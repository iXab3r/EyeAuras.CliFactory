import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough, Readable, Writable } from "node:stream";
import {
  AppArguments,
  createCli,
  command,
  MemorySecretStore,
  ProfileStore,
  Permission,
  tokenAuth,
} from "../src/index.js";
import { CommandGate } from "../src/command-gate.js";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

test(
  "parsed command identity, not positional values or profile names, controls exclusivity",
  { timeout: 5000 },
  async (t) => {
    const runtime = await harness(t);
    await runtime.profileStore.create("auth");
    const entered = deferred(),
      release = deferred();
    const app = createCli({
      name: "lifecycle-test",
      description: "fixture",
      runtime,
      concurrency: 2,
      commands: [
        command("hold", "hold", async () => {
          entered.resolve();
          await release.promise;
        }),
        command("echo <value>", "echo", ({ args }, ctx) => [
          args.value,
          ctx.profile.name,
        ]),
      ],
    });
    const held = app.execute(["hold"]);
    await entered.promise;
    try {
      assert.deepEqual(
        await app.execute(
          ["echo", "auth", "--profile", "auth"],
          AbortSignal.timeout(1000),
        ),
        ["auth", "auth"],
      );
      assert.deepEqual(
        await app.execute(
          ["-p", "auth", "echo", "permissions"],
          AbortSignal.timeout(1000),
        ),
        ["permissions", "auth"],
      );
    } finally {
      release.resolve();
      await held;
      await app.dispose();
    }
  },
);
async function harness(t: test.TestContext) {
  const root = await mkdtemp(join(tmpdir(), "cli-lifecycle-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const appArguments = new AppArguments({
    AppName: "lifecycle-test",
    Environment: {
      AppDomainDirectory: root,
      ApplicationExecutablePath: join(root, "bin.js"),
      EnvironmentAppData: root,
      EnvironmentLocalAppData: root,
      ProcessId: process.pid,
    },
  });
  const profileStore = new ProfileStore({
    applicationId: "lifecycle-test",
    appArguments,
  });
  return { appArguments, profileStore, secretStore: new MemorySecretStore() };
}
function io() {
  let out = "",
    err = "";
  const output = new Writable({
    write(chunk, _enc, done) {
      out += chunk.toString();
      done();
    },
  });
  const error = new Writable({
    write(chunk, _enc, done) {
      err += chunk.toString();
      done();
    },
  });
  return {
    input: Readable.from([]),
    output,
    error,
    out: () => out,
    err: () => err,
  };
}

test("profile show uses the selected profile unless an explicit name overrides it", async (t) => {
  const runtime = await harness(t);
  await runtime.profileStore.create("other", { marker: "other" });
  const app = createCli({
    name: "lifecycle-test",
    description: "fixture",
    runtime,
    commands: [],
  });
  try {
    for (const [argv, name] of [
      [["profile", "show"], "default"],
      [["profile", "show", "--profile", "other"], "other"],
      [["--profile=other", "profile", "show"], "other"],
      [["profile", "show", "default", "--profile", "other"], "default"],
    ] as const) {
      const expected = await runtime.profileStore.get(name);
      assert.deepEqual(await app.execute(argv), expected);
      const cli = io();
      assert.equal(await app.run([...argv, "--json"], cli), 0, cli.err());
      assert.deepEqual(JSON.parse(cli.out()), expected);
      const rpc = io();
      assert.equal(
        await app.run(["--json-rpc"], {
          ...rpc,
          input: Readable.from([
            JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              method: "cli.execute",
              params: { argv },
            }) + "\n",
          ]),
        }),
        0,
        rpc.err(),
      );
      assert.deepEqual(JSON.parse(rpc.out()).result, expected);
    }
  } finally {
    await app.dispose();
  }
});

