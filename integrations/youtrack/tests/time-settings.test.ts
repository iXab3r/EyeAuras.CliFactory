import assert from "node:assert/strict";
import { join } from "node:path";
import { after, afterEach, before, test } from "node:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import type { Connection, PageOptions } from "../src/client.js";
import {
  getGlobalTimeSettings,
  getProjectTimeSettings,
  getProjectWorkItemType,
  getWorkItemType,
  getWorkTimeSettings,
  listProjectWorkItemTypes,
  listWorkItemTypes,
} from "../src/time-settings.js";
import { fixture } from "./cli-fixture.js";

const server = setupServer();
before(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
after(() => server.close());
const connection = { baseUrl: "https://youtrack.example.com/context/", token: "synthetic-token" };
const project = "project /?#%é";
const type = "type /?#%é";
const projectPath = `/api/admin/projects/${encodeURIComponent(project)}/timeTrackingSettings`;
const globalPath = "/api/admin/timeTrackingSettings";
const scheduleFields = "id,minutesADay,workDays,firstDayOfWeek,daysAWeek";
const schedule = { id: "fixture-schedule", minutesADay: 420, workDays: [0, 3, 6], firstDayOfWeek: 0, daysAWeek: 3 };
const itemType = { id: "fixture-type", name: "Fixture type", autoAttached: false };
const rows = [
  {
    argv: ["project", "time-tracking", "get", project], path: projectPath, list: false,
    fields: "id,enabled,estimate(id,field(id,name)),timeSpent(id,field(id,name)),project(id,name,shortName)",
    value: { id: "fixture-settings", enabled: false, estimate: null, timeSpent: null, project: null },
    run: (c: Connection, options: PageOptions = {}) => getProjectTimeSettings(c, project, options),
  },
  {
    argv: ["project", "work-item-type", "list", project], path: `${projectPath}/workItemTypes`, list: true,
    fields: "id,name,autoAttached", value: [itemType],
    run: (c: Connection, options: PageOptions = {}) => listProjectWorkItemTypes(c, project, options),
  },
  {
    argv: ["project", "work-item-type", "get", project, type],
    path: `${projectPath}/workItemTypes/${encodeURIComponent(type)}`, list: false,
    fields: "id,name,autoAttached", value: itemType,
    run: (c: Connection, options: PageOptions = {}) => getProjectWorkItemType(c, project, type, options),
  },
  {
    argv: ["time-tracking", "settings", "get"], path: globalPath, list: false,
    fields: `id,workTimeSettings(${scheduleFields})`, value: { id: "fixture-settings", workTimeSettings: schedule },
    run: (c: Connection, options: PageOptions = {}) => getGlobalTimeSettings(c, options),
  },
  {
    argv: ["work-item-type", "list"], path: `${globalPath}/workItemTypes`, list: true,
    fields: "id,name,autoAttached", value: [itemType],
    run: (c: Connection, options: PageOptions = {}) => listWorkItemTypes(c, options),
  },
  {
    argv: ["work-item-type", "get", type], path: `${globalPath}/workItemTypes/${encodeURIComponent(type)}`, list: false,
    fields: "id,name,autoAttached", value: itemType,
    run: (c: Connection, options: PageOptions = {}) => getWorkItemType(c, type, options),
  },
  {
    argv: ["time-tracking", "work-time", "get"], path: `${globalPath}/workTimeSettings`, list: false,
    fields: scheduleFields, value: schedule,
    run: (c: Connection, options: PageOptions = {}) => getWorkTimeSettings(c, options),
  },
];

test("seven time metadata reads send exact paths, default fields and one bounded request", async () => {
  for (const row of rows) {
    let calls = 0;
    server.use(http.get("*", ({ request }) => {
      calls++;
      const url = new URL(request.url);
      assert.equal(url.pathname, `/context${row.path}`);
      assert.equal(url.searchParams.get("fields"), row.fields);
      assert.equal(url.searchParams.get("$top"), row.list ? "50" : null);
      assert.equal(url.searchParams.get("$skip"), row.list ? "0" : null);
      assert.equal(url.searchParams.size, row.list ? 3 : 1);
      assert.equal(request.headers.get("authorization"), "Bearer synthetic-token");
      return HttpResponse.json(row.value);
    }));
    assert.deepEqual(await row.run(connection), row.value);
    assert.equal(calls, 1);
  }
});

test("time metadata explicit projections retain sparse and nullable values and redact credential URLs", async () => {
  for (const row of rows) {
    server.use(http.get("*", ({ request }) => {
      assert.equal(new URL(request.url).searchParams.get("fields"), "id,custom(url),estimate");
      const value = { id: "synthetic-token", custom: { url: "api/files/fixture?sign=synthetic-signature" }, estimate: null };
      return HttpResponse.json(row.list ? [value] : value);
    }));
    const expected = { id: "[redacted]", custom: { url: "[redacted]" }, estimate: null };
    assert.deepEqual(await row.run(connection, { fields: "id,custom(url),estimate" }), row.list ? [expected] : expected);
  }
});

test("both work-item-type collections support empty pages and reject oversized or malformed arrays", async () => {
  for (const row of rows.filter((row) => row.list)) {
    server.use(http.get("*", ({ request }) => {
      const query = new URL(request.url).searchParams;
      assert.equal(query.get("$top"), "1");
      assert.equal(query.get("$skip"), "7");
      return HttpResponse.json([]);
    }));
    assert.deepEqual(await row.run(connection, { top: 1, skip: 7 }), []);
    server.use(http.get("*", () => HttpResponse.json([itemType, itemType])));
    await assert.rejects(row.run(connection, { top: 1 }), /more items than the requested top limit/);
    server.use(http.get("*", () => HttpResponse.json([null])));
    await assert.rejects(row.run(connection), /invalid object response/);
  }
});

test("all time metadata methods reject wrong envelopes and hide remote diagnostics without retry", async () => {
  for (const row of rows) {
    for (const payload of ["null", "42", "synthetic-private-malformed", row.list ? "{}" : "[]"]) {
      server.use(http.get("*", () => new HttpResponse(payload)));
      await assert.rejects(row.run(connection), /invalid .*response/);
    }
    for (const status of [400, 401, 403, 404, 429, 500]) {
      let calls = 0;
      server.use(http.get("*", () => {
        calls++;
        return new HttpResponse("synthetic-token synthetic-private-diagnostic", { status });
      }));
      await assert.rejects(row.run(connection),
        new RegExp(`^Error: YouTrack request failed \\(HTTP ${status}\\)\\.$`));
      assert.equal(calls, 1);
    }
  }
});

test("time metadata IDs, blank fields and invalid paging fail before fetch", async () => {
  const local = { ...connection, fetch: (async () => { assert.fail("Invalid time metadata input reached fetch"); }) as typeof globalThis.fetch };
  for (const id of ["", ".", "..", "bad\nvalue", "\ud800"]) {
    await assert.rejects(getProjectTimeSettings(local, id), /YouTrack/);
    await assert.rejects(listProjectWorkItemTypes(local, id), /YouTrack/);
    await assert.rejects(getProjectWorkItemType(local, id, "fixture-type"), /YouTrack/);
    await assert.rejects(getProjectWorkItemType(local, "fixture-project", id), /YouTrack/);
    await assert.rejects(getWorkItemType(local, id), /YouTrack/);
  }
  for (const row of rows) await assert.rejects(row.run(local, { fields: " " }), /YouTrack fields/);
  for (const row of rows.filter((row) => row.list)) {
    for (const options of [{ top: 0 }, { top: 101 }, { top: NaN }, { skip: -1 }, { skip: Number.MAX_SAFE_INTEGER + 1 }]) {
      await assert.rejects(row.run(local, options), /YouTrack/);
    }
  }
});

test("actual CLI executes every time metadata leaf in human and JSON modes", async (t) => {
  for (const row of rows) {
    for (const json of [false, true]) {
      const f = await fixture(t);
      await f.cli.execute(["profile", "create", "dev", "--url", connection.baseUrl]);
      await f.secrets.set("ai-cli-factory:youtrack-cli", "dev:token", connection.token);
      let calls = 0;
      server.use(http.get("*", ({ request }) => {
        calls++;
        const url = new URL(request.url);
        assert.equal(url.pathname, `/context${row.path}`);
        assert.equal(url.searchParams.get("fields"), "id");
        assert.equal(url.searchParams.get("$top"), row.list ? "2" : null);
        assert.equal(url.searchParams.get("$skip"), row.list ? "3" : null);
        assert.equal(request.headers.get("authorization"), "Bearer synthetic-token");
        return HttpResponse.json(row.list ? [{ id: "fixture-result" }] : { id: "fixture-result" });
      }));
      const argv = [...row.argv, "--profile", "dev", "--fields", "id",
        ...(row.list ? ["--top", "2", "--skip", "3"] : []), ...(json ? ["--json"] : [])];
      assert.equal(await f.cli.run(argv), 0);
      if (json) assert.deepEqual(JSON.parse(f.stdout()), row.list ? [{ id: "fixture-result" }] : { id: "fixture-result" });
      else assert.match(f.stdout(), /fixture-result/);
      assert.equal(f.stderr(), "");
      assert.equal(calls, 1);
    }
  }
});

test("all seven time metadata leaves enforce ReadOnly before networking and reject invented filters", async (t) => {
  const f = await fixture(t);
  await f.cli.execute(["profile", "create", "dev", "--url", connection.baseUrl]);
  await f.secrets.set("ai-cli-factory:youtrack-cli", "dev:token", connection.token);
  await f.cli.execute(["permissions", "revoke", "ReadOnly", "--profile", "dev"]);
  let calls = 0;
  server.use(http.all("*", () => { calls++; return HttpResponse.json({ id: "unexpected" }); }));
  for (const row of rows) {
    await assert.rejects(f.cli.execute([...row.argv, "--profile", "dev"]), /Permission 'ReadOnly' is disabled/);
    await assert.rejects(f.cli.execute([...row.argv, "--query", "name: Fixture", "--profile", "dev"]), /unknown option/);
    if (!row.list) await assert.rejects(f.cli.execute([...row.argv, "--top", "1", "--profile", "dev"]), /unknown option/);
  }
  assert.equal(calls, 0);
});

test("time metadata RPC isolates profiles and AppData and continues after safe remote failure", async (t) => {
  const argv = [
    ["time-tracking", "settings", "get", "--profile", "dev"],
    ["work-item-type", "get", "fixture-type", "--profile", "production"],
    ["project", "time-tracking", "get", "fixture-project", "--profile", "production"],
    ["time-tracking", "work-time", "get", "--profile", "dev"],
  ];
  const input = argv.map((argv, id) => JSON.stringify({ jsonrpc: "2.0", id, method: "cli.execute", params: { argv } })).join("\n") + "\n";
  const f = await fixture(t, input);
  for (const name of ["dev", "production"]) {
    await f.cli.execute(["profile", "create", name, "--url", `https://${name}.example.com/context`]);
    await f.secrets.set("ai-cli-factory:youtrack-cli", `${name}:token`, `synthetic-${name}`);
  }
  const hosts: string[] = [];
  server.use(http.get("*", ({ request }) => {
    const url = new URL(request.url);
    const name = url.hostname.split(".")[0];
    hosts.push(String(name));
    assert.equal(request.headers.get("authorization"), `Bearer synthetic-${name}`);
    if (url.pathname.endsWith("/workItemTypes/fixture-type")) {
      return new HttpResponse("synthetic-production synthetic-private-response", { status: 403 });
    }
    return HttpResponse.json({ id: `fixture-${name}` });
  }));
  f.paths.length = 0;
  assert.equal(await f.cli.run(["--json-rpc"]), 0);
  const replies = f.stdout().trim().split("\n").map((line) => JSON.parse(line));
  assert.deepEqual(replies.map((reply) => reply.result?.id ?? reply.error.code),
    ["fixture-dev", -32000, "fixture-production", "fixture-dev"]);
  assert.match(replies[1].error.message, /HTTP 403/);
  assert.deepEqual(hosts, ["dev", "production", "production", "dev"]);
  // Readiness and handler contexts follow admission; denied requests create neither.
  assert.deepEqual(f.paths, hosts.map((name) => join(f.appArguments.RoamingAppDataDirectory, name)).flatMap((path) => [path, path]));
  assert.equal(f.stderr(), "");
  assert.doesNotMatch(f.stdout(), /synthetic-dev|synthetic-production|synthetic-private/);
});
