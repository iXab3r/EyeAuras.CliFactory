import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { createCli, downloadCommands, ProfileFileError, saveProfileFile } from "../src/index.js";
import { createCliFixture } from "../src/testing.js";

test("saveProfileFile publishes generated text under downloads without overwriting", async (t) => {
  const f = await createCliFixture(t, { applicationId: "downloads-fixture" });
  const appDataDirectory = f.appArguments.WithProfile("default").AppDataDirectory;
  const content = "﻿line one\r\nline two ü\n";
  const saved = await saveProfileFile({ appDataDirectory, name: "notes.md", content });
  const bytes = Buffer.from(content, "utf8");
  assert.deepEqual(saved, {
    path: join(appDataDirectory, "downloads", "notes.md"),
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
  assert.deepEqual(await readFile(saved.path), bytes);
  await assert.rejects(saveProfileFile({ appDataDirectory, name: "notes.md", content: "other" }),
    (error) => error instanceof ProfileFileError && /already exists; no overwrite/.test(error.message));
  await assert.rejects(saveProfileFile({ appDataDirectory, name: "../escape.md", content }), ProfileFileError);
  assert.equal(await readFile(saved.path, "utf8"), content);
});

test("downloads built-ins list, delete and clean only regular files of the selected profile", async (t) => {
  const f = await createCliFixture(t, {
    applicationId: "downloads-fixture",
    profiles: [{ name: "default" }, { name: "other" }],
  });
  const app = f.createApplication((runtime) => createCli({
    name: "downloads-fixture", description: "Fixture", builtins: [downloadCommands], commands: [], runtime,
  }));
  const root = (profile: string) => f.appArguments.WithProfile(profile).AppDataDirectory;
  assert.deepEqual(await app.execute(["downloads", "list"]), []);
  for (const name of ["a.txt", "b.txt"]) {
    await saveProfileFile({ appDataDirectory: root("default"), name, content: name });
  }
  await saveProfileFile({ appDataDirectory: root("other"), name: "a.txt", content: "other" });
  const downloads = join(root("default"), "downloads");
  await mkdir(join(downloads, "folder"));
  await writeFile(join(root("default"), "outside.txt"), "keep");
  let linked = true;
  try {
    await symlink(join(root("default"), "outside.txt"), join(downloads, "link.txt"));
  } catch {
    linked = false; // Windows without symlink rights: the regular-file checks still apply.
  }

  const listed = await app.execute(["downloads", "list"]) as { name: string; path: string; bytes: number }[];
  assert.deepEqual(listed.map(({ name, path, bytes }) => ({ name, path, bytes })), [
    { name: "a.txt", path: join(downloads, "a.txt"), bytes: 5 },
    { name: "b.txt", path: join(downloads, "b.txt"), bytes: 5 },
  ]);
  await assert.rejects(app.execute(["downloads", "delete", "missing.txt"]), /Saved file was not found/);
  await assert.rejects(app.execute(["downloads", "delete", "../outside.txt"]), /Saved file was not found/);
  assert.deepEqual(await app.execute(["downloads", "delete", "a.txt"]), { deleted: ["a.txt"] });
  assert.deepEqual(await app.execute(["downloads", "clean"]), { deleted: ["b.txt"] });
  assert.deepEqual((await readdir(downloads)).sort(), ["folder", ...(linked ? ["link.txt"] : [])]);
  assert.equal(await readFile(join(root("default"), "outside.txt"), "utf8"), "keep");
  assert.deepEqual((await app.execute(["downloads", "list", "--profile", "other"]) as { name: string }[])
    .map((file) => file.name), ["a.txt"]);
  const [reply] = await f.rpc(app, [["downloads", "clean", "--profile", "other"]]) as { result: unknown }[];
  assert.deepEqual(reply!.result, { deleted: ["a.txt"] });
});
