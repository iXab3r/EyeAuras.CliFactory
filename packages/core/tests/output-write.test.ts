import assert from "node:assert/strict";
import { once } from "node:events";
import { Readable, Writable } from "node:stream";
import test from "node:test";
import { CliError, command, createCli, localCommand, streamResult } from "../src/index.js";
import { createCliFixture } from "../src/testing.js";
import { runJsonRpc } from "../src/json-rpc.js";

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

for (const declare of [localCommand, command]) for (const code of ["EPIPE", "EIO"]) {
  test(`${declare.name}: a failed result write (${code}) preserves the handler failure`, async t => {
    const f = await createCliFixture(t, { applicationId: "output-cli", profiles: [{ name: "default" }] });
    const app = f.createApplication(runtime => createCli({ name: "output-cli", description: "Fixture", runtime,
      commands: [declare("fail", "Fail the command", () => {
        throw new CliError("Synthetic handler failed.", { code: "handler.failure", result: { outcome: "failed" }, next: [["--help"]] });
      })],
    }));
    const output = new Writable({ write(_chunk, _encoding, done) { done(nativeError(code)); } });
    const result = await f.run(app, ["fail", "--json"], { output });
    assert.equal(result.exitCode, 1);
    const failure = JSON.parse(result.stderr).error;
    assert.equal(failure.code, "handler.failure");
    assert.equal(failure.message, "Synthetic handler failed.");
    assert.deepEqual(failure.result, { outcome: "failed" });
    assert.deepEqual(failure.next, [declare === command ? ["--help", "--profile", "default"] : ["--help"]]);
    assert.equal(failure.cause.name, "AggregateError");
    assert.match(JSON.stringify(failure.cause), new RegExp(code));
    assert.equal(output.listenerCount("error"), 0);
  });
}

for (const code of ["EPIPE", "EIO"]) {
  test(`an RPC error-frame write (${code}) preserves the handler failure`, async t => {
    const f = await createCliFixture(t, { applicationId: "output-cli" });
    const app = f.createApplication(runtime => createCli({ name: "output-cli", description: "Fixture", runtime,
      commands: [localCommand("fail", "Fail the command", () => {
        throw new CliError("Synthetic RPC handler failed.", { code: "handler.failure" });
      })],
    }));
    const output = new Writable({ write(_chunk, _encoding, done) { done(nativeError(code)); } });
    const input = Readable.from([JSON.stringify({ jsonrpc: "2.0", id: 1, method: "cli.execute", params: { argv: ["fail"] } }) + "\n"]);
    const result = await f.run(app, ["--json-rpc"], { output, input });
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /Synthetic RPC handler failed/);
    assert.match(result.stderr, /response could not be written/);
    assert.equal(output.listenerCount("error"), 0);
    await assert.rejects(runJsonRpc({
      input: Readable.from([JSON.stringify({ jsonrpc: "2.0", id: 1, method: "cli.execute", params: { argv: ["fail"] } }) + "\n"]),
      output: new Writable({ write(_chunk, _encoding, done) { done(nativeError(code)); } }),
      execute: async () => { throw new CliError("Synthetic RPC handler failed.", { code: "handler.failure" }); },
    }), (error: unknown) => {
      assert.ok(error instanceof CliError);
      assert.equal(error.code, "handler.failure");
      assert.ok(error.cause instanceof AggregateError);
      const writeFailure = error.cause.errors[1];
      assert.equal((code === "EPIPE" ? writeFailure.cause : writeFailure).code, code);
      return true;
    });
  });
}

for (const diagnostic of [false, true]) {
  test(`cancellation releases a stalled ${diagnostic ? "diagnostic" : "failed-result"} write and owns its late error`, { timeout: 5000 }, async t => {
    const f = await createCliFixture(t, { applicationId: "output-cli" });
    const callback = deferred<(error?: Error | null) => void>();
    const stalled = new Writable({ write(_chunk, _encoding, done) { callback.resolve(done); } });
    const abort = new AbortController();
    const app = f.createApplication(runtime => createCli({ name: "output-cli", description: "Fixture", runtime,
      commands: [localCommand("fail", "Fail the command", () => {
        throw new CliError("Synthetic handler failed.", { code: "handler.failure", result: { outcome: "failed" } });
      })],
    }));
    const running = f.run(app, ["fail", "--json"], {
      signal: abort.signal, ...(diagnostic ? { error: stalled } : { output: stalled }),
    });
    const done = await callback.promise;
    abort.abort();
    const result = await running;
    assert.equal(result.exitCode, 130);
    if (!diagnostic) {
      const failure = JSON.parse(result.stderr).error;
      assert.equal(failure.code, "handler.failure");
      assert.deepEqual(failure.result, { outcome: "failed" });
    }
    assert.equal(stalled.destroyed, false);
    assert.ok(stalled.listenerCount("error") > 0);
    const closed = new Promise<void>(resolve => stalled.once("close", resolve));
    done(nativeError(diagnostic ? "EIO" : "EPIPE"));
    await closed;
    assert.equal(stalled.listenerCount("error"), 0);
    assert.equal(stalled.listenerCount("close"), 0);
  });
}
