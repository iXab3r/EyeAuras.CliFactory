import assert from "node:assert/strict";
import { join } from "node:path";
import { after, afterEach, before, test } from "node:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { fixture } from "./cli-fixture.js";

const server = setupServer();
before(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
after(() => server.close());
const service = "ai-cli-factory:youtrack-cli";
const id = "DEMO /?#%é";
const field = "field /?#%é";
const projectPath = `/context/api/admin/projects/${encodeURIComponent(id)}`;
const issuePath = `/context/api/issues/${encodeURIComponent(id)}`;
const body = { $type: "StateMachineIssueCustomField", event: { id: "start" } };
const setCommand = ["issues", "fields", "set", id, field, "--body", JSON.stringify(body)];
const reads = [
  { argv: ["project", "get", id], path: projectPath, collection: false },
  { argv: ["project", "field", "list", id], path: `${projectPath}/customFields`, collection: true },
  { argv: ["project", "field", "get", id, field], path: `${projectPath}/customFields/${encodeURIComponent(field)}`, collection: false },
  { argv: ["user", "list"], path: "/context/api/users", collection: true },
  { argv: ["issues", "fields", "list", id], path: `${issuePath}/customFields`, collection: true },
  { argv: ["issues", "fields", "get", id, field], path: `${issuePath}/customFields/${encodeURIComponent(field)}`, collection: false },
];

for (const row of reads) test(`field CLI ${row.argv.slice(0, 3).join(" ")} uses actual command projection, page and human/JSON output`, async (t) => {
  for (const json of [false, true]) {
    const f = await fixture(t);
    await f.cli.execute(["profile", "create", "dev", "--url", "https://youtrack.example.com/context"]);
    await f.secrets.set(service, "dev:token", "synthetic-token");
    let calls = 0;
    const result = row.collection ? [{ id: "fixture-id" }] : { id: "fixture-id" };
    server.use(http.get("*", ({ request }) => {
      calls++;
      const url = new URL(request.url);
      assert.equal(url.pathname, row.path);
      assert.equal(request.headers.get("authorization"), "Bearer synthetic-token");
      assert.deepEqual(Object.fromEntries(url.searchParams), {
        fields: "id", ...(row.collection ? { $top: "3", $skip: "7" } : {}),
      });
      return HttpResponse.json(result);
    }));
    const argv = [...row.argv, "--fields", "id", ...(row.collection ? ["--top", "3", "--skip", "7"] : []), "--profile", "dev"];
    assert.equal(await f.cli.run([...argv, ...(json ? ["--json"] : [])]), 0);
    if (json) assert.deepEqual(JSON.parse(f.stdout()), result);
    else assert.match(f.stdout(), /fixture-id/);
    assert.equal(f.stderr(), "");
    assert.equal(calls, 1);
  }
});

test("every field read and set leaf honors its explicit permission before fetch", async (t) => {
  const f = await fixture(t);
  await f.cli.execute(["profile", "create", "dev", "--url", "https://youtrack.example.com/context"]);
  await f.secrets.set(service, "dev:token", "synthetic-token");
  let calls = 0;
  server.use(http.all("*", () => { calls++; return HttpResponse.json({}); }));
  await assert.rejects(f.cli.execute([...setCommand, "--profile", "dev"]), /Permission 'Update' is disabled/);
  await f.cli.execute(["permissions", "revoke", "ReadOnly", "--profile", "dev"]);
  for (const row of reads) await assert.rejects(f.cli.execute([...row.argv, "--profile", "dev"]), /Permission 'ReadOnly' is disabled/);
  assert.equal(calls, 0);
});

test("field set CLI sends the explicit event body and renders human/JSON results", async (t) => {
  for (const json of [false, true]) {
    const f = await fixture(t);
    await f.cli.execute(["profile", "create", "dev", "--url", "https://youtrack.example.com/context"]);
    await f.secrets.set(service, "dev:token", "synthetic-token");
    await f.cli.execute(["permissions", "grant", "Update", "--profile", "dev"]);
    let calls = 0;
    server.use(http.post("*", async ({ request }) => {
      calls++;
      assert.equal(new URL(request.url).pathname, `${issuePath}/customFields/${encodeURIComponent(field)}`);
      assert.equal(request.headers.get("authorization"), "Bearer synthetic-token");
      assert.equal(request.headers.get("content-type"), "application/json");
      assert.deepEqual(await request.json(), body);
      return HttpResponse.json({ id: "fixture-field", value: { name: "Started" } });
    }));
    assert.equal(await f.cli.run([...setCommand, "--profile", "dev", ...(json ? ["--json"] : [])]), 0);
    if (json) assert.deepEqual(JSON.parse(f.stdout()), { id: "fixture-field", value: { name: "Started" } });
    else assert.match(f.stdout(), /fixture-field/);
    assert.equal(calls, 1);
    assert.equal(f.stderr(), "");
  }
});

test("field RPC survives a profile denial and remote rejection with isolated URLs, secrets and AppData", async (t) => {
  const frames = [
    [...setCommand, "--profile", "production"],
    [...setCommand, "--profile", "dev"],
    ["project", "get", "DEMO", "--profile", "production"],
    ["user", "list", "--profile", "dev"],
  ];
  const input = frames.map((argv, id) => JSON.stringify({ jsonrpc: "2.0", id, method: "cli.execute", params: { argv } })).join("\n") + "\n";
  const f = await fixture(t, input);
  for (const profile of ["dev", "production"]) {
    await f.cli.execute(["profile", "create", profile, "--url", `https://${profile}.example.com/context`]);
    await f.secrets.set(service, `${profile}:token`, `synthetic-${profile}`);
  }
  await f.cli.execute(["permissions", "grant", "Update", "--profile", "dev"]);
  const calls: string[] = [];
  server.use(http.all("*", async ({ request }) => {
    const url = new URL(request.url);
    const profile = url.hostname.split(".")[0];
    assert.equal(request.headers.get("authorization"), `Bearer synthetic-${profile}`);
    calls.push(`${request.method} ${url.hostname}`);
    if (request.method === "POST") {
      assert.deepEqual(await request.json(), body);
      return new HttpResponse(null, { status: 204 });
    }
    if (profile === "production") return new HttpResponse("synthetic-production private-message", { status: 403 });
    return HttpResponse.json([]);
  }));
  f.paths.length = 0;
  assert.equal(await f.cli.run(["--json-rpc"]), 0);
  const replies = f.stdout().trim().split("\n").map((line) => JSON.parse(line));
  assert.deepEqual(replies.map((reply) => reply.id), [0, 1, 2, 3]);
  assert.match(replies[0].error.message, /Permission 'Update' is disabled/);
  assert.equal(replies[1].result, null);
  assert.equal(replies[2].error.code, -32000);
  assert.equal(replies[2].error.message, "YouTrack request failed (HTTP 403).");
  assert.deepEqual(replies[3].result, []);
  assert.deepEqual(calls, ["POST dev.example.com", "GET production.example.com", "GET dev.example.com"]);
  // Readiness and handler contexts follow admission; denied requests create neither.
  assert.deepEqual(f.paths, ["dev", "production", "dev"].map((name) => join(f.appArguments.RoamingAppDataDirectory, name)).flatMap((path) => [path, path]));
  assert.doesNotMatch(f.stdout() + f.stderr(), /synthetic-|private-message/);
  assert.equal(f.stderr(), "");
});

test("field set body syntax, type validation and remote errors stay local or sanitized", async (t) => {
  const f = await fixture(t);
  f.secrets.get = async () => { assert.fail("Missing required body reached secrets"); };
  await assert.rejects(f.cli.execute(["issues", "fields", "set", "DEMO-1", "fixture-field"]), /required option/);
  await assert.rejects(f.cli.execute(["issues", "fields", "set", "DEMO-1", "fixture-field", "--body", "synthetic-private-json"]), /valid JSON/);
  const configured = await fixture(t);
  await configured.cli.execute(["profile", "create", "dev", "--url", "https://youtrack.example.com/context"]);
  await configured.secrets.set(service, "dev:token", "synthetic-token");
  await configured.cli.execute(["permissions", "grant", "Update", "--profile", "dev"]);
  let calls = 0;
  server.use(http.post("*", () => { calls++; return new HttpResponse("synthetic-token private-message", { status: 403 }); }));
  await assert.rejects(configured.cli.execute(["issues", "fields", "set", "DEMO-1", "fixture-field", "--body", '{"$type":"StateMachineIssueCustomField","value":null}', "--profile", "dev"]), /event instead of value/);
  assert.equal(calls, 0);
  assert.equal(await configured.cli.run([...setCommand, "--profile", "dev", "--json"]), 1);
  assert.equal(calls, 1);
  assert.equal(configured.stdout(), "");
  assert.match(configured.stderr(), /HTTP 403/);
  assert.doesNotMatch(configured.stderr(), /synthetic-|private-message/);
});
