import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { ProfileStore } from "../src/index.js";

test("profiles have explicit create, update, default, and delete semantics", async (context) => {
  const rootDirectory = await mkdtemp(join(tmpdir(), "cli-factory-profiles-"));
  context.after(() => rm(rootDirectory, { recursive: true, force: true }));
  const store = new ProfileStore({
    applicationId: "test-cli",
    rootDirectory,
    defaults: { url: "https://default.test" },
  });

  assert.deepEqual(await store.list(), {
    active: "default",
    profiles: [{ name: "default", values: { url: "https://default.test" } }],
  });
  await assert.rejects(store.create("default"), /already exists/);
  await assert.rejects(store.set("missing", {}), /does not exist/);

  assert.deepEqual(
    await store.create("production", { url: "https://production.test" }),
    {
      name: "production",
      values: { url: "https://production.test" },
    },
  );
  await store.set("production", { region: "eu" });
  assert.deepEqual(await store.get("production"), {
    name: "production",
    values: { url: "https://production.test", region: "eu" },
  });
  assert.deepEqual(await store.get(), {
    name: "default",
    values: { url: "https://default.test" },
  });

  await assert.rejects(store.delete("default"), /Cannot delete the default profile/);
  await store.setDefault("production");
  assert.deepEqual(await store.get(), {
    name: "production",
    values: { url: "https://production.test", region: "eu" },
  });
  assert.equal(await store.getPermissions(), undefined);
  assert.deepEqual(await store.setPermissions("default", ["ReadOnly", "Update"]), [
    "ReadOnly",
    "Update",
  ]);
  assert.deepEqual(await store.delete("default"), {
    deleted: "default",
    default: "production",
  });
  await assert.rejects(store.get("default"), /does not exist/);
  await assert.rejects(store.delete("production"), /only profile/);

  const persisted = JSON.parse(
    await readFile(join(rootDirectory, "test-cli", "profiles.json"), "utf8"),
  ) as {
    active: string;
    profiles: Record<string, unknown>;
    permissions?: Record<string, string[]>;
  };
  assert.equal(persisted.active, "production");
  assert.deepEqual(Object.keys(persisted.profiles), ["production"]);
  assert.equal(persisted.permissions, undefined);
  assert.doesNotMatch(JSON.stringify(persisted), /token|password|secret/i);
});


test("fresh profile stores retain explicit and omitted ports without touching existing files", async (t) => {
  const rootDirectory = await mkdtemp(join(tmpdir(), "cli-factory-url-profiles-"));
  t.after(() => rm(rootDirectory, { recursive: true, force: true }));
  const options = { applicationId: "test-cli", rootDirectory };
  const store = new ProfileStore(options);
  const urls = ["http://example.test:80/context", "https://example.test:443/context/", "https://example.test/context", "http://example.test:8111/context", "https://example.test:8443/context"];
  for (const [i, url] of urls.entries()) await store.create("profile-" + i, { url });
  const file = join(rootDirectory, "test-cli", "profiles.json");
  const before = await readFile(file, "utf8");
  const fresh = new ProfileStore(options);
  for (const [i, url] of urls.entries()) assert.equal((await fresh.get("profile-" + i)).values.url, url);
  assert.equal(await readFile(file, "utf8"), before);
});
