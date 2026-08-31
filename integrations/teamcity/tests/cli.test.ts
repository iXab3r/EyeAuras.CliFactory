import assert from "node:assert/strict";
import test from "node:test";
import { Permission } from "@eyeauras/cli-factory";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createTestRuntime } from "./support.js";

const server = setupServer();

test.before(() => server.listen({ onUnhandledRequest: "error" }));
test.afterEach(() => server.resetHandlers());
test.after(() => server.close());

test("exposes the complete recursive tree and permission in leaf help", async (t) => {
  const testRuntime = await createTestRuntime(t);
  const cli = testRuntime.createCli();

  assert.equal(await cli.run([]), 0);
  for (const branch of [
    "server",
    "projects",
    "jobs",
    "builds",
    "queue",
    "agents",
  ]) {
    assert.match(testRuntime.stdout(), new RegExp(`\\b${branch}\\b`));
  }

  for (const [branch, leaf] of [
    ["server", "status"],
    ["projects", "list"],
    ["jobs", "run"],
    ["builds", "tests"],
    ["queue", "cancel"],
    ["agents", "show"],
  ] as const) {
    testRuntime.resetOutput();
    assert.equal(await cli.run([branch]), 0);
    assert.match(testRuntime.stdout(), new RegExp(`\\b${leaf}\\b`));
  }

  testRuntime.resetOutput();
  assert.equal(await cli.run(["jobs", "run", "--help"]), 0);
  assert.match(testRuntime.stdout(), /Required permission: Update/);
});

test("renders representative values for every read branch in human and JSON modes", async (t) => {
  server.use(
    http.get("https://teamcity.test/app/rest/server", () =>
      HttpResponse.json({
        version: "2026.1.3",
        versionMajor: 2026,
        versionMinor: 1,
        buildNumber: "222742",
        startTime: "fixture-start",
        currentTime: "fixture-now",
        role: "main_node",
        webUrl: "https://teamcity.test",
      }),
    ),
    http.get("https://teamcity.test/app/rest/projects", () =>
      HttpResponse.json({
        project: [{ id: "Example", name: "Example", archived: false }],
      }),
    ),
    http.get("https://teamcity.test/app/rest/buildTypes", () =>
      HttpResponse.json({
        buildType: [
          {
            id: "Example_Build",
            name: "Build",
            projectId: "Example",
            projectName: "Example",
            paused: false,
          },
        ],
      }),
    ),
    http.get("https://teamcity.test/app/rest/builds", () =>
      HttpResponse.json({
        build: [{ id: 101, state: "finished", status: "SUCCESS" }],
      }),
    ),
    http.get("https://teamcity.test/app/rest/buildQueue", () =>
      HttpResponse.json({
        build: [{ id: 201, state: "queued", queuePosition: 1 }],
      }),
    ),
    http.get("https://teamcity.test/app/rest/agents", () =>
      HttpResponse.json({
        agent: [
          {
            id: 8,
            name: "fixture-agent",
            connected: true,
            enabled: true,
            authorized: true,
          },
        ],
      }),
    ),
  );

  const paths = [
    ["server", "status"],
    ["projects", "list"],
    ["jobs", "list"],
    ["builds", "list"],
    ["queue", "list"],
    ["agents", "list"],
  ];

  for (const path of paths) {
    const humanRuntime = await createTestRuntime(t);
    assert.equal(await humanRuntime.createCli().run(path), 0);
    assert.notEqual(humanRuntime.stdout().trim(), "");
    assert.equal(humanRuntime.stderr(), "");

    const jsonRuntime = await createTestRuntime(t);
    assert.equal(
      await jsonRuntime.createCli().run([...path, "--json"]),
      0,
    );
    assert.doesNotThrow(() => JSON.parse(jsonRuntime.stdout()));
    assert.equal(jsonRuntime.stderr(), "");
  }
});

