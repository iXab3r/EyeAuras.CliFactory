import assert from "node:assert/strict";
import test from "node:test";
import { PassThrough, Readable, Writable } from "node:stream";
import { runJsonRpc } from "../src/json-rpc.js";
import { validateArgv } from "../src/argv.js";

test("argv validates types without restricting content size or count", () => {
  validateArgv(["я".repeat(300_000), ...Array(300).fill("argument")]);
  for (const invalid of [null, {}, "argv", [1], [null], Array(2)])
    assert.throws(() => validateArgv(invalid), /array|strings/);
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
test("RPC rejects non-string argv without executing or echoing its contents", async () => {
  const out = output();
  let calls = 0;
  await runJsonRpc({
    input: Readable.from([request([{"synthetic-private-value": true} as unknown as string])]),
    output: out.stream,
    execute: async () => {
      calls++;
    },
  });
  assert.equal(calls, 0);
  assert.equal(JSON.parse(out.text()).error.code, -32602);
  assert.doesNotMatch(out.text(), /synthetic-private-value/);
});
test("unterminated large RPC input remains cancellable without destroying input", async () => {
  const input = new PassThrough();
  const out = output();
  const abort = new AbortController();
  const running = runJsonRpc({ input, output: out.stream, signal: abort.signal,
    execute: async () => assert.fail("must not execute") });
  input.write(Buffer.alloc(300_000, 32));
  await new Promise(resolve => setImmediate(resolve));
  abort.abort();
  await assert.rejects(running, /cancelled/i);
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


test("RPC preserves Unicode content beyond the former argument and aggregate limits", async () => {
  const argv = ["--body", JSON.stringify({ description: "Описание\n".repeat(60_000) })];
  const out = output();
  await runJsonRpc({ input: Readable.from([request(argv)]), output: out.stream,
    execute: async value => { assert.deepEqual(value, argv); return "accepted"; } });
  assert.equal(JSON.parse(out.text()).result, "accepted");
});
