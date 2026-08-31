import assert from "node:assert/strict";
import test from "node:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { RandomHttpClient } from "../src/client.js";

const endpoint = "https://random.test";
const server = setupServer();
const client = () => new RandomHttpClient({ url: endpoint, contact: "operator@example.com" });
test.before(() => server.listen({ onUnhandledRequest: "error" }));
test.afterEach(() => server.resetHandlers());
test.after(() => server.close());

test("integers checks quota then uses the plain-text HTTP contract; duplicates are valid", async () => {
  const calls: string[] = [];
  server.use(
    http.get(`${endpoint}/quota/`, ({ request }) => {
      calls.push("quota");
      assert.equal(new URL(request.url).search, "?format=plain");
      assert.match(request.headers.get("user-agent") ?? "", /random-rest-cli\/0\.1\.0/);
      assert.match(request.headers.get("user-agent") ?? "", /operator@example\.com/);
      assert.equal(request.headers.get("authorization"), null);
      return HttpResponse.text("1000\n");
    }),
    http.get(`${endpoint}/integers/`, ({ request }) => {
      calls.push("integers");
      assert.deepEqual(Object.fromEntries(new URL(request.url).searchParams), {
        num: "3", min: "-2", max: "5", col: "1", base: "10", format: "plain", rnd: "new",
      });
      return HttpResponse.text("-2\r\n5\t5\n");
    }),
  );
  assert.deepEqual(await client().integers({ count: 3, min: -2, max: 5 }), { values: [-2, 5, 5] });
  assert.deepEqual(calls, ["quota", "integers"]);
});

test("sequence requests a permutation of the inclusive range", async () => {
  server.use(
    http.get(`${endpoint}/quota/`, () => HttpResponse.text("0\n")),
    http.get(`${endpoint}/sequences/`, ({ request }) => {
      assert.deepEqual(Object.fromEntries(new URL(request.url).searchParams), {
        min: "1", max: "3", col: "1", format: "plain", rnd: "new",
      });
      return HttpResponse.text("3\n1\n2\n");
    }),
  );
  assert.deepEqual(await client().sequence({ min: 1, max: 3 }), { values: [3, 1, 2] });
});

test("negative quota stops generation and subsequent calls back off without polling", async () => {
  let calls = 0;
  server.use(http.get(`${endpoint}/quota/`, () => { calls++; return HttpResponse.text("-1\n"); }));
  const instance = client();
  await assert.rejects(instance.integers({ count: 1, min: 1, max: 6 }), /10 minutes/);
  await assert.rejects(instance.sequence({ min: 1, max: 3 }), /10 minutes/);
  assert.equal(calls, 1);
});

test("all input validation precedes quota or generation requests", async () => {
  let calls = 0;
  const instance = new RandomHttpClient({ url: endpoint, contact: "operator@example.com",
    fetch: async () => { calls++; return new Response("0"); } });
  for (const request of [
    { count: 0, min: 1, max: 6 }, { count: 101, min: 1, max: 6 },
    { count: 1.2, min: 1, max: 6 }, { count: NaN, min: 1, max: 6 },
    { count: 1, min: 2, max: 1 }, { count: 1, min: -1_000_000_001, max: 6 },
    { count: 1, min: 1, max: Infinity },
  ]) await assert.rejects(instance.integers(request));
  await assert.rejects(instance.sequence({ min: 1, max: 101 }), /at most 100/);
  assert.equal(calls, 0);
});

test("equal bounds are rejected before HTTP for both legacy generators", async () => {
  let calls = 0;
  server.use(http.get(`${endpoint}/*`, () => {
    calls++;
    return HttpResponse.text("0");
  }));
  await assert.rejects(client().integers({ count: 3, min: 7, max: 7 }), /min must be less than max/);
  await assert.rejects(client().sequence({ min: 0, max: 0 }), /min must be less than max/);
  assert.equal(calls, 0);
});

test("malformed quota is not interpreted as permission to generate", async () => {
  for (const body of ["", "1.5", "<html>Error</html>", "9007199254740992"]) {
    server.use(http.get(`${endpoint}/quota/`, () => HttpResponse.text(body)));
    await assert.rejects(client().sequence({ min: 1, max: 3 }), /invalid quota/);
  }
});

test("HTTP, service and transport errors do not leak bodies or retry", async () => {
  for (const status of [403, 429, 503]) {
    let calls = 0;
    server.use(http.get(`${endpoint}/quota/`, () => {
      calls++; return HttpResponse.text("synthetic-private-marker", { status });
    }));
    await assert.rejects(client().sequence({ min: 1, max: 3 }), (error: Error) => {
      assert.match(error.message, new RegExp(String(status)));
      assert.doesNotMatch(error.message, /synthetic-private-marker/);
      return true;
    });
    assert.equal(calls, 1);
  }
  server.use(http.get(`${endpoint}/quota/`, () => HttpResponse.text("Error: synthetic-private-marker")));
  await assert.rejects(client().sequence({ min: 1, max: 3 }), /^Error: RANDOM\.ORG returned a service error/);
  server.use(http.get(`${endpoint}/quota/`, () => HttpResponse.error()));
  await assert.rejects(client().sequence({ min: 1, max: 3 }), /Check connectivity/);
});

