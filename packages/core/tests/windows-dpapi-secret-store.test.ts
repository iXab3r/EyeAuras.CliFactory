import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { AppArguments, command, createCli, PlatformSecretStore, ProfileSecrets } from "../src/index.js";

const windows = { skip: process.platform !== "win32" };
async function fixture(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), "cli-dpapi-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const args = (AppName = "dpapi-fixture") => new AppArguments({
    AppName,
    Environment: {
      AppDomainDirectory: root, ApplicationExecutablePath: join(root, "fixture.js"),
      EnvironmentAppData: root, EnvironmentLocalAppData: root, ProcessId: process.pid,
    },
  });
  const app = args();
  const store = new PlatformSecretStore(app);
  const secrets = (profile = "default", name = app.AppName) =>
    new ProfileSecrets(name === app.AppName ? store : new PlatformSecretStore(args(name)), name, profile);
  const directory = (profile = "default", name = app.AppName) => join(args(name).WithProfile(profile).AppDataDirectory, "secrets");
  const file = async (profile = "default", name = app.AppName) => {
    const dir = directory(profile, name);
    const names = await readdir(dir);
    assert.equal(names.length, 1);
    return join(dir, names[0]!);
  };
  return { root, app, store, secrets, directory, file };
}

test("DPAPI persists Unicode secrets encrypted across fresh store instances", windows, async (t) => {
  const f = await fixture(t);
  assert.equal(await f.secrets().get("token"), undefined);
  await assert.rejects(readdir(f.directory()), { code: "ENOENT" });
  const value = "synthetic-secret-🔒-日本語";
  await f.secrets().set("token", value);
  const encrypted = await readFile(await f.file());
  assert.equal(encrypted.includes(Buffer.from(value)), false);
  const reopened = new ProfileSecrets(new PlatformSecretStore(f.app), f.app.AppName, "default");
  assert.equal(await reopened.require("token"), value);
  await reopened.set("token", "synthetic-replacement");
  assert.equal(await f.secrets().require("token"), "synthetic-replacement");
  await reopened.delete("token");
  await reopened.delete("token");
  assert.equal(await reopened.get("token"), undefined);
  assert.deepEqual(await readdir(f.directory()), []);
});

test("DPAPI isolates app/profile/name identities and rejects transplanted ciphertext", windows, async (t) => {
  const f = await fixture(t);
  await f.secrets().set("token", "synthetic-default");
  await f.secrets("other").set("token", "synthetic-other");
  await f.secrets("default", "second-fixture").set("token", "synthetic-second-app");
  assert.equal(await f.secrets().get("token"), "synthetic-default");
  assert.equal(await f.secrets("other").get("token"), "synthetic-other");
  assert.equal(await f.secrets("default", "second-fixture").get("token"), "synthetic-second-app");
  await copyFile(await f.file(), await f.file("other"));
  await assert.rejects(f.secrets("other").get("token"), { code: "secrets.unavailable" });
  await copyFile(await f.file(), await f.file("default", "second-fixture"));
  await assert.rejects(f.secrets("default", "second-fixture").get("token"), { code: "secrets.unavailable" });
  const tokenFile = await f.file();
  await f.secrets().set("different", "synthetic-different-key");
  const names = await readdir(f.directory());
  const otherFile = names.map((name) => join(f.directory(), name)).find((path) => path !== tokenFile)!;
  await copyFile(tokenFile, otherFile);
  await assert.rejects(f.secrets().get("different"), { code: "secrets.unavailable" });
});

test("DPAPI handles arbitrary secret names and concurrent independent writes", windows, async (t) => {
  const f = await fixture(t);
  const keys = ["token", "input-secret:alias", "../outside\\path", "issued-token:automation"];
  await Promise.all(keys.map((key, index) => f.secrets().set(key, `synthetic-${index}`)));
  assert.deepEqual(await Promise.all(keys.map((key) => f.secrets().get(key))), keys.map((_, index) => `synthetic-${index}`));
  assert.equal((await readdir(f.directory())).length, keys.length);
  assert.ok((await readdir(f.directory())).every((name) => /^[a-f0-9]{64}\.dpapi$/.test(name)));
  await f.secrets().delete(keys[1]!);
  assert.equal(await f.secrets().get(keys[1]!), undefined);
  assert.equal(await f.secrets().get("token"), "synthetic-0");
});

test("DPAPI corruption and filesystem failures fail closed", windows, async (t) => {
  const f = await fixture(t);
  await f.secrets().set("token", "synthetic-corruption-test");
  const file = await f.file();
  await writeFile(file, Buffer.from("synthetic-invalid-ciphertext"));
  await assert.rejects(f.secrets().get("token"), { code: "secrets.unavailable" });
  await f.store.delete(`ai-cli-factory:${f.app.AppName}`, "default:token");
  await rm(f.directory(), { recursive: true });
  await writeFile(f.directory(), "synthetic-file-blocking-directory");
  await assert.rejects(f.secrets().set("token", "synthetic-write-failure"), { code: "secrets.unavailable" });
  await assert.rejects(f.store.set("ai-cli-factory:wrong-app", "default:token", "synthetic"), { code: "secrets.unavailable" });
  await assert.rejects(f.store.set(`ai-cli-factory:${f.app.AppName}`, "../escape:token", "synthetic"), { code: "secrets.unavailable" });
});

test("failed atomic replacement cleans ciphertext staging files", windows, async (t) => {
  const f = await fixture(t);
  await f.secrets().set("token", "synthetic-original");
  const file = await f.file();
  await rm(file);
  await mkdir(file);
  await assert.rejects(f.secrets().set("token", "synthetic-rejected"), { code: "secrets.unavailable" });
  assert.deepEqual(await readdir(f.directory()), [file.split(/[\\/]/).at(-1)]);
});

test("concurrent replacements expose complete values and leave no staging files", windows, async (t) => {
  const f = await fixture(t);
  const values = Array.from({ length: 8 }, (_, i) => `synthetic-concurrent-${i}-${"x".repeat(4096)}`);
  await f.secrets().set("token", values[0]!);
  await Promise.all(values.map(async (value) => {
    await f.secrets().set("token", value);
    assert.ok(values.includes((await f.secrets().get("token"))!));
  }));
  assert.ok(values.includes((await f.secrets().get("token"))!));
  assert.equal((await readdir(f.directory())).length, 1);
});

test("createCli uses persistent platform storage without an integration override", windows, async (t) => {
  const f = await fixture(t);
  const make = () => createCli({
    name: f.app.AppName, description: "DPAPI fixture", runtime: { appArguments: f.app },
    commands: [
      command("save", "Save fixture", async (_, context) => { await context.secrets.set("token", "synthetic-default-store"); return null; }),
      command("read", "Read fixture", async (_, context) => ({ value: await context.secrets.get("token") })),
    ],
  });
  const first = make();
  const second = make();
  t.after(async () => { await first.dispose(); await second.dispose(); });
  await first.execute(["save"]);
  assert.deepEqual(await second.execute(["read"]), { value: "synthetic-default-store" });
  await first.execute(["profile", "create", "other"]);
  await first.execute(["save", "--profile", "other"]);
  await f.secrets("other").set("input-secret:auxiliary", "synthetic-auxiliary");
  await first.execute(["profile", "delete", "other"]);
  assert.equal(await f.secrets("other").get("token"), undefined);
  assert.equal(await f.secrets("other").get("input-secret:auxiliary"), undefined);
  assert.deepEqual(await second.execute(["read"]), { value: "synthetic-default-store" });
});
