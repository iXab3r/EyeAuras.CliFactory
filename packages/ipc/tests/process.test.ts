import assert from "node:assert/strict";
import test from "node:test";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import {
  mkdtemp,
  rm,
  mkdir,
  writeFile,
  readFile,
  utimes,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { ownershipExitCode } from "../src/startup.js";

const bin = fileURLToPath(new URL("./fixtures/host.js", import.meta.url));
async function fixture(t: test.TestContext, extra: NodeJS.ProcessEnv = {}) {
  const root = await mkdtemp(join(tmpdir(), "ipc-process-"));
  const env = { ...process.env, CLI_HOST_TEST_ROOT: root, ...extra };
  const children = new Set<ChildProcessWithoutNullStreams>();
  const start = (argv: string[], override: NodeJS.ProcessEnv = {}) => {
    const child = spawn(process.execPath, [bin, ...argv], {
      env: { ...env, ...override },
      windowsHide: true,
    });
    children.add(child);
    let out: Buffer[] = [],
      err = "";
    let entered!: () => void, enterFailed!: (error: Error) => void;
    const started = new Promise<void>((resolve, reject) => {
      entered = resolve;
      enterFailed = reject;
    });
    void started.catch(() => {});
    child.stdout.on("data", (chunk) => out.push(Buffer.from(chunk)));
    child.stderr.on("data", (chunk) => {
      err += chunk.toString();
      if (err.includes("started")) entered();
    });
    const result = new Promise<{
      code: number | null;
      out: Buffer;
      err: string;
    }>((resolve, reject) => {
      const timer = setTimeout(() => {
        child.kill();
        reject(new Error("Fixture process deadline."));
      }, 30000);
      child.once("error", reject);
      child.once("close", (code) => {
        enterFailed(new Error("Process exited before entry barrier."));
        clearTimeout(timer);
        children.delete(child);
        resolve({ code, out: Buffer.concat(out), err });
      });
    });
    void result.catch(() => {});
    return { child, result, started };
  };
  const run = async (argv: string[], override: NodeJS.ProcessEnv = {}) => {
    const task = start(argv, override);
    task.child.stdin.end();
    return task.result;
  };
  t.after(async () => {
    for (const child of children) child.kill();
    await run(["ipc-server", "stop", "--json"]).catch(() => undefined);
    await rm(root, { recursive: true, force: true });
  });
  return { root, start, run };
}
const json = (result: { code: number | null; out: Buffer; err: string }) => {
  assert.equal(result.code, 0, result.err);
  return JSON.parse(result.out.toString()) as Record<string, any>;
};

test("service server commands and tunneled IPC management use the same owner without colliding", async (t) => {
  const f = await fixture(t);
  assert.deepEqual(json(await f.run(["ipc-server", "status", "--json"])), {
    running: false,
  });
  const service = json(await f.run(["server", "status", "--json"]));
  assert.equal(service.service, true);
  assert.equal(
    json(await f.run(["ipc-server", "status", "--json"])).pid,
    service.pid,
  );
  const rpc = f.start(["--json-rpc"]);
  rpc.child.stdin.end(
    JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "cli.execute",
      params: { argv: ["ipc-server", "status"] },
    }) + "\n",
  );
  assert.equal(json(await rpc.result).result.pid, service.pid);
});

test("invalid launch limits do not prevent status or stop and never start an owner", async (t) => {
  const f = await fixture(t);
  for (const invalid of [
    { CLI_HOST_TEST_IDLE: "0" },
    { CLI_HOST_TEST_CAPACITY: "0" },
  ]) {
    assert.deepEqual(
      json(await f.run(["ipc-server", "status", "--json"], invalid)),
      { running: false },
    );
    assert.deepEqual(
      json(await f.run(["ipc-server", "stop", "--json"], invalid)),
      {
        running: false,
      },
    );
    const owner = json(await f.run(["info", "--json"]));
    const rejected = await f.run(["info", "--json"], invalid);
    assert.equal(rejected.code, 1);
    assert.match(rejected.err, /idleTimeoutMs|maxInvocations/);
    assert.equal(
      json(await f.run(["ipc-server", "status", "--json"], invalid)).pid,
      owner.pid,
    );
    assert.deepEqual(
      json(await f.run(["-pdefault", "ipc-server", "stop", "--json"], invalid)),
      { running: false },
    );
    assert.deepEqual(json(await f.run(["ipc-server", "status", "--json"])), {
      running: false,
    });
  }
});

