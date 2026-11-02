import assert from "node:assert/strict";
import test from "node:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { trackRequests } from "@eyeauras/cli-factory/testing";
import { createTestRuntime } from "./support.js";

const server = setupServer();
test.before(() => server.listen({ onUnhandledRequest: "error" }));
test.afterEach(() => server.resetHandlers());
test.after(() => server.close());

const cron = { minute: "0", hour: "12", day: "?", month: "JAN", dayWeek: "SAT" };
const config = { format: "future-format", dslExecutionMode: "future-runner", futureOption: { enabled: false } };
const cases = [
  {
    argv: ["mutes", "create", "--item", '{"scope":{"project":{"id":"Example"}},"target":{"anyProblem":true},"resolution":{"type":"manually"},"futureOption":false}'],
    permission: "Update", path: "/mutes", method: "POST",
    body: { scope: { project: { id: "Example" } }, target: { anyProblem: true }, resolution: { type: "manually" }, futureOption: false },
  },
  {
    argv: ["jobs", "triggers", "create", "Build", "--type", "future-plugin"],
    permission: "Update", path: "/buildTypes/id:Build/triggers", method: "POST",
    body: { type: "future-plugin", properties: { property: [] } },
  },
  {
    argv: ["jobs", "features", "replace-all", "Build", "--item", '{"type":"plugin","futureOption":false}'],
    permission: "Update", path: "/buildTypes/id:Build/features",
    body: { feature: [{ type: "plugin", properties: { property: [] }, futureOption: false }] },
  },
  {
    argv: ["agents", "policy", "set", "0", " SELECTED ", "--job", " Job ", "--job", " Job "],
    permission: "Update", path: "/agents/id:0/compatibilityPolicy",
    body: { policy: " SELECTED ", buildTypes: { buildType: [{ id: " Job " }, { id: " Job " }] } },
  },
  {
    argv: ["server", "authentication", "replace", "--item", '{"modules":{"module":[{"name":"Future","futureOption":false}]},"welcomeText":" Welcome "}', "--confirm"],
    permission: "Admin", path: "/server/authSettings",
    body: { modules: { module: [{ name: "Future", futureOption: false }] }, welcomeText: " Welcome " },
  },
  {
    argv: ["server", "cleanup", "configure", "--item", JSON.stringify({ cron })],
    permission: "Admin", path: "/server/cleanup", body: { cron },
  },
  {
    argv: ["server", "settings", "set", "--item", '{"rootUrl":"https://public.example.test:443/context","futureOption":false,"maxArtifactSize":-2,"defaultExecutionTimeout":-1,"tokenCount":2,"authorizationMode":"future"}'],
    permission: "Admin", path: "/server/globalSettings",
    body: { rootUrl: "https://public.example.test:443/context", futureOption: false, maxArtifactSize: -2, defaultExecutionTimeout: -1, tokenCount: 2, authorizationMode: "future" },
  },
  {
    argv: ["projects", "versioned-settings", "config", "replace", "Example", "--item", JSON.stringify(config)],
    permission: "Update", path: "/projects/id:Example/versionedSettings/config",
    body: { ...config, storeSecureValuesOutsideVcs: true },
  },
];
for (const row of cases) {
  test(`API body reaches ${row.path} without a local vocabulary`, async t => {
    const f = await createTestRuntime(t);
    const cli = f.createCli();
    const requests = trackRequests(t, 1, async request => {
      assert.equal(request.method, row.method ?? "PUT");
      assert.equal(new URL(request.url).pathname, "/app/rest" + row.path);
      assert.deepEqual(await request.json(), row.body);
      return HttpResponse.json(row.path.endsWith("compatibilityPolicy") ? row.body : {});
    });
    server.use(http.all("*", ({ request }) => requests.handle(request)));
    await assert.rejects(cli.execute(row.argv), /Permission/);
    assert.equal(requests.count, 0);
    await cli.execute(["permissions", "grant", row.permission]);
    await cli.execute(row.argv);
  });
}

