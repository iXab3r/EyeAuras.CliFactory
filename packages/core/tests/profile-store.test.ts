import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { ProfileStore } from "../src/index.js";

test("profiles are independent and switching is explicit", async (context) => {
  const rootDirectory = await mkdtemp(join(tmpdir(), "cli-factory-profiles-"));
  context.after(() => rm(rootDirectory, { recursive: true, force: true }));
  const store = new ProfileStore({
    applicationId: "test-cli",
    rootDirectory,
    defaults: { url: "https://default.test" },
  });

  await store.set("production", { url: "https://production.test" });
  assert.deepEqual(await store.get(), {
    name: "default",
    values: { url: "https://default.test" },
  });

  await store.use("production");
  assert.deepEqual(await store.get(), {
    name: "production",
    values: { url: "https://production.test" },
  });

  const persisted = await readFile(join(rootDirectory, "test-cli", "profiles.json"), "utf8");
  assert.doesNotMatch(persisted, /token|password|secret/i);
});