test("host startup failures are prompt, phase-specific and sanitized", async (t) => {
  for (const phase of ["definition", "storage", "lock"]) {
    const f = await fixture(t, { CLI_HOST_TEST_FAIL: phase });
    if (phase === "storage") {
      await mkdir(join(f.root, "ipc-fixture"), { recursive: true });
      await writeFile(
        join(f.root, "ipc-fixture", ".runtime"),
        "synthetic-private-storage-marker",
      );
    }
    const before = Date.now();
    const result = await f.run(["info", "--json"]);
    assert.equal(result.code, 1);
    assert.match(
      result.err,
      phase === "definition" ? /application definition/ : /runtime storage/,
    );
    assert.doesNotMatch(
      result.err + result.out.toString(),
      /synthetic-private/,
    );
    assert.ok(
      Date.now() - before < 10000,
      "Known child failure must not wait for the 20-second startup deadline.",
    );
  }
});

test("auth declares its env once; shared host reads each caller snapshot and isolates profile secrets", async (t) => {
  const f = await fixture(t, { CLI_HOST_TEST_AUTH: "1" });
  const first = {
    CLI_TEST_TOKEN: "synthetic-first-token",
    CLI_TEST_VALUE: "first",
    CLI_TEST_UNDECLARED: "synthetic-hidden",
  };
  json(await f.run(["auth", "login", "--json"], first));
  const owner = json(await f.run(["info", "--json"], first));
  json(await f.run(["profile", "create", "other", "--json"]));
  const missing = await f.run(["info", "--profile", "other", "--json"], first);
  assert.equal(
    missing.code,
    1,
    "Another profile must not inherit the first credential.",
  );
  const absent = await f.run(
    ["auth", "login", "--profile", "other", "--json"],
    { CLI_TEST_TOKEN: undefined },
  );
  assert.equal(
    absent.code,
    1,
    "Missing caller env must not fall back to the host's inherited token.",
  );
  const second = {
    CLI_TEST_TOKEN: "synthetic-second-token",
    CLI_TEST_VALUE: "second",
    CLI_TEST_UNDECLARED: "synthetic-hidden",
  };
  json(await f.run(["auth", "login", "--profile", "other", "--json"], second));
  const checks = await Promise.all([
    f.run(["environment", "first", "--json"], first),
    f.run(["environment", "second", "--profile", "other", "--json"], second),
  ]);
  for (const check of checks) {
    assert.deepEqual(json(check), {
      declaredMatches: true,
      tokenMatches: true,
      unknownAbsent: true,
    });
    assert.doesNotMatch(check.out.toString() + check.err, /synthetic-.*token/);
  }
  assert.equal(
    json(await f.run(["info", "--json"], first)).identity,
    owner.identity,
  );
});