test("literal RPC flags have identical CLI, execute and RPC command semantics", async (t) => {
  const runtime = await harness(t);
  const app = createCli({
    name: "lifecycle-test",
    description: "fixture",
    runtime,
    commands: [
      command(
        "echo [value]",
        "echo",
        ({ args, options }) => ({ value: args.value ?? options.value }),
        {
          options: [{ flags: "--value <value>", description: "Literal value" }],
        },
      ),
    ],
  });
  try {
    for (const argv of [
      ["--json", "echo", "--", "--json-rpc"],
      ["--json", "echo", "--value=--json-rpc"],
    ]) {
      const expected = { value: "--json-rpc" };
      assert.deepEqual(await app.execute(argv), expected);
      const cli = io();
      assert.equal(await app.run(argv, cli), 0, cli.err());
      assert.deepEqual(JSON.parse(cli.out()), expected);
      const rpc = io();
      assert.equal(
        await app.run(["--json-rpc"], {
          ...rpc,
          input: Readable.from([
            JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              method: "cli.execute",
              params: { argv },
            }) + "\n",
          ]),
        }),
        0,
        rpc.err(),
      );
      assert.deepEqual(JSON.parse(rpc.out()).result, expected);
    }
  } finally {
    await app.dispose();
  }
});

test("actual mixed RPC mode is rejected before handlers on every command path", async (t) => {
  const runtime = await harness(t);
  let calls = 0;
  const app = createCli({
    name: "lifecycle-test",
    description: "fixture",
    runtime,
    commands: [
      command("ping", "ping", () => {
        calls++;
        return { ok: true };
      }),
    ],
  });
  try {
    for (const argv of [
      ["--json-rpc", "ping"],
      ["ping", "--json-rpc"],
      ["--profile", "default", "--json-rpc"],
      ["--json-rpc", "--help"],
    ]) {
      const cli = io();
      assert.equal(await app.run(argv, cli), 2);
      assert.match(cli.err(), /without a CLI command/);
      await assert.rejects(app.execute(argv), /without a CLI command/);
      const rpc = io();
      assert.equal(
        await app.run(["--json-rpc"], {
          ...rpc,
          input: Readable.from([
            JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              method: "cli.execute",
              params: { argv },
            }) + "\n",
          ]),
        }),
        0,
      );
      assert.match(
        JSON.parse(rpc.out()).error.message,
        /without a CLI command/,
      );
    }
    await assert.rejects(app.execute(["--json-rpc"]), /without a CLI command/);
    assert.equal(calls, 0);
  } finally {
    await app.dispose();
  }
});

test("noninteractive root help does not require auth storage but service readiness still does", async (t) => {
  const runtime = await harness(t);
  let reads = 0;
  const app = createCli({
    name: "lifecycle-test",
    description: "fixture",
    runtime: {
      ...runtime,
      secretStore: {
        get: async () => {
          reads++;
          throw new Error("Synthetic keyring unavailable");
        },
        set: async () => {},
        delete: async () => {},
      },
    },
    auth: tokenAuth(),
    commands: [command("ping", "ping", () => ({ ok: true }))],
  });
  try {
    for (const argv of [[], ["--json"], ["--help"]]) {
      const cli = io();
      assert.equal(await app.run(argv, cli), 0, cli.err());
      assert.match(cli.out(), /Usage:/);
      assert.equal(cli.err(), "");
      assert.match(
        ((await app.execute(argv)) as { help: string }).help,
        /Usage:/,
      );
    }
    const rpc = io();
    assert.equal(
      await app.run(["--json-rpc"], {
        ...rpc,
        input: Readable.from([
          JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "cli.execute",
            params: { argv: [] },
          }) + "\n",
        ]),
      }),
      0,
    );
    assert.match(JSON.parse(rpc.out()).result.help, /Usage:/);
    assert.equal(reads, 0);
    await assert.rejects(
      app.execute(["ping"]),
      /Synthetic keyring unavailable/,
    );
    assert.equal(reads, 1);
  } finally {
    await app.dispose();
  }
});

