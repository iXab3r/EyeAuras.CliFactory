import assert from "node:assert/strict";
import { after, afterEach, before, test } from "node:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { currentUser, deleteObject, readNullableObject, readObject } from "../src/client.js";

const server = setupServer();
before(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
after(() => server.close());
const connection = { baseUrl: "https://youtrack.example.com", token: "synthetic-token" };
const limit = 8 * 1024 * 1024;
const failure = "YouTrack response stream failed, exceeded 8 MiB, or was cancelled.";
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

test("YouTrack keeps Response.text BOM removal and split UTF-8 through MSW", async () => {
  server.use(http.get("*/api/users/me", () => new HttpResponse(new ReadableStream({
    start(controller) {
      for (const byte of Buffer.from('\uFEFF{"id":"fixture","login":"€ 😀"}')) {
        controller.enqueue(Uint8Array.of(byte));
      }
      controller.close();
    },
  }))));
  assert.deepEqual(await currentUser(connection), { id: "fixture", login: "€ 😀" });
});

test("YouTrack accepts an exact 8 MiB JSON response and rejects actual overflow", async () => {
  const text = '{"id":"' + "x".repeat(limit - 9) + '"}';
  assert.equal(Buffer.byteLength(text), limit);
  server.use(http.get("*/api/issues/fixture", () => new HttpResponse(body(Buffer.from(text)))));
  const result = await readObject(connection, "api/issues/fixture", {});
  assert.equal(typeof result.id === "string" ? result.id.length : -1, limit - 9);
  server.use(http.get("*/api/issues/fixture", () => new HttpResponse(body(new Uint8Array(limit + 1)))));
  await assert.rejects(readObject(connection, "api/issues/fixture", {}), safeFailure);
});

test("YouTrack rejects invalid, understated, truncated and excessive declared lengths", async () => {
  for (const length of ["synthetic-private", "1", "3", String(limit + 1)]) {
    server.use(http.get("*/api/issues/fixture", () => new HttpResponse("{}", {
      headers: { "content-length": length },
    })));
    await assert.rejects(readObject(connection, "api/issues/fixture", {}), safeFailure);
  }
});

test("YouTrack preserves empty mutation, null read and invalid JSON semantics", async () => {
  for (const value of [null, "", " \n "]) {
    server.use(http.delete("*/api/issues/fixture", () => new HttpResponse(value)));
    assert.equal(await deleteObject(connection, "api/issues/fixture"), null);
  }
  server.use(http.delete("*/api/issues/fixture", () => HttpResponse.json(null)));
  await assert.rejects(deleteObject(connection, "api/issues/fixture"), /invalid mutation response/);
  server.use(http.get("*/api/issues/fixture", () => HttpResponse.json(null)));
  assert.equal(await readNullableObject(connection, "api/issues/fixture", {}), null);
  server.use(http.get("*/api/issues/fixture", () => new HttpResponse("synthetic-private-invalid-json")));
  await assert.rejects(readObject(connection, "api/issues/fixture", {}), /^Error: YouTrack returned an invalid JSON response\.$/);
});

test("YouTrack stream failure and pending abort hide causes and release locks", async () => {
  for (const abort of [false, true]) {
    const controller = new AbortController();
    const input = new Response(new ReadableStream<Uint8Array>({
      start(stream) { if (!abort) stream.error(new Error("synthetic-private-stream")); },
    }));
    const pending = currentUser({ ...connection, fetch: async () => input, signal: controller.signal });
    if (abort) controller.abort(new Error("synthetic-private-abort"));
    await assert.rejects(pending, safeFailure);
    assert.equal(input.body?.locked, false);
  }
});

test("YouTrack non-success cancels diagnostics and preserves safe Retry-After", async () => {
  let cancelled = 0;
  const input = new Response(new ReadableStream<Uint8Array>({
    cancel() { cancelled++; return Promise.reject(new Error("synthetic-private-cancel")); },
  }), { status: 429, headers: { "retry-after": "3" } });
  await assert.rejects(currentUser({ ...connection, fetch: async () => input }),
    /^Error: YouTrack request failed \(HTTP 429\)\. Retry after 3 seconds\.$/);
  assert.equal(cancelled, 1);
  assert.equal(input.body?.locked, false);
});

test("YouTrack MSW response clone does not block bounded cancellation", { timeout: 5000 }, async () => {
  server.use(http.get("*/api/users/me", () => new HttpResponse(body(new Uint8Array(limit + 1)))));
  let input: Response | undefined;
  let sibling: Response | undefined;
  try {
    await assert.rejects(currentUser({
      ...connection,
      fetch: async (url, init) => {
        input = await fetch(url, init);
        sibling = input.clone();
        return input;
      },
    }), safeFailure);
    assert.equal(input?.body?.locked, false);
  } finally {
    void sibling?.body?.cancel().catch(() => undefined);
  }
});