test("management does not spawn; concurrent cold starts share one owner; binary, help, errors and cwd remain isolated", async (t) => {
  const f = await fixture(t);
  assert.deepEqual(json(await f.run(["ipc-server", "status", "--json"])), {
    running: false,
  });
  assert.equal(
    json(await f.run(["-pdefault", "ipc-server", "status", "--json"])).running,
    false,
  );
  assert.deepEqual(json(await f.run(["ipc-server", "stop", "--json"])), {
    running: false,
  });
  const first = await Promise.all(
    Array.from({ length: 5 }, () => f.run(["increment", "--json"])),
  );
  assert.deepEqual(
    first.map((result) => json(result).counter).sort(),
    [1, 2, 3, 4, 5],
  );
  const owner = json(await f.run(["info", "--json"]));
  assert.equal(json(await f.run(["info", "--json"])).identity, owner.identity);
  const streams = [
    Buffer.from([0, 255, 10, 13, 128]),
    Buffer.from("split 🌍 UTF-8"),
  ];
  const echoed = await Promise.all(
    streams.map(async (bytes) => {
      const call = f.start(["echo"]);
      for (const byte of bytes) call.child.stdin.write(Buffer.from([byte]));
      call.child.stdin.end();
      const result = await call.result;
      assert.equal(result.code, 0, result.err);
      return result.out;
    }),
  );
  assert.deepEqual(echoed, streams);
  const help = await f.run(["gate", "--help"]);
  assert.equal(help.code, 0);
  assert.match(help.out.toString(), /wait for one/);
  const failure = await f.run(["fail"]);
  assert.equal(failure.code, 1);
  assert.match(failure.err, /Synthetic/);
  assert.equal(json(await f.run(["info", "--json"])).identity, owner.identity);
  const wrong = await f.run(["increment", "--json"], {
    CLI_HOST_TEST_BUILD: "other-build",
  });
  assert.equal(wrong.code, 1);
  assert.match(wrong.err, /mismatch/);
  assert.equal(json(await f.run(["info", "--json"])).counter, 5);
  assert.equal(
    json(
      await f.run(["ipc-server", "status", "--json"], {
        CLI_HOST_TEST_BUILD: "other-build",
      }),
    ).pid,
    owner.pid,
  );
  assert.deepEqual(
    json(
      await f.run(["ipc-server", "stop", "--json"], {
        CLI_HOST_TEST_BUILD: "other-build",
      }),
    ),
    {
      running: false,
    },
  );
  assert.equal(
    json(await f.run(["ipc-server", "status", "--json"])).running,
    false,
  );
});

test("application limits 1, N and unbounded admit commands, not connections", async (t) => {
  for (const limit of [1, 3, 5]) {
    const f = await fixture(t, {
      ...(limit === 5 ? {} : { CLI_HOST_TEST_LIMIT: String(limit) }),
    });
    json(await f.run(["info", "--json"]));
    const calls = Array.from({ length: 5 }, () => f.start(["gate", "--json"]));
    // Release exactly the admitted group, then the remaining group: no timing-based overlap guesses.
    const pending = new Set(calls);
    let completed = 0;
    while (completed < 5) {
      const group: typeof calls = [];
      for (let i = 0; i < Math.min(limit, 5 - completed); i++) {
        const ready = await Promise.race(
          [...pending].map((call) => call.started.then(() => call)),
        );
        pending.delete(ready);
        group.push(ready);
      }
      for (const call of group) call.child.stdin.end("release");
      await Promise.all(group.map((call) => call.result));
      completed += group.length;
    }
    const stats = json(await f.run(["info", "--json"]));
    assert.equal(stats.maximum, limit);
    await f.run(["ipc-server", "stop", "--json"]);
  }
});

test("disconnect cancels one client; idle JSON-RPC holds no command slot", async (t) => {
  const f = await fixture(t, { CLI_HOST_TEST_LIMIT: "1" });
  const rpc = f.start(["--json-rpc"]);
  const ping = json(await f.run(["info", "--json"]));
  const blocked = f.start(["gate", "--json"]);
  await blocked.started;
  blocked.child.kill();
  await blocked.result;
  assert.equal(json(await f.run(["info", "--json"])).identity, ping.identity);
  rpc.child.stdin.end(
    JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "cli.execute",
      params: { argv: ["increment"] },
    }) + "\n",
  );
  const reply = await rpc.result;
  assert.equal(reply.code, 0, reply.err);
  assert.equal(JSON.parse(reply.out.toString()).result.counter, 1);
});

test("oversized unterminated RPC input fails only its invocation and keeps the host usable", async (t) => {
  const f = await fixture(t);
  const owner = json(await f.run(["info", "--json"]));
  const bad = f.start(["--json-rpc"]);
  bad.child.stdin.on("error", () => {});
  bad.child.stdin.write(Buffer.alloc(262145, 32));
  const result = await bad.result;
  assert.equal(result.code, 1);
  assert.match(result.err, /line.*limit/i);
  assert.equal(json(await f.run(["info", "--json"])).identity, owner.identity);
});

