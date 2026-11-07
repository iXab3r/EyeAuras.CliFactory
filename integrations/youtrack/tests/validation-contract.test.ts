import assert from "node:assert/strict";
import { after, afterEach, before, test } from "node:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { trackRequests } from "@eyeauras/cli-factory/testing";
import { configuredFixture } from "./cli-fixture.js";
import { mutationBody } from "../src/client.js";

const server = setupServer();
before(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
after(() => server.close());

const cases = [
  { argv: ["issues", "update", "DEMO-1"], path: "/issues/DEMO-1", body: { summary: null } },
  { argv: ["issues", "create"], path: "/issues", body: { project: { id: "0-1" }, summary: null } },
  { argv: ["issues", "comments", "update", "DEMO-1", "Comment"], path: "/issues/DEMO-1/comments/Comment",
    body: { text: null, pinned: true, visibility: null } },
  { argv: ["issues", "fields", "set", "DEMO-1", "State"], path: "/issues/DEMO-1/customFields/State",
    body: { $type: "StateMachineIssueCustomField", event: { id: "start" }, value: { id: "old-state" }, futureMetadata: false } },
  { argv: ["sprint", "update", "Board", "current"], path: "/agiles/Board/sprints/current",
    body: { name: " Future\nsprint ", previousSprint: { id: "", name: "Prior" }, futureOption: false } },
  { argv: ["article", "update", "Article"], path: "/articles/Article",
    body: { summary: null, parentArticle: { id: "Parent" }, visibility: { $type: "UnlimitedVisibility" }, futureOption: false } },
  { argv: ["article", "comment", "update", "Article", "Comment"], path: "/articles/Article/comments/Comment",
    body: { text: null, pinned: true, visibility: null } },
  { argv: ["article", "comment", "update", "Article", "Comment"], path: "/articles/Article/comments/Comment",
    body: { pinned: true, visibility: null } },
  { argv: ["issues", "fields", "set", "DEMO-1", "Field"], path: "/issues/DEMO-1/customFields/Field",
    body: { $type: "FutureIssueCustomField", value: { futureSelector: " value " }, futureOption: false } },
  { argv: ["issues", "create"], path: "/issues",
    body: { project: { id: "0-1", shortName: "DEMO" }, summary: "", customFields: [
      { $type: "SingleEnumIssueCustomField", id: "92-1", name: "Priority", value: { id: "67-1", name: "Major", $type: "EnumBundleElement" } },
    ], visibility: { $type: "UnlimitedVisibility" } } },
];
for (const row of cases) {
  test(`native JSON is preserved by ${row.argv.join(" ")}`, async t => {
    const f = await configuredFixture(t);
    const requests = trackRequests(t, 1, async request => {
      assert.equal(request.method, "POST");
      assert.equal(new URL(request.url).pathname, "/context/api" + row.path);
      assert.deepEqual(await request.json(), row.body);
      return HttpResponse.json({ id: "result" });
    });
    server.use(http.all("*", ({ request }) => requests.handle(request)));
    const argv = [...row.argv, "--body", JSON.stringify(row.body)];
    await assert.rejects(f.cli.execute(argv), /Permission/);
    assert.equal(requests.count, 0);
    await f.cli.execute(["permissions", "grant", "Update"]);
    await f.cli.execute(argv);
  });
}

test("empty projections, queries, zero page size and escaped ID controls reach the API unchanged", async t => {
  const f = await configuredFixture(t, { url: "https://youtrack.example.com/admin/context" });
  const requests = trackRequests(t, 2, request => {
    const url = new URL(request.url);
    if (url.pathname.endsWith("/issues")) {
      assert.equal(url.searchParams.get("query"), "");
      assert.equal(url.searchParams.get("$top"), "0");
      assert.equal(url.searchParams.get("fields"), "");
      return HttpResponse.json([]);
    }
    assert.equal(url.pathname, "/admin/context/api/issues/opaque%0Aid");
    return HttpResponse.json({ id: "opaque\nid" });
  });
  server.use(http.get("*", ({ request }) => requests.handle(request)));
  await f.cli.execute(["issues", "list", "--query", "", "--fields", "", "--page-size", "0"]);
  await f.cli.execute(["issues", "get", "opaque\nid"]);
});

test("caret Int values and repeated opaque issue selections are preserved", async t => {
  const f = await configuredFixture(t, { permissions: ["ReadOnly", "Update"] });
  const requests = trackRequests(t, 2, async request => {
    const body = await request.json();
    if (new URL(request.url).pathname.endsWith("/assist")) {
      assert.deepEqual(body, { query: "x", caret: -1 });
      return HttpResponse.json({ suggestions: [] });
    }
    assert.deepEqual(body, { query: "", issues: [{ id: " future/id " }, { id: " future/id " }] });
    return new HttpResponse(null, { status: 204 });
  });
  server.use(http.post("*", ({ request }) => requests.handle(request)));
  await f.cli.execute(["commands", "assist", "--query", "x", "--caret", "-1"]);
  await f.cli.execute(["commands", "apply", "--query", "", "--issues", " future/id , future/id "]);
});

test("additional body fields retain safe remote errors without retries", async t => {
  const f = await configuredFixture(t, { permissions: ["ReadOnly", "Update"] });
  const requests = trackRequests(t, 1, async request => {
    assert.deepEqual(await request.json(), { futureField: " future value " });
    return HttpResponse.text("synthetic-private-response", { status: 400 });
  });
  server.use(http.post("*", ({ request }) => requests.handle(request)));
  const result = await f.run(f.cli, ["article", "update", "Article", "--body", '{"futureField":" future value "}', "--json"]);
  assert.equal(result.exitCode, 1);
  assert.equal(result.stdout, "");
  assert.match(JSON.parse(result.stderr).error.message, /HTTP 400/);
  assert.ok(!result.stderr.includes("synthetic-private-response"));
});

test("article comment metadata-only updates retain safe remote errors without retries", async t => {
  const f = await configuredFixture(t, { permissions: ["ReadOnly", "Update"] });
  const requests = trackRequests(t, 1, async request => {
    assert.equal(new URL(request.url).pathname, "/context/api/articles/Article/comments/Comment");
    assert.deepEqual(await request.json(), { pinned: true });
    return HttpResponse.text("synthetic-private-comment-response", { status: 400 });
  });
  server.use(http.post("*", ({ request }) => requests.handle(request)));
  const result = await f.run(f.cli, ["article", "comment", "update", "Article", "Comment", "--body", '{"pinned":true}', "--json"]);
  assert.equal(result.exitCode, 1);
  assert.equal(result.stdout, "");
  assert.match(JSON.parse(result.stderr).error.message, /HTTP 400/);
  assert.ok(!result.stderr.includes("synthetic-private-comment-response"));
});

test("nullable issue summaries retain safe remote errors without retries", async t => {
  const f = await configuredFixture(t, { permissions: ["ReadOnly", "Update"] });
  const requests = trackRequests(t, 1, async request => {
    assert.equal(new URL(request.url).pathname, "/context/api/issues/DEMO-1");
    assert.deepEqual(await request.json(), { summary: null });
    return HttpResponse.text("synthetic-private-summary-response", { status: 400 });
  });
  server.use(http.post("*", ({ request }) => requests.handle(request)));
  const result = await f.run(f.cli, ["issues", "update", "DEMO-1", "--body", '{"summary":null}', "--json"]);
  assert.equal(result.exitCode, 1);
  assert.equal(result.stdout, "");
  assert.match(JSON.parse(result.stderr).error.message, /HTTP 400/);
  assert.ok(!result.stderr.includes("synthetic-private-summary-response"));
});

test("native bodies still require JSON objects and JSON value types", () => {
  const cycle: Record<string, unknown> = {}; cycle.self = cycle;
  for (const value of [null, [], { value: undefined }, { value: NaN }, { value: () => 1 }, cycle])
    assert.throws(() => mutationBody(value), /JSON/);
});
