import assert from "node:assert/strict";
import test from "node:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createTeamCityCli } from "../src/cli.js";
import { createTestRuntime } from "./support.js";
import { advancedAuthoringCases } from "./advanced-authoring-cases.js";

const base = "https://teamcity.test/app/rest";
const server = setupServer();
test.before(() => server.listen({ onUnhandledRequest: "error" }));
test.afterEach(() => server.resetHandlers());
test.after(() => server.close());
async function writable() {
  const runtime = await createTestRuntime();
  const cli = createTeamCityCli(runtime.runtime);
  await cli.execute(["permissions", "grant", "Update"]);
  return { cli, runtime };
}

test("all 50 S3 leaves deny before HTTP when their profile has no permissions", async () => {
  const runtime = await createTestRuntime({
    profiles: [{ name: "default", url: "https://teamcity.test", permissions: [] }],
  });
  let calls = 0;
  server.use(
    http.all("*", () => {
      calls++;
      return HttpResponse.json({});
    }),
  );
  for (const example of advancedAuthoringCases) {
    await assert.rejects(
      createTeamCityCli(runtime.runtime).execute(example.argv),
      new RegExp(`Permission '${example.method === "GET" ? "ReadOnly" : "Update"}'`),
    );
  }
  assert.equal(calls, 0);
});

test("S3 validates flags, fields, booleans, paths, secret-like properties and self-dependencies locally", async () => {
  const { cli } = await writable();
  let calls = 0;
  server.use(
    http.all("*", () => {
      calls++;
      return HttpResponse.json({});
    }),
  );
  const invalid = [
    ["jobs", "agent-requirements", "create", "Build", "--type", "equals"],
    [
      "jobs",
      "agent-requirements",
      "create",
      "Build",
      "--type",
      "equals",
      "--parameter",
      "env.PASSWORD",
    ],
    [
      "jobs",
      "artifact-dependencies",
      "create",
      "Build",
      "--source",
      "Build",
      "--rules",
      "*.zip",
      "--revision",
      "lastSuccessful",
    ],
    [
      "jobs",
      "artifact-dependencies",
      "create",
      "Build",
      "--source",
      "Source",
      "--revision",
      "lastSuccessful",
    ],
    ["jobs", "steps", "parameters", "show", "Build", "Runner", ".."],
    [
      "jobs",
      "steps",
      "parameters",
      "replace",
      "Build",
      "Runner",
      "--property",
      "x=a",
      "--property",
      "x=b",
    ],
    ["jobs", "features", "parameters", "set", "Build", "Feature", "secret", "synthetic"],
    [
      "projects",
      "features",
      "create",
      "Example",
      "--type",
      "plugin",
      "--property",
      "password=synthetic",
    ],
    ["projects", "features", "replace", "Example", "Feature"],
    ["projects", "templates", "create", "Example", "Template"],
    ["projects", "templates", "default", "set", "Example"],
    ["jobs", "branches", "Build", "--limit", "101"],
    ["jobs", "branches", "Build", "--start", "-1"],
    ["jobs", "fields", "show", "Build", "settingsFile"],
    ["projects", "fields", "show", "Example", "secure"],
  ];
  for (const kind of [
    "steps",
    "features",
    "triggers",
    "agent-requirements",
    "artifact-dependencies",
  ]) {
    invalid.push(["jobs", kind, "fields", "set", "Build", "Entity", "disabled", "yes"]);
    invalid.push(["jobs", kind, "fields", "show", "Build", "Entity", "type"]);
  }
  for (const argv of invalid) await assert.rejects(cli.execute(argv), Error, argv.join(" "));
  assert.equal(calls, 0);
});

test("S3 artifact options and requirement activation preserve exact typed bodies", async () => {
  const { cli } = await writable();
  const bodies: unknown[] = [];
  server.use(
    http.post(`${base}/buildTypes/id:Build/*`, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      bodies.push(body);
      return HttpResponse.json({ id: "Entity", ...body });
    }),
  );
  await cli.execute([
    "jobs",
    "artifact-dependencies",
    "create",
    "Build",
    "--source",
    "Source",
    "--rules",
    "*.zip",
    "--revision",
    "buildNumber",
    "--revision-value",
    "123",
    "--branch",
    "main",
    "--clean",
    "--disabled",
  ]);
  await cli.execute([
    "jobs",
    "agent-requirements",
    "create",
    "Build",
    "--type",
    "exists",
    "--parameter",
    "env.MODE",
    "--disabled",
  ]);
  assert.deepEqual(bodies, [
    {
      type: "artifact_dependency",
      disabled: true,
      "source-buildType": { id: "Source" },
      properties: {
        property: [
          { name: "pathRules", value: "*.zip" },
          { name: "revisionName", value: "buildNumber" },
          { name: "revisionValue", value: "123" },
          { name: "revisionBranch", value: "main" },
          { name: "cleanDestinationDirectory", value: "true" },
        ],
      },
    },
    {
      type: "exists",
      disabled: true,
      properties: { property: [{ name: "property-name", value: "env.MODE" }] },
    },
  ]);
});

