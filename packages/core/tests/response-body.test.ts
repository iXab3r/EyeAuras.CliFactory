import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { gzipSync } from "node:zlib";
import { readBoundedResponseBody } from "../src/response-body.js";

const failure = "Response body failed, exceeded its byte bound, or was cancelled.";
function safeFailure(error: unknown): boolean {
  assert.ok(error instanceof Error);
  assert.equal(error.message, failure);
  assert.equal(error.cause, undefined);
  return true;
}
function response(chunks: Uint8Array[], headers: Record<string, string> = {}): Response {
  return new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  }), { headers });
}

test("bounded bytes retain split UTF-8 and BOM without selecting a decoder", async () => {
  const expected = Buffer.from("\uFEFFfixture € 😀", "utf8");
  const input = response([...expected].map((byte) => Uint8Array.of(byte)));
  assert.deepEqual(Buffer.from(await readBoundedResponseBody(input, { maxBytes: expected.length })), expected);
  assert.equal(input.body?.locked, false);
});

test("absent and empty bodies succeed, including a declared zero length", async () => {
  for (const input of [new Response(null), response([]), response([], { "content-length": "0" })]) {
    assert.equal((await readBoundedResponseBody(input, { maxBytes: 1 })).byteLength, 0);
    assert.equal(input.body?.locked ?? false, false);
  }
});

test("bounds validate safe integers and count chunked actual bytes", async () => {
  for (const maxBytes of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    const input = response([Uint8Array.of(1)]);
    await assert.rejects(readBoundedResponseBody(input, { maxBytes }), safeFailure);
    assert.equal(input.body?.locked, false);
  }
  const input = response([Uint8Array.of(1, 2), Uint8Array.of(3, 4)]);
  await assert.rejects(readBoundedResponseBody(input, { maxBytes: 3 }), safeFailure);
  assert.equal(input.body?.locked, false);
});

test("declared lengths reject invalid, excessive, understated and truncated bodies", async () => {
  for (const length of ["", "-1", "+2", "1.5", "2e0", "synthetic-private", "9007199254740992", "5", "1", "3"]) {
    const input = response([Uint8Array.of(1, 2)], { "content-length": length });
    await assert.rejects(readBoundedResponseBody(input, { maxBytes: 4 }), safeFailure);
    assert.equal(input.body?.locked, false);
  }
  await assert.rejects(readBoundedResponseBody(new Response(null, {
    headers: { "content-length": "1" },
  }), { maxBytes: 4 }), safeFailure);
  const exact = response([Uint8Array.of(1, 2)], { "content-length": "02", "content-encoding": "IDENTITY" });
  assert.equal((await readBoundedResponseBody(exact, { maxBytes: 2 })).byteLength, 2);
});

test("encoded length is syntax-checked but only decoded bytes count toward the bound", async () => {
  const headers = { "content-length": "1", "content-encoding": "gzip" };
  assert.equal((await readBoundedResponseBody(response([Uint8Array.of(1, 2)], headers), { maxBytes: 2 })).byteLength, 2);
  await assert.rejects(readBoundedResponseBody(response([Uint8Array.of(1, 2, 3)], headers), { maxBytes: 2 }), safeFailure);
  assert.equal((await readBoundedResponseBody(response([], {
    ...headers, "content-length": "3",
  }), { maxBytes: 2 })).byteLength, 0);
  for (const length of ["synthetic-private", "9007199254740992"]) {
    await assert.rejects(readBoundedResponseBody(response([], {
      ...headers, "content-length": length,
    }), { maxBytes: 2 }), safeFailure);
  }
});