test("connecting to a peer owner retires the unused child before it can outlive ipc-server stop", async (t) => {
  const f = await fixture(t);
  const waiting = f.start(["info", "--json"], {
    CLI_HOST_TEST_LEASE_GATE: "file",
  });
  waiting.child.stdin.end();
  let pid: number | undefined;
  try {
    const deadline = Date.now() + 10000;
    while (pid === undefined && Date.now() < deadline) {
      const marker = await readFile(
        join(f.root, "waiting-child.json"),
        "utf8",
      ).catch(() => undefined);
      if (marker) pid = (JSON.parse(marker) as { pid: number }).pid;
      else await delay(25);
    }
    assert.ok(pid, "Child must reach the acquisition barrier.");
    const owner = json(await f.run(["info", "--json"]));
    assert.notEqual(owner.pid, pid);
    assert.equal(json(await waiting.result).pid, owner.pid);
    assert.deepEqual(json(await f.run(["ipc-server", "stop", "--json"])), {
      running: false,
    });
    await writeFile(join(f.root, "release-child"), "resume");
    let alive = true;
    const exitDeadline = Date.now() + 2000;
    while (alive && Date.now() < exitDeadline) {
      try {
        process.kill(pid, 0);
      } catch {
        alive = false;
      }
      if (alive) await delay(25);
    }
    assert.equal(
      alive,
      false,
      "Unused startup child survived its completed caller.",
    );
    assert.deepEqual(json(await f.run(["ipc-server", "status", "--json"])), {
      running: false,
    });
  } finally {
    // Only the fixture child whose PID was recorded above; never arbitrary Node processes.
    if (pid) {
      try {
        process.kill(pid);
      } catch {}
    }
    await waiting.result;
  }
});

test("a delayed stale-owner recovery cannot resurrect an explicitly stopped successor", async (t) => {
  const f = await fixture(t);
  json(await f.run(["info", "--json"]));
  assert.equal((await f.run(["crash"])).code, 1);
  const stale = new Date(Date.now() - 15000);
  await utimes(join(f.root, "ipc-fixture", ".runtime.lock"), stale, stale);
  // Pause after reading the dead owner but before acquiring the lease. No race timing guesses.
  const delayed = f.start(["--internal-cli-host"], {
    CLI_HOST_TEST_LEASE_GATE: "1",
  });
  await delayed.started;
  json(await f.run(["info", "--json"]));
  assert.deepEqual(json(await f.run(["ipc-server", "stop", "--json"])), {
    running: false,
  });
  delayed.child.stdin.end("resume");
  try {
    const result = await Promise.race([
      delayed.result,
      delay(3000).then(() => {
        throw new Error("Stale recovery did not exit after successor stop.");
      }),
    ]);
    assert.equal(result.code, ownershipExitCode, result.err);
    assert.deepEqual(json(await f.run(["ipc-server", "status", "--json"])), {
      running: false,
    });
    // The rejected recovery must release its lease so a new intentional launch works.
    json(await f.run(["info", "--json"]));
  } finally {
    if (delayed.child.exitCode === null) delayed.child.kill();
    await delayed.result;
  }
});

test("idle shutdown waits for work and releases ownership; crash is not replayed and recovers", async (t) => {
  const f = await fixture(t, { CLI_HOST_TEST_IDLE: "300" });
  const work = f.start(["pause", "--json"]);
  await work.started;
  work.child.stdin.end();
  assert.equal(json(await work.result).ok, true);
  const deadline = Date.now() + 10000;
  let running = true;
  while (running && Date.now() < deadline) {
    running = json(await f.run(["ipc-server", "status", "--json"])).running;
    if (running) await delay(50);
  }
  assert.equal(running, false);
  const before = json(await f.run(["info", "--json"]));
  const crash = await f.run(["crash"]);
  assert.equal(crash.code, 1);
  assert.match(crash.err, /No replay/);
  // The stale lease is intentionally conservative (10s) after an ungraceful owner loss.
  const after = json(await f.run(["info", "--json"]));
  assert.notEqual(after.identity, before.identity);
});
