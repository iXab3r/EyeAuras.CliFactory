import assert from "node:assert/strict";
import { assertHttpRequest, trackRequests, assertPermissionDenied, assertCliOutput, assertSafeCliFailure } from "@eyeauras/cli-factory/testing";
import test from "node:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createTestRuntime } from "./support.js";
import { operatorCases } from "./operator-cases.js";

const base = "https://teamcity.test/app/rest";
const server = setupServer();
test.before(() => server.listen({ onUnhandledRequest: "error" }));
test.afterEach(() => server.resetHandlers());
test.after(() => server.close());
async function writable(testContext: test.TestContext) {
  const runtime = await createTestRuntime(testContext);
  const cli = runtime.createCli();
  await cli.execute(["permissions", "grant", "Update"]);
  return { cli, runtime };
}

test("all 50 S4 leaves deny before HTTP without their declared profile permission", async (testContext) => {
  const runtime = await createTestRuntime(testContext, {
    profiles: [{ name: "default", url: "https://teamcity.test", permissions: [] }],
  });
  const cli = runtime.createCli();
  let calls = 0;
  server.use(
    http.all("*", () => {
      calls++;
      return HttpResponse.json({});
    }),
  );
  for (const example of operatorCases) {
    await assert.rejects(
      cli.execute(example.argv),
      new RegExp(`Permission '${example.method === "GET" ? "ReadOnly" : "Update"}'`),
    );
  }
  assert.equal(calls, 0);
});

test("S4 validates IDs, required options, fields, booleans, policy, tags and credential-shaped inputs locally", async (testContext) => {
  const { cli } = await writable(testContext);
  let calls = 0;
  server.use(
    http.all("*", () => {
      calls++;
      return HttpResponse.json({});
    }),
  );
  const invalid = [
    ["pools", "create"],
    ["pools", "create", "--name", " "],
    ["pools", "delete", "0"],
    ["pools", "show", "-1"],
    ["pools", "show", "1.5"],
    ["pools", "show", "NaN"],
    ["pools", "show", "9007199254740992"],
    ["pools", "agents", "assign", "1", "0"],
    ["pools", "list", "--limit", "101"],
    ["pools", "agents", "list", "1", "--start", "-1"],
    ["pools", "projects", "assign", "1", " "],
    ["pools", "fields", "set", "1", "maxAgents", "10"],
    ["agents", "delete", "0"],
    ["agents", "fields", "show", "7", "authToken"],
    ["agents", "fields", "set", "7", "name", "Renamed"],
    ["agents", "fields", "set", "7", "enabled", "yes"],
    ["agents", "enabled", "set", "7", "TRUE"],
    ["agents", "authorized", "set", "7", "0"],
    ["agents", "policy", "set", "7", "all"],
    ["agents", "policy", "set", "7", "any", "--job", "Build"],
    ["agents", "policy", "set", "7", "selected", "--job", "Build", "--job", "Build"],
    ["agents", "pool", "set", "7", "-1"],
    ["queue", "position", "show", "0"],
    ["queue", "position", "show", "1/2"],
    ["queue", "position", "set", "2", "--build", "42"],
    ["queue", "position", "set", "last"],
    ["builds", "delete", "-1"],
    ["builds", "fields", "show", "42", "status"],
    ["builds", "fields", "show", "42", "properties"],
    ["builds", "pin", "set", "42", "yes"],
    ["builds", "number", "set", "42", " "],
    ["builds", "comment", "set", "42"],
    ["builds", "statistics", "show", "42", ".."],
    ["changes", "show", "0"],
    ["changes", "parents", "1.5"],
  ];
  for (const owner of ["builds", "queue"]) {
    invalid.push([owner, "tags", "add", "42"]);
    invalid.push([owner, "tags", "add", "42", "--tag", " "]);
    invalid.push([owner, "tags", "add", "42", "--tag", "release", "--tag", "release"]);
    invalid.push([owner, "tags", "add", "42", "--tag", "Bearer synthetic-token"]);
  }
  for (const argv of [
    ["agents", "enabled", "set", "7", "true", "--comment"],
    ["builds", "pin", "set", "42", "true", "--comment"],
    ["builds", "comment", "set", "42", "--text"],
    ["builds", "status-text", "set", "42"],
  ])
    invalid.push([...argv, "Bearer synthetic-token"]);
  for (const argv of invalid) await assert.rejects(cli.execute(argv), Error, argv.join(" "));
  assert.equal(calls, 0);
});

