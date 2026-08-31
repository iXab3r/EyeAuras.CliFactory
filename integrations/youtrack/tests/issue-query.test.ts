import assert from "node:assert/strict";
import { after, afterEach, before, test } from "node:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { fixture } from "./cli-fixture.js";
import {
  applyCommands, assistCommands, assistSearch, countIssues, getSavedQuery, listSavedQueries,
  parseIssueSelection,
} from "../src/issue-query.js";

const server = setupServer();
before(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
after(() => server.close());
const connection = { baseUrl: "https://youtrack.example.com/context/", token: "synthetic-token" };
const suggestionFields = "query,caret,suggestions(option,description,caret,completionStart,completionEnd)";
const commandFields = "query,caret,commands(description,error,delete),suggestions(option,description,caret,completionStart,completionEnd)";
const savedFields = "id,name,query,owner(id,login)";
const service = "ai-cli-factory:youtrack-cli";
const query = "project: {Fixture project} #Unresolved & sort by: updated";
const rows = [
  { path: "commands", method: "POST", body: { query: "State Fixed", issues: [{ idReadable: "DEMO-1" }, { id: "2-7" }] },
    fields: "query,issues(id,idReadable)", result: { query: null, issues: [{ id: "2-7" }] },
    run: () => applyCommands(connection, "State Fixed", ["DEMO-1", "2-7"]),
    argv: ["commands", "apply", "--query", "State Fixed", "--issues", "DEMO-1,2-7"], update: true },
  { path: "commands/assist", method: "POST", body: { query: "State ", caret: 6, issues: [{ idReadable: "DEMO-1" }] },
    fields: commandFields, result: { query: null, caret: 6, commands: [{ error: null, delete: null, description: null }], suggestions: [] },
    run: () => assistCommands(connection, { query: "State ", caret: 6, issues: ["DEMO-1"] }),
    argv: ["commands", "assist", "--query", "State ", "--caret", "6", "--issues", "DEMO-1"], update: false },
  { path: "search/assist", method: "POST", body: { query: "tag: " }, fields: suggestionFields,
    result: { query: null, caret: 5, suggestions: [{ option: null, description: null, caret: null }] },
    run: () => assistSearch(connection, { query: "tag: " }),
    argv: ["search", "assist", "--query", "tag: "], update: false },
  { path: "issuesGetter/count", method: "POST", body: { query }, fields: "count", result: { count: -1 },
    run: () => countIssues(connection, query), argv: ["issues", "count", "--query", query], update: false },
  { path: "savedQueries", method: "GET", body: undefined, fields: savedFields,
    result: [{ id: "fixture-query", name: "Fixture saved query", query: null, owner: null }],
    run: () => listSavedQueries(connection, { top: 3, skip: 2 }),
    argv: ["saved-queries", "list", "--top", "3", "--skip", "2"], update: false },
  { path: `savedQueries/${encodeURIComponent("fixture /?#%é")}`, method: "GET", body: undefined, fields: savedFields,
    result: { id: "fixture-query", name: "Fixture saved query", query: null, owner: null },
    run: () => getSavedQuery(connection, "fixture /?#%é"),
    argv: ["saved-queries", "get", "fixture /?#%é"], update: false },
];

function respond(row: typeof rows[number], count: { calls: number }) {
  return http.all("*", async ({ request }) => {
    count.calls++;
    const url = new URL(request.url);
    assert.equal(request.method, row.method);
    assert.equal(url.pathname, `/context/api/${row.path}`);
    assert.equal(url.searchParams.get("fields"), row.fields);
    assert.equal(request.headers.get("authorization"), "Bearer synthetic-token");
    assert.equal(request.redirect, "error");
    if (row.body !== undefined) {
      assert.equal(request.headers.get("content-type"), "application/json");
      assert.deepEqual(await request.json(), row.body);
      assert.deepEqual([...url.searchParams.keys()], ["fields"]);
    } else if (row.path === "savedQueries") {
      assert.equal(url.searchParams.get("$top"), "3");
      assert.equal(url.searchParams.get("$skip"), "2");
    }
    return HttpResponse.json(row.result);
  });
}

test("six query endpoints send exact bounded native requests and preserve documented nullable values", async () => {
  for (const row of rows) {
    const count = { calls: 0 };
    server.use(respond(row, count));
    assert.deepEqual(await row.run(), row.result);
    assert.equal(count.calls, 1);
  }
});

test("command selections are explicit, limited to20, and reject invalid input before HTTP", async () => {
  let calls = 0;
  server.use(http.all("*", () => { calls++; return HttpResponse.json({}); }));
  assert.deepEqual(parseIssueSelection(" DEMO-1,2-7,ПРОЕКТ-3,DEMO.SUB-4 "), ["DEMO-1", "2-7", "ПРОЕКТ-3", "DEMO.SUB-4"]);
  assert.equal(parseIssueSelection(Array.from({ length: 20 }, (_, index) => `DEMO-${index}`).join(",")).length, 20);
  for (const selection of ["", "DEMO-1,", ",DEMO-1", "DEMO-1,,DEMO-2", "project: DEMO", "DEMO-1,DEMO-1", "opaque-reference", "DEMO\u0000-1",
    Array.from({ length: 21 }, (_, index) => `DEMO-${index}`).join(",")]) {
    assert.throws(() => parseIssueSelection(selection), /YouTrack/);
  }
  for (const ids of [[], [""], ["DEMO-1", "DEMO-1"], Array.from({ length: 21 }, (_, index) => `DEMO-${index}`)]) {
    await assert.rejects(applyCommands(connection, "State Fixed", ids), /YouTrack/);
  }
  for (const run of [
    () => applyCommands(connection, " ", ["DEMO-1"]),
    () => assistCommands(connection, { query: "State", caret: 6 }),
    () => assistSearch(connection, { query: "tag", caret: -1 }),
    () => assistSearch(connection, { query: "tag", caret: 1.5 }),
    () => countIssues(connection, "\n"),
    () => listSavedQueries(connection, { top: 101 }),
    () => listSavedQueries(connection, { skip: -1 }),
    () => getSavedQuery(connection, ".."),
  ]) await assert.rejects(run(), /YouTrack/);
  assert.equal(calls, 0);
});

test("count returns pending, zero and null without polling; projections stay sparse", async () => {
  let calls = 0;
  for (const value of [{ count: -1 }, { count: 0 }, { count: 24 }, { count: null }]) {
    server.use(http.post("*/api/issuesGetter/count", () => { calls++; return HttpResponse.json(value); }));
    assert.deepEqual(await countIssues(connection, query), value);
  }
  assert.equal(calls, 4);
  server.use(http.post("*", ({ request }) => {
    assert.equal(new URL(request.url).searchParams.get("fields"), "id");
    return HttpResponse.json({ id: "fixture-projection" });
  }));
  assert.deepEqual(await countIssues(connection, query, { fields: "id" }), { id: "fixture-projection" });
  assert.deepEqual(await assistCommands(connection, { query: "State", fields: "id" }), { id: "fixture-projection" });
  assert.deepEqual(await assistSearch(connection, { query: "tag", fields: "id" }), { id: "fixture-projection" });
});

test("ReadOnly POST responses never accept empty bodies or malformed entities as mutation success", async () => {
  for (const row of rows.filter((row) => row.method === "POST" && !row.update)) {
    for (const response of [new HttpResponse(null, { status: 200 }), new HttpResponse(null, { status: 204 }),
      HttpResponse.json(null), HttpResponse.json([]), HttpResponse.json("invalid"), HttpResponse.json({})]) {
      server.use(http.post("*", () => response));
      await assert.rejects(row.run(), /invalid/);
    }
  }
  for (const count of [-2, 1.5, "1", true, {}, Number.MAX_SAFE_INTEGER + 1]) {
    server.use(http.post("*", () => HttpResponse.json({ count })));
    await assert.rejects(countIssues(connection, query), /invalid/);
  }
});

test("apply accepts documented empty success while other failures stay sanitized and never retry", async () => {
  for (const status of [200, 204]) {
    server.use(http.post("*", () => new HttpResponse(null, { status })));
    assert.equal(await applyCommands(connection, "State Fixed", ["DEMO-1"]), null);
  }
  for (const row of rows) {
    for (const status of [400, 401, 403, 404, 409, 429, 500]) {
      let calls = 0;
      server.use(http.all("*", () => { calls++; return new HttpResponse("synthetic-private-response", { status }); }));
      await assert.rejects(row.run(), (error: Error) => {
        assert.match(error.message, new RegExp(`HTTP ${status}`));
        assert.doesNotMatch(error.message, /synthetic-private/);
        return true;
      });
      assert.equal(calls, 1);
    }
  }
});

test("saved query pagination/projection and nested suggestion output use shared safety policy", async () => {
  server.use(http.get("*/api/savedQueries", ({ request }) => {
    const url = new URL(request.url);
    assert.equal(url.searchParams.get("fields"), "query,owner");
    assert.equal(url.searchParams.get("$top"), "50");
    assert.equal(url.searchParams.get("$skip"), "0");
    return HttpResponse.json([]);
  }));
  assert.deepEqual(await listSavedQueries(connection, { fields: "query,owner" }), []);
  server.use(http.post("*", () => HttpResponse.json({ suggestions: [{
    option: "synthetic-token", icon: "/files/fixture?sign=synthetic-signature",
  }] })));
  assert.deepEqual(await assistSearch(connection, { query: "tag", fields: "suggestions(option,icon)" }), {
    suggestions: [{ option: "[redacted]", icon: "[redacted]" }],
  });
});

test("all six leaves share human/JSON declarations; ReadOnly POSTs work with Update disabled", async (t) => {
  for (const row of rows) {
    for (const json of [false, true]) {
      const f = await fixture(t);
      await f.cli.execute(["profile", "create", "dev", "--url", connection.baseUrl]);
      await f.secrets.set(service, "dev:token", connection.token);
      if (row.update) await f.cli.execute(["permissions", "grant", "Update", "--profile", "dev"]);
      const count = { calls: 0 };
      server.use(respond(row, count));
      assert.equal(await f.cli.run([...row.argv, "--profile", "dev", ...(json ? ["--json"] : [])]), 0);
      if (json) assert.deepEqual(JSON.parse(f.stdout()), row.result);
      else assert.ok(f.stdout().trim());
      assert.equal(f.stderr(), "");
      assert.equal(count.calls, 1);
    }
  }
});

test("apply denies Update and each semantic read denies ReadOnly before HTTP", async (t) => {
  const f = await fixture(t);
  await f.cli.execute(["profile", "create", "dev", "--url", connection.baseUrl]);
  await f.secrets.set(service, "dev:token", connection.token);
  let calls = 0;
  server.use(http.all("*", () => { calls++; return HttpResponse.json({}); }));
  await assert.rejects(f.cli.execute([...rows[0]!.argv, "--profile", "dev"]), /Permission 'Update' is disabled/);
  await f.cli.execute(["permissions", "revoke", "ReadOnly", "--profile", "dev"]);
  for (const row of rows.filter((row) => !row.update)) {
    await assert.rejects(f.cli.execute([...row.argv, "--profile", "dev"]), /Permission 'ReadOnly' is disabled/);
  }
  assert.equal(calls, 0);
});

test("query option errors fail before fresh-profile onboarding and never echo submitted text", async (t) => {
  for (const argv of [
    ["commands", "apply", "--query", "State Fixed"], ["commands", "apply", "--issues", "DEMO-1"],
    ["commands", "assist"], ["search", "assist"], ["issues", "count"],
    ["commands", "apply", "--query", "State Fixed", "--issues", "synthetic-private invalid"],
    ["search", "assist", "--query", "tag", "--caret", "synthetic-private"],
    ["issues", "count", "--query", "\n"],
  ]) {
    const f = await fixture(t);
    Object.assign(f.runtime.input, { isTTY: true, setRawMode: () => assert.fail("Unexpected token prompt") });
    Object.assign(f.runtime.error, { isTTY: true });
    f.secrets.get = async () => { assert.fail("Invalid query reached keyring"); };
    assert.equal(await f.cli.run(argv), 1);
    assert.equal(f.stdout(), "");
    assert.match(f.stderr(), /required option|YouTrack/);
    assert.doesNotMatch(f.stderr(), /synthetic-private|Token:|YouTrack server URL including/);
  }
});

test("RPC keeps permissions and credentials profile-scoped across invalid and valid query requests", async (t) => {
  const requests = [
    ["commands", "apply", "--query", "State Fixed", "--issues", "DEMO-1", "--profile", "locked"],
    ["search", "assist", "--profile", "dev"],
    ["issues", "count", "--query", query, "--profile", "locked"],
    ["commands", "apply", "--query", "State Fixed", "--issues", "DEMO-1", "--profile", "dev"],
    ["search", "assist", "--query", "tag", "--profile", "locked"],
  ].map((argv, id) => JSON.stringify({ jsonrpc: "2.0", id, method: "cli.execute", params: { argv } })).join("\n") + "\n";
  const f = await fixture(t, requests);
  for (const name of ["dev", "locked"]) {
    await f.cli.execute(["profile", "create", name, "--url", `https://${name}.example.com/context`]);
    await f.secrets.set(service, `${name}:token`, `synthetic-${name}`);
  }
  await f.cli.execute(["permissions", "grant", "Update", "--profile", "dev"]);
  const seen: string[] = [];
  server.use(http.post("*", ({ request }) => {
    const url = new URL(request.url);
    const profile = url.hostname.split(".")[0];
    assert.equal(request.headers.get("authorization"), `Bearer synthetic-${profile}`);
    seen.push(`${profile}:${url.pathname}`);
    if (url.pathname.endsWith("/count")) return HttpResponse.json({ count: -1 });
    if (url.pathname.endsWith("/commands")) return new HttpResponse(null, { status: 200 });
    return new HttpResponse("synthetic-private-response", { status: 403 });
  }));
  assert.equal(await f.cli.run(["--json-rpc"]), 0);
  const replies = f.stdout().trim().split("\n").map((line) => JSON.parse(line));
  assert.deepEqual(replies.map((reply) => reply.id), [0, 1, 2, 3, 4]);
  assert.equal(replies[0].error.code, -32000);
  assert.match(replies[0].error.message, /Update/);
  assert.equal(replies[1].error.code, -32000);
  assert.match(replies[1].error.message, /required option/);
  assert.deepEqual(replies[2].result, { count: -1 });
  assert.equal(replies[3].result, null);
  assert.equal(replies[4].error.code, -32000);
  assert.match(replies[4].error.message, /HTTP 403/);
  assert.doesNotMatch(f.stdout(), /synthetic-private/);
  assert.equal(f.stderr(), "");
  assert.deepEqual(seen, ["locked:/context/api/issuesGetter/count", "dev:/context/api/commands", "locked:/context/api/search/assist"]);
});