test("concurrent invocations have separate streams, caller context and completion", async (t) => {
  const runtime = await harness(t);
  const both = deferred();
  let entered = 0;
  const app = createCli({
    name: "lifecycle-test",
    description: "fixture",
    runtime,
    commands: [
      command("echo <value>", "echo", async ({ args }, context) => {
        if (++entered === 2) both.resolve();
        await both.promise;
        context.io.error.write(String(args.value));
        return { value: args.value, cwd: context.cwd };
      }),
    ],
  });
  const a = io(),
    b = io();
  assert.deepEqual(
    await Promise.all([
      app.run(["echo", "a", "--json"], { ...a, cwd: "a-cwd" }),
      app.run(["echo", "b", "--json"], { ...b, cwd: "b-cwd" }),
    ]),
    [0, 0],
  );
  assert.deepEqual(JSON.parse(a.out()), { value: "a", cwd: "a-cwd" });
  assert.deepEqual(JSON.parse(b.out()), { value: "b", cwd: "b-cwd" });
  assert.equal(a.err(), "a");
  assert.equal(b.err(), "b");
  await app.dispose();
  assert.equal(a.output.destroyed, false);
});

test("dispose is shared, aborts work, rejects new work and does not erase user data", async (t) => {
  const runtime = await harness(t);
  const started = deferred();
  let disposed = 0;
  const app = createCli({
    name: "lifecycle-test",
    description: "fixture",
    runtime,
    resources: [
      {
        dispose() {
          disposed++;
        },
      },
    ],
    commands: [
      command("wait", "wait", async (_input, context) => {
        started.resolve();
        await new Promise<void>((resolve) =>
          context.signal.addEventListener("abort", () => resolve(), {
            once: true,
          }),
        );
      }),
    ],
  });
  const work = app.execute(["wait"]);
  await started.promise;
  const a = app.dispose(),
    b = app.dispose();
  assert.equal(a, b);
  await Promise.all([a, work]);
  assert.equal(disposed, 1);
  await assert.rejects(app.execute(["wait"]), /disposed/);
  assert.equal((await runtime.profileStore.get()).name, "default");
});

test("cleanup failure is stable for all dispose callers", async (t) => {
  const runtime = await harness(t);
  let attempts = 0;
  const app = createCli({
    name: "lifecycle-test",
    description: "fixture",
    runtime,
    commands: [],
    resources: [
      {
        dispose() {
          attempts++;
          throw new Error("synthetic cleanup failure");
        },
      },
    ],
  });
  await assert.rejects(app.dispose(), /cleanup failure/);
  await assert.rejects(app.dispose(), /cleanup failure/);
  assert.equal(attempts, 1);
});

test("idle JSON-RPC does not consume a command slot and cancellation releases only its Run", async (t) => {
  const runtime = await harness(t);
  const input = new PassThrough(),
    streams = io();
  const app = createCli({
    name: "lifecycle-test",
    description: "fixture",
    runtime,
    concurrency: 1,
    commands: [command("ping", "ping", () => ({ ok: true }))],
  });
  const abort = new AbortController();
  const rpc = app.run(["--json-rpc"], {
    ...streams,
    input,
    signal: abort.signal,
  });
  assert.deepEqual(await app.execute(["ping"]), { ok: true });
  abort.abort();
  await rpc;
  assert.deepEqual(await app.execute(["ping"]), { ok: true });
  assert.equal(input.destroyed, false);
  input.destroy();
  await app.dispose();
});

test("application auth is not a token flow and permission denial precedes auth effects", async (t) => {
  const runtime = await harness(t);
  let authenticated = false,
    checks = 0;
  const app = createCli({
    name: "lifecycle-test",
    description: "fixture",
    runtime,
    permissions: {},
    auth: {
      loginOptions: [
        { flags: "--ticket <ticket>", description: "synthetic login ticket" },
      ],
      async login(_context, options) {
        assert.equal(options.ticket, "synthetic-ticket");
        authenticated = true;
        return { authenticated };
      },
      async status() {
        checks++;
        return { authenticated };
      },
      async logout() {
        authenticated = false;
      },
    },
    commands: [
      command("inspect", "inspect", () => ({ ok: true }), {
        permission: Permission.ReadOnly,
      }),
    ],
  });
  await runtime.profileStore.setPermissions("default", []);
  await assert.rejects(app.execute(["inspect"]), /ReadOnly/);
  assert.equal(checks, 0);
  await app.execute(["auth", "login", "--ticket", "synthetic-ticket"]);
  assert.equal(
    ((await app.execute(["auth", "status"])) as { authenticated: boolean })
      .authenticated,
    true,
  );
  await app.execute(["auth", "logout"]);
  assert.equal(authenticated, false);
  await app.dispose();
});

