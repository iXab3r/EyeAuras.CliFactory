import assert from "node:assert/strict";
import fs from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import { after, afterEach, before, test, type TestContext } from "node:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import {
  getArticleAttachment,
  getChildArticle,
  getParentArticle,
  listArticleAttachments,
  listChildArticles,
  uploadArticleAttachment,
} from "../src/article-extras.js";
import { createYouTrackCli } from "../src/cli.js";
import { fixture } from "./cli-fixture.js";

const server = setupServer();
before(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
after(() => server.close());
const connection = { baseUrl: "https://youtrack.example.com/track", token: "synthetic-extras-token" };
const bytes = new Uint8Array([0, 255, 13, 10]);
const attachmentFields = "id,name,size,mimeType";
const articleListFields = "id,idReadable,summary,project(id,shortName),updated";
const articleDetailFields = articleListFields + ",content,parentArticle(id,idReadable),created";

async function localFile(t: TestContext) {
  const directory = await mkdtemp(join(tmpdir(), "youtrack-article-extras-test-"));
  t.after(async () => {
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep));
    await rm(directory, { recursive: true, force: true });
  });
  const file = join(directory, "fixture.bin");
  await writeFile(file, bytes);
  return { directory, file };
}

async function configured(t: TestContext) {
  const f = await fixture(t);
  const local = await localFile(t);
  await f.cli.execute(["profile", "create", "dev", "--url", connection.baseUrl]);
  await f.secrets.set("ai-cli-factory:youtrack-cli", "dev:token", connection.token);
  return { ...f, ...local };
}

test("five article-extra reads send finite projections, bounded pages and no follow-up requests", async () => {
  const cases = [
    { path: "/attachments", fields: attachmentFields, list: true, run: () => listArticleAttachments(connection, "fixture-parent") },
    { path: "/attachments/fixture-attachment", fields: attachmentFields, list: false, run: () => getArticleAttachment(connection, "fixture-parent", "fixture-attachment") },
    { path: "/childArticles", fields: articleListFields, list: true, run: () => listChildArticles(connection, "fixture-parent") },
    { path: "/childArticles/fixture-child", fields: articleDetailFields, list: false, run: () => getChildArticle(connection, "fixture-parent", "fixture-child") },
    { path: "/parentArticle", fields: articleDetailFields, list: false, run: () => getParentArticle(connection, "fixture-parent") },
  ];
  let calls = 0;
  for (const item of cases) {
    server.use(http.get("*", ({ request }) => {
      calls++;
      const url = new URL(request.url);
      assert.equal(url.pathname, "/track/api/articles/fixture-parent" + item.path);
      assert.equal(url.searchParams.get("fields"), item.fields);
      assert.equal(url.searchParams.get("$top"), item.list ? "50" : null);
      assert.equal(url.searchParams.get("$skip"), item.list ? "0" : null);
      assert.equal(url.searchParams.has("query"), false);
      assert.equal(request.headers.get("authorization"), "Bearer " + connection.token);
      const result = { id: "fixture", url: "/api/files/fixture?sign=synthetic-signature" };
      return HttpResponse.json(item.list ? [result] : result);
    }));
    assert.deepEqual(await item.run(), item.list ? [{ id: "fixture", url: "[redacted]" }] : { id: "fixture", url: "[redacted]" });
  }
  assert.equal(calls, 5);
});

test("article extras keep distinct parent/child and attachment IDs as single encoded segments", async () => {
  const parent = "parent/a?#%2e";
  const child = "child/b?#%2e";
  const cases = [
    { path: "/attachments/" + encodeURIComponent(child), run: () => getArticleAttachment(connection, parent, child, { fields: "id" }) },
    { path: "/childArticles/" + encodeURIComponent(child), run: () => getChildArticle(connection, parent, child, { fields: "id" }) },
    { path: "/parentArticle", run: () => getParentArticle(connection, parent, { fields: "id" }) },
  ];
  for (const item of cases) {
    server.use(http.get("*", ({ request }) => {
      const url = new URL(request.url);
      assert.equal(url.pathname, "/track/api/articles/" + encodeURIComponent(parent) + item.path);
      assert.equal(url.searchParams.get("fields"), "id");
      return HttpResponse.json({});
    }));
    assert.deepEqual(await item.run(), {});
  }
});