test("S3 output parameter writes never downgrade protected metadata and create alone tolerates 404", async () => {
  const { cli } = await writable();
  let writes = 0;
  server.use(
    http.all(`${base}/buildTypes/id:Build/output-parameters*`, ({ request }) => {
      if (request.method === "GET")
        return HttpResponse.json({ name: "MODE", type: { rawValue: "password" } });
      writes++;
      return HttpResponse.json({ name: "MODE", value: "debug" });
    }),
  );
  for (const action of ["create", "set"])
    await assert.rejects(
      cli.execute(["jobs", "output-parameters", action, "Build", "MODE", "--value", "debug"]),
      /Protected/,
    );
  assert.equal(writes, 0);
  server.use(
    http.get(
      `${base}/buildTypes/id:Build/output-parameters/MODE`,
      () => new HttpResponse(null, { status: 404 }),
    ),
  );
  await assert.rejects(
    cli.execute(["jobs", "output-parameters", "set", "Build", "MODE", "--value", "debug"]),
    /404/,
  );
  await cli.execute(["jobs", "output-parameters", "create", "Build", "MODE", "--value", "debug"]);
  assert.equal(writes, 1);
});

test("S3 handles empty lists, full property clearing and safe malformed/delete errors", async () => {
  const { cli } = await writable();
  server.use(
    http.all(`${base}/*`, ({ request }) =>
      request.method === "DELETE"
        ? HttpResponse.text("synthetic-hidden", { status: 404 })
        : HttpResponse.json({}),
    ),
  );
  for (const example of advancedAuthoringCases) {
    if (example.argv.includes("list") || ["aliases", "branches", "tags"].includes(example.argv[1]!))
      assert.deepEqual(await cli.execute(example.argv), []);
    if (example.method === "DELETE") await assert.rejects(cli.execute(example.argv), /HTTP 404/);
  }
  let calls = 0;
  server.use(
    http.put(`${base}/buildTypes/id:Build/:kind/Entity/parameters`, async ({ request }) => {
      calls++;
      assert.deepEqual(await request.json(), { property: [] });
      return HttpResponse.json({});
    }),
  );
  for (const kind of ["steps", "features"])
    assert.deepEqual(
      await cli.execute(["jobs", kind, "parameters", "replace", "Build", "Entity"]),
      [],
    );
  assert.equal(calls, 2);
  server.use(http.all(`${base}/*`, () => HttpResponse.text('{"synthetic-hidden": broken')));
  for (const example of advancedAuthoringCases.filter((e) => !e.text && e.method !== "DELETE")) {
    await assert.rejects(cli.execute(example.argv), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, "TeamCity response was not valid JSON.");
      assert.equal(error.cause, undefined);
      return true;
    });
  }
});

test("S3 JSON-RPC keeps two profiles isolated and resumes after validation and permission errors", async () => {
  const commands = [
    ["jobs", "artifact-dependencies", "replace", "--help"],
    ["projects", "templates", "create", "Example", "Template", "--profile", "uat"],
    ["projects", "templates", "create", "Example", "Template", "--name", "Template"],
    [
      "projects",
      "templates",
      "create",
      "Example",
      "Template",
      "--name",
      "Template",
      "--profile",
      "uat",
    ],
    ["jobs", "aliases", "Build"],
  ];
  const runtime = await createTestRuntime({
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
    http.post("https://uat.test/app/rest/projects/id:Example/templates", ({ request }) => {
      assert.equal(request.headers.get("Authorization"), "Bearer fixture-uat-token");
      calls.push("uat");
      return HttpResponse.json({ id: "Template" });
    }),
    http.get(`${base}/buildTypes/id:Build/aliases`, ({ request }) => {
      assert.equal(request.headers.get("Authorization"), "Bearer fixture-token");
      calls.push("default");
      return HttpResponse.json({ item: ["OldId"] });
    }),
  );
  assert.equal(await createTeamCityCli(runtime.runtime).run(["--json-rpc"]), 0);
  const frames = runtime
    .stdout()
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  assert.equal(frames.length, 5);
  assert.match(frames[0].result.help, /NOT preserved/);
  assert.match(frames[1].error.message, /required option/);
  assert.match(frames[2].error.message, /Permission 'Update'/);
  assert.deepEqual(frames[3].result, { id: "Template" });
  assert.deepEqual(frames[4].result, ["OldId"]);
  assert.deepEqual(calls, ["uat", "default"]);
  assert.equal(runtime.stderr(), "");
});

test("S3 stateful workflow creates a template, selects it as default, and safely removes the default", async () => {
  const { cli } = await writable();
  let template: { id: string; name: string } | undefined;
  let selected: string | undefined;
  server.use(
    http.all(`${base}/projects/id:Example/*`, async ({ request }) => {
      const isDefault = new URL(request.url).pathname.endsWith("defaultTemplate");
      if (request.method === "POST") {
        template = (await request.json()) as typeof template;
        return HttpResponse.json(template);
      }
      if (request.method === "PUT") {
        assert.ok(template);
        assert.deepEqual(await request.json(), { id: template.id });
        selected = template.id;
        return HttpResponse.json(template);
      }
      if (request.method === "DELETE") {
        assert.ok(selected);
        selected = undefined;
        return new HttpResponse(null, { status: 204 });
      }
      return isDefault
        ? HttpResponse.json(selected ? template : null)
        : HttpResponse.json({ buildType: template ? [template] : [] });
    }),
  );
  await cli.execute([
    "projects",
    "templates",
    "create",
    "Example",
    "Template",
    "--name",
    "Template",
  ]);
  await cli.execute([
    "projects",
    "templates",
    "default",
    "set",
    "Example",
    "--template",
    "Template",
  ]);
  assert.deepEqual(
    await cli.execute(["projects", "templates", "default", "show", "Example"]),
    template,
  );
  await cli.execute(["projects", "templates", "default", "clear", "Example"]);
  assert.equal(selected, undefined);
  assert.deepEqual(await cli.execute(["projects", "templates", "list", "Example"]), [template]);
});