test("rejects invalid TeamCity options before fetch", async (t) => {
  let fetchCalls = 0;
  const testRuntime = await createTestRuntime(t);
  testRuntime.runtime.fetch = async () => {
    fetchCalls += 1;
    return HttpResponse.json({});
  };
  const cli = testRuntime.createCli();

  assert.equal(await cli.run(["builds", "list", "--limit", "101"]), 1);
  assert.match(testRuntime.stderr(), /between 1 and 100/);
  assert.equal(fetchCalls, 0);

  testRuntime.resetOutput();
  assert.equal(await cli.run(["agents", "show", "0"]), 1);
  assert.match(testRuntime.stderr(), /positive integer/);
  assert.equal(fetchCalls, 0);

  for (const [argv, message] of [
    [["queue", "list", "--start", "-1"], /non-negative integer/],
    [["builds", "list", "--state", "stopped"], /must be one of/],
    [["agents", "list", "--connected", "sometimes"], /must be one of/],
  ] as const) {
    testRuntime.resetOutput();
    assert.equal(await cli.run(argv), 1);
    assert.match(testRuntime.stderr(), message);
    assert.equal(fetchCalls, 0);
  }
});

test("denies every side effect before fetch, then performs one request after Update grant", async (t) => {
  let postCalls = 0;
  server.use(
    http.post("https://teamcity.test/app/rest/buildQueue", () => {
      postCalls += 1;
      return HttpResponse.json({ id: 201, state: "queued" });
    }),
    http.post("https://teamcity.test/app/rest/builds/id:101", () => {
      postCalls += 1;
      return HttpResponse.json({ id: 101, state: "finished" });
    }),
    http.post("https://teamcity.test/app/rest/buildQueue/id:201", () => {
      postCalls += 1;
      return HttpResponse.json({ id: 201, state: "finished" });
    }),
  );

  const mutations = [
    ["jobs", "run", "Example_Build"],
    ["builds", "cancel", "101"],
    ["queue", "cancel", "201"],
  ];
  const testRuntime = await createTestRuntime(t);
  const cli = testRuntime.createCli();

  for (const argv of mutations) {
    testRuntime.resetOutput();
    assert.equal(await cli.run(argv), 1);
    assert.match(testRuntime.stderr(), /Permission 'Update' is disabled/);
  }
  assert.equal(postCalls, 0);

  testRuntime.resetOutput();
  assert.equal(await cli.run(["permissions", "grant", Permission.Update]), 0);
  for (const argv of mutations) {
    testRuntime.resetOutput();
    assert.equal(await cli.run(argv), 0);
    assert.equal(testRuntime.stderr(), "");
  }
  assert.equal(postCalls, 3);
});

test("keeps URL, token, and Update permission isolated by profile", async (t) => {
  let alphaCalls = 0;
  let betaCalls = 0;
  server.use(
    http.post("https://alpha.test/app/rest/buildQueue", ({ request }) => {
      assert.equal(request.headers.get("authorization"), "Bearer alpha-token");
      alphaCalls += 1;
      return HttpResponse.json({ id: 301, state: "queued" });
    }),
    http.post("https://beta.test/app/rest/buildQueue", () => {
      betaCalls += 1;
      return HttpResponse.json({ id: 302, state: "queued" });
    }),
  );
  const testRuntime = await createTestRuntime(t, {
    profiles: [
      {
        name: "alpha",
        url: "https://alpha.test",
        permissions: [Permission.ReadOnly, Permission.Update],
      },
      {
        name: "beta",
        url: "https://beta.test",
        permissions: [Permission.ReadOnly],
      },
    ],
    tokens: { alpha: "alpha-token", beta: "beta-token" },
  });
  const cli = testRuntime.createCli();

  assert.equal(
    await cli.run(["jobs", "run", "Example_Build", "--profile", "alpha"]),
    0,
  );
  testRuntime.resetOutput();
  assert.equal(
    await cli.run(["jobs", "run", "Example_Build", "--profile", "beta"]),
    1,
  );
  assert.equal(alphaCalls, 1);
  assert.equal(betaCalls, 0);
});