test("configure defers app-owned secret changes and keeps fresh login resources", async (t) => {
  for (const name of ["default", "new-profile"]) {
    for (const outcome of ["success", "rejected", "throws", "cancelled"]) {
      const runtime = await harness(t);
      const service = "ai-cli-factory:lifecycle-test";
      await runtime.profileStore.set("default", {
        url: "https://old.example.test",
      });
      await runtime.profileStore.create("other");
      await runtime.secretStore.set(
        service,
        "default:session",
        "synthetic-old",
      );
      await runtime.secretStore.set(
        service,
        "default:obsolete",
        "synthetic-obsolete",
      );
      await runtime.secretStore.set(
        service,
        "other:session",
        "synthetic-other",
      );
      const before = await runtime.profileStore.list();
      const events: string[] = [];
      const controller = new AbortController();
      const app = createCli({
        name: "lifecycle-test",
        description: "fixture",
        runtime,
        commands: [],
        profile: {
          fields: [{ name: "url", flags: "--url <url>", description: "URL" }],
        },
        resources: [
          {
            dispose() {},
            invalidateProfile() {
              events.push("invalidate");
            },
          },
        ],
        auth: {
          async login(context) {
            assert.deepEqual(events, ["invalidate"]);
            assert.equal(
              context.profile.values.url,
              "https://new.example.test",
            );
            assert.deepEqual(await runtime.profileStore.list(), before);
            assert.equal(
              await context.secrets.get("session"),
              name === "default" ? "synthetic-old" : undefined,
            );
            await context.secrets.set("session", "synthetic-new");
            assert.equal(
              await context.secrets.require("session"),
              "synthetic-new",
            );
            await context.secrets.delete("obsolete");
            assert.equal(await context.secrets.get("obsolete"), undefined);
            await assert.rejects(
              context.secrets.require("obsolete"),
              /No credential/,
            );
            assert.equal(
              await runtime.secretStore.get(service, "default:session"),
              "synthetic-old",
            );
            assert.equal(
              await runtime.secretStore.get(service, "default:obsolete"),
              "synthetic-obsolete",
            );
            events.push("login");
            if (outcome === "throws") throw new Error("Login rejected.");
            if (outcome === "cancelled") controller.abort();
            return { authenticated: outcome !== "rejected" };
          },
          status: async () => ({ authenticated: true }),
          logout: async () => {},
        },
      });
      try {
        const work = app.execute(
          ["profile", "configure", name, "--url", "https://new.example.test"],
          controller.signal,
        );
        if (outcome === "success") {
          await work;
          assert.equal(
            (await runtime.profileStore.get(name)).values.url,
            "https://new.example.test",
          );
          assert.equal(
            await runtime.secretStore.get(service, `${name}:session`),
            "synthetic-new",
          );
          assert.equal(
            await runtime.secretStore.get(service, `${name}:obsolete`),
            undefined,
          );
        } else {
          await assert.rejects(work);
          assert.deepEqual(await runtime.profileStore.list(), before);
          assert.equal(
            await runtime.secretStore.get(service, "default:session"),
            "synthetic-old",
          );
          assert.equal(
            await runtime.secretStore.get(service, "default:obsolete"),
            "synthetic-obsolete",
          );
          assert.equal(
            await runtime.secretStore.get(service, "new-profile:session"),
            undefined,
          );
        }
        assert.deepEqual(events, ["invalidate", "login"]);
        assert.equal(
          await runtime.secretStore.get(service, "other:session"),
          "synthetic-other",
        );
      } finally {
        await app.dispose();
      }
    }
  }
});

