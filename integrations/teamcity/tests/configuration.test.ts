import assert from "node:assert/strict";
import test from "node:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createTeamCityCli } from "../src/cli.js";
import { TeamCityClient } from "../src/client.js";
import { createTestRuntime } from "./support.js";
import { configurationCases } from "./configuration-cases.js";

const base = "https://teamcity.test/app/rest/buildTypes/id:Example_Build";
const server = setupServer();
test.before(() => server.listen({ onUnhandledRequest: "error" }));
test.afterEach(() => server.resetHandlers());
test.after(() => server.close());

async function writableCli() {
  const runtime = await createTestRuntime();
  const cli = createTeamCityCli(runtime.runtime);
  await cli.execute(["permissions", "grant", "Update"]);
  return { cli, runtime };
}

test("all S2 leaves declare their gate and deny before HTTP", async () => {
  let requests = 0;
  const runtime = await createTestRuntime({
    profiles: [{ name: "default", url: "https://teamcity.test", permissions: [] }],
  });
  server.use(
    http.all("*", () => {
      requests++;
      return HttpResponse.json({});
    }),
  );
  const cli = createTeamCityCli(runtime.runtime);
  for (const example of configurationCases) {
    await assert.rejects(
      cli.execute(example.argv),
      new RegExp(`Permission '${example.method === "GET" ? "ReadOnly" : "Update"}'`),
    );
  }
  assert.equal(requests, 0);
});

test("S2 rejects missing fields, secret properties, duplicate keys, self-dependencies and raw locators before HTTP", async () => {
  const { cli } = await writableCli();
  let requests = 0;
  server.use(
    http.all("*", () => {
      requests++;
      return HttpResponse.json({});
    }),
  );
  const invalid = [
    ["triggers", "create", "Example_Build"],
    ["features", "replace", "Example_Build", "F1"],
    ["snapshot-dependencies", "create", "Example_Build"],
    ["snapshot-dependencies", "replace", "Example_Build", "Source", "--source", "Example_Build"],
    ["snapshot-dependencies", "create", "Example_Build", "--source", " "],
    ["templates", "attach", "Example_Build"],
    ["templates", "attach", "Example_Build", "--template", " "],
    ["features", "show", "Example_Build", ".."],
    ["triggers", "show", "Example_Build", "id:T1"],
    ["triggers", "delete", "Example_Build", "T1,count:100"],
    ["snapshot-dependencies", "delete", "Example_Build", "buildType:(id:Other)"],
    ["triggers", "create", "Example_Build", "--type", " "],
  ];
  for (const group of ["triggers", "features", "snapshot-dependencies"]) {
    const create = [
      group,
      "create",
      "Example_Build",
      ...(group === "snapshot-dependencies" ? ["--source", "Source"] : ["--type", "plugin"]),
    ];
    for (const property of [
      "=empty",
      "missing-equals",
      "env.TOKEN=synthetic",
      "setting=Bearer fixture-credential",
    ]) {
      invalid.push([...create, "--property", property]);
    }
    invalid.push([...create, "--property", "x=one", "--property", "x=two"]);
  }
  for (const argv of invalid)
    await assert.rejects(cli.execute(["jobs", ...argv]), Error, argv.join(" "));
  // Direct SDK callers cannot bypass the shared property validation.
  const client = new TeamCityClient({ baseUrl: "https://teamcity.test", token: "fixture-token" });
  await assert.rejects(
    client.createExtension("features", "Build", {
      type: "plugin",
      properties: [
        { name: "x", value: "one" },
        { name: "x", value: "two" },
      ],
    }),
    /Duplicate/,
  );
  await assert.rejects(client.createSnapshotDependency("Build", { source: "Build" }), /itself/);
  assert.equal(requests, 0);
});

test("S2 replacement sends an empty property set without GET/merge and extensions default disabled", async () => {
  const { cli } = await writableCli();
  let requests = 0;
  server.use(
    http.put(`${base}/*`, async ({ request }) => {
      requests++;
      const body = await request.json();
      const snapshot = new URL(request.url).pathname.includes("snapshot-dependencies");
      assert.deepEqual(
        body,
        snapshot
          ? {
              type: "snapshot_dependency",
              "source-buildType": { id: "Source" },
              properties: { property: [] },
            }
          : { type: "plugin", disabled: true, properties: { property: [] } },
      );
      return HttpResponse.json({ id: "Entity", ...(body as object) });
    }),
  );
  for (const kind of ["triggers", "features", "snapshot-dependencies"]) {
    await cli.execute([
      "jobs",
      kind,
      "replace",
      "Example_Build",
      "Entity",
      ...(kind === "snapshot-dependencies" ? ["--source", "Source"] : ["--type", "plugin"]),
    ]);
  }
  assert.equal(requests, 3);
});

