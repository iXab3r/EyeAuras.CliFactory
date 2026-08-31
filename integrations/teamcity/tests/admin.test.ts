import assert from "node:assert/strict";
import test from "node:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { TeamCityClient } from "../src/client.js";
import { createTestRuntime } from "./support.js";
import { adminCases } from "./admin-cases.js";
const base = "https://teamcity.test/app/rest";
const service = "ai-cli-factory:teamcity-cli";
const server = setupServer();
test.before(() => server.listen({ onUnhandledRequest: "error" }));
test.afterEach(() => server.resetHandlers());
test.after(() => server.close());
async function administrator(testContext: test.TestContext) {
  const runtime = await createTestRuntime(testContext);
  const cli = runtime.createCli();
  await cli.execute(["permissions", "grant", "Admin"]);
  await cli.execute(["permissions", "grant", "Credentials"]);
  return { cli, runtime };
}
const create = [
  "users",
  "tokens",
  "create",
  "ExampleToken",
  "--alias",
  "automation",
  "--no-expiration",
  "--same-permissions",
];

test("S7 all new gates deny before HTTP; Update grants neither Admin nor Credentials", async (testContext) => {
  const runtime = await createTestRuntime(testContext, {
    profiles: [{ name: "default", url: "https://teamcity.test", permissions: ["Update"] }],
  });
  const cli = runtime.createCli();
  let calls = 0;
  server.use(
    http.all("*", () => {
      calls++;
      return HttpResponse.json({});
    }),
  );
  for (const example of adminCases)
    await assert.rejects(
      cli.execute(example.argv),
      new RegExp(`Permission '${example.permission ?? "ReadOnly"}'`),
    );
  assert.equal(calls, 0);
});

test("S7 invalid identities, scopes, replacements, field names and node booleans fail locally", async (testContext) => {
  const { cli } = await administrator(testContext);
  let calls = 0;
  server.use(
    http.all("*", () => {
      calls++;
      return HttpResponse.json({});
    }),
  );
  for (const argv of [
    ["users", "delete", "-1"],
    ["users", "update", "7"],
    ["users", "fields", "get", "7", "password"],
    ["users", "fields", "set", "7", "email", "synthetic@example.test"],
    ["users", "fields", "clear", "7", "username"],
    ["users", "roles", "grant", "7", "ROLE"],
    ["users", "roles", "grant", "7", "ROLE", "--global", "--project", "Example"],
    ["groups", "parents", "replace", "Developers", "--group", "Developers"],
    ["groups", "parents", "replace", "Developers", "--group", "Other", "--group", "Other"],
    [
      "users",
      "roles",
      "replace",
      "7",
      "--item",
      '{"roleId":"R","global":true}',
      "--item",
      '{"roleId":"R","global":true}',
    ],
    ["users", "roles", "replace", "7", "--item", '{"roleId":"R","global":false}'],
    ["users", "properties", "set", "7", "password", "synthetic-invalid"],
    ["groups", "properties", "set", "Developers", "theme", "Bearer synthetic-invalid"],
    ["server", "nodes", "list", "--role", "primary"],
    ["server", "nodes", "responsibilities", "set", "node1", "CAN_CLEANUP", "true"],
    ["server", "nodes", "responsibilities", "set", "node1", "CAN_PROCESS_BUILD_MESSAGES", "yes"],
  ])
    await assert.rejects(cli.execute(argv), Error);
  assert.equal(calls, 0);
});

test("S7 explicit token expiry/permission choices and existing alias fail before issuance", async (testContext) => {
  const { cli, runtime } = await administrator(testContext);
  let calls = 0;
  server.use(
    http.all("*", () => {
      calls++;
      return HttpResponse.json({});
    }),
  );
  const head = ["users", "tokens", "create", "ExampleToken", "--alias", "automation"];
  for (const flags of [
    [],
    ["--no-expiration"],
    ["--same-permissions"],
    ["--no-expiration", "--expires", "20991231T235959+0000", "--same-permissions"],
    ["--expires", "20000101T000000+0000", "--same-permissions"],
    [
      "--no-expiration",
      "--same-permissions",
      "--restriction",
      '{"permission":"VIEW_PROJECT","global":true}',
    ],
    ["--no-expiration", "--restriction", '{"permission":"VIEW_PROJECT"}'],
    [
      "--no-expiration",
      "--restriction",
      '{"permission":"VIEW_PROJECT","global":true,"project":"Example"}',
    ],
    [
      "--no-expiration",
      "--restriction",
      '{"permission":"VIEW_PROJECT","project":"Example"}',
      "--restriction",
      '{"permission":"VIEW_PROJECT","project":"Example"}',
    ],
  ])
    await assert.rejects(cli.execute([...head, ...flags]), Error);
  await runtime.secretStore.set(service, "default:issued-token:automation", "synthetic-existing");
  await assert.rejects(cli.execute(create), /already exists/);
  assert.equal(calls, 0);
});