test("S4 preserves false, empty selected policy, empty tag replacement and pool zero without hidden calls", async (testContext) => {
  const { cli } = await writable(testContext);
  const bodies: unknown[] = [];
  server.use(
    http.put(`${base}/*`, async ({ request }) => {
      const body = await request.json();
      bodies.push(body);
      return HttpResponse.json(body);
    }),
  );
  for (const [owner, group, id] of [
    ["agents", "enabled", "7"],
    ["agents", "authorized", "7"],
    ["builds", "pin", "42"],
  ]) {
    assert.deepEqual(await cli.execute([owner!, group!, "set", id!, "false"]), { status: false });
  }
  assert.deepEqual(await cli.execute(["agents", "policy", "set", "7", "selected"]), {
    policy: "selected",
    jobs: [],
  });
  assert.deepEqual(await cli.execute(["agents", "policy", "set", "7", "any"]), {
    policy: "any",
    jobs: [],
  });
  assert.deepEqual(await cli.execute(["builds", "tags", "replace", "42"]), []);
  assert.deepEqual(await cli.execute(["agents", "pool", "set", "7", "0"]), { id: 0 });
  assert.deepEqual(bodies, [
    { status: false },
    { status: false },
    { status: false },
    { policy: "selected", buildTypes: { buildType: [] } },
    { policy: "any", buildTypes: { buildType: [] } },
    { tag: [] },
    { id: 0 },
  ]);
  server.use(
    http.put(`${base}/buildQueue/order/:position`, async ({ request, params }) => {
      assert.deepEqual(await request.json(), { id: 42 });
      assert.ok(["1", "first", "last"].includes(String(params.position)));
      return HttpResponse.json({ id: 42 });
    }),
  );
  for (const position of ["1", "first", "last"])
    assert.deepEqual(await cli.execute(["queue", "position", "set", position, "--build", "42"]), {
      id: 42,
    });
});

test("S4 projects every JSON result instead of leaking extra nested credentials or server data", async (testContext) => {
  const { cli } = await writable(testContext);
  function withPrivateExtras(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(withPrivateExtras);
    if (value !== null && typeof value === "object")
      return {
        ...Object.fromEntries(
          Object.entries(value).map(([key, item]) => [key, withPrivateExtras(item)]),
        ),
        authToken: "synthetic-hidden",
        raw: { password: "synthetic-hidden" },
      };
    return value;
  }
  for (const example of operatorCases.filter((e) => !e.text && e.response !== null)) {
    server.use(
      http.all(`${base}/*`, () =>
        HttpResponse.json(withPrivateExtras(example.response) as Record<string, unknown>),
      ),
    );
    assert.deepEqual(await cli.execute(example.argv), example.expected, example.argv.join(" "));
    server.resetHandlers();
  }
});

test("S4 handles empty collections, optional JSON/204, malformed JSON and safe delete errors", async (testContext) => {
  const { cli } = await writable(testContext);
  server.use(http.get(`${base}/*`, () => HttpResponse.json({})));
  const lists = operatorCases.filter((e) => e.method === "GET" && Array.isArray(e.expected));
  for (const example of lists) assert.deepEqual(await cli.execute(example.argv), []);
  for (const response of [
    () => new HttpResponse(null, { status: 204 }),
    () => HttpResponse.json(null),
  ]) {
    server.use(http.get(`${base}/*`, response));
    for (const argv of [
      ["agents", "pool", "show", "7"],
      ["builds", "canceled-info", "42"],
    ]) {
      assert.equal(await cli.execute(argv), null);
    }
  }
  server.use(http.get(`${base}/*`, () => new HttpResponse(null, { status: 204 })));
  await assert.rejects(cli.execute(["queue", "show", "42"]), /not valid JSON/);
  server.use(http.all(`${base}/*`, () => HttpResponse.text('{"synthetic-hidden": broken')));
  for (const example of operatorCases.filter((e) => !e.text && e.response !== null)) {
    await assert.rejects(cli.execute(example.argv), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, "TeamCity response was not valid JSON.");
      assert.equal(error.cause, undefined);
      return true;
    });
  }
  server.use(
    http.delete(`${base}/*`, () => HttpResponse.text("synthetic-hidden", { status: 404 })),
  );
  for (const example of operatorCases.filter((e) => e.method === "DELETE"))
    await assert.rejects(cli.execute(example.argv), /HTTP 404/);
});

