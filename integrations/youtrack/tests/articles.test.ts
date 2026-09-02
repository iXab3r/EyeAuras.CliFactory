import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { after, afterEach, before, test, type TestContext } from "node:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import {
  addArticleComment,
  createArticle,
  getArticle,
  getArticleComment,
  listArticleComments,
  listArticles,
  listProjectArticles,
  updateArticle,
  updateArticleComment,
} from "../src/articles.js";
import { createYouTrackCli } from "../src/cli.js";
import { configuredFixture, fixture } from "./cli-fixture.js";

const server = setupServer();
before(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
after(() => server.close());
const connection = { baseUrl: "https://youtrack.example.com/track", token: "synthetic-article-token" };
const articleListProjection = "id,idReadable,summary,project(id,shortName),updated";
const articleDetailProjection = articleListProjection + ",content,parentArticle(id,idReadable),created";
const articleWriteProjection = "id,idReadable,summary,updated";
const commentProjection = "id,text,author(id,login),created,updated";
const article = { id: "article-fixture", idReadable: "FIX-A-1", summary: null, content: null, parentArticle: null };
const comment = { id: "comment-fixture", text: null, author: null, updated: null };

async function configured(t: TestContext) {
  return configuredFixture(t, { url: connection.baseUrl, token: connection.token });
}

test("all five article reads use documented paths, finite defaults and bounded collection pages", async () => {
  const cases = [
    { path: "/articles", fields: articleListProjection, list: true, run: () => listArticles(connection) },
    { path: "/articles/fixture-article", fields: articleDetailProjection, list: false, run: () => getArticle(connection, "fixture-article") },
    { path: "/articles/fixture-article/comments", fields: commentProjection, list: true, run: () => listArticleComments(connection, "fixture-article") },
    { path: "/articles/fixture-article/comments/fixture-comment", fields: commentProjection, list: false, run: () => getArticleComment(connection, "fixture-article", "fixture-comment") },
    { path: "/admin/projects/fixture-project/articles", fields: articleListProjection, list: true, run: () => listProjectArticles(connection, "fixture-project") },
  ];
  let calls = 0;
  for (const item of cases) {
    const result = item.path.includes("comments") ? comment : article;
    server.use(http.get("*", ({ request }) => {
      calls++;
      const url = new URL(request.url);
      assert.equal(url.pathname, "/track/api" + item.path);
      assert.equal(url.searchParams.get("fields"), item.fields);
      assert.equal(url.searchParams.get("$top"), item.list ? "50" : null);
      assert.equal(url.searchParams.get("$skip"), item.list ? "0" : null);
      assert.equal(url.searchParams.has("query"), false);
      assert.equal(request.headers.get("authorization"), "Bearer " + connection.token);
      return HttpResponse.json(item.list ? [result] : result);
    }));
    assert.deepEqual(await item.run(), item.list ? [result] : result);
  }
  assert.equal(calls, 5);
});

test("article reads encode opaque IDs once and honor sparse fields/page options", async () => {
  const id = "fixture/a?#%2e";
  const cases = [
    { path: "/articles/" + encodeURIComponent(id), list: false, run: () => getArticle(connection, id, { fields: "id" }) },
    { path: "/articles/" + encodeURIComponent(id) + "/comments/" + encodeURIComponent(id), list: false, run: () => getArticleComment(connection, id, id, { fields: "id" }) },
    { path: "/articles/" + encodeURIComponent(id) + "/comments", list: true, run: () => listArticleComments(connection, id, { fields: "id", top: 2, skip: 4 }) },
    { path: "/admin/projects/" + encodeURIComponent(id) + "/articles", list: true, run: () => listProjectArticles(connection, id, { fields: "id", top: 2, skip: 4 }) },
    { path: "/articles", list: true, run: () => listArticles(connection, { fields: "id", top: 2, skip: 4 }) },
  ];
  for (const item of cases) {
    server.use(http.get("*", ({ request }) => {
      const url = new URL(request.url);
      assert.equal(url.pathname, "/track/api" + item.path);
      assert.equal(url.searchParams.get("fields"), "id");
      assert.equal(url.searchParams.get("$top"), item.list ? "2" : null);
      assert.equal(url.searchParams.get("$skip"), item.list ? "4" : null);
      return HttpResponse.json(item.list ? [{}] : {});
    }));
    assert.deepEqual(await item.run(), item.list ? [{}] : {});
  }
});

test("all four article writes send exact JSON, preserve multiline narrative and expose finite defaults", async () => {
  const cases = [
    {
      path: "/articles", fields: articleWriteProjection,
      body: { project: { id: "fixture-project" }, summary: "Fixture title", content: "line1\nline2" },
      run: (body: unknown) => createArticle(connection, body),
    },
    {
      path: "/articles/fixture-article", fields: articleWriteProjection,
      body: { summary: "Fixture changed", content: null },
      run: (body: unknown) => updateArticle(connection, "fixture-article", body),
    },
    {
      path: "/articles/fixture-article/comments", fields: commentProjection,
      body: { text: "line1\nline2" },
      run: (body: unknown) => addArticleComment(connection, "fixture-article", body),
    },
    {
      path: "/articles/fixture-article/comments/fixture-comment", fields: commentProjection,
      body: { text: "updated\ncomment" },
      run: (body: unknown) => updateArticleComment(connection, "fixture-article", "fixture-comment", body),
    },
  ];
  let calls = 0;
  for (const item of cases) {
    server.use(http.post("*", async ({ request }) => {
      calls++;
      const url = new URL(request.url);
      assert.equal(url.pathname, "/track/api" + item.path);
      assert.deepEqual([...url.searchParams.keys()], ["fields"]);
      assert.equal(url.searchParams.get("fields"), item.fields);
      assert.equal(request.headers.get("content-type"), "application/json");
      assert.equal(request.headers.get("authorization"), "Bearer " + connection.token);
      assert.equal(request.redirect, "error");
      assert.deepEqual(await request.json(), item.body);
      return HttpResponse.json({ id: "result-fixture" }, { status: 201 });
    }));
    assert.deepEqual(await item.run(item.body), { id: "result-fixture" });
  }
  assert.equal(calls, 4);
});

test("article create/update distinguish omitted content from empty string and explicit null", async () => {
  const cases = [
    { body: { project: { id: "fixture-project" }, summary: "Fixture" }, create: true },
    { body: { project: { id: "fixture-project" }, summary: "Fixture", content: "" }, create: true },
    { body: { project: { id: "fixture-project" }, summary: "Fixture", content: null }, create: true },
    { body: { summary: "Fixture" }, create: false },
    { body: { content: "" }, create: false },
    { body: { content: null }, create: false },
  ];
  for (const item of cases) {
    server.use(http.post("*", async ({ request }) => {
      assert.deepEqual(await request.json(), item.body);
      return new HttpResponse(null, { status: 204 });
    }));
    const result = item.create
      ? await createArticle(connection, item.body)
      : await updateArticle(connection, "fixture-article", item.body);
    assert.equal(result, null);
  }
});

test("article writes support explicit sparse projections and recursively scrub returned credentials", async () => {
  const operations = [
    { projection: "content", run: () => createArticle(connection, { project: { id: "fixture-project" }, summary: "Fixture" }, { fields: "content" }) },
    { projection: "content", run: () => updateArticle(connection, "fixture-article", { content: "" }, { fields: "content" }) },
    { projection: "text", run: () => addArticleComment(connection, "fixture-article", { text: "Fixture" }, { fields: "text" }) },
    { projection: "text", run: () => updateArticleComment(connection, "fixture-article", "fixture-comment", { text: "Fixture" }, { fields: "text" }) },
  ];
  server.use(http.post("*", ({ request }) => {
    const projection = new URL(request.url).searchParams.get("fields");
    assert.ok(projection === "content" || projection === "text");
    return HttpResponse.json({
      [projection]: "https://files.example.com/file?signature=synthetic-signature",
      nested: [{ value: connection.token }],
    });
  }));
  for (const operation of operations) {
    assert.deepEqual(await operation.run(), {
      [operation.projection]: "[redacted]", nested: [{ value: "[redacted]" }],
    });
  }
});

test("article validation rejects missing, empty, mistyped and unsupported write fields before fetch", async () => {
  let calls = 0;
  server.use(http.all("*", () => { calls++; return HttpResponse.json({}); }));
  const creates: unknown[] = [
    null, [], {}, { summary: "Fixture" }, { project: { id: " " }, summary: "Fixture" },
    { project: { id: "fixture-project", shortName: "FIX" }, summary: "Fixture" },
    { project: { id: "fixture-project" }, summary: null },
    { project: { id: "fixture-project" }, summary: " " },
    { project: { id: "fixture-project" }, summary: "Fixture", content: 1 },
    { project: { id: "fixture-project" }, summary: "Fixture", parentArticle: null },
    { project: { id: "fixture-project" }, summary: "Fixture", visibility: { $type: "UnlimitedVisibility" } },
  ];
  for (const body of creates) await assert.rejects(createArticle(connection, body));
  for (const body of [{}, { summary: "" }, { summary: null }, { content: false }, { reporter: null }, { project: { id: "fixture" } }]) {
    await assert.rejects(updateArticle(connection, "fixture-article", body));
  }
  for (const body of [{}, { text: null }, { text: "\n " }, { text: 2 }, { text: "Fixture", pinned: true }, { text: "Fixture", visibility: null }]) {
    await assert.rejects(addArticleComment(connection, "fixture-article", body));
    await assert.rejects(updateArticleComment(connection, "fixture-article", "fixture-comment", body));
  }
  await assert.rejects(createArticle(connection, { project: { id: "fixture" }, summary: "Fixture" }, { fields: "" }));
  await assert.rejects(updateArticle(connection, "..", { content: "Fixture" }));
  await assert.rejects(updateArticleComment(connection, "fixture-article", ".", { text: "Fixture" }));
  assert.equal(calls, 0);
});

test("article reads reject invalid pages and dot IDs before HTTP", async () => {
  let calls = 0;
  server.use(http.get("*", () => { calls++; return HttpResponse.json([]); }));
  await assert.rejects(listArticles(connection, { top: 101 }), /top/);
  await assert.rejects(listArticleComments(connection, "fixture-article", { skip: -1 }), /skip/);
  await assert.rejects(listProjectArticles(connection, ".."), /dot path/);
  await assert.rejects(getArticle(connection, "."), /dot path/);
  await assert.rejects(getArticleComment(connection, "fixture-article", ".."), /dot path/);
  await assert.rejects(getArticle(connection, "fixture-article", { fields: " " }), /fields/);
  assert.equal(calls, 0);
});

test("article reads reject malformed shapes and oversized pages while preserving empty arrays", async () => {
  server.use(http.get("*", () => HttpResponse.json([])));
  assert.deepEqual(await listArticles(connection), []);
  await assert.rejects(getArticle(connection, "fixture-article"), /invalid object/);
  server.use(http.get("*", () => HttpResponse.json({})));
  await assert.rejects(listArticleComments(connection, "fixture-article"), /invalid collection/);
  server.use(http.get("*", () => HttpResponse.json([{}, {}])));
  await assert.rejects(listProjectArticles(connection, "fixture-project", { top: 1 }), /top limit/);
  server.use(http.get("*", () => new HttpResponse("synthetic-invalid-json")));
  await assert.rejects(getArticleComment(connection, "fixture-article", "fixture-comment"), /invalid JSON response/);
});

test("article writes preserve empty success but reject malformed response shapes", async () => {
  const operations = [
    () => createArticle(connection, { project: { id: "fixture-project" }, summary: "Fixture" }),
    () => updateArticle(connection, "fixture-article", { content: null }),
    () => addArticleComment(connection, "fixture-article", { text: "Fixture" }),
    () => updateArticleComment(connection, "fixture-article", "fixture-comment", { text: "Fixture" }),
  ];
  for (const run of operations) {
    server.use(http.post("*", () => new HttpResponse(null, { status: 204 })));
    assert.equal(await run(), null);
    for (const value of ["[]", "null", "1", "{"]) {
      server.use(http.post("*", () => new HttpResponse(value)));
      await assert.rejects(run(), /invalid .*response/);
    }
  }
});

test("article write failures expose only safe HTTP details and never retry", async () => {
  const operations = [
    () => createArticle(connection, { project: { id: "fixture-project" }, summary: "Fixture" }),
    () => updateArticle(connection, "fixture-article", { content: null }),
    () => addArticleComment(connection, "fixture-article", { text: "Fixture" }),
    () => updateArticleComment(connection, "fixture-article", "fixture-comment", { text: "Fixture" }),
  ];
  let calls = 0;
  for (const [index, run] of operations.entries()) {
    const status = [400, 403, 429, 500][index]!;
    server.use(http.post("*", () => {
      calls++;
      return new HttpResponse("synthetic-private-diagnostics " + connection.token, { status, headers: { "Retry-After": "9" } });
    }));
    await assert.rejects(run(), (error: Error) => {
      assert.match(error.message, new RegExp("HTTP " + status));
      assert.doesNotMatch(error.message, /synthetic-/);
      if (status === 429) assert.match(error.message, /9 seconds/);
      return true;
    });
  }
  assert.equal(calls, 4);
});

const readCommands = [
  ["article", "list"],
  ["article", "get", "fixture-article"],
  ["article", "comment", "list", "fixture-article"],
  ["article", "comment", "get", "fixture-article", "fixture-comment"],
  ["project", "article", "list", "fixture-project"],
];
const writeCommands = [
  ["article", "create", "--body", JSON.stringify({ project: { id: "fixture-project" }, summary: "Fixture" })],
  ["article", "update", "fixture-article", "--body", JSON.stringify({ content: null })],
  ["article", "comment", "add", "fixture-article", "--body", JSON.stringify({ text: "Fixture" })],
  ["article", "comment", "update", "fixture-article", "fixture-comment", "--body", JSON.stringify({ text: "Fixture" })],
];

test("actual CLI mounts all nine article commands with fields/paging and exact service paths", async (t) => {
  const f = await configured(t);
  await f.cli.execute(["permissions", "grant", "Update", "--profile", "dev"]);
  const paths = [
    "/articles", "/articles/fixture-article", "/articles/fixture-article/comments",
    "/articles/fixture-article/comments/fixture-comment", "/admin/projects/fixture-project/articles",
    "/articles", "/articles/fixture-article", "/articles/fixture-article/comments",
    "/articles/fixture-article/comments/fixture-comment",
  ];
  let calls = 0;
  server.use(http.all("*", ({ request }) => {
    const index = calls++;
    const url = new URL(request.url);
    assert.equal(url.pathname, "/track/api" + paths[index]);
    assert.equal(request.method, index < 5 ? "GET" : "POST");
    assert.equal(url.searchParams.get("fields"), "id");
    const list = [0, 2, 4].includes(index);
    assert.equal(url.searchParams.get("$top"), list ? "2" : null);
    assert.equal(url.searchParams.get("$skip"), list ? "3" : null);
    return HttpResponse.json(list ? [{ id: "fixture" }] : { id: "fixture" });
  }));
  for (const [index, command] of [...readCommands, ...writeCommands].entries()) {
    const paging = [0, 2, 4].includes(index) ? ["--top", "2", "--skip", "3"] : [];
    const result = await f.cli.execute([...command, ...paging, "--fields", "id", "--profile", "dev"]);
    assert.deepEqual(result, [0, 2, 4].includes(index) ? [{ id: "fixture" }] : { id: "fixture" });
  }
  assert.equal(calls, 9);
});

test("all article permission gates reject before HTTP, including every mutation", async (t) => {
  const f = await configured(t);
  let calls = 0;
  server.use(http.all("*", () => { calls++; return HttpResponse.json({}); }));
  for (const command of writeCommands) {
    await assert.rejects(f.cli.execute([...command, "--profile", "dev"]), /Permission 'Update' is disabled/);
  }
  await f.cli.execute(["permissions", "revoke", "ReadOnly", "--profile", "dev"]);
  for (const command of readCommands) {
    await assert.rejects(f.cli.execute([...command, "--profile", "dev"]), /Permission 'ReadOnly' is disabled/);
  }
  assert.equal(calls, 0);
});

test("article missing bodies and JSON syntax fail before onboarding/keyring; no undocumented list query", async (t) => {
  const f = await fixture(t);
  let keyringReads = 0;
  t.mock.method(f.secrets, "get", async () => { keyringReads++; throw new Error("unexpected keyring"); });
  for (const command of writeCommands) {
    const base = command.slice(0, command.indexOf("--body"));
    await assert.rejects(f.cli.execute(base), /--body/);
    await assert.rejects(f.cli.execute([...base, "--body", "{"]), /valid JSON/);
  }
  for (const command of [readCommands[0]!, readCommands[2]!, readCommands[4]!]) {
    await assert.rejects(f.cli.execute([...command, "--query", "Fixture"]), /unknown option/);
  }
  assert.equal(keyringReads, 0);
});

test("article semantic invalid body is rejected after an explicit grant but before HTTP", async (t) => {
  const f = await configured(t);
  await f.cli.execute(["permissions", "grant", "Update", "--profile", "dev"]);
  let calls = 0;
  server.use(http.post("*", () => { calls++; return HttpResponse.json({}); }));
  for (const command of writeCommands) {
    const base = command.slice(0, command.indexOf("--body"));
    await assert.rejects(f.cli.execute([...base, "--body", "{}", "--profile", "dev"]));
  }
  assert.equal(calls, 0);
});

test("article CLI renders JSON and human results without signed URLs", async (t) => {
  for (const json of [false, true]) {
    const f = await configured(t);
    server.use(http.get("*", () => HttpResponse.json({
      summary: "Fixture title", content: "https://files.example.com/file?token=synthetic-signature",
    })));
    assert.equal(await f.cli.run(["article", "get", "fixture-article", "--profile", "dev", ...(json ? ["--json"] : [])]), 0);
    if (json) assert.deepEqual(JSON.parse(f.stdout()), { summary: "Fixture title", content: "[redacted]" });
    else assert.match(f.stdout(), /Fixture title/);
    assert.doesNotMatch(f.stdout(), /synthetic-signature/);
    assert.equal(f.stderr(), "");
  }
});

test("persistent article RPC isolates profiles and mutation gates while retaining safe outputs", async (t) => {
  const f = await configured(t);
  await f.cli.execute(["profile", "create", "production", "--url", "https://production.example.com/context"]);
  await f.secrets.set("ai-cli-factory:youtrack-cli", "production:token", "synthetic-production-token");
  await f.cli.execute(["permissions", "grant", "Update", "--profile", "dev"]);
  const seen: string[] = [];
  server.use(http.all("*", ({ request }) => {
    const url = new URL(request.url);
    const production = url.hostname === "production.example.com";
    assert.equal(request.headers.get("authorization"), "Bearer " + (production ? "synthetic-production-token" : connection.token));
    assert.ok(url.pathname.startsWith(production ? "/context/api/" : "/track/api/"));
    seen.push(request.method + " " + (production ? "production" : "dev"));
    if (production) return HttpResponse.json([{ id: "fixture" }]);
    return HttpResponse.json({ content: "/api/files/fixture/sign=synthetic-signature" });
  }));
  const commands = [
    ["article", "get", "fixture-article", "--fields", "content", "--profile", "dev"],
    ["project", "article", "list", "fixture-project", "--top", "1", "--profile", "production"],
    [...writeCommands[0]!, "--fields", "content", "--profile", "dev"],
    [...writeCommands[3]!, "--profile", "production"],
  ];
  const input = commands.map((argv, i) => JSON.stringify({
    jsonrpc: "2.0", id: i + 1, method: "cli.execute", params: { argv },
  })).join("\n") + "\n";
  const rpc = f.createApplication(runtime => createYouTrackCli({ ...runtime, input: Readable.from([input]) }));
  assert.equal(await rpc.run(["--json-rpc"]), 0);
  const rows = f.stdout().trim().split("\n").map((line) => JSON.parse(line));
  assert.equal(rows.length, 4);
  assert.deepEqual(rows[0].result, { content: "[redacted]" });
  assert.deepEqual(rows[1].result, [{ id: "fixture" }]);
  assert.deepEqual(rows[2].result, { content: "[redacted]" });
  assert.equal(rows[3].error.code, -32000);
  assert.match(rows[3].error.message, /Permission 'Update' is disabled/);
  assert.deepEqual(seen, ["GET dev", "GET production", "POST dev"]);
  assert.doesNotMatch(f.stdout(), /synthetic-/);
  assert.equal(f.stderr(), "");
});
