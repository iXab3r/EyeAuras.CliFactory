import assert from "node:assert/strict";
import test from "node:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createTeamCityCli } from "../src/cli.js";
import { TeamCityClient, TeamCityHttpError } from "../src/client.js";
import { createTestRuntime } from "./support.js";
import { authoringCases } from "./authoring-cases.js";
import { configurationCases } from "./configuration-cases.js";
import { advancedAuthoringCases } from "./advanced-authoring-cases.js";
import { operatorCases } from "./operator-cases.js";
import { bulkConfigurationCases } from "./bulk-configuration-cases.js";
import { triageCases } from "./triage-cases.js";
import { adminCases } from "./admin-cases.js";
import { infrastructureCases } from "./infrastructure-cases.js";

const base = "https://teamcity.test/app/rest";
const server = setupServer();
test.before(() => server.listen({ onUnhandledRequest: "error" }));
test.afterEach(() => server.resetHandlers());
test.after(() => server.close());

for (const example of [
  ...authoringCases,
  ...configurationCases,
  ...advancedAuthoringCases,
  ...operatorCases,
  ...bulkConfigurationCases,
  ...triageCases,
  ...adminCases,
  ...infrastructureCases,
]) {
  test(`authoring contract: ${example.method} ${example.path}`, async (testContext) => {
    const runtime = await createTestRuntime(testContext);
    for (const [key, value] of Object.entries(example.storedSecrets ?? {}))
      await runtime.secretStore.set("ai-cli-factory:teamcity-cli", "default:" + key, value);
    const cli = createTeamCityCli(runtime.runtime);
    let requests = 0;
    server.use(
      http.all(`${base}/*`, async ({ request }) => {
        requests += 1;
        const url = new URL(request.url);
        assert.equal(request.headers.get("Authorization"), "Bearer fixture-token");
        if (
          example.preflight &&
          request.method === "GET" &&
          url.pathname === `/app/rest${example.preflight}`
        ) {
          assert.equal(url.pathname, `/app/rest${example.preflight}`);
          assert.equal(
            url.searchParams.get("fields"),
            example.preflightFields ?? "name,inherited,type(rawValue)",
          );
          return HttpResponse.json(
            (example.preflightResponse ?? {
              name: "env.MODE",
              type: { rawValue: "text" },
            }) as Record<string, unknown>,
          );
        }
        assert.equal(request.method, example.method);
        assert.equal(url.pathname, `/app/rest${example.path}`);
        assert.deepEqual(Object.fromEntries(url.searchParams), example.query ?? {});
        const mediaType = example.text ? "text/plain" : "application/json";
        assert.equal(
          request.headers.get("Accept"),
          example.jsonResponse ? "application/json" : mediaType,
        );
        assert.equal(
          request.headers.get("Content-Type"),
          example.body === undefined ? null : mediaType,
        );
        if (example.body !== undefined) {
          assert.deepEqual(
            example.text ? await request.text() : await request.json(),
            example.body,
          );
        } else assert.equal(await request.text(), "");
        return example.response === null
          ? new HttpResponse(null, { status: 204 })
          : example.text && !example.jsonResponse
            ? HttpResponse.text(
                String(example.response),
                example.responseStatus ? { status: example.responseStatus } : {},
              )
            : HttpResponse.json(
                example.response,
                example.responseStatus ? { status: example.responseStatus } : {},
              );
      }),
    );
    if (example.method !== "GET") {
      await assert.rejects(
        cli.execute(example.argv),
        new RegExp(`Permission '${example.permission ?? "Update"}'`),
      );
      assert.equal(requests, 0, "denied command must not even preflight");
      await cli.execute(["permissions", "grant", example.permission ?? "Update"]);
    }
    assert.equal(await cli.run([...example.argv, "--json"]), 0, runtime.stderr());
    assert.deepEqual(JSON.parse(runtime.stdout()), example.expected);
    assert.equal(requests, example.preflight ? 2 : 1, "no retries or hidden read/merge");
  });
}

