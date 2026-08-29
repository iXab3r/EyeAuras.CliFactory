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
  await assert.rejects(store.set("missing", {}), /profile create missing/);

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

  await assert.rejects(store.delete("default"), /Cannot delete default profile/);
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