test("S4 acknowledgement commands discard successful response bodies instead of exposing them", async (testContext) => {
  const { cli } = await writable(testContext);
  // Tag POST can return Tags; the CLI contract deliberately returns a local acknowledgement.
  server.use(http.all(`${base}/*`, () => HttpResponse.json({ authToken: "synthetic-hidden" })));
  for (const example of operatorCases.filter((e) => e.response === null)) {
    assert.deepEqual(await cli.execute(example.argv), example.expected);
  }
});

test("S4 statistics preserve numeric precision and refuse nonnumeric payloads without echoing them", async (testContext) => {
  const { cli } = await writable(testContext);
  for (const value of ["900719925474099312345", "-1.25e+12", ".5", "0"]) {
    server.use(
      http.get(`${base}/builds/id:42/statistics/Duration`, () => HttpResponse.text(value)),
    );
    assert.deepEqual(await cli.execute(["builds", "statistics", "show", "42", "Duration"]), {
      name: "Duration",
      value,
    });
  }
  for (const value of ["synthetic-hidden", "NaN", "Infinity", ""]) {
    server.use(
      http.get(`${base}/builds/id:42/statistics*`, ({ request }) =>
        new URL(request.url).pathname.endsWith("/Duration")
          ? HttpResponse.text(value)
          : HttpResponse.json({ property: [{ name: "Duration", value }] }),
      ),
    );
    for (const argv of [
      ["builds", "statistics", "show", "42", "Duration"],
      ["builds", "statistics", "list", "42"],
    ]) {
      await assert.rejects(cli.execute(argv), {
        message: "TeamCity statistic was not numeric text.",
      });
    }
  }
});