test("authoring uses gated JSON, text and empty responses through the real tree", async (testContext) => {
  const runtime = await createTestRuntime(testContext);
  const cli = createTeamCityCli(runtime.runtime);
  let requests = 0;
  server.use(
    http.post(`${base}/projects`, async ({ request }) => {
      requests += 1;
      assert.equal(request.headers.get("Authorization"), "Bearer fixture-token");
      assert.equal(request.headers.get("Content-Type"), "application/json");
      assert.deepEqual(await request.json(), {
        id: "Example",
        name: "Example",
        parentProject: { id: "_Root" },
      });
      return HttpResponse.json({ id: "Example", name: "Example", archived: false });
    }),
    http.put(`${base}/projects/id:Example/name`, async ({ request }) => {
      requests += 1;
      assert.equal(request.headers.get("Content-Type"), "text/plain");
      assert.equal(await request.text(), "Renamed");
      return HttpResponse.text("Renamed");
    }),
    http.delete(`${base}/projects/id:Example`, () => {
      requests += 1;
      return new HttpResponse(null, { status: 204 });
    }),
  );
  const create = ["projects", "create", "Example", "--name", "Example"];
  await assert.rejects(cli.execute(create), /Permission 'Update'/);
  assert.equal(requests, 0);
  await cli.execute(["permissions", "grant", "Update"]);
  assert.deepEqual(await cli.execute(create), { id: "Example", name: "Example", archived: false });
  assert.deepEqual(await cli.execute(["projects", "set", "Example", "name", "Renamed"]), {
    id: "Example",
    field: "name",
    value: "Renamed",
  });
  assert.deepEqual(await cli.execute(["projects", "delete", "Example"]), {
    id: "Example",
    deleted: true,
  });
  assert.equal(requests, 3);
});

test("all authoring leaves reject unknown options before HTTP and surface remote errors without payloads", async (testContext) => {
  assert.equal(authoringCases.length, 32);
  assert.equal(authoringCases.filter((c) => c.method !== "GET").length, 21);
  assert.equal(configurationCases.length, 18);
  assert.equal(configurationCases.filter((c) => c.method !== "GET").length, 11);
  assert.equal(advancedAuthoringCases.length, 50);
  assert.equal(operatorCases.length, 50);
  assert.equal(bulkConfigurationCases.length, 50);
  assert.equal(triageCases.length, 50);
  assert.equal(adminCases.length, 50);
  assert.equal(infrastructureCases.length, 50);
  for (const example of [
    ...authoringCases,
    ...configurationCases,
    ...advancedAuthoringCases,
    ...operatorCases,
    ...bulkConfigurationCases,
    ...triageCases,
    ...adminCases,
    ...infrastructureCases,
  ]) {
    const runtime = await createTestRuntime(testContext);
    for (const [key, value] of Object.entries(example.storedSecrets ?? {}))
      await runtime.secretStore.set("ai-cli-factory:teamcity-cli", "default:" + key, value);
    const cli = createTeamCityCli(runtime.runtime);
    await cli.execute(["permissions", "grant", example.permission ?? "Update"]);
    let requests = 0;
    server.use(
      http.all(`${base}/*`, ({ request }) => {
        requests += 1;
        if (
          example.preflight &&
          request.method === "GET" &&
          new URL(request.url).pathname === `/app/rest${example.preflight}`
        ) {
          return HttpResponse.json(
            (example.preflightResponse ?? {
              name: "env.MODE",
              type: { rawValue: "text" },
            }) as Record<string, unknown>,
          );
        }
        return HttpResponse.text("synthetic-sensitive-error-body fixture-token", { status: 403 });
      }),
    );
    await assert.rejects(cli.execute([...example.argv, "--unknown-flag"]), /unknown option/);
    assert.equal(requests, 0);
    await assert.rejects(cli.execute(example.argv), (error: unknown) => {
      assert.ok(error instanceof TeamCityHttpError);
      assert.equal(error.status, 403);
      assert.equal(error.message, "TeamCity request failed with HTTP 403.");
      assert.equal(error.cause, undefined);
      return true;
    });
    assert.equal(requests, example.preflight ? 2 : 1);
    server.resetHandlers();
  }
});

