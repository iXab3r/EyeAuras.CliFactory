import assert from "node:assert/strict";
import test from "node:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createTeamCityCli } from "../src/cli.js";
import { TeamCityClient } from "../src/client.js";
import { createTestRuntime } from "./support.js";
import { triageCases } from "./triage-cases.js";

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
const item = (value: unknown) => ["--item", JSON.stringify(value)];
const investigation = {
  target: { kind: "test", projectId: "Example", testId: "9223372036854775807" },
  state: "TAKEN",
  assignee: 3,
  resolution: "whenFixed",
};

test("S6 all 50 gates deny before any HTTP", async (testContext) => {
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
  for (const example of triageCases)
    await assert.rejects(
      cli.execute(example.argv),
      new RegExp(`Permission '${example.method === "GET" ? "ReadOnly" : "Update"}'`),
    );
  assert.equal(calls, 0);
});

test("S6 validates bounded identities, controls, typed bodies and timestamps before HTTP", async (testContext) => {
  const { cli } = await writable(testContext);
  let calls = 0;
  server.use(
    http.all("*", () => {
      calls++;
      return HttpResponse.json({});
    }),
  );
  const invalid = [
    ["builds", "batch", "delete"],
    ["builds", "batch", "delete", "--build", "42", "--build", "42"],
    ["builds", "batch", "delete", "--build", "9007199254740993"],
    [
      "builds",
      "batch",
      "delete",
      ...Array.from({ length: 101 }, (_, i) => ["--build", String(i + 1)]).flat(),
    ],
    ["builds", "batch", "pin", "--build", "42", "--status", "yes"],
    ["builds", "log", "append", "42", "--text", "##teamcity[buildStatus status='FAILURE']"],
    ["builds", "finish-at", "42", "20260230T100000+0000"],
    ["builds", "finish-at", "42", "20260830T250000+0000"],
    ["builds", "set-status", "42", "UNKNOWN", "--comment", "Synthetic"],
    ["builds", "vcs-labels", "add", "42", "--label", "example"],
    ["changes", "field", "7", "username"],
    ["investigations", "create", "--item", "{synthetic-invalid"],
    ["investigations", "create", ...item({ ...investigation, password: "synthetic-invalid" })],
    ["investigations", "replace", ...item({ ...investigation, assignee: 0 })],
    ["investigations", "create", ...item({ ...investigation, resolution: "atTime" })],
    ["investigations", "show", "--target", '{"kind":"job","jobId":"Build","projectId":"Example"}'],
    ["investigations", "create-many", ...item(investigation), ...item(investigation)],
    ["mutes", "create", ...item({ project: "Example", tests: [], resolution: "manually" })],
    [
      "mutes",
      "create",
      ...item({ project: "Example", jobs: ["Build"], tests: ["1"], resolution: "manually" }),
    ],
    [
      "mutes",
      "create",
      ...item({ project: "Example", tests: ["1"], problems: ["2"], resolution: "manually" }),
    ],
    ["mutes", "create", ...item({ project: "Example", tests: ["1", "1"], resolution: "manually" })],
    ["mutes", "create", ...item({ project: "Example", tests: ["1"], resolution: "atTime" })],
    [
      "mutes",
      "create",
      ...item({
        project: "Example",
        tests: ["1"],
        resolution: "whenFixed",
        time: "20260830T100000+0000",
      }),
    ],
    ["mutes", "delete", "0"],
    ["tests", "list", "--limit", "101"],
    ["tests", "occurrence", "1", "--build", "0"],
    ["builds", "output-parameters", "exists", "42", ".."],
  ];
  for (const argv of invalid) await assert.rejects(cli.execute(argv), Error);
  assert.equal(calls, 0);
});