for (const url of ["http://git.example.test:80/repo.git?branch=main", "git://git.example.test/repo.git", "ssh://git@git.example.test/repo.git"]) {
  test(`Git URL is forwarded unchanged: ${url}`, async t => {
    const f = await createTestRuntime(t);
    const cli = f.createCli();
    await cli.execute(["permissions", "grant", "Update"]);
    const requests = trackRequests(t, 1, async request => {
      const body = await request.json() as { name: string; properties: { property: unknown[] } };
      assert.equal(request.method, "POST");
      assert.equal(body.name, " Git name ");
      assert.deepEqual(body.properties.property, [
        { name: "authMethod", value: "ANONYMOUS" },
        { name: "branch", value: " main " },
        { name: "url", value: url },
      ]);
      return HttpResponse.json({ id: "Git", name: body.name });
    });
    server.use(http.all("*", ({ request }) => requests.handle(request)));
    await cli.execute(["vcs", "roots", "create", "Git", "--name", " Git name ", "--project", "Example", "--branch", " main ", "--url", url]);
  });
}

test("field selectors and literal IDs are encoded without closing service fields", async t => {
  const f = await createTestRuntime(t);
  const cli = f.createCli();
  const requests = trackRequests(t, 1, request => {
    assert.equal(new URL(request.url).pathname, "/app/rest/buildTypes/id:Example/triggers/$base64:cnVubmVyL2lk/futureField");
    return HttpResponse.text(" future value ");
  });
  server.use(http.all("*", ({ request }) => requests.handle(request)));
  const result = await cli.execute(["jobs", "triggers", "fields", "show", "Example", "runner/id", "futureField"]);
  assert.equal((result as { value: string }).value, " future value ");
});

test("self references and service-message text keep safe remote validation without retries", async t => {
  const f = await createTestRuntime(t);
  const cli = f.createCli();
  await cli.execute(["permissions", "grant", "Update"]);
  await cli.execute(["permissions", "grant", "Admin"]);
  const rows = [
    { argv: ["jobs", "snapshot-dependencies", "create", "Build", "--source", "Build"],
      path: "/buildTypes/id:Build/snapshot-dependencies", body: { type: "snapshot_dependency", "source-buildType": { id: "Build" }, properties: { property: [] } } },
    { argv: ["jobs", "artifact-dependencies", "create", "Build", "--source", "Build", "--rules", "*.zip", "--revision", "lastSuccessful"],
      path: "/buildTypes/id:Build/artifact-dependencies", body: { type: "artifact_dependency", disabled: false, "source-buildType": { id: "Build" }, properties: { property: [
        { name: "pathRules", value: "*.zip" }, { name: "revisionName", value: "lastSuccessful" }, { name: "cleanDestinationDirectory", value: "false" },
      ] } } },
    { argv: ["groups", "parents", "replace", "Developers", "--group", "Developers"],
      path: "/userGroups/key:Developers/parent-groups", body: { group: [{ key: "Developers" }] } },
    { argv: ["builds", "log", "append", "42", "--text", "##teamcity[message text='Future']"],
      path: "/builds/id:42/log", body: "##teamcity[message text='Future']" },
  ];
  for (const row of rows) {
    const requests = trackRequests(t, 1, async request => {
      assert.equal(new URL(request.url).pathname, "/app/rest" + row.path);
      assert.deepEqual(typeof row.body === "string" ? await request.text() : await request.json(), row.body);
      return HttpResponse.text("synthetic-private-detail", { status: 400 });
    });
    server.use(http.all("*", ({ request }) => requests.handle(request)));
    const result = await f.run(cli, [...row.argv, "--json"]);
    assert.equal(result.exitCode, 1);
    assert.equal(JSON.parse(result.stderr).error.code, "http.rejected", result.stderr);
    assert.ok(!result.stderr.includes("synthetic-private-detail"));
  }
});

test("future parameter UI metadata permits a plain value write after metadata-only preflight", async t => {
  const f = await createTestRuntime(t);
  const cli = f.createCli();
  await cli.execute(["permissions", "grant", "Update"]);
  const requests = trackRequests(t, 2, async request => {
    const url = new URL(request.url);
    assert.equal(url.pathname, "/app/rest/projects/id:Example/parameters/env.MODE");
    if (request.method === "GET") {
      assert.equal(url.searchParams.get("fields"), "name,inherited,type(rawValue)");
      return HttpResponse.json({ name: "env.MODE", type: { rawValue: "future-control" } });
    }
    assert.equal(request.method, "PUT");
    assert.deepEqual(await request.json(), { name: "env.MODE", value: " next " });
    return HttpResponse.json({ name: "env.MODE", value: " next " });
  });
  server.use(http.all("*", ({ request }) => requests.handle(request)));
  await cli.execute(["projects", "parameters", "set", "Example", "env.MODE", "--value", " next "]);
});