test("authoring validates fields, required options, paging, paths and plain properties before HTTP", async (testContext) => {
  const runtime = await createTestRuntime(testContext);
  const cli = createTeamCityCli(runtime.runtime);
  await cli.execute(["permissions", "grant", "Update"]);
  let requests = 0;
  server.use(
    http.all(`${base}/*`, () => {
      requests += 1;
      return HttpResponse.json({});
    }),
  );
  const invalid = [
    ["projects", "create", "Example"],
    ["projects", "create", "Example", "--name", " "],
    ["projects", "move", "Example"],
    ["projects", "delete", "_Root"],
    ["projects", "set", "Example", "parentProject", "Other"],
    ["projects", "set", "Example", "archived", "yes"],
    ["jobs", "create", "Build", "--name", "Build"],
    ["jobs", "move", "Build"],
    ["jobs", "set", "Build", "paused", "1"],
    ["jobs", "parameters", "set", "Build", "env.MODE"],
    ["projects", "parameters", "create", "Example", "env.PASSWORD", "--value", "synthetic"],
    ["projects", "parameters", "show", "Example", ".."],
    ["jobs", "steps", "show", "Build", "."],
    ["jobs", "steps", "create", "Build", "--name", "Echo"],
    [
      "jobs",
      "steps",
      "create",
      "Build",
      "--name",
      "Echo",
      "--type",
      "simpleRunner",
      "--property",
      "=empty",
    ],
    [
      "jobs",
      "steps",
      "create",
      "Build",
      "--name",
      "Echo",
      "--type",
      "simpleRunner",
      "--property",
      "key=x",
      "--property",
      "key=y",
    ],
    [
      "jobs",
      "steps",
      "create",
      "Build",
      "--name",
      "Echo",
      "--type",
      "simpleRunner",
      "--property",
      "token=synthetic",
    ],
    ["jobs", "vcs", "attach", "Build"],
    ["jobs", "vcs", "replace", "Build", "Root"],
    ["jobs", "vcs", "checkout-rules", "set", "Build", "Root"],
    ["vcs", "roots", "list", "--limit", "101"],
    ["vcs", "roots", "list", "--start", "-1"],
  ];
  for (const argv of invalid) await assert.rejects(cli.execute(argv), Error);
  assert.equal(requests, 0);
});

test("parameter reads redact passwords, hidden/unknown types and credential-shaped data", async (testContext) => {
  const properties = [
    { name: "plain", value: "debug" },
    { name: "password-type", value: "synthetic-hidden", type: { rawValue: "password" } },
    { name: "masked", value: "synthetic-hidden", type: { rawValue: "text display='hidden'" } },
    {
      name: "plugin",
      value: "synthetic-hidden",
      type: { rawValue: "future-kind label='synthetic-hidden'" },
    },
    { name: "malformed", value: "synthetic-hidden", type: {} },
    { name: "env.ACCESS_TOKEN", value: "synthetic-hidden" },
    { name: "endpoint", value: "https://fixture:synthetic-hidden@example.test" },
  ];
  server.use(
    http.get(`${base}/projects/id:Example/parameters`, () =>
      HttpResponse.json({ property: properties }),
    ),
  );
  const runtime = await createTestRuntime(testContext);
  const cli = createTeamCityCli(runtime.runtime);
  assert.equal(await cli.run(["projects", "parameters", "list", "Example", "--json"]), 0);
  const result = JSON.parse(runtime.stdout());
  assert.equal(result[0].value, "debug");
  assert.equal(
    result
      .slice(1)
      .every((p: { redacted: boolean; value?: string }) => p.redacted && p.value === undefined),
    true,
  );
  assert.equal(runtime.stdout().includes("synthetic-hidden"), false);
  runtime.resetOutput();
  assert.equal(await cli.run(["projects", "parameters", "list", "Example"]), 0);
  assert.equal(runtime.stdout().includes("synthetic-hidden"), false);
});

