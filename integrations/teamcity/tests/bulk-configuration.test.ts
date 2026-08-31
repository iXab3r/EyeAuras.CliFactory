import assert from "node:assert/strict";
import test from "node:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createTeamCityCli } from "../src/cli.js";
import { createTestRuntime } from "./support.js";
import { bulkConfigurationCases } from "./bulk-configuration-cases.js";

const base = "https://teamcity.test/app/rest";
const server = setupServer();
test.before(() => server.listen({ onUnhandledRequest: "error" }));
test.afterEach(() => server.resetHandlers());
test.after(() => server.close());
async function writable(testContext: test.TestContext) {
  const runtime = await createTestRuntime(testContext);
  const cli = createTeamCityCli(runtime.runtime);
  await cli.execute(["permissions", "grant", "Update"]);
  return { cli, runtime };
}

test("S5 all 50 permission gates deny before HTTP", async (testContext) => {
  const runtime = await createTestRuntime(testContext, {
    profiles: [{ name: "default", url: "https://teamcity.test", permissions: [] }],
  });
  let calls = 0;
  server.use(
    http.all("*", () => {
      calls++;
      return HttpResponse.json({});
    }),
  );
  const cli = createTeamCityCli(runtime.runtime);
  for (const example of bulkConfigurationCases)
    await assert.rejects(
      cli.execute(example.argv),
      new RegExp(`Permission '${example.method === "GET" ? "ReadOnly" : "Update"}'`),
    );
  assert.equal(calls, 0);
});

test("S5 validates typed items, IDs, booleans, confirmation and bounded queue scope locally", async (testContext) => {
  const { cli } = await writable(testContext);
  let calls = 0;
  server.use(
    http.all("*", () => {
      calls++;
      return HttpResponse.json({});
    }),
  );
  const invalid = [
    ["jobs", "parameters", "clear", "Build"],
    ["jobs", "templates", "clear", "Build"],
    ["pools", "projects", "clear", "1"],
    ["queue", "delete-page", "--confirm"],
    ["queue", "delete-page", "--job", "Build"],
    ["queue", "delete-page", "--job", "Build", "--limit", "101", "--confirm"],
    ["queue", "paused", "set", "yes", "--reason", "Maintenance"],
    ["queue", "paused", "set", "false"],
    ["queue", "reorder"],
    ["queue", "reorder", "--build", "42", "--build", "42"],
    ["queue", "reorder", "--build", "0"],
    ["queue", "approval", "approve", "-1"],
    ["projects", "pools", "replace-all", "Example", "--pool", "-1"],
    ["projects", "pools", "replace-all", "Example", "--pool", "1", "--pool", "1"],
    ["projects", "order", "jobs", "set", "Example", "--id", "Build", "--id", "Build"],
    ["projects", "jobs", "create", "Example", "Build"],
    ["agents", "types", "show", "0"],
    ["jobs", "parameters", "type", "set", "Build", "env.MODE", "password"],
    ["jobs", "parameters", "raw-type", "set", "Build", "env.MODE", "text display=hidden"],
    ["jobs", "output-parameters", "replace-all", "Build", "--property", "password=synthetic"],
    ["jobs", "parameters", "value", "set", "Build", "env.MODE", "Bearer synthetic-token"],
    ["jobs", "steps", "replace-all", "Build", "--item", "{broken"],
    ["jobs", "steps", "replace-all", "Build", "--item", "null"],
    [
      "jobs",
      "steps",
      "replace-all",
      "Build",
      "--item",
      '{"name":"Echo","type":"runner","unknown":true}',
    ],
    ["jobs", "features", "replace-all", "Build", "--item", '{"type":"plugin","enabled":"false"}'],
    [
      "jobs",
      "steps",
      "replace-all",
      "Build",
      "--item",
      '{"name":"Echo","type":"runner","properties":[{"name":"password","value":"synthetic"}]}',
    ],
    ["jobs", "snapshot-dependencies", "replace-all", "Build", "--item", '{"source":"Build"}'],
    [
      "jobs",
      "artifact-dependencies",
      "replace-all",
      "Build",
      "--item",
      '{"source":"Source","rules":"*.zip"}',
    ],
    [
      "jobs",
      "agent-requirements",
      "replace-all",
      "Build",
      "--item",
      '{"type":"exists","parameter":"secret"}',
    ],
    [
      "jobs",
      "vcs",
      "replace-all",
      "Build",
      "--item",
      '{"rootId":"Git","rules":"Bearer synthetic-token"}',
    ],
    [
      "projects",
      "features",
      "replace-all",
      "Example",
      "--item",
      '{"type":"plugin","enabled":true}',
    ],
  ];
  for (const argv of invalid) await assert.rejects(cli.execute(argv), Error, argv.join(" "));
  assert.equal(calls, 0);
});

