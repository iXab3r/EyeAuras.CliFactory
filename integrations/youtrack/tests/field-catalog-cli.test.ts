import assert from "node:assert/strict";
import { assertHttpRequest, trackRequests, assertPermissionDenied, assertCliOutput, assertSafeCliFailure } from "@eyeauras/cli-factory/testing";
import { join } from "node:path";
import { after, afterEach, before, test } from "node:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { fixture } from "./cli-fixture.js";
import { catalogCases } from "./field-catalog-cases.js";

const server = setupServer();
before(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
after(() => server.close());
const service = "ai-cli-factory:youtrack-cli";

for (const row of catalogCases) test(`catalog CLI ${row.argv.join(" ")} binds its route and human/JSON output`, async (t) => {
  const f = await fixture(t);
  await f.cli.execute(["profile", "create", "dev", "--url", "https://youtrack.example.com/context"]);
  await f.secrets.set(service, "dev:token", "synthetic-token");
  const result = row.collection ? [{ id: "fixture-result" }] : { id: "fixture-result" };
  const requests = trackRequests(t, 2, async request => {
    await assertHttpRequest(request, {
      method: "GET", url: "https://youtrack.example.com" + row.path,
      headers: { authorization: "Bearer synthetic-token" },
      query: { fields: "id", ...(row.collection ? { $top: "2", $skip: "3" } : {}) },
    });
    return HttpResponse.json(result);
  });
  server.use(http.all("*", ({ request }) => requests.handle(request)));
  await assertCliOutput(f, f.cli, [
    ...row.argv, "--fields", "id", ...(row.collection ? ["--top", "2", "--skip", "3"] : []),
    "--profile", "dev",
  ], result, /fixture-result/, requests);
});

test("every catalog leaf requires ReadOnly even when Update is enabled", async (t) => {
  const f = await fixture(t);
  await f.cli.execute(["profile", "create", "dev", "--url", "https://youtrack.example.com/context"]);
  await f.secrets.set(service, "dev:token", "synthetic-token");
  await f.cli.execute(["permissions", "revoke", "ReadOnly", "--profile", "dev"]);
  await f.cli.execute(["permissions", "grant", "Update", "--profile", "dev"]);
  const requests = trackRequests(t, 0, () => HttpResponse.json({}));
  server.use(http.all("*", ({ request }) => requests.handle(request)));
  for (const row of catalogCases)
    await assertPermissionDenied(f.cli, [...row.argv, "--profile", "dev"], "ReadOnly", requests);
});

test("catalog CLI rejects unsupported filters, detail pagination and malformed paging before fetch", async (t) => {
  const f = await fixture(t);
  await f.cli.execute(["profile", "create", "dev", "--url", "https://youtrack.example.com/context"]);
  await f.secrets.set(service, "dev:token", "synthetic-token");
  let calls = 0;
  server.use(http.get("*", () => { calls++; return HttpResponse.json([]); }));
  for (const row of catalogCases) {
    for (const flag of ["--query", "--archived", "--all"]) {
      await assert.rejects(f.cli.execute([...row.argv, flag, "--profile", "dev"]), /unknown option/);
    }
    if (row.collection) {
      await assert.rejects(f.cli.execute([...row.argv, "--top", "1e2", "--profile", "dev"]), /decimal integers/);
      await assert.rejects(f.cli.execute([...row.argv, "--top", "101", "--profile", "dev"]), /between 1 and 100/);
    } else {
      await assert.rejects(f.cli.execute([...row.argv, "--top", "2", "--profile", "dev"]), /unknown option/);
    }
  }
  assert.equal(calls, 0);
});

test("catalog RPC isolates profile URLs, tokens, permissions and AppData and survives remote rejection", async (t) => {
  const requests = [
    ["field", "type", "list", "--profile", "dev"],
    ["bundle", "enum", "get", "fixture-bundle", "--profile", "production"],
    ["bundle", "state", "value", "list", "fixture-bundle", "--profile", "disabled"],
    ["bundle", "state", "value", "get", "fixture-bundle", "fixture-value", "--profile", "dev"],
  ];
  const input = requests.map((argv, id) => JSON.stringify({
    jsonrpc: "2.0", id, method: "cli.execute", params: { argv },
  })).join("\n") + "\n";
  const f = await fixture(t, input);
  for (const profile of ["dev", "production", "disabled"]) {
    await f.cli.execute(["profile", "create", profile, "--url", `https://${profile}.example.com/context`]);
    await f.secrets.set(service, `${profile}:token`, `synthetic-${profile}`);
  }
  await f.cli.execute(["permissions", "revoke", "ReadOnly", "--profile", "disabled"]);
  const calls: string[] = [];
  const tracked = trackRequests(t, 3, request => {
    const url = new URL(request.url);
    const profile = url.hostname.split(".")[0];
    assert.equal(request.method, "GET");
    assert.equal(request.headers.get("authorization"), `Bearer synthetic-${profile}`);
    calls.push(`${url.hostname}${url.pathname}`);
    if (profile === "production") return new HttpResponse("synthetic-production private-response", { status: 403 });
    if (url.pathname.endsWith("/types")) return HttpResponse.json([]);
    return HttpResponse.json({ id: "fixture-value", description: "synthetic-dev", localizedName: null });
  });
  server.use(http.all("*", ({ request }) => tracked.handle(request)));
  f.paths.length = 0;
  assert.equal(await f.cli.run(["--json-rpc"]), 0);
  const replies = f.stdout().trim().split("\n").map((line) => JSON.parse(line));
  assert.deepEqual(replies.map((reply) => reply.id), [0, 1, 2, 3]);
  assert.deepEqual(replies[0].result, []);
  assert.equal(replies[1].error.code, -32000);
  assert.equal(replies[1].error.message, "YouTrack request failed (HTTP 403).");
  assert.match(replies[2].error.message, /Permission 'ReadOnly' is disabled/);
  assert.deepEqual(replies[3].result, { id: "fixture-value", description: "[redacted]", localizedName: null });
  assert.deepEqual(calls, [
    "dev.example.com/context/api/admin/customFieldSettings/types",
    "production.example.com/context/api/admin/customFieldSettings/bundles/enum/fixture-bundle",
    "dev.example.com/context/api/admin/customFieldSettings/bundles/state/fixture-bundle/values/fixture-value",
  ]);
  // Readiness and handler contexts follow admission; denied requests create neither.
  assert.deepEqual(f.paths, ["dev", "production", "dev"].map((profile) =>
    join(f.appArguments.RoamingAppDataDirectory, profile)).flatMap((path) => [path, path]));
  assert.equal(f.stderr(), "");
  assert.doesNotMatch(f.stdout(), /synthetic-|private-response/);
});

test("catalog ordinary JSON errors stay on stderr with one failed request and no private payload", async (t) => {
  const f = await fixture(t);
  await f.cli.execute(["profile", "create", "dev", "--url", "https://youtrack.example.com/context"]);
  await f.secrets.set(service, "dev:token", "synthetic-token");
  const requests = trackRequests(t, 1, () =>
    new HttpResponse("synthetic-token private-response", { status: 403 }));
  server.use(http.all("*", ({ request }) => requests.handle(request)));
  await assertSafeCliFailure(f, f.cli,
    ["field", "get", "fixture-field", "--profile", "dev", "--json"],
    /YouTrack request failed \(HTTP 403\)/, /synthetic-|private-response/);
});
