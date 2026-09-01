import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createTestRuntime } from "./support.js";
import { systemCases } from "./system-cases.js";
import { TeamCityClient } from "../src/client.js";
import { pluginXml, cleanupPatch, globalPatch } from "../src/system-models.js";
const server = setupServer();
const base = "https://teamcity.test/app/rest";
const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
test.before(() => server.listen({ onUnhandledRequest: "error" }));
test.afterEach(() => server.resetHandlers());
test.after(() => server.close());
for (const c of systemCases)
  test(`S9 contract: ${c.method} ${c.path}`, async (testContext) => {
    const runtime = await createTestRuntime(testContext);
    for (const [key, value] of Object.entries(c.storedSecrets ?? {}))
      await runtime.secretStore.set("ai-cli-factory:teamcity-cli", "default:" + key, value);
    const cli = runtime.createCli();
    let requests = 0;
    server.use(
      http.all(/^https:\/\/teamcity\.test\/app\/rest(?:\/|$)/, async ({ request }) => {
        requests++;
        const url = new URL(request.url);
        assert.equal(request.headers.get("Authorization"), "Bearer fixture-token");
        if (c.preflight && request.method === "GET" && url.pathname === "/app/rest" + c.preflight) {
          assert.deepEqual(Object.fromEntries(url.searchParams), { fields: c.preflightFields });
          return HttpResponse.json(c.preflightResponse as never);
        }
        assert.equal(request.method, c.method);
        assert.equal(url.pathname, "/app/rest" + c.path);
        assert.deepEqual(Object.fromEntries(url.searchParams), c.query ?? {});
        assert.equal(
          request.headers.get("Accept"),
          c.accept ?? (c.text && !c.jsonResponse ? "text/plain" : "application/json"),
        );
        if (c.avatar) {
          assert.match(
            request.headers.get("Content-Type") ?? "",
            /^multipart\/form-data; boundary=/,
          );
          const form = await request.formData();
          assert.deepEqual([...form.keys()], ["avatar"]);
          assert.deepEqual(new Uint8Array(await (form.get("avatar") as File).arrayBuffer()), png);
        } else {
          assert.equal(
            request.headers.get("Content-Type"),
            c.body === undefined ? null : c.text ? "text/plain" : "application/json",
          );
          assert.deepEqual(
            c.body === undefined
              ? await request.text()
              : c.text
                ? await request.text()
                : await request.json(),
            c.body ?? "",
          );
        }
        if (c.response === null) return new HttpResponse(null, { status: 204 });
        return c.responseMedia || (c.text && !c.jsonResponse)
          ? new HttpResponse(String(c.response), {
              headers: { "Content-Type": c.responseMedia ?? "text/plain" },
            })
          : HttpResponse.json(c.response as never);
      }),
    );
    if (c.method !== "GET") {
      await assert.rejects(
        cli.execute(c.argv),
        new RegExp(`Permission '${c.permission ?? "Update"}'`),
      );
      assert.equal(requests, 0);
      await cli.execute(["permissions", "grant", c.permission ?? "Update"]);
    }
    const dir = c.avatar ? await mkdtemp(join(tmpdir(), "teamcity-avatar-test-")) : undefined;
    try {
      if (dir) await writeFile(join(dir, "avatar.png"), png);
      const argv = c.argv.map((v) => (v === "AVATAR_FILE" ? join(dir!, "avatar.png") : v));
      assert.equal(await cli.run([...argv, "--json"]), 0, runtime.stderr());
      assert.deepEqual(JSON.parse(runtime.stdout()), c.expected);
      assert.equal(requests, c.preflight ? 2 : 1);
      if (c.method === "POST" && c.path.includes("authorizationTokens"))
        assert.equal(
          await runtime.secretStore.get(
            "ai-cli-factory:teamcity-cli",
            "default:input-secret:agent-one",
          ),
          "synthetic-agent-registration",
        );
    } finally {
      if (dir) await rm(dir, { recursive: true, force: true });
    }
  });

