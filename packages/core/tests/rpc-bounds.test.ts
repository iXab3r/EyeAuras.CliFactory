import assert from "node:assert/strict";
import test from "node:test";
import { PassThrough, Readable, Writable } from "node:stream";
import { runJsonRpc } from "../src/json-rpc.js";
import { validateArgv } from "../src/input-limits.js";

test("common argv limits cover counts, UTF-8 bytes and aggregate size", () => {
  validateArgv(["a".repeat(8192)]);
  assert.throws(() => validateArgv(["a".repeat(8193)]), /byte/);
  assert.throws(() => validateArgv(["я".repeat(4097)]), /byte/);
  assert.throws(() => validateArgv(Array(257).fill("a")), /count/);
  assert.throws(() => validateArgv(Array(5).fill("a".repeat(8192))), /byte/);
});

const request = (argv: string[]) =>
  JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "cli.execute",
    params: { argv },
  }) + "\n";
function output() {
  let text = "";
  return {
    stream: new Writable({
      write(chunk, _encoding, done) {
        text += chunk;
        done();
      },
    }),
    text: () => text,
  };
}
test("RPC rejects oversized argv without executing or echoing its contents", async () => {
  const out = output();
  let calls = 0;
  await runJsonRpc({
    input: Readable.from([request(["synthetic-private-value".repeat(500)])]),
    output: out.stream,
    execute: async () => {
      calls++;
    },
  });
  assert.equal(calls, 0);
  assert.equal(JSON.parse(out.text()).error.code, -32602);
  assert.doesNotMatch(out.text(), /synthetic-private-value/);
});
test("unterminated oversized RPC line fails before EOF without destroying input", async () => {
  const input = new PassThrough();
  const out = output();
  const running = runJsonRpc({
    input,
    output: out.stream,
    signal: AbortSignal.timeout(1500),
    execute: async () => assert.fail("must not execute"),
  });
  input.write(Buffer.alloc(262145, 32));
  await assert.rejects(running, /line.*limit/i);
  assert.equal(input.destroyed, false);
  input.destroy();
});
test("RPC reads UTF-8 fragments and final lines without newline", async () => {
  const out = output();
  const bytes = Buffer.from(request(["привет"]).trimEnd());
  await runJsonRpc({
    input: Readable.from([...bytes].map((b) => Buffer.from([b]))),
    output: out.stream,
    execute: async (argv) => argv,
  });
  assert.deepEqual(JSON.parse(out.text()).result, ["привет"]);
});
test("RPC applies backpressure while an earlier request executes", async () => {
  const input = new PassThrough({ highWaterMark: 32 }),
    out = output();
  let release!: () => void, started!: () => void;
  const entered = new Promise<void>((r) => {
    started = r;
  });
  const held = new Promise<void>((r) => {
    release = r;
  });
  let calls = 0;
  const pending = runJsonRpc({
    input,
    output: out.stream,
    execute: async () => {
      if (++calls === 1) {
        started();
        await held;
      }
      return calls;
    },
  });
  input.write(request(["first"]));
  await entered;
  input.write(request(["second"]));
  await new Promise((r) => setImmediate(r));
  assert.ok(input.readableLength > 0);
  input.end();
  release();
  await pending;
  assert.equal(calls, 2);
});

test("RPC waits for slow output before executing the next request", async () => {
  let completeWrite!: () => void, entered!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  let writes = 0,
    calls = 0;
  const out = new Writable({
    highWaterMark: 1,
    write(_chunk, _encoding, done) {
      if (++writes === 1) {
        completeWrite = done;
        entered();
      } else done();
    },
  });
  const running = runJsonRpc({
    input: Readable.from([request(["first"]) + request(["second"])]),
    output: out,
    execute: async () => ++calls,
  });
  await started;
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls, 1);
  completeWrite();
  await running;
  assert.equal(calls, 2);
});

test("closing a blocked RPC output does not leave the invocation waiting for drain", async () => {
  let entered!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const out = new Writable({
    highWaterMark: 1,
    write() {
      entered();
    },
  });
  const running = runJsonRpc({
    input: Readable.from([request(["first"])]),
    output: out,
    execute: async () => 1,
  });
  await started;
  out.destroy();
  await assert.rejects(running, /aborted/i);
  assert.equal(out.listenerCount("drain"), 0);
  assert.equal(out.listenerCount("close"), 0);
});

test("RPC cancellation detaches a slow output without destroying it", async () => {
  let entered!: () => void, completeWrite!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const abort = new AbortController();
  const out = new Writable({
    highWaterMark: 1,
    write(_chunk, _encoding, done) {
      completeWrite = done;
      entered();
    },
  });
  const running = runJsonRpc({
    input: Readable.from([request(["first"])]),
    output: out,
    signal: abort.signal,
    execute: async () => 1,
  });
  await started;
  abort.abort();
  await assert.rejects(running, /aborted/i);
  assert.equal(out.listenerCount("drain"), 0);
  assert.equal(out.destroyed, false);
  completeWrite();
});