test("S6 partial and malformed bulk/status results never become unconditional success", async (testContext) => {
  const { cli } = await writable(testContext);
  for (const result of [
    { count: 2, errorCount: 0, operationResult: [] },
    {
      count: 2,
      errorCount: 2,
      operationResult: [
        {
          message: "synthetic-private",
          related: { build: { id: 42, token: "synthetic-private" } },
        },
      ],
    },
  ]) {
    server.use(http.delete(base + "/builds/multiple/*", () => HttpResponse.json(result)));
    assert.deepEqual(
      await cli.execute(["builds", "batch", "delete", "--build", "42", "--build", "43"]),
      {
        count: 2,
        errorCount: result.errorCount,
        partialFailure: result.errorCount > 0,
        buildIds: result.operationResult.length ? [42] : [],
      },
    );
  }
  for (const result of [
    {},
    { count: 1 },
    { count: 1, errorCount: 2 },
    { count: 1, errorCount: "0" },
  ]) {
    server.use(http.delete(base + "/builds/multiple/*", () => HttpResponse.json(result)));
    await assert.rejects(
      cli.execute(["builds", "batch", "delete", "--build", "42"]),
      /success is unknown/,
    );
  }
  server.use(http.post(base + "/builds/id:42/status", () => HttpResponse.json({})));
  await assert.rejects(
    cli.execute(["builds", "set-status", "42", "SUCCESS", "--comment", "Synthetic"]),
    /success is unknown/,
  );
});

test("S6 typed investigation replacement uses one exact target and no hidden reads or retries", async (testContext) => {
  const { cli } = await writable(testContext);
  const bodies: unknown[] = [];
  server.use(
    http.put(base + "/investigations/*", async ({ request }) => {
      const url = new URL(request.url);
      assert.equal(
        url.pathname,
        "/app/rest/investigations/assignmentProject:(id:Example),test:(id:9223372036854775807)",
      );
      bodies.push(await request.json());
      return HttpResponse.json({
        id: "synthetic",
        assignee: { id: 3, email: "synthetic@example.test" },
        target: { tests: { test: [{ id: "9223372036854775807", password: "synthetic-private" }] } },
      });
    }),
  );
  const result = await cli.execute(["investigations", "replace", ...item(investigation)]);
  assert.deepEqual(result, {
    id: "synthetic",
    assignee: { id: 3 },
    target: { tests: { test: [{ id: "9223372036854775807" }] } },
  });
  assert.deepEqual(bodies, [
    {
      state: "TAKEN",
      assignee: { id: 3 },
      scope: { project: { id: "Example" } },
      target: { tests: { test: [{ id: "9223372036854775807" }] } },
      resolution: { type: "whenFixed" },
    },
  ]);
  let failures = 0;
  server.use(
    http.put(base + "/investigations/*", () => {
      failures++;
      return HttpResponse.text("synthetic-private", { status: 400 });
    }),
  );
  await assert.rejects(cli.execute(["investigations", "replace", ...item(investigation)]), {
    message: "TeamCity request failed with HTTP 400.",
  });
  assert.equal(failures, 1);
});

test("S6 mute stateful create/read/delete uses explicit scope, atTime and text deletion", async (testContext) => {
  const { cli } = await writable(testContext);
  let saved: Record<string, unknown> | undefined;
  const calls: string[] = [];
  server.use(
    http.all(base + "/mutes*", async ({ request }) => {
      calls.push(request.method);
      if (request.method === "POST") {
        saved = { id: 9, ...((await request.json()) as object) };
        return HttpResponse.json(saved);
      }
      if (request.method === "DELETE") {
        assert.equal(await request.text(), "Resolved");
        saved = undefined;
        return new HttpResponse(null, { status: 204 });
      }
      return HttpResponse.json(saved ?? {});
    }),
  );
  const input = {
    jobs: ["Build"],
    problems: ["problem-1"],
    resolution: "atTime",
    time: "20260830T100000+0000",
  };
  await cli.execute(["mutes", "create", ...item(input)]);
  assert.deepEqual(await cli.execute(["mutes", "show", "9"]), {
    id: 9,
    scope: { buildTypes: { buildType: [{ id: "Build" }] } },
    target: { problems: { problem: [{ id: "problem-1" }] } },
    resolution: { type: "atTime", time: input.time },
  });
  await cli.execute(["mutes", "delete", "9", "--comment", "Resolved"]);
  assert.equal(saved, undefined);
  assert.deepEqual(calls, ["POST", "GET", "DELETE"]);
});