test("S4 JSON-RPC isolates profiles, credentials and permission failures and continues the session", async (testContext) => {
  const commands = [
    ["agents", "policy", "set", "--help"],
    ["agents", "fields", "show", "7", "authToken"],
    ["builds", "pin", "set", "42", "true"],
    ["builds", "pin", "set", "42", "false", "--profile", "uat"],
    ["agents", "pool", "show", "7"],
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
  const requests = trackRequests(testContext, 2, async (request, index) => {
    if (index === 0) {
      await assertHttpRequest(request, {
        method: "PUT", url: "https://uat.test/app/rest/builds/id:42/pinInfo",
        query: { fields: "status,comment(text,timestamp)" },
        headers: { authorization: "Bearer fixture-uat-token" }, body: { json: { status: false } },
      });
      calls.push("uat");
      return HttpResponse.json({ status: false });
    }
    await assertHttpRequest(request, {
      method: "GET", url: base + "/agents/id:7/pool", query: { fields: "id,name" },
      headers: { authorization: "Bearer fixture-token" },
    });
    calls.push("default");
    return HttpResponse.json({ id: 0 });
  });
  server.use(http.all("*", ({ request }) => requests.handle(request)));
  assert.equal(await runtime.createCli().run(["--json-rpc"]), 0);
  const frames = runtime
    .stdout()
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  assert.equal(frames.length, 5);
  assert.match(frames[0].result.help, /empty selected/);
  assert.ok(frames[1].error);
  assert.match(frames[2].error.message, /Permission 'Update'/);
  assert.deepEqual(frames[3].result, { status: false });
  assert.deepEqual(frames[4].result, { id: 0 });
  assert.deepEqual(calls, ["uat", "default"]);
  assert.equal(runtime.stderr(), "");
});

test("S4 stateful operator workflow mutates and cleans up only explicitly named mocked resources", async (testContext) => {
  const { cli } = await writable(testContext);
  let pool: { id: number; name: string } | undefined;
  let project: string | undefined;
  let agentPool = 0;
  let comment: string | undefined;
  let pinned = false;
  const queue = [43, 42];
  let tags: string[] = [];
  const calls: string[] = [];
  server.use(
    http.all(`${base}/*`, async ({ request }) => {
      const path = new URL(request.url).pathname.replace("/app/rest", "");
      const call = `${request.method} ${path}`;
      calls.push(call);
      switch (call) {
        case "POST /agentPools":
          pool = { id: 1, ...((await request.json()) as { name: string }) };
          return HttpResponse.json(pool);
        case "POST /agentPools/id:1/agents":
          assert.ok(pool);
          assert.deepEqual(await request.json(), { id: 7 });
          agentPool = 1;
          return HttpResponse.json({ id: 7 });
        case "POST /agentPools/id:1/projects":
          assert.ok(pool);
          project = ((await request.json()) as { id: string }).id;
          return HttpResponse.json({ id: project });
        case "PUT /agents/id:7/compatibilityPolicy":
          assert.equal(agentPool, 1);
          return HttpResponse.json(await request.json());
        case "PUT /agents/id:7/enabledInfo":
          assert.equal(agentPool, 1);
          return HttpResponse.json(await request.json());
        case "PUT /buildQueue/order/first":
          assert.deepEqual(await request.json(), { id: 42 });
          queue.reverse();
          return HttpResponse.json({ id: queue[0] });
        case "POST /buildQueue/id:42/tags":
          assert.equal(queue[0], 42);
          tags.push(
            ...((await request.json()) as { tag: { name: string }[] }).tag.map((t) => t.name),
          );
          return new HttpResponse(null, { status: 204 });
        case "PUT /builds/id:42/comment":
          comment = await request.text();
          return new HttpResponse(null, { status: 204 });
        case "PUT /builds/id:42/pinInfo":
          pinned = ((await request.json()) as { status: boolean }).status;
          return HttpResponse.json({ status: pinned });
        case "PUT /builds/id:42/tags":
          tags = ((await request.json()) as { tag: { name: string }[] }).tag.map((t) => t.name);
          return HttpResponse.json({ tag: tags.map((name) => ({ name })) });
        case "DELETE /builds/id:42/comment":
          assert.equal(comment, "Reviewed");
          comment = undefined;
          return new HttpResponse(null, { status: 204 });
        case "DELETE /agentPools/id:1/projects/id:Example":
          assert.equal(project, "Example");
          project = undefined;
          return new HttpResponse(null, { status: 204 });
        case "PUT /agents/id:7/pool":
          assert.deepEqual(await request.json(), { id: 0 });
          agentPool = 0;
          return HttpResponse.json({ id: 0 });
        case "DELETE /agentPools/id:1":
          assert.equal(agentPool, 0);
          assert.equal(project, undefined);
          pool = undefined;
          return new HttpResponse(null, { status: 204 });
        default:
          assert.fail(`Unexpected workflow call: ${call}`);
      }
    }),
  );
  const commands = [
    ["pools", "create", "--name", "Pool"],
    ["pools", "agents", "assign", "1", "7"],
    ["pools", "projects", "assign", "1", "Example"],
    ["agents", "policy", "set", "7", "selected", "--job", "Example_Build"],
    ["agents", "enabled", "set", "7", "true"],
    ["queue", "position", "set", "first", "--build", "42"],
    ["queue", "tags", "add", "42", "--tag", "release"],
    ["builds", "comment", "set", "42", "--text", "Reviewed"],
    ["builds", "pin", "set", "42", "true"],
    ["builds", "tags", "replace", "42"],
    ["builds", "comment", "clear", "42"],
    ["builds", "pin", "set", "42", "false"],
    ["pools", "projects", "unassign", "1", "Example"],
    ["agents", "pool", "set", "7", "0"],
    ["pools", "delete", "1"],
  ];
  for (const argv of commands) await cli.execute(argv);
  assert.equal(calls.length, commands.length);
  assert.deepEqual(
    { pool, project, agentPool, comment, pinned, tags, queue },
    {
      pool: undefined,
      project: undefined,
      agentPool: 0,
      comment: undefined,
      pinned: false,
      tags: [],
      queue: [42, 43],
    },
  );
});

test("S4 help for every operation and version require no profile configuration, keyring or HTTP", async (testContext) => {
  const runtime = await createTestRuntime(testContext, {
    profiles: [{ name: "default", permissions: [] }],
    tokens: {},
  });
  const cli = runtime.createCli();
  let calls = 0;
  server.use(
    http.all("*", () => {
      calls++;
      return HttpResponse.json({});
    }),
  );
  for (const example of operatorCases) {
    const result = (await cli.execute([...example.argv, "--help"])) as { help: string };
    assert.match(result.help, /Usage:/);
  }
  assert.equal(await cli.run(["--version"]), 0);
  assert.match(runtime.stdout().trim(), /^\d+\.\d+\.\d+$/);
  assert.equal(calls, 0);
  assert.equal(runtime.stderr(), "");
});
test("operator list/detail/create contracts have one request in each human and JSON mode", async t => {
  const pool = { id: 1, name: "Pool" };
  const samples: Array<{
    argv: string[]; permission: string; method: string; path: string; query: Record<string, string>;
    response: unknown; expected: unknown; body?: unknown;
  }> = [
    { argv: ["pools", "list"], permission: "ReadOnly", method: "GET", path: "/agentPools",
      query: { locator: "start:0,count:100", fields: "agentPool(id,name)" }, response: { agentPool: [pool] }, expected: [pool] },
    { argv: ["pools", "show", "1"], permission: "ReadOnly", method: "GET", path: "/agentPools/id:1",
      query: { fields: "id,name" }, response: pool, expected: pool },
    { argv: ["pools", "create", "--name", "Pool"], permission: "Update", method: "POST", path: "/agentPools",
      query: {}, response: pool, expected: pool, body: { name: "Pool" } },
  ];
  for (const sample of samples) {
    const f = await createTestRuntime(t);
    const cli = f.createCli();
    const requests = trackRequests(t, 2, async request => {
      await assertHttpRequest(request, {
        method: sample.method, url: base + sample.path, query: sample.query,
        headers: { authorization: "Bearer fixture-token" },
        ...(sample.body ? { body: { json: sample.body } } : {}),
      });
      return Response.json(sample.response);
    });
    server.use(http.all("*", ({ request }) => requests.handle(request)));
    await cli.execute(["permissions", "revoke", sample.permission]);
    await assertPermissionDenied(cli, sample.argv, sample.permission, requests);
    await cli.execute(["permissions", "grant", sample.permission]);
    await assertCliOutput(f, cli, sample.argv, sample.expected, /Pool/, requests);
  }
});

test("operator JSON failure output excludes the remote payload", async t => {
  const f = await createTestRuntime(t);
  const requests = trackRequests(t, 1, () =>
    HttpResponse.text("fixture-token synthetic-private-response", { status: 403 }));
  server.use(http.all("*", ({ request }) => requests.handle(request)));
  await assertSafeCliFailure(f, f.createCli(), ["pools", "show", "1", "--json"],
    /TeamCity request failed with HTTP 403/, /fixture-token|synthetic-private/);
});

test("MSW resolver assertion failures remain visible after the CLI sanitizes the HTTP error", async t => {
  const f = await createTestRuntime(t);
  const hooks: (() => void)[] = [];
  const context = { after(callback: () => void) { hooks.push(callback); } } as Pick<test.TestContext, "after">;
  const requests = trackRequests(context, 1, async request => {
    await assertHttpRequest(request, { method: "GET", url: base + "/deliberately-wrong" });
    return HttpResponse.json({ id: 1 });
  });
  server.use(http.all("*", ({ request }) => requests.handle(request)));
  assert.equal(await f.createCli().run(["pools", "show", "1", "--json"]), 1);
  assert.match(f.stderr(), /HTTP 500/);
  assert.equal(hooks.length, 1);
  assert.throws(hooks[0]!, /HTTP origin\/path/);
});
