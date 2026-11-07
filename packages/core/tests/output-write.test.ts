import assert from "node:assert/strict";
import { once } from "node:events";
import { Readable, Writable } from "node:stream";
import test from "node:test";
import { CliError, createCli, localCommand, streamResult } from "../src/index.js";
import { createCliFixture } from "../src/testing.js";

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}
const nativeError = (code: string) => Object.assign(new Error(`Synthetic write ${code}`), { code });

for (const argv of [["--help"], ["value", "--json"], ["--json-rpc"]]) {
  test(`run awaits a small write and reports unrelated EIO: ${argv.join(" ")}`, { timeout: 5000 }, async t => {
    const f = await createCliFixture(t, { applicationId: "output-cli" });
    const started = deferred(), callback = deferred<(error?: Error | null) => void>();
    const output = new Writable({ write(_chunk, _encoding, done) { callback.resolve(done); started.resolve(); } });
    const app = f.createApplication(runtime => createCli({ name: "output-cli", description: "Fixture", runtime,
      commands: [localCommand("value", "Return a value", () => ({ ok: true }))],
    }));
    const input = Readable.from([JSON.stringify({ jsonrpc: "2.0", id: 1, method: "cli.execute", params: { argv: ["value"] } }) + "\n"]);
    let settled = false;
    const running = f.run(app, argv, { output, input });
    void running.then(() => { settled = true; });
    await started.promise;
    assert.equal(settled, false);
    assert.equal(output.writableNeedDrain, false, "Failure occurs below the high-water mark.");
    (await callback.promise)(nativeError("EIO"));
    const result = await running;
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /EIO/);
    assert.doesNotMatch(result.stderr, /\n\s+at /);
    assert.equal(output.listenerCount("error"), 0);
    assert.equal(output.listenerCount("close"), 0);
  });
}

test("an EPIPE from the handler remains an ordinary error and no process listeners are installed", async t => {
  const before = [process.stdout.listenerCount("error"), process.stderr.listenerCount("error"), process.listenerCount("uncaughtException")];
  const f = await createCliFixture(t, { applicationId: "output-cli" });
  const app = f.createApplication(runtime => createCli({ name: "output-cli", description: "Fixture", runtime,
    commands: [localCommand("fail", "Fail the command", () => { throw nativeError("EPIPE"); })],
  }));
  const result = await f.run(app, ["fail", "--json"]);
  assert.equal(result.exitCode, 1);
  assert.equal(JSON.parse(result.stderr).error.cause.code, "EPIPE");
  await app.dispose();
  assert.deepEqual([process.stdout.listenerCount("error"), process.stderr.listenerCount("error"), process.listenerCount("uncaughtException")], before);
});

for (const rpc of [false, true]) for (const cleanupFails of [false, true]) {
  test(`broken pipe awaits iterator cleanup; RPC=${rpc}, cleanup failure=${cleanupFails}`, { timeout: 5000 }, async t => {
    const f = await createCliFixture(t, { applicationId: "output-cli" });
    const cleaning = deferred(), release = deferred(), pending = deferred();
    let signal: AbortSignal | undefined, settled = false;
    const app = f.createApplication(runtime => createCli({ name: "output-cli", description: "Fixture", runtime,
      commands: [localCommand("items", "List items", () => streamResult(async function* (owned) {
        signal = owned;
        try {
          yield 1;
          if (rpc) { pending.resolve(); await once(owned, "abort"); owned.throwIfAborted(); }
        }
        finally { cleaning.resolve(); await release.promise; if (cleanupFails) throw new Error("Synthetic iterator cleanup failed."); }
      }))],
    }));
    const output = new Writable({ write(_chunk, _encoding, done) { done(nativeError("EPIPE")); } });
    const input = Readable.from([JSON.stringify({ jsonrpc: "2.0", id: 1, method: "cli.execute", params: { argv: ["items"] } }) + "\n"]);
    const running = f.run(app, rpc ? ["--json-rpc"] : ["items", "--json"], { output, input });
    void running.then(() => { settled = true; });
    if (rpc) { await pending.promise; output.destroy(nativeError("EPIPE")); }
    await cleaning.promise;
    assert.equal(signal?.aborted, true);
    assert.equal(settled, false);
    release.resolve();
    const result = await running;
    assert.equal(result.exitCode, cleanupFails ? 1 : 141);
    if (cleanupFails) {
      assert.match(result.stderr, rpc ? /Stream consumption and cleanup failed/ : /Synthetic iterator cleanup failed/);
      assert.match(result.stderr, /EPIPE/);
    } else assert.equal(result.stderr, "");
    assert.equal(output.listenerCount("error"), 0);
  });
}

test("cancelling an ordinary write returns 130 and retains ownership of a late EPIPE", { timeout: 5000 }, async t => {
  const f = await createCliFixture(t, { applicationId: "output-cli" });
  const callback = deferred<(error?: Error | null) => void>();
  const output = new Writable({ write(_chunk, _encoding, done) { callback.resolve(done); } });
  const app = f.createApplication(runtime => createCli({ name: "output-cli", description: "Fixture", runtime, commands: [] }));
  const abort = new AbortController();
  const running = f.run(app, ["--help"], { output, signal: abort.signal });
  const done = await callback.promise;
  abort.abort();
  assert.equal((await running).exitCode, 130);
  assert.equal(output.destroyed, false);
  assert.ok(output.listenerCount("error") > 0);
  const closed = new Promise<void>(resolve => output.once("close", resolve));
  done(nativeError("EPIPE"));
  await closed;
  assert.equal(output.listenerCount("error"), 0);
  assert.equal(output.listenerCount("close"), 0);
});

test("diagnostic write failures reject rather than disappearing", async t => {
  const f = await createCliFixture(t, { applicationId: "output-cli" });
  const app = f.createApplication(runtime => createCli({ name: "output-cli", description: "Fixture", runtime, commands: [] }));
  const error = new Writable({ write(_chunk, _encoding, done) { done(nativeError("EIO")); } });
  await assert.rejects(f.run(app, ["--unknown"], { error }), { code: "EIO" });
  assert.equal(error.listenerCount("error"), 0);
});

test("an interrupted failed outcome retains its result and diagnostic code", async t => {
  const f = await createCliFixture(t, { applicationId: "output-cli" });
  const abort = new AbortController();
  const app = f.createApplication(runtime => createCli({ name: "output-cli", description: "Fixture", runtime,
    commands: [localCommand("wait", "Wait for an outcome", () => {
      abort.abort();
      throw new CliError("The operation was interrupted.", { code: "operation.interrupted", result: { outcome: "interrupted" } });
    })],
  }));
  const result = await f.run(app, ["wait", "--json"], { signal: abort.signal });
  assert.equal(result.exitCode, 130);
  assert.deepEqual(JSON.parse(result.stdout), { outcome: "interrupted" });
  assert.equal(JSON.parse(result.stderr).error.code, "operation.interrupted");
});