test("article-extra collection projections and caller page limits are exact", async () => {
  server.use(http.get("*", ({ request }) => {
    const url = new URL(request.url);
    assert.equal(url.searchParams.get("fields"), "id");
    assert.equal(url.searchParams.get("$top"), "2");
    assert.equal(url.searchParams.get("$skip"), "7");
    return HttpResponse.json([]);
  }));
  assert.deepEqual(await listArticleAttachments(connection, "fixture-parent", { fields: "id", top: 2, skip: 7 }), []);
  assert.deepEqual(await listChildArticles(connection, "fixture-parent", { fields: "id", top: 2, skip: 7 }), []);
});

test("only the parent relation accepts actual JSON null; failures and malformed results stay errors", async () => {
  server.use(http.get("*", () => HttpResponse.json(null)));
  assert.equal(await getParentArticle(connection, "fixture-article"), null);
  await assert.rejects(getChildArticle(connection, "fixture-parent", "fixture-child"), /invalid object/);
  await assert.rejects(getArticleAttachment(connection, "fixture-article", "fixture-attachment"), /invalid object/);
  for (const body of ["", " ", "{", "[]", "1", "false"]) {
    server.use(http.get("*", () => new HttpResponse(body)));
    await assert.rejects(getParentArticle(connection, "fixture-article"), /invalid .*response/);
  }
  server.use(http.get("*", () => new HttpResponse(null, { status: 204 })));
  await assert.rejects(getParentArticle(connection, "fixture-article"), /invalid JSON response/);
  for (const status of [403, 404]) {
    server.use(http.get("*", () => new HttpResponse("synthetic-private-response", { status })));
    await assert.rejects(getParentArticle(connection, "fixture-article"), (error: Error) => {
      assert.match(error.message, new RegExp("HTTP " + status));
      assert.doesNotMatch(error.message, /synthetic-/);
      return true;
    });
  }
});

test("extra reads reject invalid IDs/pages and malformed or oversized collections", async () => {
  let calls = 0;
  server.use(http.get("*", () => { calls++; return HttpResponse.json({}); }));
  await assert.rejects(getChildArticle(connection, "..", "fixture-child"), /dot path/);
  await assert.rejects(getChildArticle(connection, "fixture-parent", "."), /dot path/);
  await assert.rejects(getArticleAttachment(connection, "fixture-parent", ".."), /dot path/);
  await assert.rejects(getParentArticle(connection, "."), /dot path/);
  await assert.rejects(listChildArticles(connection, "fixture-parent", { top: 0 }), /top/);
  await assert.rejects(listArticleAttachments(connection, "fixture-parent", { skip: -1 }), /skip/);
  assert.equal(calls, 0);
  await assert.rejects(listArticleAttachments(connection, "fixture-parent"), /invalid collection/);
  server.use(http.get("*", () => HttpResponse.json([{}, {}])));
  await assert.rejects(listChildArticles(connection, "fixture-parent", { top: 1 }), /top limit/);
});