test("service commands never implicitly call active auth status", async (t) => {
  const runtime = await harness(t);
  let checks = 0;
  const app = createCli({
    name: "lifecycle-test",
    description: "fixture",
    runtime,
    auth: {
      login: async () => ({ authenticated: true }),
      logout: async () => {},
      status: async () => {
        checks++;
        return { authenticated: true };
      },
    },
    commands: [command("inspect", "inspect", () => ({ ok: true }))],
  });
  try {
    await app.execute(["inspect"]);
    assert.equal(checks, 0);
    await app.execute(["auth", "status"]);
    assert.equal(checks, 1);
  } finally {
    await app.dispose();
  }
});

test("profile deletion logs out through live resources; failed logout leaves them usable", async (t) => {
  const runtime = await harness(t);
  await runtime.profileStore.create("other");
  let live = true,
    deny = true;
  const events: string[] = [];
  const app = createCli({
    name: "lifecycle-test",
    description: "fixture",
    runtime,
    commands: [],
    resources: [
      {
        dispose() {},
        invalidateProfile() {
          events.push("invalidate");
          live = false;
        },
      },
    ],
    auth: {
      login: async () => ({ authenticated: true }),
      status: async () => ({ authenticated: live }),
      async logout() {
        events.push("logout");
        assert.equal(live, true);
        if (deny) throw new Error("Synthetic revoke failure");
      },
    },
  });
  try {
    await assert.rejects(
      app.execute(["profile", "delete", "other"]),
      /revoke failure/,
    );
    assert.equal(live, true);
    assert.equal((await runtime.profileStore.get("other")).name, "other");
    assert.deepEqual(events, ["logout"]);
    deny = false;
    await app.execute(["profile", "delete", "other"]);
    assert.deepEqual(events, ["logout", "logout", "invalidate"]);
  } finally {
    await app.dispose();
  }
});

test("passive auth readiness is profile-scoped and follows permission admission", async (t) => {
  const runtime = await harness(t);
  await runtime.profileStore.create("ready");
  const checked: string[] = [];
  const app = createCli({
    name: "lifecycle-test",
    description: "fixture",
    runtime,
    permissions: {},
    auth: {
      login: async () => ({ authenticated: true }),
      logout: async () => {},
      status: async () => ({ authenticated: true }),
      isReady(context) {
        assert.equal("io" in context, false);
        assert.equal("fetch" in context, false);
        checked.push(context.profile.name);
        return context.profile.name === "ready";
      },
    },
    commands: [
      command("inspect", "inspect", () => ({ ok: true }), {
        permission: Permission.ReadOnly,
      }),
    ],
  });
  try {
    await runtime.profileStore.setPermissions("default", []);
    await assert.rejects(app.execute(["inspect"]), /ReadOnly/);
    assert.deepEqual(checked, []);
    await runtime.profileStore.setPermissions("default", ["ReadOnly"]);
    await assert.rejects(app.execute(["inspect"]), /auth|configur/i);
    assert.deepEqual(await app.execute(["inspect", "--profile", "ready"]), {
      ok: true,
    });
    assert.deepEqual(checked, ["default", "ready"]);
    await app.execute(["auth", "status"]);
    assert.deepEqual(checked, ["default", "ready"]);
  } finally {
    await app.dispose();
  }
});

test("one owner serializes concurrent profile file read-modify-write operations", async (t) => {
  const runtime = await harness(t);
  await Promise.all(
    Array.from({ length: 20 }, (_, i) =>
      runtime.profileStore.create("fixture" + i),
    ),
  );
  assert.equal((await runtime.profileStore.list()).profiles.length, 21);
  await assert.rejects(runtime.profileStore.create("Fixture0"), /letter case/);
});