test("a persistent JSON-RPC session can interleave profiles and commands", async (t) => {
  server.use(
    http.get("https://alpha.test/app/rest/server", ({ request }) => {
      assert.equal(request.headers.get("authorization"), "Bearer alpha-token");
      return HttpResponse.json({
        version: "alpha-version",
        versionMajor: 2026,
        versionMinor: 1,
        buildNumber: "1",
        startTime: "start",
        currentTime: "now",
        role: "main_node",
        webUrl: "https://alpha.test",
      });
    }),
    http.get("https://beta.test/app/rest/buildTypes", ({ request }) => {
      assert.equal(request.headers.get("authorization"), "Bearer beta-token");
      return HttpResponse.json({
        buildType: [
          {
            id: "Beta_Build",
            name: "Beta build",
            projectId: "Beta",
            projectName: "Beta",
            paused: false,
          },
        ],
      });
    }),
  );
  const input =
    '{"jsonrpc":"2.0","id":1,"method":"cli.execute","params":{"argv":["server","status","--profile","alpha"]}}\n' +
    '{"jsonrpc":"2.0","id":2,"method":"cli.execute","params":{"argv":["jobs","list","--profile","beta"]}}\n';
  const testRuntime = await createTestRuntime(t, {
    profiles: [
      { name: "alpha", url: "https://alpha.test" },
      { name: "beta", url: "https://beta.test" },
    ],
    tokens: { alpha: "alpha-token", beta: "beta-token" },
    input,
  });

  assert.equal(
    await testRuntime.createCli().run(["--json-rpc"]),
    0,
  );
  const frames = testRuntime
    .stdout()
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as { id: number; result: unknown });
  assert.deepEqual(
    frames.map((frame) => frame.id),
    [1, 2],
  );
  assert.equal(
    (frames[0]?.result as { version: string }).version,
    "alpha-version",
  );
  assert.equal(
    (frames[1]?.result as Array<{ id: string }>)[0]?.id,
    "Beta_Build",
  );
  assert.equal(testRuntime.stderr(), "");
});

test("auth login validates and stores a token without printing it", async (t) => {
  server.use(
    http.get("https://teamcity.test/app/rest/users/current", ({ request }) => {
      assert.equal(request.headers.get("authorization"), "Bearer login-token");
      return HttpResponse.json({ id: 7, username: "fixture-user" });
    }),
  );
  const testRuntime = await createTestRuntime(t, {
    tokens: {},
    input: "login-token",
  });
  const cli = testRuntime.createCli();

  assert.equal(await cli.run(["auth", "login", "--token-stdin", "--json"]), 0);
  assert.equal(
    await testRuntime.secretStore.get(
      "ai-cli-factory:teamcity-cli",
      "default:token",
    ),
    "login-token",
  );
  assert.equal(testRuntime.stdout().includes("login-token"), false);
  assert.equal(testRuntime.stderr().includes("login-token"), false);
});

test("explicit guest profile configuration needs no token and uses guest REST", async (t) => {
  const publicServer = "https://teamcity.jetbrains.com";
  server.use(
    http.get(`${publicServer}/guestAuth/app/rest/server`, ({ request }) => {
      assert.equal(request.headers.get("authorization"), null);
      return HttpResponse.json({
        version: "2026.2 EAP",
        buildNumber: "238763",
        webUrl: publicServer,
      });
    }),
  );
  const testRuntime = await createTestRuntime(t, {
    profiles: [{ name: "default" }],
    tokens: {},
  });
  const cli = testRuntime.createCli();

  assert.equal(
    await cli.run([
      "profile",
      "configure",
      "jetbrains-demo",
      "--url",
      publicServer,
      "--guest",
      "--json",
    ]),
    0,
  );
  assert.deepEqual(JSON.parse(testRuntime.stdout()), {
    configured: true,
    profile: "jetbrains-demo",
    authenticated: true,
    identity: null,
  });
  assert.deepEqual(
    (await testRuntime.profileStore.get("jetbrains-demo")).values,
    {
      url: publicServer,
      guest: true,
    },
  );

  testRuntime.resetOutput();
  assert.equal(
    await cli.run(["auth", "status", "--profile", "jetbrains-demo", "--json"]),
    0,
  );
  assert.deepEqual(JSON.parse(testRuntime.stdout()), {
    authenticated: true,
    profile: "jetbrains-demo",
    identity: null,
  });

  testRuntime.resetOutput();
  assert.equal(
    await cli.run([
      "server",
      "status",
      "--profile",
      "jetbrains-demo",
      "--json",
    ]),
    0,
  );
  assert.equal(JSON.parse(testRuntime.stdout()).buildNumber, "238763");
  assert.equal(testRuntime.stderr(), "");
});
