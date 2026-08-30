import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable, Writable } from "node:stream";
import test, { type TestContext } from "node:test";
import { AppArguments, command, createCli, MemorySecretStore, Permission, ProfileStore } from "../src/index.js";

async function fixture(t: TestContext) {
  const directory = await mkdtemp(join(tmpdir(), "profile-own-properties-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const appArguments = new AppArguments({
    AppName: "own-properties-cli",
    Environment: {
      AppDomainDirectory: directory,
      ApplicationExecutablePath: join(directory, "fixture.js"),
      EnvironmentAppData: join(directory, "roaming"),
      EnvironmentLocalAppData: join(directory, "local"),
      ProcessId: 1,
    },
  });
  const store = new ProfileStore({ applicationId: appArguments.AppName, appArguments });
  await store.setPermissions("default", ["ReadOnly", "Update"]);
  return { store, appArguments, path: join(appArguments.RoamingAppDataDirectory, "profiles.json") };
}

test("inherited object keys never count as existing profiles or permit phantom mutations", async (t) => {
  const f = await fixture(t);
  const before = await readFile(f.path, "utf8");
  for (const name of ["constructor", "toString"]) {
    for (const operation of [
      () => f.store.get(name),
      () => f.store.getPermissions(name),
      () => f.store.set(name, { url: "https://unused.example.test" }),
      () => f.store.setDefault(name),
      () => f.store.delete(name),
      () => f.store.setPermissions(name, ["Update"]),
    ]) {
      await assert.rejects(operation(), /does not exist/);
      assert.equal(await readFile(f.path, "utf8"), before);
    }
  }
  await assert.rejects(f.store.get("__proto__"), /does not exist/);
  await assert.rejects(f.store.getPermissions("__proto__"), /does not exist/);
  for (const operation of [
    () => f.store.create("__proto__"),
    () => f.store.set("__proto__", {}),
    () => f.store.setDefault("__proto__"),
    () => f.store.delete("__proto__"),
    () => f.store.setPermissions("__proto__", []),
  ]) {
    await assert.rejects(operation(), /must start with a letter or number/);
  }
  assert.equal(await readFile(f.path, "utf8"), before);
  assert.equal((await f.store.get()).name, "default");
  assert.deepEqual(await f.store.getPermissions(), ["ReadOnly", "Update"]);
});

test("legal object-key profile names retain isolated permission defaults, grants and resets", async (t) => {
  const f = await fixture(t);
  const writes: string[] = [];
  const cli = createCli({
    name: f.appArguments.AppName,
    description: "Own-property permission fixture",
    permissions: {},
    commands: [
      command("read", "Read fixture", (_input, context) => context.profile.name, {
        permission: Permission.ReadOnly,
      }),
      command("write", "Write fixture", (_input, context) => {
        writes.push(context.profile.name);
        return context.profile.name;
      }, { permission: Permission.Update }),
    ],
    runtime: {
      appArguments: f.appArguments,
      profileStore: f.store,
      secretStore: new MemorySecretStore(),
      input: Readable.from([]),
      output: new Writable({ write(_chunk, _encoding, done) { done(); } }),
      error: new Writable({ write(_chunk, _encoding, done) { done(); } }),
      fetch: async () => { assert.fail("Permission fixture must not use HTTP"); },
    },
  });
  for (const name of ["constructor", "toString"]) {
    await cli.execute(["profile", "create", name]);
    assert.equal(await f.store.getPermissions(name), undefined);
    const run = (...args: string[]) => cli.execute(["--profile", name, ...args]);
    assert.equal(await run("read"), name);
    await assert.rejects(run("write"), /Permission 'Update' is disabled/);
    await run("permissions", "grant", "Update");
    assert.equal(await run("write"), name);
    await run("permissions", "revoke", "Update");
    await run("permissions", "revoke", "ReadOnly");
    assert.deepEqual(await f.store.getPermissions(name), []);
    await assert.rejects(run("read"), /Permission 'ReadOnly' is disabled/);
    await run("permissions", "grant", "ReadOnly");
    assert.equal(await run("read"), name);
    await f.store.set(name, { label: name });
    await f.store.setDefault(name);
    assert.equal((await f.store.get()).values.label, name);
    await f.store.setDefault("default");
    await cli.execute(["profile", "delete", name]);
    await cli.execute(["profile", "create", name]);
    assert.equal(await f.store.getPermissions(name), undefined);
    assert.equal(await run("read"), name);
    await assert.rejects(run("write"), /Permission 'Update' is disabled/);
    assert.deepEqual(await f.store.getPermissions("default"), ["ReadOnly", "Update"]);
  }
  assert.deepEqual(writes, ["constructor", "toString"]);
  assert.equal(await f.store.getPermissions("constructor"), undefined);
  assert.equal(await f.store.getPermissions("toString"), undefined);
});

test("own special JSON keys remain data and never supply another profile's permissions", async (t) => {
  const f = await fixture(t);
  const values = JSON.parse('{"constructor":"fixture-constructor","toString":"fixture-text","__proto__":{"marker":"fixture-data"}}') as Record<string, unknown>;
  await f.store.create("constructor", values);
  await f.store.create("toString");
  const document = JSON.parse(await readFile(f.path, "utf8"));
  document.permissions = JSON.parse('{"default":["ReadOnly"],"__proto__":["Update"]}');
  await writeFile(f.path, JSON.stringify(document));
  assert.deepEqual((await f.store.get("constructor")).values, values);
  assert.equal(await f.store.getPermissions("constructor"), undefined);
  assert.equal(await f.store.getPermissions("toString"), undefined);
  await f.store.setPermissions("constructor", ["Update"]);
  await f.store.setPermissions("toString", []);
  assert.deepEqual(await f.store.getPermissions("constructor"), ["Update"]);
  assert.deepEqual(await f.store.getPermissions("toString"), []);
  assert.deepEqual(await f.store.getPermissions("default"), ["ReadOnly"]);
  await f.store.set("constructor", { changed: true });
  assert.deepEqual((await f.store.get("constructor")).values, { ...values, changed: true });
  await f.store.delete("constructor");
  const persisted = JSON.parse(await readFile(f.path, "utf8"));
  assert.equal(Object.hasOwn(persisted.permissions, "__proto__"), true);
  assert.deepEqual(persisted.permissions.__proto__, ["Update"]);
  assert.equal(Object.hasOwn(persisted.permissions, "constructor"), false);
  assert.deepEqual(persisted.permissions.toString, []);
  assert.equal(Object.getPrototypeOf(persisted.profiles), Object.prototype);
  assert.equal(Object.hasOwn(Object.prototype, "marker"), false);
});