test("article upload sends one native multipart file with exact bytes, basename, projection and auth", async (t) => {
  const f = await localFile(t);
  let calls = 0;
  server.use(http.post("*/track/api/articles/fixture-article/attachments", async ({ request }) => {
    calls++;
    const url = new URL(request.url);
    assert.deepEqual([...url.searchParams.keys()], ["fields"]);
    assert.equal(url.searchParams.get("fields"), "id,url,mimeType");
    assert.equal(request.headers.get("authorization"), "Bearer " + connection.token);
    assert.match(request.headers.get("content-type")!, /^multipart\/form-data; boundary=.+/);
    assert.equal(request.redirect, "error");
    const form = await request.formData();
    assert.deepEqual([...form.keys()], ["upload1"]);
    const file = form.get("upload1");
    assert.ok(file instanceof File);
    assert.equal(file.name, "fixture.bin");
    assert.equal(file.type, "application/octet-stream");
    assert.deepEqual(new Uint8Array(await file.arrayBuffer()), bytes);
    return HttpResponse.json([{ id: "fixture", url: "/api/files/fixture?sign=synthetic-signature", mimeType: null }], { status: 201 });
  }));
  assert.deepEqual(await uploadArticleAttachment(connection, "fixture-article", f.file, { fields: "id,url,mimeType" }), [
    { id: "fixture", url: "[redacted]", mimeType: null },
  ]);
  assert.equal(calls, 1);
});

test("article upload uses metadata defaults, preserves arrays and empty success, rejects malformed shapes", async (t) => {
  const f = await localFile(t);
  for (const value of [[], [{}], [{}, {}]]) {
    server.use(http.post("*", ({ request }) => {
      assert.equal(new URL(request.url).searchParams.get("fields"), attachmentFields);
      return HttpResponse.json(value);
    }));
    assert.deepEqual(await uploadArticleAttachment(connection, "fixture-article", f.file), value);
  }
  server.use(http.post("*", () => new HttpResponse(null, { status: 204 })));
  assert.equal(await uploadArticleAttachment(connection, "fixture-article", f.file), null);
  for (const value of ["null", "{}", "[null]", "[1]", "{"]) {
    server.use(http.post("*", () => new HttpResponse(value)));
    await assert.rejects(uploadArticleAttachment(connection, "fixture-article", f.file), /invalid .*response/);
  }
});

test("article upload errors are safe, never retried and never follow another origin", async (t) => {
  const f = await localFile(t);
  let calls = 0;
  let followed = 0;
  server.use(http.get("https://files.example.com/*", () => { followed++; return HttpResponse.json([]); }));
  for (const status of [403, 413, 429, 500]) {
    server.use(http.post("*", () => {
      calls++;
      return new HttpResponse("synthetic-private " + connection.token, { status, headers: { "Retry-After": "8" } });
    }));
    await assert.rejects(uploadArticleAttachment(connection, "fixture-article", f.file), (error: Error) => {
      assert.match(error.message, new RegExp("HTTP " + status));
      assert.doesNotMatch(error.message, /synthetic-|fixture.bin/);
      return true;
    });
  }
  server.use(http.post("*", () => {
    calls++;
    return new HttpResponse(null, { status: 302, headers: { Location: "https://files.example.com/file?token=synthetic-redirect" } });
  }));
  await assert.rejects(uploadArticleAttachment(connection, "fixture-article", f.file), /YouTrack request failed/);
  server.use(http.post("*", () => { calls++; return HttpResponse.error(); }));
  await assert.rejects(uploadArticleAttachment(connection, "fixture-article", f.file), /YouTrack request failed; check connectivity/);
  assert.equal(calls, 6);
  assert.equal(followed, 0);
});

test("article upload local-file errors and invalid inputs expose no path and precede HTTP", async (t) => {
  const f = await localFile(t);
  let calls = 0;
  server.use(http.post("*", () => { calls++; return HttpResponse.json([]); }));
  for (const path of [f.directory, join(f.directory, "not-present.bin")]) {
    await assert.rejects(uploadArticleAttachment(connection, "fixture-article", path), {
      message: "YouTrack upload requires a readable regular file.",
    });
  }
  await assert.rejects(uploadArticleAttachment(connection, "fixture-article", " "), /file path/);
  await assert.rejects(uploadArticleAttachment(connection, "..", f.file), /dot path/);
  let opens = 0;
  t.mock.method(fs, "openAsBlob", async () => { opens++; throw new Error("synthetic-private-path"); });
  await assert.rejects(uploadArticleAttachment(connection, "fixture-article", f.file, { fields: "" }), /fields/);
  assert.equal(opens, 0);
  await assert.rejects(uploadArticleAttachment(connection, "fixture-article", f.file), {
    message: "YouTrack upload requires a readable regular file.",
  });
  assert.equal(opens, 1);
  assert.equal(calls, 0);
});