test("command gate supports 1, N and no extra limit with cancellation before execution", async () => {
  for (const limit of [1, 3, Infinity]) {
    const gate = new CommandGate(limit);
    const release = deferred();
    let entered = 0;
    const count = 5;
    const starts = deferred();
    const works = Array.from({ length: count }, () =>
      gate.run(async () => {
        entered++;
        if (entered === Math.min(limit, count)) starts.resolve();
        await release.promise;
      }, new AbortController().signal),
    );
    await starts.promise;
    assert.equal(entered, Math.min(limit, count));
    release.resolve();
    await Promise.all(works);
  }
  const gate = new CommandGate(1, 1);
  const started = deferred(),
    release = deferred();
  const running = gate.run(async () => {
    started.resolve();
    await release.promise;
  }, new AbortController().signal);
  await started.promise;
  const abort = new AbortController();
  let reached = false;
  const queued = gate.run(async () => {
    reached = true;
  }, abort.signal);
  await assert.rejects(
    gate.run(async () => {}, new AbortController().signal),
    /queue is full/,
  );
  abort.abort();
  await assert.rejects(queued, /cancelled/);
  assert.equal(reached, false);
  release.resolve();
  await running;
});

test("token stdin is bounded and cancellable without destroying caller-owned streams", async (t) => {
  const { readStdin } = await import("../src/auth.js");
  const input = new PassThrough(),
    abort = new AbortController();
  const pending = readStdin(input, abort.signal);
  abort.abort();
  await assert.rejects(pending, /cancelled/);
  assert.equal(input.destroyed, false);
  input.destroy();
  await assert.rejects(
    readStdin(Readable.from([Buffer.alloc(65537)])),
    /size limit/,
  );
  assert.equal(
    await readStdin(Readable.from([Buffer.from("synthetic-token\n")])),
    "synthetic-token",
  );
});
test("dispose remains idempotent when an abort handler reenters it", async (t) => {
  const runtime = await harness(t);
  const started = deferred();
  let cleanup = 0,
    again: Promise<void> | undefined;
  const app = createCli({
    name: "lifecycle-test",
    description: "fixture",
    runtime,
    resources: [
      {
        dispose() {
          cleanup++;
        },
      },
    ],
    commands: [
      command("wait", "wait", async (_input, context) => {
        started.resolve();
        await new Promise<void>((resolve) =>
          context.signal.addEventListener(
            "abort",
            () => {
              again = app.dispose();
              resolve();
            },
            { once: true },
          ),
        );
      }),
    ],
  });
  const pending = app.execute(["wait"]);
  await started.promise;
  const disposal = app.dispose();
  await pending;
  assert.equal(again, disposal);
  await disposal;
  assert.equal(cleanup, 1);
});
test("per-invocation environment is a snapshot, not process-global state", async (t) => {
  const runtime = await harness(t);
  const app = createCli({
    name: "lifecycle-test",
    description: "fixture",
    runtime,
    commands: [
      command("inspect", "inspect", (_input, context) => ({
        value: context.environment.SYNTHETIC,
      })),
    ],
  });
  const a = io(),
    b = io();
  await Promise.all([
    app.run(["inspect", "--json"], { ...a, environment: { SYNTHETIC: "a" } }),
    app.run(["inspect", "--json"], { ...b, environment: { SYNTHETIC: "b" } }),
  ]);
  assert.deepEqual(JSON.parse(a.out()), { value: "a" });
  assert.deepEqual(JSON.parse(b.out()), { value: "b" });
  await app.dispose();
});

test("dispose-style cancellation restores a masked terminal without waiting for input", async () => {
  const { promptSecret } = await import("../src/auth.js");
  const raw: boolean[] = [];
  const input = Object.assign(new PassThrough(), {
    isTTY: true,
    isRaw: false,
    setRawMode: (value: boolean) => {
      raw.push(value);
    },
  });
  const output = Object.assign(io().error, { isTTY: true });
  const abort = new AbortController();
  const pending = promptSecret(input, output, abort.signal);
  abort.abort();
  await assert.rejects(pending, /cancelled/);
  assert.deepEqual(raw, [true, false]);
  assert.equal(input.destroyed, false);
  input.destroy();
});
test("app-owned auth options reuse command defaults and parsers", async (t) => {
  const runtime = await harness(t);
  const observed: unknown[] = [];
  const app = createCli({
    name: "lifecycle-test",
    description: "fixture",
    runtime,
    commands: [],
    auth: {
      loginOptions: [
        {
          flags: "--attempts <n>",
          description: "Synthetic option",
          defaultValue: 2,
          parse: (value) => Number(value),
        },
      ],
      async login(_context, options) {
        observed.push(options.attempts);
        return { authenticated: true };
      },
      async status() {
        return { authenticated: false };
      },
      async logout() {},
    },
  });
  await app.execute(["auth", "login"]);
  await app.execute(["profile", "configure", "default", "--attempts", "3"]);
  assert.deepEqual(observed, [2, 3]);
  await app.dispose();
});