test("enabling triggers and features is explicit for both create and replace", async () => {
  const { cli } = await writableCli();
  let requests = 0;
  server.use(
    http.all(`${base}/*`, async ({ request }) => {
      requests++;
      assert.ok(["POST", "PUT"].includes(request.method));
      assert.deepEqual(await request.json(), {
        type: "plugin",
        disabled: false,
        properties: { property: [] },
      });
      return HttpResponse.json({ id: "Entity", type: "plugin", disabled: false });
    }),
  );
  for (const group of ["triggers", "features"]) {
    for (const action of ["create", "replace"]) {
      assert.deepEqual(
        await cli.execute([
          "jobs",
          group,
          action,
          "Example_Build",
          ...(action === "replace" ? ["Entity"] : []),
          "--type",
          "plugin",
          "--enabled",
        ]),
        { id: "Entity", type: "plugin", disabled: false, properties: [] },
      );
    }
  }
  assert.equal(requests, 4);
});

test("template flags are explicit and affect only the named attachment", async () => {
  const { cli } = await writableCli();
  const methods: string[] = [];
  server.use(
    http.all(`${base}/templates*`, async ({ request }) => {
      methods.push(request.method);
      const url = new URL(request.url);
      if (request.method === "POST") {
        assert.equal(url.pathname, "/app/rest/buildTypes/id:Example_Build/templates");
        assert.deepEqual(Object.fromEntries(url.searchParams), {
          fields: "id,name,projectId",
          optimizeSettings: "true",
        });
        assert.deepEqual(await request.json(), { id: "Example_Template" });
        return HttpResponse.json({
          id: "Example_Template",
          name: "Template",
          parameters: { password: "synthetic-hidden" },
        });
      }
      assert.equal(request.method, "DELETE");
      assert.equal(
        url.pathname,
        "/app/rest/buildTypes/id:Example_Build/templates/id:Example_Template",
      );
      assert.deepEqual(Object.fromEntries(url.searchParams), { inlineSettings: "true" });
      assert.equal(await request.text(), "");
      return new HttpResponse(null, { status: 204 });
    }),
  );
  assert.deepEqual(
    await cli.execute([
      "jobs",
      "templates",
      "attach",
      "Example_Build",
      "--template",
      "Example_Template",
      "--optimize-settings",
    ]),
    { id: "Example_Template", name: "Template" },
  );
  assert.deepEqual(
    await cli.execute([
      "jobs",
      "templates",
      "detach",
      "Example_Build",
      "Example_Template",
      "--inline-settings",
    ]),
    {
      jobId: "Example_Build",
      templateId: "Example_Template",
      detached: true,
      inlineSettings: true,
    },
  );
  assert.deepEqual(methods, ["POST", "DELETE"]);
});

test("S2 results redact all plugin values and unknown nested fields, preserving inherited/source identity", async () => {
  const { cli, runtime } = await writableCli();
  server.use(
    http.all(`${base}/*`, () =>
      HttpResponse.json({
        id: "Entity",
        type: "plugin",
        inherited: true,
        disabled: false,
        properties: {
          property: [
            { name: "ordinary", value: "synthetic-hidden" },
            { name: "password", value: "synthetic-hidden", type: { rawValue: "password" } },
          ],
        },
        buildCustomization: { secret: "synthetic-hidden" },
        "source-buildType": {
          id: "Source",
          name: "Source",
          projectId: "Example",
          parameters: { secret: "synthetic-hidden" },
        },
      }),
    ),
  );
  for (const group of ["triggers", "features", "snapshot-dependencies"]) {
    const result = (await cli.execute([
      "jobs",
      group,
      "show",
      "Example_Build",
      "Entity",
    ])) as Record<string, unknown>;
    assert.equal(result.inherited, true);
    assert.deepEqual(result.properties, [
      { name: "ordinary", type: "plain", redacted: true },
      { name: "password", type: "protected", redacted: true },
    ]);
    assert.equal("buildCustomization" in result, false);
    if (group === "snapshot-dependencies")
      assert.deepEqual(result.source, { id: "Source", name: "Source", projectId: "Example" });
    assert.equal(JSON.stringify(result).includes("synthetic-hidden"), false);
  }
  assert.equal(await cli.run(["jobs", "features", "show", "Example_Build", "Entity"]), 0);
  assert.ok(runtime.stdout().length > 0);
  assert.equal(runtime.stdout().includes("synthetic-hidden"), false);
});