test("S7 issued token is a profile-scoped secure record; revoke and forget have separate ownership", async (testContext) => {
  const { cli, runtime } = await administrator(testContext);
  let posts = 0;
  let deletes = 0;
  server.use(
    http.post(base + "/users/current/tokens", async ({ request }) => {
      posts++;
      assert.deepEqual(await request.json(), { name: "ExampleToken" });
      return HttpResponse.json({
        name: "ExampleToken",
        value: "synthetic-issued-token",
        expirationTime: null,
      });
    }),
    http.delete(base + "/users/current/tokens/ExampleToken", () => {
      deletes++;
      return new HttpResponse(null, { status: 204 });
    }),
  );
  assert.equal(await cli.run([...create, "--json"]), 0);
  assert.deepEqual(JSON.parse(runtime.stdout()), {
    name: "ExampleToken",
    expirationTime: null,
    alias: "automation",
    stored: true,
  });
  assert.ok(!runtime.stdout().includes("synthetic-issued"));
  assert.equal(await runtime.secretStore.get(service, "default:token"), "fixture-token");
  assert.deepEqual(
    JSON.parse((await runtime.secretStore.get(service, "default:issued-token:automation"))!),
    { name: "ExampleToken", value: "synthetic-issued-token" },
  );
  await assert.rejects(
    cli.execute(["users", "tokens", "delete", "Different", "--alias", "automation"]),
    /does not match/,
  );
  assert.equal(deletes, 0);
  await cli.execute(["users", "tokens", "delete", "ExampleToken", "--alias", "automation"]);
  assert.equal(
    await runtime.secretStore.get(service, "default:issued-token:automation"),
    undefined,
  );
  await cli.execute(create);
  await cli.execute(["users", "tokens", "forget", "--alias", "automation"]);
  assert.equal(deletes, 1, "forget must not revoke remotely");
  assert.equal(posts, 2);
  assert.equal(await runtime.secretStore.get(service, "default:token"), "fixture-token");
});

test("S7 restricted token body is explicit and local persistence failure never leaks or retries", async (testContext) => {
  const { cli, runtime } = await administrator(testContext);
  let calls = 0;
  server.use(
    http.post(base + "/users/current/tokens", async ({ request }) => {
      calls++;
      assert.deepEqual(await request.json(), {
        name: "ExampleToken",
        permissionRestrictions: {
          permissionRestriction: [
            { permission: { id: "VIEW_PROJECT" }, project: { id: "Example" } },
          ],
        },
      });
      return HttpResponse.json({ name: "ExampleToken", value: "synthetic-issued-token" });
    }),
  );
  runtime.secretStore.set = async () => {
    throw new Error("synthetic-private-backend-error");
  };
  await assert.rejects(
    cli.execute([
      "users",
      "tokens",
      "create",
      "ExampleToken",
      "--alias",
      "automation",
      "--no-expiration",
      "--restriction",
      '{"permission":"VIEW_PROJECT","project":"Example"}',
    ]),
    {
      message:
        "Remote token was created but secure persistence failed; revoke the named remote token. No retry was made.",
    },
  );
  assert.equal(calls, 1);
  assert.equal(runtime.stderr(), "");
});

test("S7 malformed one-time token replies never reach output or secure storage", async (testContext) => {
  const { cli, runtime } = await administrator(testContext);
  for (const response of [
    { name: "Wrong", value: "synthetic-issued-token" },
    { name: "ExampleToken", value: "" },
    { name: "ExampleToken" },
  ]) {
    server.use(http.post(base + "/users/current/tokens", () => HttpResponse.json(response)));
    await assert.rejects(cli.execute(create), /one-time result was invalid/);
    assert.equal(
      await runtime.secretStore.get(service, "default:issued-token:automation"),
      undefined,
    );
  }
});

test("S7 full direct-role/group replacements and user identity update preserve explicit bodies", async (testContext) => {
  const { cli } = await administrator(testContext);
  const bodies: unknown[] = [];
  server.use(
    http.put(base + "/*", async ({ request }) => {
      bodies.push(await request.json());
      return HttpResponse.json({});
    }),
  );
  await cli.execute(["users", "update", "9223372036854775807", "--name", "Example"]);
  await cli.execute(["users", "groups", "replace", "7"]);
  await cli.execute(["groups", "parents", "replace", "Developers"]);
  await cli.execute(["users", "roles", "replace", "7"]);
  assert.deepEqual(bodies, [{ name: "Example" }, { group: [] }, { group: [] }, { role: [] }]);
});