test("S5 protected metadata prevents downgrade and raw value reads; bulk replacement only preflights metadata", async (testContext) => {
  const { cli } = await writable(testContext);
  const requests: string[] = [];
  server.use(
    http.all(`${base}/*`, ({ request }) => {
      const url = new URL(request.url);
      requests.push(`${request.method} ${url.pathname}`);
      assert.equal(request.method, "GET");
      assert.ok(!url.searchParams.get("fields")?.includes("value,"));
      const protectedProperty = { name: "env.MODE", type: { rawValue: "password" } };
      return HttpResponse.json(
        url.pathname.endsWith("/parameters")
          ? { property: [protectedProperty] }
          : protectedProperty,
      );
    }),
  );
  for (const part of ["value", "type", "raw-type"]) {
    const result = await cli.execute(["jobs", "parameters", part, "show", "Build", "env.MODE"]);
    assert.deepEqual(result, { name: "env.MODE", type: "protected", redacted: true });
    await assert.rejects(
      cli.execute(["jobs", "parameters", part, "set", "Build", "env.MODE", "text"]),
      /Protected/,
    );
  }
  await assert.rejects(
    cli.execute(["jobs", "parameters", "replace-all", "Build", "--property", "env.MODE=debug"]),
    /Protected/,
  );
  assert.equal(requests.length, 7);
  assert.ok(requests.every((r) => !r.endsWith("/value") && !r.endsWith("/type")));
});

test("S5 empty replacements and explicit template flags preserve full replacement contracts", async (testContext) => {
  const { cli } = await writable(testContext);
  let writes = 0;
  server.use(
    http.put(`${base}/*`, async ({ request }) => {
      writes++;
      const body = (await request.json()) as Record<string, unknown[]>;
      assert.deepEqual(Object.values(body), [[]]);
      return HttpResponse.json(body);
    }),
  );
  for (const kind of [
    "steps",
    "features",
    "triggers",
    "agent-requirements",
    "artifact-dependencies",
    "snapshot-dependencies",
    "vcs",
  ]) {
    assert.deepEqual(await cli.execute(["jobs", kind, "replace-all", "Build"]), []);
  }
  for (const argv of [
    ["projects", "features", "replace-all", "Example"],
    ["projects", "pools", "replace-all", "Example"],
    ["pools", "projects", "replace-all", "1"],
    ["projects", "order", "jobs", "set", "Example"],
  ])
    assert.deepEqual(await cli.execute(argv), []);
  assert.equal(writes, 11);
  server.use(
    http.all(`${base}/buildTypes/id:Build/templates`, async ({ request }) => {
      const url = new URL(request.url);
      assert.equal(
        url.searchParams.get(request.method === "PUT" ? "optimizeSettings" : "inlineSettings"),
        "true",
      );
      return request.method === "PUT"
        ? HttpResponse.json({})
        : new HttpResponse(null, { status: 204 });
    }),
  );
  await cli.execute(["jobs", "templates", "replace-all", "Build", "--optimize-settings"]);
  await cli.execute(["jobs", "templates", "clear", "Build", "--confirm", "--inline-settings"]);
});

test("S5 typed item validation preserves false and refuses duplicates without hidden mutations", async (testContext) => {
  const { cli } = await writable(testContext);
  const bodies: unknown[] = [];
  server.use(
    http.put(`${base}/*`, async ({ request }) => {
      bodies.push(await request.json());
      return HttpResponse.json({});
    }),
  );
  await cli.execute([
    "jobs",
    "features",
    "replace-all",
    "Build",
    "--item",
    '{"type":"plugin","enabled":false}',
  ]);
  await cli.execute([
    "jobs",
    "agent-requirements",
    "replace-all",
    "Build",
    "--item",
    '{"type":"exists","parameter":"env.MODE","disabled":true}',
  ]);
  assert.deepEqual(bodies, [
    { feature: [{ type: "plugin", disabled: true, properties: { property: [] } }] },
    {
      "agent-requirement": [
        {
          type: "exists",
          disabled: true,
          properties: { property: [{ name: "property-name", value: "env.MODE" }] },
        },
      ],
    },
  ]);
  await assert.rejects(
    cli.execute([
      "jobs",
      "snapshot-dependencies",
      "replace-all",
      "Build",
      "--item",
      '{"source":"Source"}',
      "--item",
      '{"source":"Source"}',
    ]),
    /Duplicate/,
  );
  assert.equal(bodies.length, 2);
});

