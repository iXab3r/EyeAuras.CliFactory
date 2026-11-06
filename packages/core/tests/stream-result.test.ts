import assert from "node:assert/strict";
import test from "node:test";
import { once } from "node:events";
import { Readable, Writable } from "node:stream";
import { CliError, command, createCli, localCommand, Permission, streamResult, tableView } from "../src/index.js";
import { createCliFixture } from "../src/testing.js";

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

async function fixture(t: test.TestContext) {
  return createCliFixture(t, { applicationId: "stream-cli", profiles: [{ name: "default" }, { name: "other" }] });
}

test("CLI JSON writes each item before pulling another and leaves output open", { timeout: 5000 }, async (t) => {
  const f = await fixture(t);
  const firstWrite = deferred(), continueWrite = deferred();
  let pulled = 0, closed = false, stdout = "";
  const output = new Writable({ highWaterMark: 1, write(chunk, _encoding, done) {
    stdout += chunk.toString();
    firstWrite.resolve();
    void continueWrite.promise.then(() => done());
  } });
  const app = f.createApplication(runtime => createCli({ name: "stream-cli", description: "Fixture", runtime,
    commands: [command("items", "List items", () => streamResult(async function* () {
      try { pulled++; yield { id: 1 }; pulled++; yield { id: 2 }; }
      finally { closed = true; }
    }))],
  }));
  const running = f.run(app, ["items", "--json"], { output });
  try {
    await firstWrite.promise;
    assert.equal(stdout, '{"id":1}\n');
    assert.equal(pulled, 1);
  } finally { continueWrite.resolve(); }
  assert.equal((await running).exitCode, 0);
  assert.equal(stdout, '{"id":1}\n{"id":2}\n');
  assert.equal(closed, true);
  assert.equal(output.writableEnded, false);
  assert.equal(output.destroyed, false);
});

test("human, execute and two persistent RPC requests receive profile-scoped arrays", async (t) => {
  const f = await fixture(t);
  const app = f.createApplication(runtime => createCli({ name: "stream-cli", description: "Fixture", runtime,
    commands: [command("items", "List items", (_input, context) => streamResult(async function* (signal) {
      signal.throwIfAborted();
      yield { profile: context.profile.name, id: 1 };
      yield { profile: context.profile.name, id: 2 };
    }), { view: tableView<{ profile: string; id: number }>({ columns: [{ header: "ID", value: (row) => row.id }] }) })],
  }));
  const expected = (profile: string) => [{ profile, id: 1 }, { profile, id: 2 }];
  assert.deepEqual(await app.execute(["items", "--json"]), expected("default"));
  const human = await f.run(app, ["items"]);
  assert.equal(human.exitCode, 0);
  assert.match(human.stdout, /ID\s+1\s+2/);
  const replies = await f.rpc(app, [["items", "--json", "--profile", "other"], ["items"]]);
  assert.deepEqual(replies, [
    { jsonrpc: "2.0", id: 0, result: expected("other") },
    { jsonrpc: "2.0", id: 1, result: expected("default") },
  ]);
});

test("local commands share streaming semantics and plain arrays keep one JSON value", async (t) => {
  const f = await fixture(t);
  const app = f.createApplication(runtime => createCli({ name: "stream-cli", description: "Fixture", runtime,
    commands: [
      localCommand("items", "List items", () => streamResult(async function* () { yield 1; yield null; })),
      localCommand("plain", "List plain items", () => [1, null]),
      localCommand("empty", "List no items", () => streamResult(async function* () {})),
    ],
  }));
  assert.equal((await f.run(app, ["items", "--json"])).stdout, "1\nnull\n");
  assert.deepEqual(await app.execute(["items"]), [1, null]);
  assert.equal((await f.run(app, ["plain", "--json"])).stdout, "[1,null]\n");
  assert.deepEqual(await f.run(app, ["empty", "--json"]), { exitCode: 0, stdout: "", stderr: "" });
  assert.deepEqual(await app.execute(["empty"]), []);
});

test("permissions and classification do not acquire the lazy producer", async (t) => {
  const f = await fixture(t);
  let acquired = 0;
  const lazy = streamResult(async function* () { acquired++; yield 1; });
  const app = f.createApplication(runtime => createCli({ name: "stream-cli", description: "Fixture", runtime,
    permissions: {}, commands: [command("items", "List items", () => lazy, { permission: Permission.Update })],
  }));
  assert.equal(await app.classify(["items"]), "owner");
  assert.equal(acquired, 0);
  const denied = await f.run(app, ["items", "--json"]);
  assert.equal(JSON.parse(denied.stderr).error.code, "permission.denied");
  assert.equal(acquired, 0);
  await app.execute(["permissions", "grant", "Update"]);
  assert.deepEqual(await app.execute(["items"]), [1]);
  assert.equal(acquired, 1);
});

test("the scheduling gate stays held until producer cleanup finishes", { timeout: 5000 }, async (t) => {
  const f = await fixture(t);
  const cleaning = deferred(), release = deferred();
  let followingEntered = false;
  const app = f.createApplication(runtime => createCli({ name: "stream-cli", description: "Fixture", runtime,
    concurrency: 1, commands: [
      command("items", "List items", () => streamResult(async function* () {
        try { yield 1; } finally { cleaning.resolve(); await release.promise; }
      })),
      command("following", "Run next command", () => { followingEntered = true; return true; }),
    ],
  }));
  const first = app.execute(["items"]);
  await cleaning.promise;
  const next = app.execute(["following"]);
  try { await new Promise(resolve => setImmediate(resolve)); assert.equal(followingEntered, false); }
  finally { release.resolve(); }
  assert.deepEqual(await first, [1]);
  assert.equal(await next, true);
});