test("S2 empty lists, delete 404s and malformed response errors are deterministic and sanitized", async () => {
  const { cli } = await writableCli();
  server.use(
    http.all(`${base}/*`, ({ request }) =>
      request.method === "DELETE"
        ? HttpResponse.text("synthetic-hidden", { status: 404 })
        : HttpResponse.json({}),
    ),
  );
  for (const example of configurationCases) {
    if (example.argv[2] === "list") assert.deepEqual(await cli.execute(example.argv), []);
    if (example.method === "DELETE") await assert.rejects(cli.execute(example.argv), /HTTP 404/);
  }
  server.use(http.all(`${base}/*`, () => HttpResponse.text('{"synthetic-hidden": malformed')));
  for (const example of configurationCases.filter((c) => c.method !== "DELETE")) {
    await assert.rejects(cli.execute(example.argv), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, "TeamCity response was not valid JSON.");
      assert.equal(error.cause, undefined);
      return true;
    });
  }
});

test("S2 JSON-RPC preserves profile URL/token/gates and continues after help and denied mutation", async () => {
  const commands = [
    ["jobs", "triggers", "replace", "--help"],
    ["jobs", "triggers", "create", "Example_Build", "--profile", "uat"],
    ["jobs", "triggers", "create", "Example_Build", "--type", "vcsTrigger"],
    ["jobs", "features", "create", "Example_Build", "--type", "swabra", "--profile", "uat"],
    ["jobs", "templates", "list", "Example_Build"],
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
  const seen: string[] = [];
  server.use(
    http.post("https://uat.test/app/rest/buildTypes/id:Example_Build/features", ({ request }) => {
      assert.equal(request.headers.get("Authorization"), "Bearer fixture-uat-token");
      seen.push("uat-write");
      return HttpResponse.json({ id: "Feature", type: "swabra", disabled: true });
    }),
    http.get(`${base}/templates`, ({ request }) => {
      assert.equal(request.headers.get("Authorization"), "Bearer fixture-token");
      seen.push("default-read");
      return HttpResponse.json({});
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
  assert.match(frames[0].result.help, /Required permission: Update/);
  assert.match(frames[0].result.help, /--enabled/);
  assert.match(frames[1].error.message, /required option.*--type/);
  assert.match(frames[2].error.message, /Permission 'Update'/);
  assert.equal(frames[3].result.id, "Feature");
  assert.deepEqual(frames[4].result, []);
  assert.deepEqual(seen, ["uat-write", "default-read"]);
  assert.equal(runtime.stderr(), "");
});

test("offline S2 workflow configures, inspects, replaces and removes settings without launching builds", async () => {
  const { cli } = await writableCli();
  const state = new Map<string, Record<string, unknown>>();
  let requests = 0;
  server.use(
    http.all(`${base}/*`, async ({ request }) => {
      requests++;
      const suffix = new URL(request.url).pathname.split("/id:Example_Build/")[1]!;
      const [family, id] = suffix.split("/");
      assert.ok(family);
      const key =
        family === "snapshot-dependencies"
          ? "snapshot-dependency"
          : family === "templates"
            ? "buildType"
            : family.slice(0, -1);
      if (request.method === "GET")
        return HttpResponse.json({ [key]: state.has(family) ? [state.get(family)] : [] });
      if (request.method === "DELETE") {
        assert.equal(
          id,
          family === "templates"
            ? "id:Template"
            : family === "snapshot-dependencies"
              ? "Source"
              : "Entity",
        );
        assert.ok(state.delete(family));
        return new HttpResponse(null, { status: 204 });
      }
      assert.ok(["POST", "PUT"].includes(request.method));
      const body = (await request.json()) as Record<string, unknown>;
      if (family !== "templates" && request.method === "PUT") {
        assert.ok(state.has(family));
        assert.deepEqual(body.properties, { property: [] });
      }
      const result = { id: family === "snapshot-dependencies" ? "Source" : "Entity", ...body };
      state.set(family, result);
      return HttpResponse.json(result);
    }),
  );
  for (const group of ["triggers", "features", "snapshot-dependencies"]) {
    const options =
      group === "snapshot-dependencies" ? ["--source", "Source"] : ["--type", "plugin"];
    await cli.execute([
      "jobs",
      group,
      "create",
      "Example_Build",
      ...options,
      "--property",
      "example=one",
    ]);
    const first = (await cli.execute(["jobs", group, "list", "Example_Build"])) as { id: string }[];
    assert.equal(first.length, 1);
    await cli.execute(["jobs", group, "replace", "Example_Build", first[0]!.id, ...options]);
    await cli.execute(["jobs", group, "delete", "Example_Build", first[0]!.id]);
    assert.deepEqual(await cli.execute(["jobs", group, "list", "Example_Build"]), []);
  }
  await cli.execute(["jobs", "templates", "attach", "Example_Build", "--template", "Template"]);
  assert.deepEqual(await cli.execute(["jobs", "templates", "list", "Example_Build"]), [
    { id: "Template" },
  ]);
  await cli.execute(["jobs", "templates", "detach", "Example_Build", "Template"]);
  assert.equal(state.size, 0);
  assert.equal(requests, 18);
});