test("S5 JSON and text output exclude unknown nested fields and malformed payload excerpts", async (testContext) => {
  const { cli } = await writable(testContext);
  server.use(
    http.get(`${base}/agentTypes/id:7`, () =>
      HttpResponse.json({
        id: 7,
        isCloud: true,
        availableParameters: { password: "synthetic-hidden" },
      }),
    ),
    http.get(`${base}/buildQueue/id:42/approvalInfo`, () =>
      HttpResponse.json({ status: "approved", userApprovals: { token: "synthetic-hidden" } }),
    ),
  );
  assert.deepEqual(await cli.execute(["agents", "types", "show", "7"]), { id: 7, isCloud: true });
  assert.deepEqual(await cli.execute(["queue", "approval", "show", "42"]), { status: "approved" });
  server.use(http.get(`${base}/*`, () => HttpResponse.text('{"synthetic-hidden": broken')));
  await assert.rejects(cli.execute(["jobs", "builds", "Build"]), {
    message: "TeamCity response was not valid JSON.",
  });
});

test("S5 JSON-RPC isolates replacement permissions and credentials across two profiles", async (testContext) => {
  const commands = [
    ["jobs", "steps", "replace-all", "--help"],
    ["jobs", "steps", "replace-all", "Build"],
    ["jobs", "steps", "replace-all", "Build", "--profile", "uat"],
    ["agents", "types", "show", "7"],
  ];
  const runtime = await createTestRuntime(testContext, {
    profiles: [
      { name: "default", url: "https://teamcity.test" },
      { name: "uat", url: "https://uat.test", permissions: ["ReadOnly", "Update"] },
    ],
    tokens: { default: "fixture-token", uat: "fixture-uat-token" },
    input:
      commands
        .map((argv, id) =>
          JSON.stringify({ jsonrpc: "2.0", id, method: "cli.execute", params: { argv } }),
        )
        .join("\n") + "\n",
  });
  const calls: string[] = [];
  server.use(
    http.put("https://uat.test/app/rest/buildTypes/id:Build/steps", async ({ request }) => {
      assert.equal(request.headers.get("Authorization"), "Bearer fixture-uat-token");
      assert.deepEqual(await request.json(), { step: [] });
      calls.push("uat");
      return HttpResponse.json({});
    }),
    http.get(`${base}/agentTypes/id:7`, ({ request }) => {
      assert.equal(request.headers.get("Authorization"), "Bearer fixture-token");
      calls.push("default");
      return HttpResponse.json({ id: 7 });
    }),
  );
  assert.equal(await createTeamCityCli(runtime.runtime).run(["--json-rpc"]), 0);
  const frames = runtime
    .stdout()
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  assert.match(frames[0].result.help, /omitted items/);
  assert.match(frames[1].error.message, /Permission 'Update'/);
  assert.deepEqual(frames[2].result, []);
  assert.deepEqual(frames[3].result, { id: 7 });
  assert.deepEqual(calls, ["uat", "default"]);
});

test("S5 stateful parameter replacement/value/type/clear workflow uses the exact metadata boundary", async (testContext) => {
  const { cli } = await writable(testContext);
  let value = "initial";
  let exists = true;
  let writes = 0;
  server.use(
    http.all(`${base}/buildTypes/id:Build/parameters*`, async ({ request }) => {
      const path = new URL(request.url).pathname;
      if (request.method === "GET") {
        if (path.endsWith("/value")) return HttpResponse.text(value);
        if (path.endsWith("/type")) return HttpResponse.json({ rawValue: "text" });
        const metadata = { name: "env.MODE", type: { rawValue: "text" } };
        return HttpResponse.json(
          path.endsWith("/parameters") ? { property: exists ? [metadata] : [] } : metadata,
        );
      }
      writes++;
      if (request.method === "DELETE") {
        exists = false;
        return new HttpResponse(null, { status: 204 });
      }
      if (path.endsWith("/value")) {
        value = await request.text();
        return HttpResponse.text(value);
      }
      const body = (await request.json()) as { property: { name: string; value: string }[] };
      value = body.property[0]!.value;
      return HttpResponse.json(body);
    }),
  );
  await cli.execute(["jobs", "parameters", "replace-all", "Build", "--property", "env.MODE=debug"]);
  await cli.execute(["jobs", "parameters", "value", "set", "Build", "env.MODE", "release"]);
  assert.deepEqual(
    await cli.execute(["jobs", "parameters", "value", "show", "Build", "env.MODE"]),
    { name: "env.MODE", type: "text", value: "release", redacted: false },
  );
  assert.deepEqual(await cli.execute(["jobs", "parameters", "type", "show", "Build", "env.MODE"]), {
    name: "env.MODE",
    type: "text",
    redacted: false,
  });
  await cli.execute(["jobs", "parameters", "clear", "Build", "--confirm"]);
  assert.equal(writes, 3);
  assert.equal(exists, false);
});