test("raw scalar fields keep text while JSON controls keep Boolean types", async t => {
  const f = await createTestRuntime(t);
  const cli = f.createCli();
  await cli.execute(["permissions", "grant", "Update"]);
  const requests = trackRequests(t, 2, async request => {
    assert.equal(request.method, "PUT");
    assert.equal(await request.text(), "TRUE");
    return HttpResponse.text("TRUE");
  });
  server.use(http.all("*", ({ request }) => requests.handle(request)));
  await cli.execute(["projects", "set", "Example", "archived", "TRUE"]);
  await cli.execute(["agents", "fields", "set", "0", "enabled", "TRUE"]);
  await assert.rejects(cli.execute(["agents", "enabled", "set", "0", "TRUE"]), /true or false/);
});

test("native filters, custom file areas and backup names are server-validated", async t => {
  const f = await createTestRuntime(t);
  const cli = f.createCli();
  await cli.execute(["permissions", "grant", "Admin"]);
  const requests = trackRequests(t, 5, request => {
    const url = new URL(request.url);
    if (url.pathname.endsWith("/backup")) {
      assert.equal(url.searchParams.get("fileName"), "folder/backup + future");
      return HttpResponse.text("future.zip");
    }
    if (url.pathname.endsWith("/nodes")) {
      assert.equal(url.searchParams.get("locator"), "role:futureRole,state:futureState");
      return HttpResponse.json({ node: [] });
    }
    if (url.pathname.endsWith("/health")) {
      assert.match(url.searchParams.get("locator")!, /project:\(id:Example\),global:true/);
      return HttpResponse.json({ healthItem: [] });
    }
    if (url.pathname.endsWith("/builds")) {
      assert.match(url.searchParams.get("locator")!, /state:futureState,status:futureStatus/);
      return HttpResponse.json({ build: [] });
    }
    assert.equal(url.pathname, "/app/rest/server/files/custom.future");
    assert.match(url.searchParams.get("locator")!, /^count:0,/);
    return HttpResponse.json({ file: [] });
  });
  server.use(http.all("*", ({ request }) => requests.handle(request)));
  await cli.execute(["server", "backup", "start", "folder/backup + future", "--confirm"]);
  await cli.execute(["server", "nodes", "list", "--role", "futureRole", "--state", "futureState"]);
  await cli.execute(["health", "list", "--global", "--project", "Example"]);
  await cli.execute(["builds", "list", "--state", "futureState", "--status", "futureStatus"]);
  await cli.execute(["server", "files", "list", "custom.future", "--limit", "0"]);
});

test("credential fields stay blocked and remote field errors stay safe", async t => {
  const f = await createTestRuntime(t);
  const cli = f.createCli();
  const requests = trackRequests(t, 1, () => HttpResponse.text("synthetic-private-response", { status: 400 }));
  server.use(http.all("*", ({ request }) => requests.handle(request)));
  await assert.rejects(cli.execute(["users", "fields", "get", "7", "password"]), /non-secret/);
  for (const field of ["passwordHash", "encryptionKey", "credentialsJSON", "secretKey", "accessToken"])
    await assert.rejects(cli.execute(["server", "field", field]), /non-secret/);
  assert.equal(requests.count, 0);
  const result = await f.run(cli, ["users", "fields", "get", "7", "futureField", "--json"]);
  assert.equal(result.exitCode, 1);
  assert.equal(JSON.parse(result.stderr).error.code, "http.rejected");
  assert.ok(!result.stderr.includes("synthetic-private-response"));
});

test("valid lookup progress passes thirteen HTTP pages without a hidden cutoff", async t => {
  const f = await createTestRuntime(t);
  const cli = f.createCli();
  let calls = 0;
  let clock = 0;
  t.mock.method(Date, "now", () => clock += 35_000);
  const requests = trackRequests(t, 13, request => {
    const locator = new URL(request.url).searchParams.get("locator")!;
    assert.match(locator, /start:0,count:3/);
    calls++;
    return HttpResponse.json(calls < 13 ? {
      build: [], nextHref: `/app/rest/builds?locator=start:0,count:3,lookupLimit:${calls * 5000}`,
    } : { build: [{ id: 1, state: "finished", status: "SUCCESS" }] });
  });
  server.use(http.get("*", ({ request }) => requests.handle(request)));
  const result = await cli.execute(["builds", "list", "--limit", "2"]) as { count: number; hasMore: boolean };
  assert.equal(result.count, 1);
  assert.equal(result.hasMore, false);
});