const reads = [
  ["article", "attachment", "list", "fixture-parent"],
  ["article", "attachment", "get", "fixture-parent", "fixture-attachment"],
  ["article", "child", "list", "fixture-parent"],
  ["article", "child", "get", "fixture-parent", "fixture-child"],
  ["article", "parent", "get", "fixture-parent"],
];

test("actual CLI mounts exactly the six extra leaves with read/write fields and proper paths", async (t) => {
  const f = await configured(t);
  await f.cli.execute(["permissions", "grant", "Update", "--profile", "dev"]);
  const tails = ["/attachments", "/attachments/fixture-attachment", "/childArticles", "/childArticles/fixture-child", "/parentArticle", "/attachments"];
  let calls = 0;
  server.use(http.all("*", ({ request }) => {
    const index = calls++;
    const url = new URL(request.url);
    assert.equal(url.pathname, "/track/api/articles/fixture-parent" + tails[index]);
    assert.equal(url.searchParams.get("fields"), "id");
    assert.equal(request.method, index === 5 ? "POST" : "GET");
    const list = index === 0 || index === 2;
    assert.equal(url.searchParams.get("$top"), list ? "2" : null);
    assert.equal(url.searchParams.get("$skip"), list ? "4" : null);
    return HttpResponse.json(list || index === 5 ? [{ id: "fixture" }] : { id: "fixture" });
  }));
  for (const [index, command] of reads.entries()) {
    const page = index === 0 || index === 2 ? ["--top", "2", "--skip", "4"] : [];
    const result = await f.cli.execute([...command, ...page, "--fields", "id", "--profile", "dev"]);
    assert.deepEqual(result, index === 0 || index === 2 ? [{ id: "fixture" }] : { id: "fixture" });
  }
  assert.deepEqual(await f.cli.execute(["article", "attachment", "upload", "fixture-parent", "--file", f.file, "--fields", "id", "--profile", "dev"]), [{ id: "fixture" }]);
  assert.equal(calls, 6);
});

test("extra permission gates reject upload before stat/open/HTTP and all reads before HTTP", async (t) => {
  const f = await configured(t);
  let calls = 0;
  let fileOperations = 0;
  server.use(http.all("*", () => { calls++; return HttpResponse.json({}); }));
  t.mock.method(fs.promises, "stat", async () => { fileOperations++; throw new Error("unexpected stat"); });
  t.mock.method(fs, "openAsBlob", async () => { fileOperations++; throw new Error("unexpected open"); });
  await assert.rejects(f.cli.execute(["article", "attachment", "upload", "fixture-parent", "--file", f.file, "--profile", "dev"]), /Permission 'Update' is disabled/);
  await f.cli.execute(["permissions", "revoke", "ReadOnly", "--profile", "dev"]);
  for (const command of reads) {
    await assert.rejects(f.cli.execute([...command, "--profile", "dev"]), /Permission 'ReadOnly' is disabled/);
  }
  assert.equal(calls, 0);
  assert.equal(fileOperations, 0);
});