test("S6 metadata probes discard private bytes and bound reading even on an unending body", async (testContext) => {
  let pulled = 0;
  let canceled = false;
  const client = new TeamCityClient({
    baseUrl: "https://teamcity.test",
    token: "fixture-token",
    fetch: async () =>
      new Response(
        new ReadableStream<Uint8Array>({
          pull(controller) {
            pulled++;
            controller.enqueue(new Uint8Array(16384).fill(65));
          },
          cancel() {
            canceled = true;
          },
        }),
      ),
  });
  assert.deepEqual(await client.checkBuildRuntimeParameter(42, "output-parameters", "env.MODE"), {
    name: "env.MODE",
    exists: true,
  });
  assert.ok(pulled <= 5);
  assert.equal(canceled, true);
  const runtime = await createTestRuntime(testContext);
  const cli = createTeamCityCli(runtime.runtime);
  server.use(
    http.get(base + "/builds/id:42/resulting-properties/env.MODE", () =>
      HttpResponse.text("synthetic-private-value"),
    ),
  );
  assert.equal(
    await cli.run(["builds", "resulting-properties", "exists", "42", "env.MODE", "--json"]),
    0,
  );
  assert.ok(!runtime.stdout().includes("synthetic-private"));
  assert.equal(runtime.stderr(), "");
  server.use(
    http.get(base + "/builds/id:42/resulting-properties/env.MODE", () =>
      HttpResponse.text("synthetic-private", { status: 404 }),
    ),
  );
  await assert.rejects(
    cli.execute(["builds", "resulting-properties", "exists", "42", "env.MODE"]),
    { message: "TeamCity request failed with HTTP 404." },
  );
});

test("S6 unknown nested data and malformed entities never leak payload excerpts", async (testContext) => {
  const { cli } = await writable(testContext);
  server.use(
    http.get(base + "/testOccurrences/*", () =>
      HttpResponse.json({
        id: "opaque",
        test: { id: "9223372036854775807", token: "synthetic-private" },
        build: { id: 42, password: "synthetic-private" },
        details: "synthetic-private",
      }),
    ),
  );
  assert.deepEqual(
    await cli.execute(["tests", "occurrence", "9223372036854775807", "--build", "42"]),
    { id: "opaque", test: { id: "9223372036854775807" }, build: { id: 42 } },
  );
  server.use(http.get(base + "/tests/id:1", () => HttpResponse.json({ id: 9007199254740992 })));
  await assert.rejects(cli.execute(["tests", "show", "1"]), /Invalid scalar response/);
  server.use(http.get(base + "/tests/id:1", () => HttpResponse.text("{synthetic-private")));
  await assert.rejects(cli.execute(["tests", "show", "1"]), {
    message: "TeamCity response was not valid JSON.",
  });
});

test("S6 persistent RPC keeps profile auth/gates and generated help isolated", async (testContext) => {
  const commands = [
    ["investigations", "replace", "--help"],
    ["builds", "batch", "delete", "--build", "42"],
    ["builds", "batch", "delete", "--build", "42", "--profile", "uat"],
    ["tests", "show", "9223372036854775807"],
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
    http.delete("https://uat.test/app/rest/builds/multiple/*", ({ request }) => {
      assert.equal(request.headers.get("Authorization"), "Bearer fixture-uat-token");
      calls.push("uat");
      return HttpResponse.json({ count: 1, errorCount: 0 });
    }),
    http.get(base + "/tests/*", ({ request }) => {
      assert.equal(request.headers.get("Authorization"), "Bearer fixture-token");
      calls.push("default");
      return HttpResponse.json({ id: "9223372036854775807" });
    }),
  );
  assert.equal(await createTeamCityCli(runtime.runtime).run(["--json-rpc"]), 0);
  const frames = runtime
    .stdout()
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  assert.match(frames[0].result.help, /not atomic/);
  assert.match(frames[1].error.message, /Permission 'Update'/);
  assert.equal(frames[2].result.errorCount, 0);
  assert.equal(frames[3].result.id, "9223372036854775807");
  assert.deepEqual(calls, ["uat", "default"]);
});
