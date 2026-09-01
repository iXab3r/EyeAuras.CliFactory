import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { lstat, mkdir, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test, { type TestContext } from "node:test";
import { command, createCli, Permission } from "../src/index.js";
import { createCliFixture } from "../src/testing.js";

function cleanupContext() {
  const hooks: (() => Promise<void>)[] = [];
  const context = { after(hook: () => Promise<void>) { hooks.push(hook); } } as Pick<TestContext, "after">;
  return { context, hooks };
}

async function removeTestDirectory(path: string) {
  assert.equal(dirname(path), await realpath(tmpdir()));
  assert.match(path, /cli-factory-fixture-/);
  assert.equal(await realpath(path), path);
  await rm(path, { recursive: true, force: true });
}

test("fixture is unconfigured, uses real validated profiles and never invents authentication", async t => {
  const f = await createCliFixture(t, { applicationId: "fixture-test" });
  assert.equal(await realpath(f.root), f.root);
  assert.deepEqual(await f.profileStore.get(), { name: "default", values: {} });
  assert.equal(await f.profileStore.getPermissions(), undefined);
  assert.equal(f.runtime.profileStore, undefined);
  let ready = 0, login = 0;
  const cli = f.createApplication(runtime => createCli({
    name: "fixture-test", description: "Synthetic fixture", runtime, permissions: {},
    profile: {
      fields: [{ name: "url", flags: "--url <url>", description: "URL", required: true }],
      validate(values) { if (values.url === "invalid") throw new Error("Synthetic invalid URL."); },
    },
    auth: {
      isReady: () => { ready++; return false; },
      login: async () => { login++; return { authenticated: true }; },
      status: async () => ({ authenticated: false }),
      logout: async () => undefined,
    },
    commands: [command("inspect", "Inspect", () => null, { permission: Permission.ReadOnly })],
  }));
  assert.equal(ready, 0);
  await assert.rejects(cli.execute(["profile", "create", "other", "--url", "invalid"]), /Synthetic invalid URL/);
  await assert.rejects(cli.execute(["inspect"]), /configur/);
  assert.equal(ready, 0);
  assert.equal(login, 0);
  assert.deepEqual((await f.profileStore.list()).profiles, [{ name: "default", values: {} }]);
});

test("fixture preserves app-owned auth, isolated profiles, gates, I/O and successive RPC requests", async t => {
  const f = await createCliFixture(t, {
    applicationId: "fixture-test",
    profiles: [
      { name: "default", values: { url: "https://first.example.com" }, permissions: ["ReadOnly"],
        secrets: { session: "synthetic-first" } },
      { name: "production", values: { url: "https://second.example.com" }, permissions: ["ReadOnly", "Update"],
        secrets: { session: "synthetic-second" } },
    ],
  });
  let activeStatus = 0, effects = 0;
  const cli = f.createApplication(runtime => createCli({
    name: "fixture-test", description: "Synthetic fixture", runtime, permissions: {},
    auth: {
      isReady: async context => !!await context.secrets.get("session"),
      login: async () => { throw new Error("Fixture must not log in implicitly."); },
      status: async () => { activeStatus++; return { authenticated: true }; },
      logout: async context => { await context.secrets.delete("session"); },
    },
    commands: [
      command("inspect", "Inspect", async (_input, context) => ({
        url: context.profile.values.url, secret: await context.secrets.get("session"),
        path: context.appArguments.AppDataDirectory, marker: context.environment.FIXTURE_MARKER ?? null,
      }), { permission: Permission.ReadOnly }),
      command("change", "Change", () => { effects++; return true; }, { permission: Permission.Update }),
    ],
  }));
  const first = { url: "https://first.example.com", secret: "synthetic-first",
    path: join(f.appArguments.RoamingAppDataDirectory, "default"), marker: null };
  const second = { url: "https://second.example.com", secret: "synthetic-second",
    path: join(f.appArguments.RoamingAppDataDirectory, "production"), marker: null };
  assert.deepEqual(await f.json(cli, ["inspect"]), first);
  const human = await f.run(cli, ["inspect"], { environment: { FIXTURE_MARKER: "synthetic-invocation" } });
  assert.equal(human.exitCode, 0);
  assert.match(human.stdout, /synthetic-invocation/);
  assert.equal(human.stderr, "");
  const replies = await f.rpc(cli, [
    ["inspect"], ["change"], ["inspect", "--profile", "production"],
    ["change", "--profile", "production"], ["inspect"],
  ]) as Array<{ id: number; result?: unknown; error?: { message: string } }>;
  assert.deepEqual(replies.map(reply => reply.id), [0, 1, 2, 3, 4]);
  assert.deepEqual(replies[0]!.result, first);
  assert.match(replies[1]!.error!.message, /Permission 'Update' is disabled/);
  assert.deepEqual(replies[2]!.result, second);
  assert.equal(replies[3]!.result, true);
  assert.deepEqual(replies[4]!.result, first);
  assert.equal(effects, 1);
  assert.equal(activeStatus, 0);
  assert.equal(f.stdout(), "");
  assert.equal(await cli.run(["inspect", "--json"], { environment: {} }), 0);
  assert.deepEqual(JSON.parse(f.stdout()), first);
  f.resetOutput();
  assert.equal(f.stdout(), "");
  assert.equal(f.stderr(), "");
  const document = await readFile(join(f.appArguments.RoamingAppDataDirectory, "profiles.json"), "utf8");
  assert.doesNotMatch(document, /synthetic-first|synthetic-second/);
});

test("fixture owns all applications and disposes their resources before deleting its root", async () => {
  const { context, hooks } = cleanupContext();
  const f = await createCliFixture(context, { applicationId: "fixture-test" });
  const closed: number[] = [];
  for (const id of [1, 2]) f.createApplication(runtime => createCli({
    name: "fixture-test", description: "Synthetic fixture", runtime, commands: [],
    resources: [{ async dispose() { assert.ok((await lstat(f.root)).isDirectory()); closed.push(id); } }],
  }));
  assert.throws(() => f.createApplication(() => { throw new Error("Synthetic factory failure."); }), /factory failure/);
  assert.equal(hooks.length, 1);
  await hooks[0]!();
  await f.dispose();
  assert.deepEqual(closed, [2, 1]);
  await assert.rejects(lstat(f.root), { code: "ENOENT" });
  assert.throws(() => f.createApplication(() => { throw new Error("must not run"); }), /Fixture is disposed/);
});

test("fixture registers cleanup before failing profile setup", async () => {
  const { context, hooks } = cleanupContext();
  await assert.rejects(createCliFixture(context, {
    applicationId: "fixture-test",
    profiles: [{ name: "other" }, { name: "other" }],
  }), /already exists/);
  assert.equal(hooks.length, 1);
  await hooks[0]!();
});

test("fixture attempts every disposal but retains its root when shutdown fails", async () => {
  const { context } = cleanupContext();
  const f = await createCliFixture(context, { applicationId: "fixture-test" });
  const closed: number[] = [];
  for (const id of [1, 2]) f.createApplication(runtime => createCli({
    name: "fixture-test", description: "Synthetic fixture", runtime, commands: [],
    resources: [{ dispose() { closed.push(id); if (id === 2) throw new Error("Synthetic shutdown failure."); } }],
  }));
  try {
    await assert.rejects(f.dispose(), /temporary data retained/);
    assert.deepEqual(closed, [2, 1]);
    assert.ok((await lstat(f.root)).isDirectory());
  } finally { await removeTestDirectory(f.root); }
});

test("fixture refuses to clean a replaced root and preserves the replacement's files", async () => {
  const { context } = cleanupContext();
  const f = await createCliFixture(context, { applicationId: "fixture-test" });
  const original = f.root + "-original";
  assert.equal(dirname(original), await realpath(tmpdir()));
  await rename(f.root, original);
  await mkdir(f.root);
  const sentinel = join(f.root, "sentinel.txt");
  await writeFile(sentinel, "synthetic-replacement");
  try {
    await assert.rejects(f.dispose(), /Fixture root identity changed/);
    assert.equal(await readFile(sentinel, "utf8"), "synthetic-replacement");
    assert.ok((await lstat(original)).isDirectory());
  } finally {
    await removeTestDirectory(f.root);
    await removeTestDirectory(original);
  }
});

test("published testing subpath imports independently without entering the default export", async () => {
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", [
    'const core = await import("@eyeauras/cli-factory");',
    'const testing = await import("@eyeauras/cli-factory/testing");',
    'if ("createCliFixture" in core || typeof testing.createCliFixture !== "function") process.exitCode = 1;',
  ].join("\n")], { encoding: "utf8", timeout: 5000 });
  assert.equal(result.status, 0, result.stderr);
});
test("non-default fixture identity requires preparation and agrees with the real application", async t => {
  await assert.rejects(createCliFixture(t, { applicationId: "fixture-test", defaultProfile: "uat" }), /explicit profile preparation/);
  const f = await createCliFixture(t, {
    applicationId: "fixture-test", defaultProfile: "uat", profiles: [{ name: "uat" }],
  });
  const cli = f.createApplication(runtime => createCli({ name: "fixture-test", description: "Synthetic fixture", runtime, commands: [] }));
  assert.deepEqual(await cli.execute(["profile", "show"]), await f.profileStore.get());
  assert.deepEqual(await f.profileStore.get(), { name: "uat", values: {} });
});

test("JSON fixture invocation preserves literal arguments after the option sentinel", async t => {
  const f = await createCliFixture(t, { applicationId: "fixture-test" });
  const cli = f.createApplication(runtime => createCli({
    name: "fixture-test", description: "Synthetic fixture", runtime,
    commands: [command("echo <value>", "Echo", ({ args }) => ({ value: args.value }))],
  }));
  assert.deepEqual(await f.json(cli, ["echo", "--", "--json-rpc"]), { value: "--json-rpc" });
});
