import assert from "node:assert/strict";
import { join } from "node:path";
import { after, afterEach, before, test, type TestContext } from "node:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { fixture as cliFixture } from "./cli-fixture.js";
import { createSprint, updateSprint } from "../src/agile.js";

const server = setupServer();
before(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
after(() => server.close());
const api = "https://dev.example.com/track/api";
const connection = { baseUrl: "https://dev.example.com/track", token: "synthetic-dev" };
const agileFields = "id,name,currentSprint(id,name,start,finish,archived),status(valid,hasJobs)";
const sprintFields = "id,name,goal,start,finish,archived,isDefault,agile(id,name)";

async function fixture(t: TestContext, input = "") {
  const f = await cliFixture(t, input);
  for (const profile of ["dev", "production"]) {
    await f.cli.execute(["profile", "create", profile, "--url", `https://${profile}.example.com/track`]);
    await f.secrets.set("ai-cli-factory:youtrack-cli", `${profile}:token`, `synthetic-${profile}`);
  }
  return f;
}

const reads = [
  { argv: ["agile", "list"], path: "/agiles", fields: agileFields, result: [{ id: "fixture-board", currentSprint: null }] },
  { argv: ["agile", "get", "fixture-board"], path: "/agiles/fixture-board", fields: agileFields, result: { id: "fixture-board", status: { valid: true, hasJobs: false } } },
  { argv: ["sprint", "list", "fixture-board"], path: "/agiles/fixture-board/sprints", fields: sprintFields, result: [{ id: "fixture-sprint", goal: null, start: null, finish: null, agile: null }] },
  { argv: ["sprint", "get", "fixture-board", "current"], path: "/agiles/fixture-board/sprints/current", fields: sprintFields, result: { id: "fixture-current", goal: "", start: null, finish: null } },
];

for (const row of reads) test(`${row.argv.join(" ")} uses bounded documented requests and its ReadOnly gate`, async (t) => {
  const f = await fixture(t);
  let calls = 0;
  server.use(http.get(api + row.path, ({ request }) => {
    calls++;
    const query = new URL(request.url).searchParams;
    assert.equal(request.headers.get("authorization"), "Bearer synthetic-dev");
    assert.equal(query.get("fields"), row.fields);
    assert.deepEqual([...query.keys()].sort(), row.argv.includes("list") ? ["$skip", "$top", "fields"] : ["fields"]);
    if (row.argv.includes("list")) {
      assert.equal(query.get("$top"), "50");
      assert.equal(query.get("$skip"), "0");
    }
    return HttpResponse.json(row.result);
  }));
  assert.equal(await f.cli.run([...row.argv, "--profile", "dev", "--json"]), 0);
  assert.deepEqual(JSON.parse(f.stdout()), row.result);
  assert.equal(calls, 1);
  await f.cli.execute(["permissions", "revoke", "ReadOnly", "--profile", "dev"]);
  await assert.rejects(f.cli.execute([...row.argv, "--profile", "dev"]), /Permission 'ReadOnly' is disabled/);
  assert.equal(calls, 1);
});

test("agile/sprint projections, empty pages, offset controls and opaque IDs preserve context without followups", async (t) => {
  const f = await fixture(t);
  const seen: string[] = [];
  server.use(http.get("*", ({ request }) => {
    const url = new URL(request.url);
    seen.push(url.pathname);
    assert.equal(url.searchParams.get("fields"), "id");
    if (url.searchParams.has("$top")) {
      assert.equal(url.searchParams.get("$top"), "2");
      assert.equal(url.searchParams.get("$skip"), "3");
      return HttpResponse.json([]);
    }
    assert.equal(url.searchParams.size, 1);
    return HttpResponse.json({ id: "fixture" });
  }));
  for (const argv of [["agile", "list"], ["sprint", "list", "fixture/board?"]]) {
    assert.deepEqual(await f.cli.execute([...argv, "--top", "2", "--skip", "3", "--fields", "id", "--profile", "dev"]), []);
  }
  for (const argv of [["agile", "get", "fixture/board?"], ["sprint", "get", "fixture/board?", "%2e/#"]]) {
    assert.deepEqual(await f.cli.execute([...argv, "--fields", "id", "--profile", "dev"]), { id: "fixture" });
  }
  assert.deepEqual(seen, ["/track/api/agiles", "/track/api/agiles/fixture%2Fboard%3F/sprints", "/track/api/agiles/fixture%2Fboard%3F", "/track/api/agiles/fixture%2Fboard%3F/sprints/%252e%2F%23"]);
  for (const argv of [["agile", "get", ".."], ["sprint", "get", "fixture-board", "."], ["agile", "list", "--top", "101"], ["sprint", "list", "fixture-board", "--skip", "-1"]]) {
    await assert.rejects(f.cli.execute([...argv, "--profile", "dev"]));
  }
  await assert.rejects(f.cli.execute(["agile", "list", "--query", "test", "--profile", "dev"]), /unknown option/);
  assert.equal(seen.length, 4);
});

for (const action of ["create", "update"]) test(`sprint ${action} enforces Update per profile and sends only explicit fields`, async (t) => {
  const f = await fixture(t);
  const body = action === "create"
    ? { name: "Fixture sprint", goal: "First line\nSecond line", start: null, finish: 0, archived: false, isDefault: true, previousSprint: { id: "fixture-previous" } }
    : { goal: "", start: 0, finish: null, archived: true, isDefault: false };
  const argv = ["sprint", action, "fixture/board", ...(action === "update" ? ["current"] : []), "--body", JSON.stringify(body), "--fields", "id,name"];
  let calls = 0;
  server.use(http.post("*", async ({ request }) => {
    calls++;
    const url = new URL(request.url);
    assert.equal(url.pathname, `/track/api/agiles/fixture%2Fboard/sprints${action === "update" ? "/current" : ""}`);
    assert.deepEqual(Object.fromEntries(url.searchParams), { fields: "id,name" });
    assert.equal(request.headers.get("authorization"), "Bearer synthetic-dev");
    assert.equal(request.headers.get("content-type"), "application/json");
    assert.deepEqual(await request.json(), body);
    return HttpResponse.json({ id: "fixture-sprint", name: "Fixture sprint" });
  }));
  await assert.rejects(f.cli.execute([...argv, "--profile", "dev"]), /Permission 'Update' is disabled/);
  await f.cli.execute(["permissions", "grant", "Update", "--profile", "dev"]);
  await assert.rejects(f.cli.execute([...argv, "--profile", "production"]), /Permission 'Update' is disabled/);
  assert.equal(calls, 0);
  assert.equal(await f.cli.run([...argv, "--profile", "dev", "--json"]), 0);
  assert.deepEqual(JSON.parse(f.stdout()), { id: "fixture-sprint", name: "Fixture sprint" });
  assert.equal(calls, 1);
});

test("sprint bodies reject malformed or unsupported fields before fetch and never infer carryover", async (t) => {
  const f = await fixture(t);
  for (const argv of [["sprint", "create", "fixture"], ["sprint", "update", "fixture", "current"]]) {
    await assert.rejects(f.cli.execute(argv), /required option/);
    await assert.rejects(f.cli.execute([...argv, "--body", "{invalid"]), /valid JSON/);
  }
  const noFetch = { ...connection, fetch: async () => assert.fail("invalid sprint body reached fetch") };
  const commonInvalid = [null, [], {}, { name: null }, { name: "" }, { name: "two\nlines" }, { name: "bad\tname" }, { goal: 4 }, { start: 1.5 }, { finish: Number.MAX_SAFE_INTEGER + 1 }, { start: "1" }, { archived: 1 }, { isDefault: null }, { issues: [] }, { id: "fixture" }, { muteUpdateNotifications: true }];
  for (const input of commonInvalid) {
    const creatingInput = input !== null && typeof input === "object" && !Array.isArray(input) && Object.keys(input).length > 0
      ? { name: "Fixture", ...input } : input;
    await assert.rejects(createSprint(noFetch, "fixture", creatingInput));
    await assert.rejects(updateSprint(noFetch, "fixture", "current", input));
  }
  for (const previousSprint of [null, {}, { id: "" }, { id: "bad\nreference" }, { id: "fixture", name: "unsupported" }]) {
    await assert.rejects(createSprint(noFetch, "fixture", { name: "Fixture", previousSprint }));
  }
  await assert.rejects(updateSprint(noFetch, "fixture", "current", { previousSprint: { id: "fixture" } }), /supports only/);
  const bodies: unknown[] = [];
  server.use(http.post("*", async ({ request }) => {
    bodies.push(await request.json());
    assert.equal(new URL(request.url).searchParams.get("fields"), sprintFields);
    return new HttpResponse(null, { status: 204 });
  }));
  assert.equal(await createSprint(connection, "fixture", { name: "Fixture" }), null);
  assert.equal(await updateSprint(connection, "fixture", "current", { goal: null }), null);
  assert.deepEqual(bodies, [{ name: "Fixture" }, { goal: null }]);
});

test("sprint help explains explicit carryover and automatic default membership", async (t) => {
  const f = await fixture(t);
  assert.equal(await f.cli.run(["sprint", "create", "--help"]), 0);
  assert.match(f.stdout(), /previousSprint/);
  assert.match(f.stdout(), /unresolved issues/);
  assert.match(f.stdout(), /isDefault/);
  assert.match(f.stdout(), /matching new issues/);
  assert.match(f.stdout(), /--fields/);
});

test("agile human output and sprint mutation results use the shared credential scrub", async (t) => {
  const f = await fixture(t);
  server.use(http.get(api + "/agiles/fixture", () => HttpResponse.json({ id: "fixture", name: "synthetic-dev", currentSprint: { name: "/file?token=synthetic-signed" } })));
  assert.equal(await f.cli.run(["agile", "get", "fixture", "--profile", "dev"]), 0);
  assert.match(f.stdout(), /\[redacted\]/);
  assert.doesNotMatch(f.stdout(), /synthetic-/);
  server.use(http.post("*", () => HttpResponse.json({ id: "fixture", goal: "synthetic-dev", link: "https://example.com/file?sign=synthetic-signed" })));
  assert.deepEqual(await createSprint(connection, "fixture", { name: "Fixture" }), { id: "fixture", goal: "[redacted]", link: "[redacted]" });
});

test("sprint mutations report safe failures without retry, including failed response parsing", async () => {
  for (const status of [400, 401, 403, 404, 409, 429, 500]) {
    let calls = 0;
    server.use(http.post("*", () => { calls++; return new HttpResponse("synthetic-dev private-body", { status, headers: { "Retry-After": "5" } }); }));
    for (const run of [() => createSprint(connection, "fixture", { name: "Fixture" }), () => updateSprint(connection, "fixture", "current", { archived: true })]) {
      await assert.rejects(run(), (error: Error) => {
        assert.match(error.message, new RegExp(`HTTP ${status}`));
        assert.doesNotMatch(error.message, /synthetic-|private-body/);
        return true;
      });
    }
    assert.equal(calls, 2);
  }
  for (const response of ["invalid JSON", "null", "[]"]) {
    server.use(http.post("*", () => new HttpResponse(response)));
    await assert.rejects(createSprint(connection, "fixture", { name: "Fixture" }), /invalid/);
  }
});

test("persistent agile/sprint RPC isolates profile URLs and AppData and survives denied mutation", async (t) => {
  const argv = [
    ["agile", "get", "fixture", "--profile", "dev"],
    ["sprint", "create", "fixture", "--body", '{"name":"Fixture"}', "--profile", "production"],
    ["sprint", "get", "fixture", "current", "--profile", "production"],
  ];
  const f = await fixture(t, argv.map((args, id) => JSON.stringify({ jsonrpc: "2.0", id, method: "cli.execute", params: { argv: args } })).join("\n") + "\n");
  let calls = 0;
  server.use(http.get("*", ({ request }) => {
    calls++;
    const url = new URL(request.url);
    const profile = url.hostname.split(".")[0];
    assert.equal(request.headers.get("authorization"), `Bearer synthetic-${profile}`);
    return HttpResponse.json({ id: `fixture-${profile}` });
  }));
  f.paths.length = 0;
  assert.equal(await f.cli.run(["--json-rpc"]), 0);
  const replies = f.stdout().trim().split("\n").map((line) => JSON.parse(line));
  assert.equal(replies[0].result.id, "fixture-dev");
  assert.equal(replies[1].error.code, -32000);
  assert.match(replies[1].error.message, /Permission 'Update' is disabled/);
  assert.equal(replies[2].result.id, "fixture-production");
  assert.deepEqual(f.paths, ["dev", "production", "production"].map((name) => join(f.appArguments.RoamingAppDataDirectory, name)));
  assert.equal(calls, 2);
  assert.doesNotMatch(f.stdout() + f.stderr(), /synthetic-/);
});