test("S9 all gates, help and error paths avoid network/preflight leaks", async (testContext) => {
  for (const c of systemCases) {
    const runtime = await createTestRuntime(testContext, {
      profiles: [{ name: "default", url: "https://teamcity.test", permissions: [] }],
    });
    const cli = runtime.createCli();
    let calls = 0;
    server.use(
      http.all(/^https:\/\/teamcity\.test\/app\/rest/, () => {
        calls++;
        return HttpResponse.text("synthetic-private-error", { status: 403 });
      }),
    );
    await assert.rejects(cli.execute(c.argv), /Permission/);
    assert.equal(calls, 0);
    assert.equal(await cli.run([...c.argv, "--help"]), 0);
    assert.equal(calls, 0);
    runtime.resetOutput();
    if (c.avatar) continue;
    for (const [k, v] of Object.entries(c.storedSecrets ?? {}))
      await runtime.secretStore.set("ai-cli-factory:teamcity-cli", "default:" + k, v);
    await cli.execute([
      "permissions",
      "grant",
      c.method === "GET" ? "ReadOnly" : (c.permission ?? "Update"),
    ]);
    assert.equal(await cli.run([...c.argv, "--json"]), 1);
    assert.equal(calls, 1);
    assert.doesNotMatch(runtime.stderr() + runtime.stdout(), /synthetic-private-error/);
  }
});
test("S9 strict settings reject unknown fields, invalid sentinels and unsafe auth before HTTP", async (testContext) => {
  const r = await createTestRuntime(testContext);
  const cli = r.createCli();
  await cli.execute(["permissions", "grant", "Admin"]);
  await cli.execute(["permissions", "grant", "Update"]);
  let calls = 0;
  server.use(
    http.all(/^https:\/\/teamcity\.test/, () => {
      calls++;
      return HttpResponse.json({});
    }),
  );
  for (const argv of [
    ["server", "field", "superUserToken"],
    ["health", "list"],
    ["health", "list", "--global", "--project", "Example"],
    ["roles", "included", "add", "reader", "reader"],
    ["server", "settings", "set", "--item", '{"encryptionKey":"synthetic-not-allowed"}'],
    ["server", "authentication", "replace", "--item", '{"allowGuest":false}', "--confirm"],
    [
      "server",
      "authentication",
      "replace",
      "--item",
      '{"modules":[{"name":"Default","properties":[{"name":"password","value":"synthetic"}]}]}',
      "--confirm",
    ],
    ["server", "backup", "start", "../escape", "--confirm"],
    ["deployments", "delete", "Release"],
    [
      "deployments",
      "instances",
      "append-state",
      "Release",
      "Uat",
      "--state",
      "successful",
      "--date",
      "20260830T120000+0000",
    ],
    ["mutes", "delete-many", "--id", "9", "--id", "9", "--confirm"],
  ])
    await assert.rejects(cli.execute(argv));
  assert.equal(calls, 0);
  assert.deepEqual(
    globalPatch({
      maxArtifactSize: -1,
      defaultExecutionTimeout: 0,
      enforceDefaultVCSCheckInterval: false,
    }),
    { maxArtifactSize: -1, defaultExecutionTimeout: 0, enforceDefaultVCSCheckInterval: false },
  );
  for (const v of [
    { maxArtifactSize: -2 },
    { defaultQuietPeriod: 1.5 },
    { maxArtifactSize: Number.MAX_SAFE_INTEGER + 1 },
  ])
    assert.throws(() => globalPatch(v));
  assert.deepEqual(cleanupPatch({ enabled: false, daily: { hour: 0, minute: 0 } }), {
    enabled: false,
    daily: { hour: 0, minute: 0 },
  });
  for (const v of [
    { daily: { hour: 24, minute: 0 } },
    { daily: { hour: 0, minute: 0 }, cron: {} },
    { cron: { minute: "*", hour: "*", day: "*", month: "*", dayWeek: "bad" } },
  ])
    assert.throws(() => cleanupPatch(v));
});
test("S9 plugin XML rejects entities, DTD, malformed media and oversized streams", async (testContext) => {
  assert.deepEqual(pluginXml('<plugin name="rest&amp;api" loaded="false"/>'), {
    name: "rest&api",
    loaded: false,
  });
  for (const xml of [
    '<!DOCTYPE plugin><plugin name="rest"/>',
    '<plugin name="&xxe;"/>',
    "<other/>",
    '<plugin name="x" name="y"/>',
    '<plugin name="x"><nested/></plugin>',
    '<plugin name="x" loaded="oops"/>',
  ])
    assert.throws(() => pluginXml(xml));
  const r = await createTestRuntime(testContext),
    cli = r.createCli();
  server.use(http.get(base + "/info", () => HttpResponse.text('<plugin name="rest"/>')));
  await assert.rejects(cli.execute(["server", "rest-plugin"]), /media/);
  server.use(
    http.get(
      base + "/info",
      () =>
        new HttpResponse(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new Uint8Array(2 * 1024 * 1024 + 1));
              controller.close();
            },
          }),
          { headers: { "Content-Type": "application/xml" } },
        ),
    ),
  );
  await assert.rejects(cli.execute(["server", "rest-plugin"]), /2MiB/);
});
test("S9 one-time issuance validates aliases and reports partial persistence without retry", async (testContext) => {
  const r = await createTestRuntime(testContext),
    cli = r.createCli();
  await cli.execute(["permissions", "grant", "Credentials"]);
  let calls = 0;
  server.use(
    http.post(base + "/agentPools/id:2/authorizationTokens", () => {
      calls++;
      return HttpResponse.json({ item: ["synthetic-first", "synthetic-second"] });
    }),
  );
  const argv = [
    "pools",
    "tokens",
    "create",
    "2",
    "--ttl",
    "300",
    "--store-as",
    "first",
    "--store-as",
    "second",
  ];
  await r.secretStore.set(
    "ai-cli-factory:teamcity-cli",
    "default:input-secret:first",
    "synthetic-existing",
  );
  await assert.rejects(cli.execute(argv), /already exists/);
  assert.equal(calls, 0);
  await r.secretStore.delete("ai-cli-factory:teamcity-cli", "default:input-secret:first");
  const set = r.secretStore.set.bind(r.secretStore);
  r.secretStore.set = async (service, key, value) => {
    if (key.endsWith(":second")) throw new Error("synthetic-private-store-cause");
    return set(service, key, value);
  };
  await assert.rejects(
    cli.execute(argv),
    /Remote operation succeeded but secure persistence failed/,
  );
  assert.equal(calls, 1);
  assert.equal(
    await r.secretStore.get("ai-cli-factory:teamcity-cli", "default:input-secret:first"),
    "synthetic-first",
  );
  assert.equal(
    await r.secretStore.get("ai-cli-factory:teamcity-cli", "default:token"),
    "fixture-token",
  );
});
test("S9 secure module inputs and license paths never leak on rejected requests", async (testContext) => {
  const r = await createTestRuntime(testContext),
    cli = r.createCli();
  await cli.execute(["permissions", "grant", "Admin"]);
  await r.secretStore.set(
    "ai-cli-factory:teamcity-cli",
    "default:input-secret:directory",
    "synthetic-directory-secret",
  );
  let calls = 0;
  server.use(
    http.put(base + "/server/authSettings", async ({ request }) => {
      calls++;
      assert.deepEqual(await request.json(), {
        modules: {
          module: [
            {
              name: "LDAP",
              properties: { property: [{ name: "password", value: "synthetic-directory-secret" }] },
            },
          ],
        },
      });
      return HttpResponse.json({
        modules: {
          module: [
            { name: "LDAP", properties: { property: [{ value: "synthetic-directory-secret" }] } },
          ],
        },
      });
    }),
  );
  assert.deepEqual(
    await cli.execute([
      "server",
      "authentication",
      "replace",
      "--item",
      '{"modules":[{"name":"LDAP","secrets":[{"name":"password","alias":"directory"}]}]}',
      "--confirm",
    ]),
    { modules: [{ name: "LDAP" }] },
  );
  assert.equal(calls, 1);
  const client = new TeamCityClient({
    baseUrl: "https://teamcity.test",
    token: "fixture-token",
    fetch: async () => {
      throw new Error("synthetic-secret-in-url");
    },
  });
  await assert.rejects(
    client.getLicense("directory", {
      get: async () => "synthetic-secret-in-url",
      require: async () => "synthetic-secret-in-url",
      set: async () => {},
      delete: async () => {},
    }),
    (e) => e instanceof Error && !e.message.includes("synthetic-secret") && e.cause === undefined,
  );
});
test("S9 bulk unmute reconstructs exact full preflight model and never retries failure", async (testContext) => {
  const r = await createTestRuntime(testContext),
    cli = r.createCli();
  await cli.execute(["permissions", "grant", "Update"]);
  let gets = 0,
    writes = 0;
  const c = systemCases.find((c) => c.path === "/mutes/multiple")!;
  server.use(
    http.get(base + "/mutes/id:9", () => {
      gets++;
      return HttpResponse.json({ ...(c.preflightResponse as object), id: 10 });
    }),
    http.delete(base + "/mutes/multiple", () => {
      writes++;
      return HttpResponse.text("synthetic-secret-error", { status: 500 });
    }),
  );
  await assert.rejects(cli.execute(c.argv), /identity/);
  assert.equal(writes, 0);
  server.use(
    http.get(base + "/mutes/id:9", () => {
      gets++;
      return HttpResponse.json(c.preflightResponse as never);
    }),
  );
  await assert.rejects(cli.execute(c.argv), /HTTP 500/);
  assert.equal(writes, 1);
  assert.equal(gets, 2);
});
test("S9 persistent RPC isolates license input aliases and Admin permissions", async (testContext) => {
  const requests = [
    {
      jsonrpc: "2.0",
      id: 1,
      method: "cli.execute",
      params: {
        argv: ["server", "licenses", "delete", "license", "--confirm", "--profile", "uat"],
      },
    },
    {
      jsonrpc: "2.0",
      id: 2,
      method: "cli.execute",
      params: { argv: ["server", "licenses", "show", "license", "--profile", "prod"] },
    },
  ];
  const r = await createTestRuntime(testContext, {
    profiles: [
      { name: "uat", url: "https://teamcity.test" },
      { name: "prod", url: "https://teamcity.test" },
    ],
    tokens: { uat: "fixture-uat", prod: "fixture-prod" },
    input: requests.map((x) => JSON.stringify(x)).join("\n") + "\n",
  });
  await r.secretStore.set(
    "ai-cli-factory:teamcity-cli",
    "prod:input-secret:license",
    "synthetic-prod-license",
  );
  let calls = 0;
  server.use(
    http.get(base + "/server/licensingData/licenseKeys/synthetic-prod-license", ({ request }) => {
      calls++;
      assert.equal(request.headers.get("Authorization"), "Bearer fixture-prod");
      return HttpResponse.json({ active: true, key: "synthetic-prod-license" });
    }),
  );
  const cli = r.createCli();
  assert.equal(await cli.run(["--json-rpc"]), 0);
  assert.equal(calls, 1);
  assert.doesNotMatch(r.stdout(), /synthetic-prod-license/);
  assert.match(r.stdout(), /Admin/);
  assert.match(r.stdout(), /active/);
});
