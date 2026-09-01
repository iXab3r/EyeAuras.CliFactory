import assert from "node:assert/strict";
import { after, afterEach, before, test } from "node:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { TeamCityClient } from "../src/client.js";

const server = setupServer();
before(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
after(() => server.close());
const baseUrl = "https://teamcity.example.com";
const connection = { baseUrl, token: "synthetic-token" };
const limit = 2 * 1024 * 1024;
const failure = "TeamCity response stream failed or exceeded2MiB; remote outcome is unknown.";
function safeFailure(error: unknown): boolean {
  assert.ok(error instanceof Error);
  assert.equal(error.message, failure);
  assert.equal(error.cause, undefined);
  return true;
}
function body(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (let offset = 0; offset < bytes.length; offset += 65536) {
        controller.enqueue(bytes.subarray(offset, offset + 65536));
      }
      controller.close();
    },
  });
}

test("TeamCity preserves BOM and split UTF-8 text through the MSW boundary", async () => {
  const expected = "\uFEFFfixture € 😀";
  server.use(http.get(baseUrl + "/app/rest/apiVersion", () => new HttpResponse(new ReadableStream({
    start(controller) {
      for (const byte of Buffer.from(expected)) controller.enqueue(Uint8Array.of(byte));
      controller.close();
    },
  }))));
  assert.deepEqual(await new TeamCityClient(connection).getApiVersion(), { version: expected });
});

test("TeamCity accepts its exact 2 MiB text bound and empty responses", async () => {
  for (const value of ["", "x".repeat(limit)]) {
    server.use(http.get(baseUrl + "/app/rest/apiVersion", () => new HttpResponse(body(Buffer.from(value)))));
    const result = await new TeamCityClient(connection).getApiVersion();
    assert.equal(result.version.length, value.length);
  }
});

test("TeamCity rejects actual overflow and bad declared lengths through MSW", async () => {
  for (const [value, length] of [
    ["fixture", "synthetic-private"], ["fixture", "1"], ["fixture", "8"],
    ["fixture", String(limit + 1)], ["x".repeat(limit + 1), undefined],
  ] as const) {
    server.use(http.get(baseUrl + "/app/rest/apiVersion", () => new HttpResponse(body(Buffer.from(value)), {
      headers: length === undefined ? {} : { "content-length": length },
    })));
    await assert.rejects(new TeamCityClient(connection).getApiVersion(), safeFailure);
  }
});

test("TeamCity stream failure and pending abort are private and release the reader", async () => {
  for (const abort of [false, true]) {
    const controller = new AbortController();
    const input = new Response(new ReadableStream<Uint8Array>({
      start(stream) { if (!abort) stream.error(new Error("synthetic-private-stream")); },
    }));
    const client = new TeamCityClient({
      ...connection, signal: controller.signal, fetch: async () => input,
    });
    const pending = client.getApiVersion();
    if (abort) controller.abort(new Error("synthetic-private-abort"));
    await assert.rejects(pending, safeFailure);
    assert.equal(input.body?.locked, false);
  }
});

test("TeamCity cancels non-success bodies without inspecting diagnostics", async () => {
  let cancelled = 0;
  const input = new Response(new ReadableStream<Uint8Array>({
    cancel() { cancelled++; },
  }), { status: 503 });
  const client = new TeamCityClient({ ...connection, fetch: async () => input });
  await assert.rejects(client.getApiVersion(), /TeamCity request failed with HTTP 503/);
  assert.equal(cancelled, 1);
  assert.equal(input.body?.locked, false);
});

test("TeamCity MSW response clone does not block bounded cancellation", { timeout: 5000 }, async () => {
  server.use(http.get(baseUrl + "/app/rest/apiVersion", () => new HttpResponse(body(new Uint8Array(limit + 1)))));
  let input: Response | undefined;
  let sibling: Response | undefined;
  const client = new TeamCityClient({
    ...connection,
    fetch: async (url, init) => {
      input = await fetch(url, init);
      sibling = input.clone();
      return input;
    },
  });
  try {
    await assert.rejects(client.getApiVersion(), safeFailure);
    assert.equal(input?.body?.locked, false);
  } finally {
    void sibling?.body?.cancel().catch(() => undefined);
  }
});