test("S7 node/account/role projections discard URLs, credentials and unexpected nested data", async (testContext) => {
  const { cli } = await administrator(testContext);
  server.use(
    http.get(base + "/server/nodes/id:node1", () =>
      HttpResponse.json({
        id: "node1",
        url: "https://internal.example.test",
        properties: { token: "synthetic-hidden" },
      }),
    ),
    http.get(base + "/users/id:7/roles", ({ request }) => {
      assert.equal(new URL(request.url).search, "");
      return HttpResponse.json({
        role: [{ roleId: "R", scope: "g", href: "/private", token: "synthetic-hidden" }],
      });
    }),
    http.get(base + "/users/current/tokens", () =>
      HttpResponse.json({ token: [{ name: "ExampleToken", value: "synthetic-hidden" }] }),
    ),
  );
  assert.deepEqual(await cli.execute(["server", "nodes", "show", "node1"]), { id: "node1" });
  assert.deepEqual(await cli.execute(["users", "roles", "list", "7"]), [
    { roleId: "R", scope: "g" },
  ]);
  assert.deepEqual(await cli.execute(["users", "tokens", "list"]), [{ name: "ExampleToken" }]);
});

test("S7 JSON-RPC token issuance isolates credentials and custom gates across profiles", async (testContext) => {
  const commands = [
    ["users", "tokens", "create", "--help"],
    create,
    [...create, "--profile", "uat"],
  ];
  const runtime = await createTestRuntime(testContext, {
    profiles: [
      { name: "default", url: "https://teamcity.test", permissions: ["ReadOnly", "Update"] },
      { name: "uat", url: "https://uat.test", permissions: ["ReadOnly", "Credentials"] },
    ],
    tokens: { default: "fixture-token", uat: "fixture-uat-token" },
    input:
      commands
        .map((argv, id) =>
          JSON.stringify({ jsonrpc: "2.0", id, method: "cli.execute", params: { argv } }),
        )
        .join("\n") + "\n",
  });
  let calls = 0;
  server.use(
    http.post("https://uat.test/app/rest/users/current/tokens", ({ request }) => {
      calls++;
      assert.equal(request.headers.get("Authorization"), "Bearer fixture-uat-token");
      return HttpResponse.json({ name: "ExampleToken", value: "synthetic-issued-token" });
    }),
  );
  assert.equal(await runtime.createCli().run(["--json-rpc"]), 0);
  const frames = runtime
    .stdout()
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  assert.match(frames[0].result.help, /Credentials/);
  assert.match(frames[1].error.message, /Permission 'Credentials'/);
  assert.equal(frames[2].result.stored, true);
  assert.ok(!runtime.stdout().includes("synthetic-issued"));
  assert.equal(
    await runtime.secretStore.get(service, "default:issued-token:automation"),
    undefined,
  );
  assert.ok(await runtime.secretStore.get(service, "uat:issued-token:automation"));
  assert.equal(calls, 1);
});

test("S7 network failures cannot echo secret bodies or nested causes", async (testContext) => {
  const client = new TeamCityClient({
    baseUrl: "https://teamcity.test",
    token: "fixture-token",
    fetch: async () => {
      throw new Error("synthetic-private-network-detail");
    },
  });
  await assert.rejects(client.getApiVersion(), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.equal(error.message, "TeamCity network request failed; remote outcome is unknown.");
    assert.equal(error.cause, undefined);
    return true;
  });
});

test("S7 failed secure-store preflight and post-revocation cleanup expose no backend details", async (testContext) => {
  const { cli, runtime } = await administrator(testContext);
  let calls = 0;
  server.use(
    http.all("*", () => {
      calls++;
      return new HttpResponse(null, { status: 204 });
    }),
  );
  const originalGet = runtime.secretStore.get.bind(runtime.secretStore);
  runtime.secretStore.get = async (serviceName, account) => {
    if (account.includes("issued-token:")) throw new Error("synthetic-private-backend");
    return originalGet(serviceName, account);
  };
  await assert.rejects(cli.execute(create), /Could not inspect the issued-token credential store/);
  assert.equal(calls, 0);
  runtime.secretStore.get = originalGet;
  await runtime.secretStore.set(
    service,
    "default:issued-token:automation",
    JSON.stringify({ name: "ExampleToken", value: "synthetic-issued" }),
  );
  runtime.secretStore.delete = async () => {
    throw new Error("synthetic-private-backend");
  };
  await assert.rejects(
    cli.execute(["users", "tokens", "delete", "ExampleToken", "--alias", "automation"]),
    {
      message:
        "Remote token was revoked but local secure-record cleanup failed; forget the alias explicitly.",
    },
  );
  assert.equal(calls, 1);
});

test("S7 failed response streams cannot expose secret values in ordinary or discard mode", async (testContext) => {
  const client = new TeamCityClient({
    baseUrl: "https://teamcity.test",
    token: "fixture-token",
    fetch: async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.error(new Error("synthetic-private-stream"));
          },
        }),
      ),
  });
  for (const call of [
    () => client.getApiVersion(),
    () => client.checkAccountProperty("users", "7", "theme"),
  ])
    await assert.rejects(call(), (error) => {
      assert.ok(error instanceof Error);
      assert.match(
        error.message,
        /^TeamCity response stream failed(?: or exceeded2MiB)?; remote outcome is unknown\.$/,
      );
      assert.equal(error.cause, undefined);
      return true;
    });
});
