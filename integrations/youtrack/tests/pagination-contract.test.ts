import assert from "node:assert/strict";
import { after, afterEach, before, test } from "node:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { configuredFixture, fixture } from "./cli-fixture.js";
import { listIssues } from "../src/client.js";

const server = setupServer();
before(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
after(() => server.close());

test("one-page reads retain unknown completeness without lookahead, including capped short pages", async () => {
  const connection = { baseUrl: "https://youtrack.example.test/context", token: "synthetic-token" };
  let calls = 0;
  server.use(http.get("*/context/api/issues", ({ request }) => {
    calls++;
    const query = new URL(request.url).searchParams;
    assert.equal(query.get("$skip"), "7");
    return HttpResponse.json(query.get("$top") === "0" ? [] : [{ summary: "No stable ID" }]);
  }));
  assert.deepEqual(await listIssues(connection, { pageSize: 1000, start: 7, fields: "summary" }), {
    count: 1, items: [{ summary: "No stable ID" }], hasMore: null, nextStart: 8,
  });
  assert.equal(calls, 1);
  assert.deepEqual(await listIssues(connection, { pageSize: 0, start: 7 }), {
    count: 0, items: [], hasMore: null, nextStart: null,
  });
  assert.equal(calls, 2);
});

test("invalid complete-mode combinations and offset overflow precede onboarding and credentials", async t => {
  const f = await fixture(t);
  f.secrets.get = async () => assert.fail("credentials");
  Object.assign(f.runtime.input, { isTTY: true, setRawMode: () => assert.fail("prompt") });
  Object.assign(f.runtime.output, { isTTY: true });
  Object.assign(f.runtime.error, { isTTY: true });
  const cases = [
    { argv: ["issues", "list", "--all"], message: /go together/ },
    { argv: ["issues", "list", "--max-results", "1"], message: /go together/ },
    { argv: ["issues", "list", "--all", "--max-results", "1", "--page-size", "0"], message: /positive with --all/ },
    { argv: ["project", "list", "--start", String(Number.MAX_SAFE_INTEGER), "--page-size", "1"], message: /safe integer/ },
  ];
  for (const { argv, message } of cases) {
    await assert.rejects(f.cli.execute(argv), message);
    for (const extra of [[], ["--json"]]) {
      const result = await f.run(f.cli, [...argv, ...extra]);
      assert.equal(result.exitCode, 1);
      assert.equal(result.stdout, "");
      assert.match(result.stderr, message);
    }
  }
  const replies = await f.rpc(f.cli, cases.map(row => row.argv)) as { error: { message: string } }[];
  replies.forEach((reply, i) => assert.match(reply.error.message, cases[i]!.message));
});

test("superseded offset flag names are rejected without aliases", async t => {
  const f = await fixture(t);
  for (const flag of ["--top", "--skip"]) {
    await assert.rejects(f.cli.execute(["project", "list", flag, "1"]), /unknown option/);
  }
});

test("the maximum safe result budget never generates an unsafe proof-row count", async () => {
  const sizes: string[] = [];
  server.use(http.get("*/api/issues", ({ request }) => {
    sizes.push(new URL(request.url).searchParams.get("$top")!);
    return HttpResponse.json([]);
  }));
  assert.deepEqual(await listIssues({ baseUrl: "https://youtrack.example.test", token: "synthetic-token" }, {
    pageSize: Number.MAX_SAFE_INTEGER, maxResults: Number.MAX_SAFE_INTEGER,
  }), { count: 0, items: [], hasMore: false, nextStart: null });
  assert.deepEqual(sizes, [String(Number.MAX_SAFE_INTEGER)]);
});

test("complete-selection failures return no successful rows in JSON, execute or RPC", async t => {
  const f = await configuredFixture(t);
  let calls = 0;
  server.use(http.get("*/context/api/issues", ({ request }) => {
    calls++;
    return new URL(request.url).searchParams.get("$skip") === "0"
      ? HttpResponse.json([{ id: "synthetic-issue" }])
      : new HttpResponse("synthetic-private-body", { status: 503 });
  }));
  const argv = ["issues", "list", "--all", "--max-results", "2", "--page-size", "1"];
  await assert.rejects(f.cli.execute(argv), error => {
    assert.equal((error as { result?: unknown }).result, undefined);
    assert.match((error as Error).message, /HTTP 503/);
    return true;
  });
  const result = await f.run(f.cli, [...argv, "--json"]);
  assert.equal(result.exitCode, 1);
  assert.equal(result.stdout, "");
  assert.doesNotMatch(result.stderr, /synthetic-private-body/);
  const [reply] = await f.rpc(f.cli, [argv]) as { error: { data: { result?: unknown } } }[];
  assert.equal(reply!.error.data.result, undefined);
  assert.equal(calls, 6);
});

test("complete traversal keeps profile endpoint and token fixed across pages and RPC invocations", async t => {
  const f = await configuredFixture(t);
  await f.cli.execute(["profile", "create", "other", "--url", "https://other.example.test/context"]);
  await f.secrets.set("ai-cli-factory:youtrack-cli", "other:token", "synthetic-other");
  const seen: string[] = [];
  server.use(http.get("*/context/api/issues", ({ request }) => {
    const url = new URL(request.url);
    const other = url.hostname === "other.example.test";
    assert.equal(request.headers.get("authorization"), other ? "Bearer synthetic-other" : "Bearer synthetic-token");
    assert.equal(url.searchParams.get("query"), "project: SYNTHETIC");
    const offset = Number(url.searchParams.get("$skip"));
    seen.push(`${other ? "other" : "dev"}:${offset}`);
    return HttpResponse.json(offset === 0 ? [{ id: other ? "other-issue" : "dev-issue" }] : []);
  }));
  const argv = ["issues", "list", "--all", "--max-results", "1", "--query", "project: SYNTHETIC"];
  const replies = await f.rpc(f.cli, [argv, [...argv, "--profile", "other"]]) as { result: unknown }[];
  assert.deepEqual(replies.map(reply => reply.result), ["dev-issue", "other-issue"].map(id => ({
    count: 1, items: [{ id }], hasMore: false, nextStart: null,
  })));
  assert.deepEqual(seen, ["dev:0", "dev:1", "other:0", "other:1"]);
});