test("timestamp text follows server configuration rather than a fixed client pattern", async t => {
  const f = await createTestRuntime(t);
  const cli = f.createCli();
  await cli.execute(["permissions", "grant", "Update"]);
  const value = "2000-01-01T00:00:00Z";
  const requests = trackRequests(t, 1, async request => {
    assert.equal(new URL(request.url).pathname, "/app/rest/builds/id:42/finishDate");
    assert.equal(await request.text(), value);
    return HttpResponse.text("synthetic-private-response", { status: 400 });
  });
  server.use(http.all("*", ({ request }) => requests.handle(request)));
  const result = await f.run(cli, ["builds", "finish-at", "42", value, "--json"]);
  assert.equal(result.exitCode, 1);
  assert.equal(JSON.parse(result.stderr).error.code, "http.rejected");
  assert.ok(!result.stderr.includes("synthetic-private-response"));
});

test("numeric identity semantics are validated remotely with safe errors", async t => {
  const f = await createTestRuntime(t);
  const cli = f.createCli();
  await cli.execute(["permissions", "grant", "Update"]);
  const requests = trackRequests(t, 2, request => {
    assert.match(new URL(request.url).pathname, /\/agentPools\/id:(?:0|-1)$/);
    return HttpResponse.text("synthetic-private-response", { status: 400 });
  });
  server.use(http.all("*", ({ request }) => requests.handle(request)));
  for (const argv of [["pools", "delete", "0"], ["pools", "show", "-1"]]) {
    const result = await f.run(cli, [...argv, "--json"]);
    assert.equal(result.exitCode, 1);
    assert.equal(JSON.parse(result.stderr).error.code, "http.rejected");
    assert.ok(!result.stderr.includes("synthetic-private-response"));
  }
});

test("queue positions, token statuses and expiration semantics reach remote validation unchanged", async t => {
  const f = await createTestRuntime(t);
  const cli = f.createCli();
  await cli.execute(["permissions", "grant", "Update"]);
  await cli.execute(["permissions", "grant", "Credentials"]);
  const requests = trackRequests(t, 3, async request => {
    const url = new URL(request.url);
    if (url.pathname.endsWith("/order/2")) assert.deepEqual(await request.json(), { id: 42 });
    else if (request.method === "GET") assert.equal(url.searchParams.get("status"), "futureStatus");
    else assert.deepEqual(await request.json(), { name: "AuditToken", expirationTime: "20000101T000000+0000",
      permissionRestrictions: { permissionRestriction: [{ permission: { id: "VIEW_PROJECT" }, project: { id: "Example" }, futureOption: false }] } });
    return HttpResponse.text("synthetic-private-response", { status: 400 });
  });
  server.use(http.all("*", ({ request }) => requests.handle(request)));
  for (const argv of [
    ["queue", "position", "set", "2", "--build", "42"],
    ["projects", "versioned-settings", "tokens", "list", "Example", "--status", "futureStatus"],
    ["users", "tokens", "create", "AuditToken", "--alias", "audit-token", "--expires", "20000101T000000+0000", "--restriction", '{"permission":{"id":"VIEW_PROJECT"},"project":{"id":"Example"},"futureOption":false}'],
  ]) {
    const result = await f.run(cli, [...argv, "--json"]);
    assert.equal(result.exitCode, 1);
    assert.equal(JSON.parse(result.stderr).error.code, "http.rejected");
    assert.ok(!result.stderr.includes("synthetic-private-response"));
  }
});

test("bulk unmute preserves native anyProblem targets and validates identity before DELETE", async t => {
  const f = await createTestRuntime(t);
  const cli = f.createCli();
  await cli.execute(["permissions", "grant", "Update"]);
  const mute = { id: 9, scope: { project: { id: "Example" } }, target: { anyProblem: true }, resolution: { type: "manually" } };
  const requests = trackRequests(t, 2, async request => {
    if (request.method === "GET") {
      assert.match(new URL(request.url).searchParams.get("fields")!, /anyProblem/);
      return HttpResponse.json(mute);
    }
    assert.equal(request.method, "DELETE");
    assert.deepEqual(await request.json(), { mute: [mute] });
    return new HttpResponse(null, { status: 204 });
  });
  server.use(http.all("*", ({ request }) => requests.handle(request)));
  await cli.execute(["mutes", "delete-many", "--id", "9", "--confirm"]);
});