test("parameter writes preflight metadata, reject protected/unknown types and only tolerate create 404", async (testContext) => {
  const runtime = await createTestRuntime(testContext);
  const cli = createTeamCityCli(runtime.runtime);
  await cli.execute(["permissions", "grant", "Update"]);
  let writes = 0;
  server.use(
    http.all(`${base}/projects/id:Example/parameters*`, ({ request }) => {
      if (request.method === "GET")
        return HttpResponse.json({ name: "innocent", type: { rawValue: "password" } });
      writes += 1;
      return HttpResponse.json({ name: "innocent", value: "debug" });
    }),
  );
  for (const action of ["create", "set"]) {
    await assert.rejects(
      cli.execute(["projects", "parameters", action, "Example", "innocent", "--value", "debug"]),
      /Protected or unknown/,
    );
  }
  assert.equal(writes, 0);
  for (const metadata of [{ name: "innocent", type: { rawValue: "future-kind" } }, {}]) {
    server.use(
      http.get(`${base}/projects/id:Example/parameters/innocent`, () =>
        HttpResponse.json(metadata),
      ),
    );
    await assert.rejects(
      cli.execute(["projects", "parameters", "set", "Example", "innocent", "--value", "debug"]),
      /Protected or unknown/,
    );
  }
  assert.equal(writes, 0);
  server.use(
    http.get(
      `${base}/projects/id:Example/parameters/innocent`,
      () => new HttpResponse(null, { status: 404 }),
    ),
  );
  await cli.execute([
    "projects",
    "parameters",
    "create",
    "Example",
    "innocent",
    "--value",
    "debug",
  ]);
  assert.equal(writes, 1);
  await assert.rejects(
    cli.execute(["projects", "parameters", "set", "Example", "innocent", "--value", "debug"]),
    /HTTP 404/,
  );
  assert.equal(writes, 1);
});

test("steps replace does not read/merge, unknown properties are redacted and VCS excludes connection data", async (testContext) => {
  const runtime = await createTestRuntime(testContext);
  const cli = createTeamCityCli(runtime.runtime);
  await cli.execute(["permissions", "grant", "Update"]);
  let requests = 0;
  server.use(
    http.put(`${base}/buildTypes/id:Build/steps/Step`, async ({ request }) => {
      requests += 1;
      assert.deepEqual(await request.json(), {
        name: "Empty",
        type: "plugin",
        properties: { property: [] },
      });
      return HttpResponse.json({
        id: "Step",
        name: "Empty",
        type: "plugin",
        properties: {
          property: [{ name: "unrecognized", value: "synthetic-hidden" }],
        },
        shortDescription: "synthetic-hidden",
        extra: "synthetic-hidden",
      });
    }),
    http.get(`${base}/vcs-roots/id:Root`, () =>
      HttpResponse.json({
        id: "Root",
        name: "Root",
        properties: { password: "synthetic-hidden" },
        project: { id: "Example", name: "Example", properties: "synthetic-hidden" },
      }),
    ),
  );
  const step = await cli.execute([
    "jobs",
    "steps",
    "replace",
    "Build",
    "Step",
    "--name",
    "Empty",
    "--type",
    "plugin",
  ]);
  assert.equal(requests, 1);
  assert.equal(JSON.stringify(step).includes("synthetic-hidden"), false);
  assert.deepEqual(await cli.execute(["vcs", "roots", "show", "Root"]), {
    id: "Root",
    name: "Root",
    project: { id: "Example", name: "Example" },
  });
});

test("literal path segments and locators cannot broaden authoring targets", async (testContext) => {
  const paths: string[] = [];
  const client = new TeamCityClient({
    baseUrl: "https://teamcity.test",
    token: "fixture-token",
    fetch: async (input) => {
      paths.push(new URL(String(input)).pathname);
      return HttpResponse.json({ name: "mode/with?query#fragment", value: "debug" });
    },
  });
  await client.getParameter("projects", "Example,count:100", "mode/with?query#fragment");
  assert.equal(
    paths[0],
    "/app/rest/projects/id:($base64:RXhhbXBsZSxjb3VudDoxMDA)/parameters/mode%2Fwith%3Fquery%23fragment",
  );
  await assert.rejects(client.deleteStep("Build", ".."), /Dot path/);
  assert.equal(paths.length, 1);
});