test("rejects wrong counts, non-integers, out-of-range values, and duplicate sequences", async () => {
  server.use(http.get(`${endpoint}/quota/`, () => HttpResponse.text("1000")));
  for (const body of ["", "1 2", "1 2 3 4", "1 2 4", "1 1 3", "1 2 2.5", "1 2 NaN", "1 2 0x3", "1 2 3junk"]) {
    server.use(http.get(`${endpoint}/sequences/`, () => HttpResponse.text(body)));
    await assert.rejects(client().sequence({ min: 1, max: 3 }), /invalid random values/);
  }
});

test("response buffers are bounded", async () => {
  server.use(http.get(`${endpoint}/quota/`, () => HttpResponse.text("1".repeat(16_385))));
  await assert.rejects(client().sequence({ min: 1, max: 3 }), /size limit/);
});

test("cancellation aborts the actual HTTP request and prevents generation", { timeout: 5000 }, async () => {
  const controller = new AbortController();
  let announceRequest!: () => void;
  const started = new Promise<void>((resolve) => { announceRequest = resolve; });
  let releaseResponse!: () => void;
  const responseReady = new Promise<void>((resolve) => { releaseResponse = resolve; });
  let actualSignal: AbortSignal | undefined;
  server.use(http.get(`${endpoint}/quota/`, async () => {
    announceRequest();
    await responseReady;
    return HttpResponse.text("1000");
  }));
  const instance = new RandomHttpClient({ url: endpoint, contact: "operator@example.com", fetch(input, init) {
    actualSignal = init?.signal ?? undefined;
    return fetch(input, init);
  } });
  const operation = instance.sequence({ min: 1, max: 3 }, controller.signal);
  try {
    await started;
    controller.abort();
    await assert.rejects(operation, /cancelled/);
    assert.equal(actualSignal?.aborted, true);
  } finally { releaseResponse(); }
});

test("one client serializes pairs and remains usable after an error", async () => {
  const calls: string[] = [];
  server.use(
    http.get(`${endpoint}/quota/`, () => { calls.push("quota"); return HttpResponse.text("1000"); }),
    http.get(`${endpoint}/integers/`, () => { calls.push("integers"); return HttpResponse.text("Error: example"); }),
    http.get(`${endpoint}/sequences/`, () => { calls.push("sequence"); return HttpResponse.text("3 2 1"); }),
  );
  const instance = client();
  const results = await Promise.allSettled([
    instance.integers({ count: 1, min: 1, max: 3 }), instance.sequence({ min: 1, max: 3 }),
  ]);
  assert.equal(results[0]?.status, "rejected");
  assert.equal(results[1]?.status, "fulfilled");
  assert.deepEqual(calls, ["quota", "integers", "quota", "sequence"]);
});

test("rejects unsafe URL/header configuration without echoing it", () => {
  for (const url of ["http://random.test", "https://user:synthetic-private-marker@random.test", "https://random.test/?key=synthetic-private-marker", "https://random.test/path/", "bad-url"]) {
    assert.throws(() => new RandomHttpClient({ url, contact: "operator@example.com" }), (error: Error) => {
      assert.doesNotMatch(error.message, /synthetic-private-marker/);
      return true;
    });
  }
  assert.throws(() => new RandomHttpClient({ url: endpoint, contact: "operator@example.com\r\nX-Test: injected" }), /contact/);
});

test("an already cancelled call does not fetch or leak the caller's cancellation reason", async () => {
  let calls = 0;
  const instance = new RandomHttpClient({ url: endpoint, contact: "operator@example.com",
    fetch: async () => { calls++; return new Response("0"); } });
  await assert.rejects(instance.sequence({ min: 1, max: 3 }, AbortSignal.abort("synthetic-private-marker")),
    /^Error: RANDOM\.ORG request cancelled\.$/);
  assert.equal(calls, 0);
});

test("request timeout is two minutes and yields a bounded diagnostic", async (context) => {
  let requestedTimeout = 0;
  let calls = 0;
  context.mock.method(AbortSignal, "timeout", (milliseconds: number) => {
    requestedTimeout = milliseconds;
    return AbortSignal.abort(new DOMException("Synthetic timeout", "TimeoutError"));
  });
  const instance = new RandomHttpClient({ url: endpoint, contact: "operator@example.com",
    fetch: async () => { calls++; return new Response("0"); } });
  await assert.rejects(instance.sequence({ min: 1, max: 3 }), /request timed out/);
  assert.equal(requestedTimeout, 120_000);
  assert.equal(calls, 0);
});
