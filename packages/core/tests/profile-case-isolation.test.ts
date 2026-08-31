import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable, Writable } from "node:stream";
import test, { type TestContext } from "node:test";
import { AppArguments, createCli, MemorySecretStore, ProfileStore, tokenAuth } from "../src/index.js";

async function fixture(t: TestContext, defaultName = "default") {
  const directory = await mkdtemp(join(tmpdir(), "profile-case-isolation-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const appArguments = new AppArguments({
    AppName: "profile-isolation-cli",
    Profile: defaultName,
    Environment: {
      AppDomainDirectory: directory,
      ApplicationExecutablePath: join(directory, "fixture.js"),
      EnvironmentAppData: join(directory, "roaming"),
      EnvironmentLocalAppData: join(directory, "local"),
      ProcessId: 1,
    },
  });
  let validations = 0;
  const options = {
    applicationId: appArguments.AppName,
    appArguments,
    defaultName,
    validate() { validations++; },
  };
  return {
    appArguments,
    store: new ProfileStore(options),
    reload: () => new ProfileStore(options),
    path: join(appArguments.RoamingAppDataDirectory, "profiles.json"),
    validations: () => validations,
  };
}

test("case-colliding create rejects before validation or persistence and preserves exact identities", async (t) => {
  const f = await fixture(t);
  await f.store.create("Fixture", { url: "https://fixture.example.test" });
  await f.store.setDefault("Fixture");
  await f.store.setPermissions("Fixture", ["ReadOnly", "Update"]);
  const before = await readFile(f.path, "utf8");
  const validations = f.validations();
  for (const name of ["fixture", "FIXTURE", "FiXtUrE"]) {
    await assert.rejects(f.store.create(name, { url: "https://unused.example.test" }), /ignoring letter case/);
    assert.equal(await readFile(f.path, "utf8"), before);
  }
  assert.equal(f.validations(), validations);
  assert.equal((await f.reload().get()).name, "Fixture");
  assert.deepEqual(await f.reload().getPermissions("Fixture"), ["ReadOnly", "Update"]);
  await assert.rejects(f.reload().get("fixture"), /does not exist/);
  await f.store.create("Different", { url: "https://different.example.test" });
  assert.equal((await f.reload().get("Different")).name, "Different");
  assert.equal((await f.reload().get("Fixture")).values.url, "https://fixture.example.test");
});

test("a virtual mixed-case default reserves its identity without creating a document", async (t) => {
  const f = await fixture(t, "Fixture");
  await assert.rejects(f.store.create("fixture"), /ignoring letter case/);
  assert.equal(f.validations(), 0);
  assert.equal((await f.store.get()).name, "Fixture");
  await assert.rejects(readFile(f.path), { code: "ENOENT" });
  await assert.rejects(f.store.create("PROFILES.JSON"), /reserved/);
  await assert.rejects(f.store.create("Profiles.Json"), /reserved/);
});

test("every store operation fails closed on existing case collisions without repairing the document", async (t) => {
  const f = await fixture(t);
  const contents = JSON.stringify({
    version: 1,
    active: "default",
    profiles: {
      default: {},
      Fixture: { url: "https://first.example.test" },
      fixture: { url: "https://second.example.test" },
    },
    permissions: { Fixture: ["ReadOnly"], fixture: ["Update"] },
  }, null, 2);
  await mkdir(f.appArguments.RoamingAppDataDirectory, { recursive: true });
  await writeFile(f.path, contents);
  const operations = [
    () => f.store.get(),
    () => f.store.list(),
    () => f.store.create("Different"),
    () => f.store.set("Fixture", {}),
    () => f.store.setDefault("Fixture"),
    () => f.store.delete("Fixture"),
    () => f.store.getPermissions("Fixture"),
    () => f.store.setPermissions("Fixture", []),
  ];
  for (const operation of operations) {
    await assert.rejects(operation(), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /differ only by letter case.*Back up.*manually.*reconfigure/);
      assert.doesNotMatch(error.message, /first\.example|second\.example|ReadOnly|Update/);
      return true;
    });
    assert.equal(await readFile(f.path, "utf8"), contents);
  }
  assert.equal(f.validations(), 0);
});

test("interactive configure rejects collisions before prompts, validation, credentials or HTTP", async (t) => {
  for (const args of [[], ["--url", "https://unused.example.test"], ["--token-stdin"]]) {
    const f = await fixture(t);
    await f.store.create("Fixture", { url: "https://fixture.example.test" });
    const before = await readFile(f.path, "utf8");
    const validations = f.validations();
    let inputReads = 0;
    let output = "";
    let errors = "";
    const rawModes: boolean[] = [];
    const input = Object.assign(new Readable({
      read() {
        inputReads++;
        this.push("synthetic-unused-input\n");
        this.push(null);
      },
    }), {
      isTTY: true,
      setRawMode(enabled: boolean) { rawModes.push(enabled); },
    });
    const secrets = new MemorySecretStore();
    for (const method of ["get", "set", "delete"] as const) {
      secrets[method] = async () => { assert.fail(`Collision reached secret ${method}`); };
    }
    const cli = createCli({
      name: f.appArguments.AppName,
      description: "Profile isolation fixture",
      profile: {
        fields: [{ name: "url", flags: "--url <url>", description: "Service URL", required: true }],
        validate() { assert.fail("Collision reached profile validation"); },
      },
      auth: tokenAuth({ validate() { assert.fail("Collision reached auth validation"); } }),
      commands: [],
      runtime: {
        appArguments: f.appArguments,
        profileStore: f.store,
        secretStore: secrets,
        input,
        output: Object.assign(new Writable({
          write(chunk, _encoding, done) { output += chunk.toString(); done(); },
        }), { isTTY: true }),
        error: Object.assign(new Writable({
          write(chunk, _encoding, done) { errors += chunk.toString(); done(); },
        }), { isTTY: true }),
        fetch: async () => { assert.fail("Collision reached HTTP"); },
      },
    });
    assert.equal(await cli.run(["profile", "configure", "fixture", ...args]), 1);
    assert.match(errors, /ignoring letter case/);
    assert.doesNotMatch(errors, /Service URL|synthetic-unused-input|unused\.example/);
    assert.equal(output, "");
    assert.equal(inputReads, 0);
    assert.deepEqual(rawModes, []);
    assert.equal(f.validations(), validations);
    assert.equal(await readFile(f.path, "utf8"), before);
  }
});