test("JSON-RPC survives nested help and errors and isolates new Update commands by profile", async (testContext) => {
  const commands = [
    ["jobs", "steps", "replace", "--help"],
    ["projects", "create", "Example", "--profile", "uat"],
    ["projects", "create", "Example", "--name", "Example"],
    ["projects", "create", "Example", "--name", "Example", "--profile", "uat"],
    ["vcs", "roots", "show", "Root"],
  ];
  const runtime = await createTestRuntime(testContext, {
    profiles: [
      { name: "default", url: "https://teamcity.test" },
      { name: "uat", url: "https://uat.test", permissions: ["ReadOnly", "Update"] },
    ],
    tokens: { default: "fixture-token", uat: "fixture-uat-token" },
    input:
      commands
        .map((argv, i) =>
          JSON.stringify({ jsonrpc: "2.0", id: i + 1, method: "cli.execute", params: { argv } }),
        )
        .join("\n") + "\n",
  });
  const seen: string[] = [];
  server.use(
    http.post("https://uat.test/app/rest/projects", ({ request }) => {
      assert.equal(request.headers.get("Authorization"), "Bearer fixture-uat-token");
      seen.push("uat-write");
      return HttpResponse.json({ id: "Example", name: "Example", archived: false });
    }),
    http.get(`${base}/vcs-roots/id:Root`, ({ request }) => {
      assert.equal(request.headers.get("Authorization"), "Bearer fixture-token");
      seen.push("default-read");
      return HttpResponse.json({ id: "Root", name: "Root" });
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
  assert.match(frames[1].error.message, /required option.*--name/);
  assert.match(frames[2].error.message, /Permission 'Update'/);
  assert.equal(frames[3].result.id, "Example");
  assert.equal(frames[4].result.id, "Root");
  assert.deepEqual(seen, ["uat-write", "default-read"]);
  assert.equal(runtime.stderr(), "");
});

test("empty scoped lists, missing deletes and malformed JSON have explicit safe behavior", async (testContext) => {
  const runtime = await createTestRuntime(testContext);
  const cli = createTeamCityCli(runtime.runtime);
  await cli.execute(["permissions", "grant", "Update"]);
  server.use(
    http.all(`${base}/*`, ({ request }) =>
      request.method === "DELETE"
        ? HttpResponse.text("synthetic-hidden", { status: 404 })
        : HttpResponse.json({}),
    ),
  );
  for (const argv of [
    ["projects", "parameters", "list", "Example"],
    ["jobs", "parameters", "list", "Build"],
    ["jobs", "steps", "list", "Build"],
    ["jobs", "vcs", "list", "Build"],
    ["vcs", "roots", "list"],
  ])
    assert.deepEqual(await cli.execute(argv), []);
  for (const example of authoringCases.filter((c) => c.method === "DELETE")) {
    await assert.rejects(cli.execute(example.argv), /HTTP 404/);
  }
  server.use(
    http.get(`${base}/vcs-roots/id:Root`, () => HttpResponse.text('{"synthetic-hidden": broken')),
  );
  await assert.rejects(cli.execute(["vcs", "roots", "show", "Root"]), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.equal(error.message, "TeamCity response was not valid JSON.");
    assert.equal(error.cause, undefined);
    return true;
  });
});

test("offline workflow authors a project/job, launches it and cleans up explicitly", async (testContext) => {
  const runtime = await createTestRuntime(testContext);
  const cli = createTeamCityCli(runtime.runtime);
  await cli.execute(["permissions", "grant", "Update"]);
  let project: Record<string, unknown> | undefined;
  let job: Record<string, unknown> | undefined;
  let parameter: Record<string, unknown> | undefined;
  let step: Record<string, unknown> | undefined;
  let attachment: Record<string, unknown> | undefined;
  let launched = false;
  const requests: string[] = [];
  server.use(
    http.all(`${base}/*`, async ({ request }) => {
      const path = new URL(request.url).pathname.replace("/app/rest", "");
      const key = `${request.method} ${path}`;
      requests.push(key);
      switch (key) {
        case "POST /projects":
          assert.equal(project, undefined);
          project = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json(project);
        case "POST /buildTypes":
          assert.ok(project);
          job = (await request.json()) as Record<string, unknown>;
          assert.deepEqual(job.project, { id: project.id });
          return HttpResponse.json(job);
        case "GET /buildTypes/id:Example_Build/parameters/env.MODE":
          assert.ok(job);
          return new HttpResponse(null, { status: 404 });
        case "POST /buildTypes/id:Example_Build/parameters":
          assert.ok(job);
          parameter = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json(parameter);
        case "POST /buildTypes/id:Example_Build/steps":
          assert.ok(parameter);
          step = { ...((await request.json()) as object), id: "RUNNER_1" };
          return HttpResponse.json(step);
        case "POST /buildTypes/id:Example_Build/vcs-root-entries":
          assert.ok(step);
          attachment = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json(attachment);
        case "GET /buildTypes/id:Example_Build":
          assert.ok(attachment);
          return HttpResponse.json(job);
        case "POST /buildQueue":
          assert.ok(step);
          assert.ok(attachment);
          assert.deepEqual(await request.json(), { buildType: { id: job!.id } });
          launched = true;
          return HttpResponse.json({ id: 42, state: "queued" });
        case "GET /builds":
          assert.ok(launched);
          return HttpResponse.json({ build: [{ id: 42, state: "finished", status: "SUCCESS" }] });
        case "DELETE /buildTypes/id:Example_Build/vcs-root-entries/id:Example_Git":
          assert.ok(attachment);
          attachment = undefined;
          break;
        case "DELETE /buildTypes/id:Example_Build/steps/RUNNER_1":
          assert.ok(step);
          step = undefined;
          break;
        case "DELETE /buildTypes/id:Example_Build/parameters/env.MODE":
          assert.ok(parameter);
          parameter = undefined;
          break;
        case "DELETE /buildTypes/id:Example_Build":
          assert.equal(attachment, undefined);
          assert.equal(step, undefined);
          assert.equal(parameter, undefined);
          job = undefined;
          break;
        case "DELETE /projects/id:Example":
          assert.equal(job, undefined);
          project = undefined;
          break;
        default:
          assert.fail(`Unexpected workflow request: ${key}`);
      }
      return new HttpResponse(null, { status: 204 });
    }),
  );
  for (const argv of [
    ["projects", "create", "Example", "--name", "Example"],
    ["jobs", "create", "Example_Build", "--name", "Build", "--project", "Example"],
    ["jobs", "parameters", "create", "Example_Build", "env.MODE", "--value", "debug"],
    [
      "jobs",
      "steps",
      "create",
      "Example_Build",
      "--name",
      "Echo",
      "--type",
      "simpleRunner",
      "--property",
      "script.content=echo hello",
      "--property",
      "use.custom.script=true",
    ],
    ["jobs", "vcs", "attach", "Example_Build", "--root", "Example_Git"],
    ["jobs", "show", "Example_Build"],
    ["jobs", "run", "Example_Build"],
  ])
    await cli.execute(argv);
  assert.deepEqual(await cli.execute(["jobs", "status", "Example_Build"]), {
    jobId: "Example_Build",
    latestBuild: { id: 42, state: "finished", status: "SUCCESS" },
  });
  for (const argv of [
    ["jobs", "vcs", "detach", "Example_Build", "Example_Git"],
    ["jobs", "steps", "delete", "Example_Build", "RUNNER_1"],
    ["jobs", "parameters", "delete", "Example_Build", "env.MODE"],
    ["jobs", "delete", "Example_Build"],
    ["projects", "delete", "Example"],
  ])
    await cli.execute(argv);
  assert.equal(project, undefined);
  assert.equal(job, undefined);
  assert.equal(requests.length, 14);
});
