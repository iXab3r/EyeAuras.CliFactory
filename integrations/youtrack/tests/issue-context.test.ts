import assert from "node:assert/strict";
import { join } from "node:path";
import { after, afterEach, before, test, type TestContext } from "node:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { fixture as cliFixture } from "./cli-fixture.js";
import { getActivitiesPage, getIssueActivitiesPage, updateComment } from "../src/issue-context.js";

const server = setupServer();
before(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
after(() => server.close());
const endpoint = "https://dev.example.com/track/api";
const connection = { baseUrl: "https://dev.example.com/track", token: "synthetic-dev" };
const envelope = {
  id: "fixture-page", beforeCursor: "fixture:^:before", afterCursor: "fixture:+:after",
  hasBefore: true, hasAfter: true, reverse: true,
  activities: [{ id: "fixture-activity", $type: "CommentActivityItem", timestamp: 1, author: { id: "fixture-user" } }],
};

async function fixture(t: TestContext, input = "") {
  const f = await cliFixture(t, input);
  for (const profile of ["dev", "production"]) {
    await f.cli.execute(["profile", "create", profile, "--url", `https://${profile}.example.com/track`]);
    await f.secrets.set("ai-cli-factory:youtrack-cli", `${profile}:token`, `synthetic-${profile}`);
  }
  return f;
}
const reads = [
  { argv: ["activities", "page", "--categories", "CommentsCategory"], path: "/activitiesPage", result: envelope, fields: "id,beforeCursor,afterCursor,hasBefore,hasAfter,reverse,activities(id,$type,timestamp,author(id,login),category(id))" },
  { argv: ["issues", "activity", "page", "fixture-issue", "--categories", "CommentsCategory"], path: "/issues/fixture-issue/activitiesPage", result: envelope, fields: "id,beforeCursor,afterCursor,hasBefore,hasAfter,reverse,activities(id,$type,timestamp,author(id,login),category(id))" },
  { argv: ["issues", "comments", "get", "fixture-issue", "fixture-comment"], path: "/issues/fixture-issue/comments/fixture-comment", result: { id: "fixture-comment", text: null, author: null, updated: null }, fields: "id,text,author(id,login),created,updated" },
  { argv: ["issues", "sprints", "list", "fixture-issue"], path: "/issues/fixture-issue/sprints", result: [{ id: "fixture-sprint", goal: null, start: null, finish: null, agile: null }], fields: "id,name,goal,start,finish,archived,agile(id,name)" },
  { argv: ["issues", "vcs-changes", "list", "fixture-issue"], path: "/issues/fixture-issue/vcsChanges", result: [{ id: "fixture-change", $type: "VcsChange", fetched: null, text: null }, { id: "fixture-pr", $type: "PullRequest", fetched: null }], fields: "id,$type,date,fetched,text,author(login)" },
  { argv: ["issues", "vcs-changes", "get", "fixture-issue", "fixture-change"], path: "/issues/fixture-issue/vcsChanges/fixture-change", result: { id: "fixture-change", $type: "PullRequest", text: null }, fields: "id,$type,date,fetched,text,author(login)" },
];

for (const row of reads) test(`context CLI ${row.argv.slice(0, 3).join(" ")} preserves service shapes and gates ReadOnly`, async (t) => {
  const f = await fixture(t);
  let calls = 0;
  server.use(http.get(endpoint + row.path, ({ request }) => {
    calls++;
    const query = new URL(request.url).searchParams;
    assert.equal(query.get("fields"), row.fields);
    assert.equal(request.headers.get("authorization"), "Bearer synthetic-dev");
    if (row.argv.includes("list")) { assert.equal(query.get("$top"), "50"); assert.equal(query.get("$skip"), "0"); }
    else { assert.equal(query.has("$top"), false); assert.equal(query.has("$skip"), false); }
    return HttpResponse.json(row.result);
  }));
  assert.equal(await f.cli.run([...row.argv, "--profile", "dev", "--json"]), 0);
  assert.deepEqual(JSON.parse(f.stdout()), row.result);
  assert.equal(calls, 1);
  await f.cli.execute(["permissions", "revoke", "ReadOnly", "--profile", "dev"]);
  await assert.rejects(f.cli.execute([...row.argv, "--profile", "dev"]), /Permission 'ReadOnly' is disabled/);
  assert.equal(calls, 1);
});

test("activity cursor filters round-trip exactly, preserve metadata and never fetch a second page", async (t) => {
  const f = await fixture(t);
  let calls = 0;
  server.use(http.get(endpoint + "/activitiesPage", ({ request }) => {
    calls++;
    assert.deepEqual(Object.fromEntries(new URL(request.url).searchParams), {
      fields: "beforeCursor,afterCursor,hasBefore,hasAfter,reverse,activities(id)",
      categories: "CommentsCategory,IssueCreatedCategory", cursor: "fixture:^:+/#?&", reverse: "true",
    });
    return HttpResponse.json(envelope);
  }));
  const argv = ["activities", "page", "--categories", "CommentsCategory,IssueCreatedCategory", "--cursor", "fixture:^:+/#?&", "--reverse",
    "--fields", "beforeCursor,afterCursor,hasBefore,hasAfter,reverse,activities(id)", "--profile", "dev"];
  assert.deepEqual(await f.cli.execute(argv), envelope);
  assert.equal(calls, 1);
  for (const extra of [["--top", "1"], ["--skip", "0"], ["--page-size", "1"], ["--start", "1"], ["--end", "2"], ["--author", "me"], ["--activity-id", "fixture"], ["--issue-query", "test"]])
    await assert.rejects(f.cli.execute([...argv, ...extra]), /unknown option/);
  await assert.rejects(f.cli.execute(["issues", "activity", "page", "fixture-issue", "--categories", "CommentsCategory", "--issue-query", "test", "--profile", "dev"]), /unknown option/);
  assert.equal(calls, 1);
});

test("activity categories are required before profile onboarding and empty filter values never reach fetch", async (t) => {
  const f = await fixture(t);
  for (const argv of [["activities", "page"], ["issues", "activity", "page", "fixture-issue"]])
    await assert.rejects(f.cli.execute(argv), /required option/);
  for (const categories of ["", "CommentsCategory,", ",CommentsCategory", "CommentsCategory\n"]) {
    await assert.rejects(f.cli.execute(["activities", "page", "--categories", categories]), /categories/);
    await assert.rejects(getActivitiesPage({ ...connection, fetch: async () => assert.fail("invalid categories reached fetch") }, { categories }), /categories/);
  }
  await assert.rejects(getIssueActivitiesPage({ ...connection, fetch: async () => assert.fail("invalid cursor reached fetch") }, "fixture-issue", { categories: "CommentsCategory", cursor: "\n" }), /cursor/);
});

test("activity pages accept empty and sparse projections but reject invalid envelope members", async () => {
  server.use(http.get(endpoint + "/activitiesPage", () => HttpResponse.json({ ...envelope, activities: [], hasAfter: false })));
  assert.deepEqual((await getActivitiesPage(connection, { categories: "CommentsCategory" })).activities, []);
  for (const invalid of [{}, { ...envelope, activities: null }, { ...envelope, activities: [null] }, { ...envelope, beforeCursor: 4 }, { ...envelope, hasAfter: "true" }, []]) {
    server.use(http.get(endpoint + "/activitiesPage", () => HttpResponse.json(invalid)));
    await assert.rejects(getActivitiesPage(connection, { categories: "CommentsCategory" }), /invalid/);
  }
  server.use(http.get(endpoint + "/activitiesPage", () => HttpResponse.json({ afterCursor: null })));
  await assert.rejects(getActivitiesPage(connection, { categories: "CommentsCategory", fields: "afterCursor" }), /invalid activity page/);
  server.use(http.get(endpoint + "/activitiesPage", () => HttpResponse.json({ id: "fixture-page" })));
  assert.deepEqual(await getActivitiesPage(connection, { categories: "CommentsCategory", fields: "id" }), { id: "fixture-page" });
});

test("context collection paging and opaque child IDs preserve the configured context path", async (t) => {
  const f = await fixture(t);
  const seen: string[] = [];
  server.use(http.get("*", ({ request }) => {
    const url = new URL(request.url); seen.push(url.pathname);
    assert.equal(url.searchParams.get("fields"), "id");
    if (url.pathname.endsWith("/vcsChanges") || url.pathname.endsWith("/sprints")) {
      assert.equal(url.searchParams.get("$top"), "2"); assert.equal(url.searchParams.get("$skip"), "3");
      return HttpResponse.json([]);
    }
    assert.equal(url.searchParams.size, 1);
    return HttpResponse.json({ id: "fixture-item" });
  }));
  for (const resource of ["sprints", "vcs-changes"])
    assert.deepEqual(await f.cli.execute(["issues", resource, "list", "fixture/issue?", "--top", "2", "--skip", "3", "--fields", "id", "--profile", "dev"]), []);
  for (const resource of ["comments", "vcs-changes"])
    assert.deepEqual(await f.cli.execute(["issues", resource, "get", "fixture/issue?", "%2e/#", "--fields", "id", "--profile", "dev"]), { id: "fixture-item" });
  assert.deepEqual(seen, ["/track/api/issues/fixture%2Fissue%3F/sprints", "/track/api/issues/fixture%2Fissue%3F/vcsChanges", "/track/api/issues/fixture%2Fissue%3F/comments/%252e%2F%23", "/track/api/issues/fixture%2Fissue%3F/vcsChanges/%252e%2F%23"]);
  await assert.rejects(f.cli.execute(["issues", "comments", "get", "fixture-issue", "..", "--profile", "dev"]), /dot path/);
  assert.equal(seen.length, 4);
});

test("comment update gates each profile, sends only multiline text and supports empty success without retry", async (t) => {
  const f = await fixture(t);
  const argv = ["issues", "comments", "update", "fixture/issue", "fixture/comment", "--body", JSON.stringify({ text: "First line\nSecond line" })];
  let calls = 0;
  server.use(http.post("*", async ({ request }) => {
    calls++;
    assert.equal(new URL(request.url).pathname, "/track/api/issues/fixture%2Fissue/comments/fixture%2Fcomment");
    assert.equal(request.headers.get("authorization"), "Bearer synthetic-dev");
    assert.equal(request.headers.get("content-type"), "application/json");
    assert.equal(new URL(request.url).searchParams.get("fields"), "id,text,author(id,login),created,updated");
    assert.deepEqual(await request.json(), { text: "First line\nSecond line" });
    return new HttpResponse(null, { status: 204 });
  }));
  await assert.rejects(f.cli.execute([...argv, "--profile", "dev"]), /Permission 'Update' is disabled/);
  await f.cli.execute(["permissions", "grant", "Update", "--profile", "dev"]);
  await assert.rejects(f.cli.execute([...argv, "--profile", "production"]), /Permission 'Update' is disabled/);
  assert.equal(calls, 0);
  assert.equal(await f.cli.execute([...argv, "--profile", "dev"]), null);
  assert.equal(calls, 1);
  for (const input of [null, [], {}, { text: null }, { text: " " }, { text: "valid", deleted: true }, { text: "valid", visibility: null }])
    await assert.rejects(updateComment({ ...connection, fetch: async () => assert.fail("invalid update reached fetch") }, "fixture-issue", "fixture-comment", input), /body|text/);
  await assert.rejects(f.cli.execute(["issues", "comments", "update", "fixture-issue", "fixture-comment"]), /required option/);
});

test("context outputs recursively redact credentials in activity payloads and polymorphic VCS URLs", async (t) => {
  const f = await fixture(t);
  server.use(http.get(endpoint + "/issues/fixture-issue/vcsChanges/fixture-change", () => HttpResponse.json({
    $type: "PullRequest", text: "synthetic-dev", url: "https://repo.example.com/pull/1?signature=synthetic-signature",
    urls: ["https://repo.example.com/commit/fixture", "/attachment/sign=synthetic-signature/file"],
  })));
  assert.equal(await f.cli.run(["issues", "vcs-changes", "get", "fixture-issue", "fixture-change", "--profile", "dev", "--json"]), 0);
  assert.deepEqual(JSON.parse(f.stdout()), { $type: "PullRequest", text: "[redacted]", url: "[redacted]", urls: ["https://repo.example.com/commit/fixture", "[redacted]"] });
  server.use(http.get(endpoint + "/activitiesPage", () => HttpResponse.json({ ...envelope,
    activities: [{ id: "fixture-activity", added: { url: "/file?token=synthetic-signature" }, removed: "synthetic-dev" }],
  })));
  assert.deepEqual((await getActivitiesPage(connection, { categories: "AttachmentsCategory" })).activities,
    [{ id: "fixture-activity", added: { url: "[redacted]" }, removed: "[redacted]" }]);
});

test("persistent RPC preserves context profiles and recovers after sanitized remote denial", async (t) => {
  const rows = [
    ["issues", "comments", "get", "fixture-issue", "fixture-comment", "--profile", "dev"],
    ["issues", "vcs-changes", "get", "fixture-issue", "fixture-change", "--profile", "production"],
    ["activities", "page", "--categories", "CommentsCategory", "--profile", "dev"],
  ];
  const f = await fixture(t, rows.map((argv, id) => JSON.stringify({ jsonrpc: "2.0", id, method: "cli.execute", params: { argv } })).join("\n") + "\n");
  let calls = 0;
  server.use(http.get("*", ({ request }) => {
    calls++; const url = new URL(request.url), profile = url.hostname.split(".")[0];
    assert.equal(request.headers.get("authorization"), `Bearer synthetic-${profile}`);
    if (profile === "production") return new HttpResponse("synthetic-production private-response", { status: 403 });
    return HttpResponse.json(url.pathname.endsWith("activitiesPage") ? envelope : { id: "fixture-comment", text: "Fixture comment" });
  }));
  f.paths.length = 0;
  assert.equal(await f.cli.run(["--json-rpc"]), 0);
  const replies = f.stdout().trim().split("\n").map((line) => JSON.parse(line));
  assert.equal(replies[0].result.id, "fixture-comment"); assert.equal(replies[1].error.code, -32000);
  assert.match(replies[1].error.message, /HTTP 403/); assert.deepEqual(replies[2].result, envelope);
  assert.doesNotMatch(f.stdout() + f.stderr(), /synthetic-|private-response/);
  assert.deepEqual(f.paths, ["dev", "production", "dev"].map((name) => join(f.appArguments.RoamingAppDataDirectory, name)));
  assert.equal(calls, 3);
});

test("comment update and cursor failures report status without payloads or retries", async () => {
  for (const status of [401, 403, 404, 429, 500]) {
    let calls = 0;
    server.use(http.all("*", () => { calls++; return new HttpResponse("synthetic-dev private-response", { status, headers: { "Retry-After": "7" } }); }));
    for (const run of [() => getActivitiesPage(connection, { categories: "CommentsCategory" }), () => updateComment(connection, "fixture-issue", "fixture-comment", { text: "Fixture" })])
      await assert.rejects(run(), (error: Error) => { assert.match(error.message, new RegExp(`HTTP ${status}`)); assert.doesNotMatch(error.message, /synthetic-|private-response/); return true; });
    assert.equal(calls, 2);
  }
});


