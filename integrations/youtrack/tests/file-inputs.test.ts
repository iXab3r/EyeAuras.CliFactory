import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { after, afterEach, before, test } from "node:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { configuredFixture } from "./cli-fixture.js";

const server = setupServer();
before(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
after(() => server.close());
const text = "Line one\r\n\n```md\n# Überschrift\n```\n";
const writes = [
  { argv: ["issues", "create"], body: { project: { id: "0-1" }, summary: "S" }, field: "description", path: "/context/api/issues" },
  { argv: ["issues", "update", "DEMO-1"], body: {}, field: "description", path: "/context/api/issues/DEMO-1" },
  { argv: ["issues", "comments", "add", "DEMO-1"], body: {}, field: "text", path: "/context/api/issues/DEMO-1/comments" },
  { argv: ["issues", "comments", "update", "DEMO-1", "4-1"], body: {}, field: "text", path: "/context/api/issues/DEMO-1/comments/4-1" },
  { argv: ["article", "create"], body: { project: { id: "0-1" }, summary: "S" }, field: "content", path: "/context/api/articles" },
  { argv: ["article", "update", "KB-A-1"], body: { summary: "S" }, field: "content", path: "/context/api/articles/KB-A-1" },
  { argv: ["article", "comment", "add", "KB-A-1"], body: {}, field: "text", path: "/context/api/articles/KB-A-1/comments" },
  { argv: ["article", "comment", "update", "KB-A-1", "5-1"], body: {}, field: "text", path: "/context/api/articles/KB-A-1/comments/5-1" },
];

test("text-file options send strict UTF-8 content unchanged except an initial BOM", async (t) => {
  const f = await configuredFixture(t);
  await f.cli.execute(["permissions", "grant", "Update", "--profile", "dev"]);
  const file = join(f.root, "text.md");
  await writeFile(file, `﻿${text}`);
  for (const row of writes) {
    const bodies: unknown[] = [];
    server.use(http.post("*", async ({ request }) => {
      assert.equal(new URL(request.url).pathname, row.path);
      bodies.push(await request.json());
      return HttpResponse.json({ id: "fixture-id" });
    }));
    await f.cli.execute([...row.argv, "--body", JSON.stringify(row.body), `--${row.field}-file`, file, "--profile", "dev"]);
    assert.deepEqual(bodies, [{ ...row.body, [row.field]: text }]);
  }
});

test("file conflicts, encoding and unreadable paths fail before requests; denied writes never read files", async (t) => {
  const f = await configuredFixture(t);
  server.use(http.all("*", () => assert.fail("A rejected file input reached the network.")));
  const missing = join(f.root, "missing.md");
  const update = ["issues", "update", "DEMO-1", "--body", "{}", "--description-file"];
  await assert.rejects(f.cli.execute([...update, missing, "--profile", "dev"]), /Permission 'Update' is disabled/);
  await f.cli.execute(["permissions", "grant", "Update", "--profile", "dev"]);
  await writeFile(join(f.root, "invalid.md"), Uint8Array.of(0x4c, 0xc3, 0x28));
  await mkdir(join(f.root, "folder"));
  for (const [path, error] of [
    [missing, /readable regular file/], [join(f.root, "folder"), /readable regular file/], [join(f.root, "invalid.md"), /valid UTF-8/],
  ] as const) await assert.rejects(f.cli.execute([...update, path, "--profile", "dev"]), error);
  await writeFile(join(f.root, "ok.md"), text);
  await assert.rejects(f.cli.execute(["issues", "update", "DEMO-1", "--body", "{\"description\":null}",
    "--description-file", join(f.root, "ok.md"), "--profile", "dev"]), /either --body or --description-file/);
  await assert.rejects(f.cli.execute(["issues", "update", "DEMO-1", "--body", "[]",
    "--description-file", join(f.root, "ok.md"), "--profile", "dev"]), /body must be a JSON object/);
});

test("article attachment download and export publish profile-owned files that cleanup commands remove", async (t) => {
  const f = await configuredFixture(t, { token: "synthetic-download-token" });
  const seen: string[] = [];
  server.use(http.get("*", ({ request }) => {
    const url = new URL(request.url);
    seen.push(`${url.pathname} ${request.headers.get("authorization") ?? "no-auth"}`);
    if (url.pathname === "/context/api/articles/KB-A-1/attachments/7-1") {
      return HttpResponse.json({ id: "7-1", name: "diagram.png", mimeType: "image/png", url: "/context/api/files/7-1?sign=synthetic" });
    }
    if (url.pathname === "/context/api/files/7-1") return new HttpResponse(Uint8Array.of(1, 2, 3));
    assert.equal(url.searchParams.get("fields"), "id,idReadable,content");
    return HttpResponse.json({
      id: "3-1", idReadable: "KB-A-1",
      content: "See https://youtrack.example.com/context/api/files/9-9?sign=synthetic-signature\nLine ü",
    });
  }));
  const download = await f.cli.execute(["article", "attachment", "download", "KB-A-1", "7-1", "--profile", "dev"]) as
    { name: string; path: string; bytes: number };
  const downloads = join(f.paths.at(-1)!, "downloads");
  assert.deepEqual([download.name, download.path, download.bytes], ["7-1-diagram.png", join(downloads, "7-1-diagram.png"), 3]);
  assert.deepEqual(seen.splice(0), [
    "/context/api/articles/KB-A-1/attachments/7-1 Bearer synthetic-download-token",
    "/context/api/files/7-1 no-auth",
  ]);

  const exported = await f.cli.execute(["article", "export", "KB-A-1", "--profile", "dev"]) as { id: string; path: string };
  assert.equal(exported.path, join(downloads, "KB-A-1.md"));
  assert.equal(await readFile(exported.path, "utf8"), "See [redacted]\nLine ü");
  await assert.rejects(f.cli.execute(["article", "export", "KB-A-1", "--profile", "dev"]), /already exists; no overwrite/);
  await f.cli.execute(["article", "export", "KB-A-1", "--name", "copy.md", "--profile", "dev"]);
  assert.deepEqual((await f.cli.execute(["downloads", "list", "--profile", "dev"]) as { name: string }[]).map((item) => item.name),
    ["7-1-diagram.png", "KB-A-1.md", "copy.md"]);
  assert.deepEqual(await f.cli.execute(["downloads", "delete", "copy.md", "--profile", "dev"]), { deleted: ["copy.md"] });
  assert.deepEqual(await f.cli.execute(["downloads", "clean", "--profile", "dev"]), { deleted: ["7-1-diagram.png", "KB-A-1.md"] });
});