// Cancellation and output failure are explicit acceptance workflows of streamResult.
for (const mode of ["interrupt", "dispose", "disconnect", "rpc-disconnect"] as const) {
  test(`${mode} aborts pending producer work and awaits cleanup`, { timeout: 5000 }, async (t) => {
    const f = await fixture(t);
    const pending = deferred(), cleaning = deferred(), release = deferred();
    const interrupt = new AbortController();
    const output = new Writable({ write(_chunk, _encoding, done) { done(); } });
    let producerSignal: AbortSignal | undefined, cleaned = false, settled = false;
    const app = f.createApplication(runtime => createCli({ name: "stream-cli", description: "Fixture", runtime,
      commands: [command("items", "List items", () => streamResult(async function* (signal) {
        producerSignal = signal;
        try { yield 1; pending.resolve(); await once(signal, "abort"); signal.throwIfAborted(); }
        finally { cleaning.resolve(); await release.promise; cleaned = true; }
      }))],
    }));
    const invocation = { output, signal: interrupt.signal,
      ...(mode === "rpc-disconnect" ? { input: Readable.from([JSON.stringify({ jsonrpc: "2.0", id: 1, method: "cli.execute", params: { argv: ["items"] } }) + "\n"]) } : {}),
    };
    const running = f.run(app, mode === "rpc-disconnect" ? ["--json-rpc"] : ["items", "--json"], invocation);
    void running.then(() => { settled = true; });
    await pending.promise;
    let disposing: Promise<void> | undefined;
    if (mode === "interrupt") interrupt.abort();
    else if (mode === "dispose") disposing = app.dispose();
    else output.destroy();
    await cleaning.promise;
    assert.equal(producerSignal?.aborted, true);
    assert.equal(settled, false);
    release.resolve();
    const result = await running;
    await disposing;
    assert.equal(cleaned, true);
    assert.equal(result.exitCode, mode === "interrupt" ? 130 : 1);
    if (mode === "interrupt" || mode === "dispose") assert.equal(output.destroyed, false);
    assert.equal(output.listenerCount("error"), 0);
    assert.equal(output.listenerCount("close"), 0);
  });
}

test("streamed failure metadata stays on stderr; execute and RPC retain its result", async (t) => {
  const f = await fixture(t);
  const metadata = { retrievedCount: 1, observedCount: 2, maxResults: 1 };
  const app = f.createApplication(runtime => createCli({ name: "stream-cli", description: "Fixture", runtime,
    commands: [command("items", "List items", () => streamResult(async function* () {
      yield { id: 1 };
      throw new CliError("Selection exceeds the result budget.", { code: "selection.budgetExceeded", result: metadata });
    }))],
  }));
  const json = await f.run(app, ["items", "--json"]);
  assert.equal(json.exitCode, 1);
  assert.equal(json.stdout, '{"id":1}\n');
  assert.deepEqual(JSON.parse(json.stderr).error.result, metadata);
  await assert.rejects(app.execute(["items"]), (error: unknown) => {
    assert.ok(error instanceof CliError);
    assert.equal(error.code, "selection.budgetExceeded");
    assert.deepEqual(error.result, metadata);
    return true;
  });
  const [reply] = await f.rpc(app, [["items"]]) as { error: { data: { result: unknown } } }[];
  assert.deepEqual(reply?.error.data.result, metadata);
});

test("serialization failure closes the iterator and preserves cleanup failure diagnostics", async (t) => {
  const f = await fixture(t);
  let cleaned = false;
  const app = f.createApplication(runtime => createCli({ name: "stream-cli", description: "Fixture", runtime,
    commands: [command("items", "List items", () => streamResult(async function* () {
      try { yield { id: 1 }; yield { id: 2n }; }
      finally { cleaned = true; throw new Error("Fixture cleanup failed."); }
    }))],
  }));
  const result = await f.run(app, ["items", "--json"]);
  assert.equal(result.exitCode, 1);
  assert.equal(result.stdout, '{"id":1}\n');
  assert.equal(cleaned, true);
  const failure = JSON.parse(result.stderr).error;
  assert.match(JSON.stringify(failure), /BigInt/);
  assert.match(JSON.stringify(failure), /Fixture cleanup failed/);
});

test("a cancelled pending output write still handles its later error", { timeout: 5000 }, async (t) => {
  const f = await fixture(t);
  const writing = deferred(), callback = deferred<(error: Error) => void>();
  const interrupt = new AbortController();
  let cleaned = false;
  const output = new Writable({ write(_chunk, _encoding, done) { callback.resolve(done); writing.resolve(); } });
  const app = f.createApplication(runtime => createCli({ name: "stream-cli", description: "Fixture", runtime,
    commands: [command("items", "List items", () => streamResult(async function* () {
      try { yield 1; yield 2; } finally { cleaned = true; }
    }))],
  }));
  const running = f.run(app, ["items", "--json"], { output, signal: interrupt.signal });
  await writing.promise;
  interrupt.abort();
  assert.equal((await running).exitCode, 130);
  assert.equal(cleaned, true);
  assert.ok(output.listenerCount("error") > 0, "The pending write still owns its error listener.");
  const closed = new Promise<void>(resolve => output.once("close", resolve));
  (await callback.promise)(new Error("Fixture delayed output error."));
  await closed;
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(output.listenerCount("error"), 0);
  assert.equal(output.listenerCount("close"), 0);
});
