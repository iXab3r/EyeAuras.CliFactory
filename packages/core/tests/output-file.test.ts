import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { mkdtemp, realpath, rm, readFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { saveFile as save } from "../src/index.js";

test("user output uses captured cwd and explicit relative/absolute paths", async t => {
  const cwd = await realpath(await mkdtemp(join(tmpdir(), "output-test-")));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  await mkdir(join(cwd, "nested"));
  for (const output of [undefined, "nested/relative.txt", join(cwd, "absolute.txt")]) {
    const result = await save({ cwd, name: "default.txt", ...(output === undefined ? {} : { output }), content: "synthetic" });
    assert.equal(result.path, output?.startsWith("/") ? output : join(cwd, output ?? "default.txt"));
    assert.equal(await readFile(result.path, "utf8"), "synthetic");
    assert.equal(result.bytes, Buffer.byteLength("synthetic"));
    assert.equal(result.sha256, createHash("sha256").update("synthetic").digest("hex"));
  }
  await assert.rejects(save({cwd, name: "../escape", content: "synthetic"}));
  await assert.rejects(save({cwd, name: "default.txt", content: "synthetic"}));
  await assert.rejects(save({cwd, name: "unused", output: "missing/file", content: "synthetic"}));
});
