import assert from "node:assert/strict";
import { assertHttpRequest, trackRequests, assertPermissionDenied, assertCliOutput } from "@eyeauras/cli-factory/testing";
import { join } from "node:path";
import { after, afterEach, before, test, type TestContext } from "node:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { fixture } from "./cli-fixture.js";

const server = setupServer();
before(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
after(() => server.close());
const service = "ai-cli-factory:youtrack-cli";
const issueID = "DEMO /?#%é";
const itemID = "work /?#%é";
const issueItems = `/api/issues/${encodeURIComponent(issueID)}/timeTracking/workItems`;
const reads = [
  { argv: ["issues", "time-tracking", "get", issueID], path: `/api/issues/${encodeURIComponent(issueID)}/timeTracking`, list: false },
  { argv: ["issues", "work-items", "list", issueID], path: issueItems, list: true },
  { argv: ["issues", "work-items", "get", issueID, itemID], path: `${issueItems}/${encodeURIComponent(itemID)}`, list: false },
  { argv: ["work-items", "list"], path: "/api/workItems", list: true },
  { argv: ["work-items", "get", itemID], path: `/api/workItems/${encodeURIComponent(itemID)}`, list: false },
];
const writes = [
  { argv: ["issues", "work-items", "add", issueID], path: issueItems },
  { argv: ["issues", "work-items", "update", issueID, itemID], path: `${issueItems}/${encodeURIComponent(itemID)}` },
];
const body = JSON.stringify({ duration: { minutes: 45 }, text: "First line\n\nSecond line" });

async function configured(t: TestContext, input = "") {
  const f = await fixture(t, input);
  for (const name of ["dev", "production"]) {
    await f.cli.execute(["profile", "create", name, "--url", `https://${name}.example.com/context`]);
    await f.secrets.set(service, `${name}:token`, `synthetic-${name}`);
  }
  return f;
}

test("actual work-time CLI exposes five reads with fields, pagination and human/JSON output", async (t) => {
  for (const row of reads) {
    const f = await configured(t);
    const result = row.list ? [{ id: "fixture-work" }] : { id: "fixture-work" };
    const requests = trackRequests(t, 2, async request => {
      await assertHttpRequest(request, {
        method: "GET", url: "https://dev.example.com/context" + row.path,
        headers: { authorization: "Bearer synthetic-dev" },
        query: { fields: "id", ...(row.list ? { $top: "2", $skip: "3" } : {}) },
      });
      return HttpResponse.json(result);
    });
    server.use(http.all("*", ({ request }) => requests.handle(request)));
    await assertCliOutput(f, f.cli,
      [...row.argv, "--profile", "dev", "--fields", "id", ...(row.list ? ["--top", "2", "--skip", "3"] : [])],
      result, /fixture-work/, requests);
  }
});

test("every work-time leaf checks its profile permission before fetching", async (t) => {
  const f = await configured(t);
  const requests = trackRequests(t, 0, () => HttpResponse.json({ id: "unexpected" }));
  server.use(http.all("*", ({ request }) => requests.handle(request)));
  for (const row of writes)
    await assertPermissionDenied(f.cli, [...row.argv, "--body", body, "--profile", "dev"], "Update", requests);
  await f.cli.execute(["permissions", "revoke", "ReadOnly", "--profile", "dev"]);
  for (const row of reads)
    await assertPermissionDenied(f.cli, [...row.argv, "--profile", "dev"], "ReadOnly", requests);
});

test("both work-time writes use the actual CLI JSON body and fields with Update granted", async (t) => {
  for (const row of writes) {
    const f = await configured(t);
    await f.cli.execute(["permissions", "grant", "Update", "--profile", "dev"]);
    const requests = trackRequests(t, 1, async request => {
      await assertHttpRequest(request, {
        method: "POST", url: "https://dev.example.com/context" + row.path,
        query: { fields: "id,text" }, body: { json: JSON.parse(body) },
        headers: { authorization: "Bearer synthetic-dev" },
      });
      return HttpResponse.json({ id: "fixture-work", text: null });
    });
    server.use(http.all("*", ({ request }) => requests.handle(request)));
    assert.deepEqual(await f.json(f.cli,
      [...row.argv, "--body", body, "--fields", "id,text", "--profile", "dev"]),
      { id: "fixture-work", text: null });
  }
});

test("work-time required body and JSON syntax fail without onboarding; local list rejects query", async (t) => {
  for (const row of writes) {
    for (const flags of [[], ["--body", "{"]]) {
      const f = await fixture(t);
      f.secrets.get = async () => { assert.fail("Invalid input reached keyring"); };
      assert.equal(await f.cli.run([...row.argv, ...flags, "--json"]), 1);
      assert.match(f.stderr(), /required option|valid JSON/);
      assert.equal(f.stdout(), "");
    }
  }
  const f = await configured(t);
  assert.equal(await f.cli.run(["issues", "work-items", "list", issueID, "--query", "project: Fixture", "--profile", "dev"]), 1);
  assert.match(f.stderr(), /unknown option/);
});

test("global work-items list passes its documented query unchanged through CLI", async (t) => {
  const f = await configured(t);
  const query = "project: {Fixture & Team} #Unresolved";
  server.use(http.get("https://dev.example.com/context/api/workItems", ({ request }) => {
    const url = new URL(request.url);
    assert.equal(url.searchParams.get("query"), query);
    assert.equal(url.searchParams.get("$top"), "1");
    return HttpResponse.json([]);
  }));
  assert.deepEqual(await f.cli.execute(["work-items", "list", "--query", query, "--top", "1", "--profile", "dev"]), []);
});

test("work-time RPC isolates profiles, recovers after body and remote errors, and emits no secrets", async (t) => {
  const argv = [
    [...writes[0]!.argv, "--body", body, "--profile", "dev"],
    [...writes[1]!.argv, "--body", body, "--profile", "production"],
    ["work-items", "get", "fixture-work", "--profile", "production"],
    [...writes[1]!.argv, "--body", '{"synthetic-private-key":"synthetic-private-value"}', "--profile", "dev"],
    [...writes[1]!.argv, "--body", body, "--profile", "dev"],
    ["work-items", "get", "fixture-work", "--profile", "dev"],
  ];
  const input = argv.map((argv, id) => JSON.stringify({ jsonrpc: "2.0", id, method: "cli.execute", params: { argv } })).join("\n") + "\n";
  const f = await configured(t, input);
  await f.cli.execute(["permissions", "grant", "Update", "--profile", "dev"]);
  const methods: string[] = [];
  server.use(http.all("*", ({ request }) => {
    const url = new URL(request.url);
    const name = url.hostname.split(".")[0];
    assert.equal(request.headers.get("authorization"), `Bearer synthetic-${name}`);
    methods.push(`${name}:${request.method}`);
    if (request.method === "POST" && url.pathname.endsWith(encodeURIComponent(itemID))) {
      return new HttpResponse("synthetic-dev synthetic-private-value", { status: 409 });
    }
    return HttpResponse.json({ id: `fixture-${name}` });
  }));
  f.paths.length = 0;
  assert.equal(await f.cli.run(["--json-rpc"]), 0);
  const replies = f.stdout().trim().split("\n").map((line) => JSON.parse(line));
  assert.deepEqual(replies.map((reply) => reply.result?.id ?? reply.error.code),
    ["fixture-dev", -32000, "fixture-production", -32000, -32000, "fixture-dev"]);
  assert.match(replies[1].error.message, /Permission 'Update' is disabled/);
  assert.match(replies[4].error.message, /HTTP 409/);
  assert.deepEqual(methods, ["dev:POST", "production:GET", "dev:POST", "dev:GET"]);
  assert.ok(f.paths.includes(join(f.appArguments.RoamingAppDataDirectory, "dev")));
  assert.ok(f.paths.includes(join(f.appArguments.RoamingAppDataDirectory, "production")));
  assert.doesNotMatch(f.stdout() + f.stderr(), /synthetic-dev|synthetic-production|synthetic-private/);
});