test("extra missing/invalid file syntax and unsupported query fail before fresh-profile keyring", async (t) => {
  const f = await fixture(t);
  let keyringReads = 0;
  t.mock.method(f.secrets, "get", async () => { keyringReads++; throw new Error("unexpected keyring"); });
  await assert.rejects(f.cli.execute(["article", "attachment", "upload", "fixture-parent"]), /--file/);
  for (const path of [" ", "fixture\nfile"]) {
    await assert.rejects(f.cli.execute(["article", "attachment", "upload", "fixture-parent", "--file", path]), /file path/);
  }
  for (const command of [reads[0]!, reads[2]!]) {
    await assert.rejects(f.cli.execute([...command, "--query", "fixture"]), /unknown option/);
  }
  assert.equal(keyringReads, 0);
});

test("parent null and attachment redaction survive CLI JSON/human rendering", async (t) => {
  const parent = await configured(t);
  server.use(http.get("*", () => HttpResponse.json(null)));
  assert.equal(await parent.cli.run(["article", "parent", "get", "fixture-parent", "--profile", "dev", "--json"]), 0);
  assert.equal(JSON.parse(parent.stdout()), null);
  for (const json of [false, true]) {
    const f = await configured(t);
    server.use(http.get("*", () => HttpResponse.json({ id: "fixture", url: "/api/files/fixture/sign=synthetic-signature" })));
    assert.equal(await f.cli.run([...reads[1]!, "--fields", "id,url", "--profile", "dev", ...(json ? ["--json"] : [])]), 0);
    if (json) assert.deepEqual(JSON.parse(f.stdout()), { id: "fixture", url: "[redacted]" });
    else assert.match(f.stdout(), /fixture/);
    assert.doesNotMatch(f.stdout(), /synthetic-/);
    assert.equal(f.stderr(), "");
  }
});

test("persistent extras RPC keeps profile auth, nullable parent and upload redaction isolated", async (t) => {
  const f = await configured(t);
  await f.cli.execute(["profile", "create", "production", "--url", "https://production.example.com/context"]);
  await f.secrets.set("ai-cli-factory:youtrack-cli", "production:token", "synthetic-production-token");
  await f.cli.execute(["permissions", "grant", "Update", "--profile", "dev"]);
  const seen: string[] = [];
  server.use(http.all("*", async ({ request }) => {
    const url = new URL(request.url);
    const production = url.hostname === "production.example.com";
    assert.equal(request.headers.get("authorization"), "Bearer " + (production ? "synthetic-production-token" : connection.token));
    assert.ok(url.pathname.startsWith(production ? "/context/api/" : "/track/api/"));
    seen.push(request.method + " " + (production ? "production" : "dev"));
    if (production) return HttpResponse.json(null);
    const file = (await request.formData()).get("upload1");
    assert.ok(file instanceof File);
    assert.deepEqual(new Uint8Array(await file.arrayBuffer()), bytes);
    return HttpResponse.json([{ id: "fixture", url: "/api/files/fixture?sign=synthetic-signature" }]);
  }));
  const commands = [
    ["article", "parent", "get", "fixture-parent", "--profile", "production"],
    ["article", "attachment", "upload", "fixture-parent", "--file", f.file, "--fields", "id,url", "--profile", "dev"],
    ["article", "attachment", "upload", "fixture-parent", "--file", f.file, "--profile", "production"],
  ];
  const input = commands.map((argv, i) => JSON.stringify({
    jsonrpc: "2.0", id: i + 1, method: "cli.execute", params: { argv },
  })).join("\n") + "\n";
  const rpc = createYouTrackCli({ ...f.runtime, input: Readable.from([input]) });
  assert.equal(await rpc.run(["--json-rpc"]), 0);
  const rows = f.stdout().trim().split("\n").map((line) => JSON.parse(line));
  assert.deepEqual(rows[0].result, null);
  assert.deepEqual(rows[1].result, [{ id: "fixture", url: "[redacted]" }]);
  assert.equal(rows[2].error.code, -32000);
  assert.match(rows[2].error.message, /Permission 'Update' is disabled/);
  assert.deepEqual(seen, ["GET production", "POST dev"]);
  assert.doesNotMatch(f.stdout(), /synthetic-/);
  assert.equal(f.stderr(), "");
});