test("pre-abort and pending-read abort cancel and unlock without disclosing reasons", async () => {
  for (const before of [true, false]) {
    const controller = new AbortController();
    let cancelled = 0;
    const input = new Response(new ReadableStream<Uint8Array>({
      cancel() {
        cancelled++;
        return Promise.reject(new Error("synthetic-private-cancellation"));
      },
    }));
    if (before) controller.abort(new Error("synthetic-private-abort"));
    const pending = readBoundedResponseBody(input, { maxBytes: 4, signal: controller.signal });
    if (!before) controller.abort(new Error("synthetic-private-abort"));
    await assert.rejects(pending, safeFailure);
    assert.equal(cancelled, 1);
    assert.equal(input.body?.locked, false);
  }
});

test("abort during a chunk and stream failures release ownership with static errors", async () => {
  const controller = new AbortController();
  const aborted = new Response(new ReadableStream<Uint8Array>({
    pull(stream) {
      stream.enqueue(Uint8Array.of(1));
      controller.abort(new Error("synthetic-private-abort"));
    },
  }));
  await assert.rejects(readBoundedResponseBody(aborted, { maxBytes: 4, signal: controller.signal }), safeFailure);
  assert.equal(aborted.body?.locked, false);
  const failed = new Response(new ReadableStream<Uint8Array>({
    start(stream) { stream.error(new Error("synthetic-private-stream")); },
  }));
  await assert.rejects(readBoundedResponseBody(failed, { maxBytes: 4 }), safeFailure);
  assert.equal(failed.body?.locked, false);
});

test("an unread tee sibling cannot block overflow cancellation or lock release", { timeout: 2000 }, async () => {
  const [body, sibling] = new ReadableStream<Uint8Array>({
    pull(controller) { controller.enqueue(new Uint8Array(4)); },
  }).tee();
  const input = new Response(body);
  try {
    await assert.rejects(readBoundedResponseBody(input, { maxBytes: 3 }), safeFailure);
    assert.equal(body.locked, false);
  } finally {
    await sibling.cancel();
  }
});

test("native fetch enforces decoded limits for actual compressed local HTTP responses", async (t) => {
  const tiny = Buffer.from("x");
  const small = Buffer.from("fixture € ".repeat(20));
  const large = Buffer.from("fixture ".repeat(1024));
  const server = createServer((request, result) => {
    const encoded = gzipSync(request.url === "/tiny" ? tiny : request.url === "/large" ? large : small);
    result.writeHead(200, { "content-encoding": "gzip", "content-length": encoded.length });
    result.end(encoded);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const url = `http://127.0.0.1:${address.port}`;
  const overhead = await fetch(url + "/tiny");
  assert.ok(Number(overhead.headers.get("content-length")) > tiny.length);
  assert.deepEqual(Buffer.from(await readBoundedResponseBody(overhead, { maxBytes: tiny.length })), tiny);
  assert.equal(overhead.body?.locked, false);
  const good = await fetch(url + "/small");
  assert.notEqual(Number(good.headers.get("content-length")), small.length);
  assert.deepEqual(Buffer.from(await readBoundedResponseBody(good, { maxBytes: small.length })), small);
  assert.equal(good.body?.locked, false);
  const oversized = await fetch(url + "/large");
  assert.ok(Number(oversized.headers.get("content-length")) < 1024);
  await assert.rejects(readBoundedResponseBody(oversized, { maxBytes: 1024 }), safeFailure);
  assert.equal(oversized.body?.locked, false);
});
test("owned accumulation handles empty chunks and a producer reusing one-byte storage", async () => {
  const reusable = new Uint8Array(1);
  let index = 0;
  const input = new Response(new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index === 300) {
        controller.close();
      } else if (index++ % 3 === 0) {
        controller.enqueue(new Uint8Array(0));
      } else {
        reusable[0] = index % 256;
        controller.enqueue(reusable);
      }
    },
  }, { highWaterMark: 0 }));
  const expected = Array.from({ length: 300 }, (_, i) => i)
    .filter((i) => i % 3 !== 0).map((i) => (i + 1) % 256);
  assert.deepEqual([...await readBoundedResponseBody(input, { maxBytes: expected.length })], expected);
  assert.equal(input.body?.locked, false);
});