test("already-cancelled JSON-RPC returns without waiting for caller stdin", async (t) => {
  const runtime = await harness(t),
    input = new PassThrough(),
    streams = io();
  const app = createCli({
    name: "lifecycle-test",
    description: "fixture",
    runtime,
    commands: [],
  });
  assert.equal(
    await app.run(["--json-rpc"], {
      ...streams,
      input,
      signal: AbortSignal.abort(),
    }),
    1,
  );
  assert.equal(input.destroyed, false);
  input.destroy();
  await app.dispose();
});

test("owned resources invalidate only the changed profile and all dispose after a failure", async (t) => {
  const runtime = await harness(t);
  const events: string[] = [];
  const app = createCli({
    name: "lifecycle-test",
    description: "fixture",
    runtime,
    commands: [],
    profile: {
      fields: [
        { name: "url", flags: "--url <url>", description: "Synthetic URL" },
      ],
    },
    resources: [
      {
        invalidateProfile(args) {
          events.push(args.AppDataDirectory);
        },
        dispose() {
          events.push("first closed");
        },
      },
      {
        dispose() {
          events.push("second closed");
          throw new Error("synthetic cleanup failure");
        },
      },
    ],
  });
  await app.execute(["profile", "create", "other"]);
  await app.execute([
    "profile",
    "set",
    "other",
    "--url",
    "https://example.invalid",
  ]);
  await app.execute(["profile", "delete", "other"]);
  assert.deepEqual(events, [
    runtime.appArguments.WithProfile("other").AppDataDirectory,
    runtime.appArguments.WithProfile("other").AppDataDirectory,
  ]);
  await assert.rejects(app.dispose(), /cleanup failure/);
  assert.deepEqual(events.slice(-2), ["second closed", "first closed"]);
  await assert.rejects(app.dispose(), /cleanup failure/);
  assert.equal(events.length, 4);
});

test("run and execute share argv validation before handlers or diagnostics echo input", async (t) => {
  const runtime = await harness(t),
    streams = io();
  let calls = 0;
  const app = createCli({
    name: "lifecycle-test",
    description: "fixture",
    runtime,
    commands: [
      command("echo <value>", "echo", () => {
        calls++;
      }),
    ],
  });
  try {
    const argv = ["echo", "synthetic-private-value".repeat(500)];
    await assert.rejects(app.execute(argv), /byte/);
    assert.equal(await app.run(argv, streams), 1);
    assert.equal(calls, 0);
    assert.doesNotMatch(streams.err(), /synthetic-private-value/);
  } finally {
    await app.dispose();
  }
});

test("profile mutation waits for service work and queued work rechecks updated configuration", async (t) => {
  const runtime = await harness(t);
  const entered = deferred(),
    release = deferred();
  const app = createCli({
    name: "lifecycle-test",
    description: "fixture",
    runtime,
    concurrency: 2,
    profile: {
      fields: [
        { name: "url", flags: "--url <url>", description: "Synthetic URL" },
      ],
    },
    commands: [
      command("hold", "hold", async () => {
        entered.resolve();
        await release.promise;
      }),
      command("inspect", "inspect", (_input, ctx) => ctx.profile.values.url),
    ],
  });
  const first = app.execute(["hold"]);
  await entered.promise;
  const update = app.execute([
    "profile",
    "set",
    "default",
    "--url",
    "https://updated.invalid",
  ]);
  const last = app.execute(["inspect"]);
  await new Promise((r) => setImmediate(r));
  assert.equal((await runtime.profileStore.get()).values.url, undefined);
  release.resolve();
  await Promise.all([first, update]);
  assert.equal(await last, "https://updated.invalid");
  await app.dispose();
});
