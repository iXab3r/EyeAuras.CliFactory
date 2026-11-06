import assert from "node:assert/strict";
import test from "node:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { assertPermissionDenied, trackRequests } from "@eyeauras/cli-factory/testing";
import { createTestRuntime } from "./support.js";
import { infrastructureCases } from "./infrastructure-cases.js";
import { plainProperty, safeProperty } from "../src/authoring-models.js";
const base = "https://teamcity.test/app/rest";
const service = "ai-cli-factory:teamcity-cli";
const server = setupServer();
test("property protection decodes credential-bearing URL keys and fragments", () => {
  for (const value of [
    "https://example.test/repo?%74oken=synthetic",
    "https://example.test/repo#access_token=synthetic",
    "https://synthetic@example.test/repo",
    "https://example.test/file?X-Amz-Signature=synthetic",
  ]) {
    assert.throws(() => plainProperty("url", value));
    assert.deepEqual(safeProperty({ name: "url", value }), {
      name: "url",
      type: "plain",
      redacted: true,
    });
  }
  assert.equal(
    plainProperty("url", "https://example.test/repo?branch=main").value,
    "https://example.test/repo?branch=main",
  );
});
test.before(() => server.listen({ onUnhandledRequest: "error" }));
test.afterEach(() => server.resetHandlers());
test.after(() => server.close());
async function writable(testContext: test.TestContext) {
  const runtime = await createTestRuntime(testContext);
  const cli = runtime.createCli();
  await cli.execute(["permissions", "grant", "Update"]);
  await cli.execute(["permissions", "grant", "Credentials"]);
  return { cli, runtime };
}
const versioned = ["projects", "versioned-settings"];

for (const format of ["csharp", "future-format+v2", "xml", "kotlin", " future format ", ""]) {
  test(`versioned settings forwards format ${JSON.stringify(format)} unchanged`, async (testContext) => {
    const { cli } = await writable(testContext);
    const path = base + "/projects/id:Example/versionedSettings/config";
    const requests = trackRequests(testContext, 2, async (request) => {
      assert.equal(request.method, "PUT");
      if (new URL(request.url).pathname.endsWith("/parameters/format")) {
        assert.equal(request.headers.get("content-type"), "text/plain");
        assert.equal(await request.text(), format);
        return HttpResponse.text(format);
      }
      assert.equal(new URL(request.url).pathname, new URL(path).pathname);
      const body = await request.json() as Record<string, unknown>;
      assert.deepEqual(body, {
        synchronizationMode: "enabled", vcsRootId: "Git", format,
        storeSecureValuesOutsideVcs: true,
      });
      return HttpResponse.json(body);
    });
    server.use(http.all("*", ({ request }) => requests.handle(request)));
    const results = await Promise.allSettled([
      cli.execute([...versioned, "config", "fields", "set", "Example", "format", format]),
      cli.execute([...versioned, "config", "replace", "Example", "--item",
        JSON.stringify({ synchronizationMode: "enabled", vcsRootId: "Git", format })]),
    ]);
    for (const result of results) {
      if (result.status === "rejected") throw result.reason;
    }
    assert.equal(((results[1] as PromiseFulfilledResult<unknown>).value as Record<string, unknown>).format, format);
  });
}

test("versioned settings rejects invalid JSON and format types before HTTP", async (testContext) => {
  const { cli } = await writable(testContext);
  const requests = trackRequests(testContext, 0, () => HttpResponse.json({}));
  server.use(http.all("*", ({ request }) => requests.handle(request)));
  for (const item of ["{", ...[null, 42, false, [], {}].map(format =>
    JSON.stringify({ synchronizationMode: "enabled", vcsRootId: "Git", format }))]) {
    await assert.rejects(cli.execute([...versioned, "config", "replace", "Example", "--item", item]));
  }
});

test("versioned settings format keeps safe remote validation failures", async (testContext) => {
  const { cli, runtime } = await writable(testContext);
  const requests = trackRequests(testContext, 2, () =>
    HttpResponse.text("synthetic-private-server-detail", { status: 400 }));
  server.use(http.all("*", ({ request }) => requests.handle(request)));
  for (const argv of [
    [...versioned, "config", "fields", "set", "Example", "format", "csharp"],
    [...versioned, "config", "replace", "Example", "--item",
      '{"synchronizationMode":"enabled","vcsRootId":"Git","format":"future-format+v2"}'],
  ]) {
    const result = await runtime.run(cli, [...argv, "--json"]);
    assert.equal(result.exitCode, 1);
    assert.equal(result.stdout, "");
    const error = JSON.parse(result.stderr).error;
    assert.equal(error.code, "http.rejected");
    assert.equal(error.message, "TeamCity request failed with HTTP 400.");
    assert.ok(!result.stderr.includes("synthetic-private-server-detail"));
  }
});

test("S8 all50 gates deny before network or secret-input reads", async (testContext) => {
  const runtime = await createTestRuntime(testContext, {
    profiles: [{ name: "default", url: "https://teamcity.test", permissions: [] }],
  });
  const requests = trackRequests(testContext, 0, () => HttpResponse.json({}));
  server.use(http.all("*", ({ request }) => requests.handle(request)));
  const cli = runtime.createCli();
  for (const example of infrastructureCases)
    await assertPermissionDenied(
      cli,
      example.argv,
      example.permission ?? (example.method === "GET" ? "ReadOnly" : "Update"),
      requests,
    );
});

test("S8 typed inputs reject unsafe URLs, missing confirmation, invalid fields and secret-to-VCS settings", async (testContext) => {
  const { cli } = await writable(testContext);
  const requests = trackRequests(testContext, 0, () => HttpResponse.json({}));
  server.use(http.all("*", ({ request }) => requests.handle(request)));
  const createRoot = [
    "vcs",
    "roots",
    "create",
    "Git",
    "--name",
    "Git",
    "--project",
    "Example",
    "--branch",
    "main",
    "--url",
  ];
  const invalid = [
    ...[
      "https://fixture:synthetic-hidden@example.test/repo.git",
      "https://example.test/repo.git?token=synthetic-hidden",
    ].map((url) => [...createRoot, url]),
    [
      "cloud",
      "instances",
      "delete",
      "--cloud-profile",
      "Cloud",
      "--image",
      "Image",
      "--instance",
      "Instance",
    ],
    ["cloud", "images", "show", "--cloud-profile", "Cloud"],

    ["vcs", "roots", "properties", "clear", "Git"],
    [
      "vcs",
      "roots",
      "properties",
      "set",
      "Git",
      "url",
      "https://example.test/repo?token=synthetic-hidden",
    ],
    ["vcs", "roots", "properties", "set", "Git", "secure:password", "synthetic-hidden"],

    ["vcs", "instances", "fields", "set", "8", "commitHookMode", "Bearer synthetic"],

    [...versioned, "commit", "Example"],
    [...versioned, "load", "Example"],
    [
      ...versioned,
      "config",
      "replace",
      "Example",
      "--item",
      '{"synchronizationMode":"disabled","storeSecureValuesOutsideVcs":false}',
    ],
    [
      ...versioned,
      "config",
      "replace",
      "Example",
      "--item",
      '{"synchronizationMode":"disabled","portableDsl":"false"}',
    ],
    [
      ...versioned,
      "config",
      "replace",
      "Example",
      "--item",
      '{"synchronizationMode":"disabled","password":"synthetic-hidden"}',
    ],
    [...versioned, "config", "fields", "set", "Example", "storeSecureValuesOutsideVcs", "false"],
    [...versioned, "config", "fields", "set", "Example", "showSettingsChanges", "Bearer synthetic"],
    [...versioned, "context", "replace", "Example", "--property", "password=synthetic-hidden"],
    [
      ...versioned,
      "tokens",
      "set",
      "Example",
      "--mapping",
      "Remote=one",
      "--mapping",
      "Remote=two",
    ],
  ];
  for (const argv of invalid) await assert.rejects(cli.execute(argv), Error);
});

test("S8 composite cloud identities cannot inject another profile/image or expose network fields", async (testContext) => {
  const { cli } = await writable(testContext);
  let posted: unknown;
  server.use(
    http.post(base + "/cloud/instances", async ({ request }) => {
      posted = await request.json();
      return new HttpResponse(null, { status: 204 });
    }),
    http.get(base + "/cloud/images/*", ({ request }) => {
      const path = new URL(request.url).pathname;
      const encoded = path.slice(path.indexOf("$base64:") + 8, -1);
      assert.equal(
        Buffer.from(encoded, "base64url").toString(),
        "profileId:($base64:Q2xvdWQsb3RoZXI6aWQ),id:Image",
      );
      return HttpResponse.json({
        id: "safe-id",
        profile: { id: "Cloud", password: "synthetic-hidden" },
        networkAddress: "synthetic-hidden",
        errors: { message: "synthetic-hidden" },
      });
    }),
  );
  await cli.execute([
    "cloud",
    "instances",
    "start",
    "--cloud-profile",
    "Cloud",
    "--image",
    "Image",
  ]);
  assert.deepEqual(posted, { image: { id: "profileId:Cloud,id:Image" } });
  assert.deepEqual(
    await cli.execute([
      "cloud",
      "images",
      "show",
      "--cloud-profile",
      "Cloud,other:id",
      "--image",
      "Image",
    ]),
    { id: "safe-id", profile: { id: "Cloud" } },
  );
});

test("S8 commit-hook only reports scheduling for202 and never retries unexpected success or failure", async (testContext) => {
  const { cli } = await writable(testContext);
  for (const status of [200, 201, 202, 404]) {
    let calls = 0;
    server.use(
      http.post(base + "/vcs-root-instances/commitHookNotification", ({ request }) => {
        calls++;
        assert.equal(new URL(request.url).searchParams.get("okOnNothingFound"), "false");
        return HttpResponse.text("synthetic-private-diagnostics", { status });
      }),
    );
    const request = cli.execute(["vcs", "instances", "notify-commit", "8"]);
    if (status === 202) assert.deepEqual(await request, { instanceId: "8", scheduled: true });
    else await assert.rejects(request, status === 404 ? /HTTP 404/ : /unexpected success status/);
    assert.equal(calls, 1);
  }
});

test("S8 full repository/context replacements preserve empty and false values without hidden reads", async (testContext) => {
  const { cli } = await writable(testContext);
  const bodies: unknown[] = [];
  server.use(
    http.put(base + "/*", async ({ request }) => {
      const body = await request.json();
      bodies.push(body);
      return HttpResponse.json(body as object);
    }),
  );
  assert.deepEqual(await cli.execute(["vcs", "instances", "state", "replace", "8"]), []);
  assert.deepEqual(await cli.execute([...versioned, "context", "replace", "Example"]), []);
  assert.deepEqual(await cli.execute(["vcs", "roots", "properties", "replace", "Git"]), []);
  const value = await cli.execute([
    ...versioned,
    "config",
    "replace",
    "Example",
    "--item",
    '{"synchronizationMode":"disabled","allowUIEditing":false,"portableDsl":false}',
  ]);
  assert.deepEqual(value, {
    synchronizationMode: "disabled",
    allowUIEditing: false,
    storeSecureValuesOutsideVcs: true,
    portableDsl: false,
  });
  assert.deepEqual(bodies.slice(0, 3), [
    { entry: [] },
    { versionedSettingsContextParameter: [] },
    { property: [] },
  ]);
});

test("S8 config reset may fail after mutation: no retry or false rollback acknowledgement", async (testContext) => {
  const { cli } = await writable(testContext);
  let changed = false;
  let calls = 0;
  server.use(
    http.delete(base + "/projects/id:Example/versionedSettings/config/parameters/vcsRootId", () => {
      changed = true;
      calls++;
      return HttpResponse.text("synthetic-private-diagnostic", { status: 400 });
    }),
  );
  await assert.rejects(
    cli.execute([...versioned, "config", "fields", "reset", "Example", "vcsRootId", "--confirm"]),
    { message: "TeamCity request failed with HTTP 400." },
  );
  assert.equal(changed, true);
  assert.equal(calls, 1);
});

test("S8 input-secret import/forget uses only explicit env input and never replaces auth", async (testContext) => {
  const { cli, runtime } = await writable(testContext);
  const envName = "CLIFACTORY_SYNTHETIC_SECRET_INPUT";
  const previous = process.env[envName];
  process.env[envName] = "synthetic-input-secret";
  try {
    assert.equal(
      await cli.run(["credentials", "import", "deployment", "--env", envName, "--json"]),
      0,
    );
    assert.deepEqual(JSON.parse(runtime.stdout()), { alias: "deployment", stored: true });
    assert.equal(
      await runtime.secretStore.get(service, "default:input-secret:deployment"),
      "synthetic-input-secret",
    );
    await assert.rejects(
      cli.execute(["credentials", "import", "deployment", "--env", envName]),
      /already exists/,
    );
    await cli.execute(["credentials", "forget", "deployment"]);
    assert.equal(
      await runtime.secretStore.get(service, "default:input-secret:deployment"),
      undefined,
    );
    assert.equal(await runtime.secretStore.get(service, "default:token"), "fixture-token");
    assert.ok(!runtime.stdout().includes("synthetic-input"));
  } finally {
    if (previous === undefined) delete process.env[envName];
    else process.env[envName] = previous;
  }
});

test("S8 secure mapping resolves every input before HTTP and remote deletion retains local secrets", async (testContext) => {
  const { cli, runtime } = await writable(testContext);
  await runtime.secretStore.set(service, "default:input-secret:one", "synthetic-one");
  let calls = 0;
  server.use(
    http.all(base + "/projects/id:Example/versionedSettings/tokens", async ({ request }) => {
      calls++;
      assert.deepEqual(
        await request.json(),
        request.method === "POST"
          ? { versionedSettingsToken: [{ name: "Remote", value: "synthetic-one" }] }
          : { versionedSettingsToken: [{ name: "Remote" }] },
      );
      return HttpResponse.json({
        versionedSettingsToken: [{ name: "Unrelated", value: "synthetic-private" }],
      });
    }),
  );
  await assert.rejects(
    cli.execute([
      ...versioned,
      "tokens",
      "set",
      "Example",
      "--mapping",
      "Remote=one",
      "--mapping",
      "Other=missing",
    ]),
    /input-secret is unavailable/,
  );
  assert.equal(calls, 0);
  assert.deepEqual(
    await cli.execute([...versioned, "tokens", "set", "Example", "--mapping", "Remote=one"]),
    { names: ["Remote"], updated: true },
  );
  assert.deepEqual(
    await cli.execute([...versioned, "tokens", "delete", "Example", "--name", "Remote"]),
    { names: ["Remote"], deleted: true },
  );
  assert.equal(await runtime.secretStore.get(service, "default:input-secret:one"), "synthetic-one");
  assert.equal(calls, 2);
});

test("S8 effective/status/context projections reject nested private data and malformed response text", async (testContext) => {
  const { cli } = await writable(testContext);
  const path = base + "/projects/id:Example/versionedSettings";
  server.use(
    http.get(path + "/config/effective", () =>
      HttpResponse.json({
        project: { id: "Parent", token: "synthetic-hidden" },
        config: { synchronizationMode: "disabled", password: "synthetic-hidden" },
        details: "synthetic-hidden",
      }),
    ),
    http.get(path + "/contextParameters", () =>
      HttpResponse.json({
        versionedSettingsContextParameter: [{ name: "environment", value: "synthetic-hidden" }],
      }),
    ),
    http.get(path + "/status", () =>
      HttpResponse.json({
        type: "warn",
        missingContextParameters: ["environment"],
        message: "synthetic-hidden",
        stackTraceLines: ["synthetic-hidden"],
      }),
    ),
  );
  assert.deepEqual(await cli.execute([...versioned, "config", "effective", "Example"]), {
    project: { id: "Parent" },
    config: { synchronizationMode: "disabled" },
  });
  assert.deepEqual(await cli.execute([...versioned, "context", "list", "Example"]), [
    { name: "environment", hasValue: true },
  ]);
  assert.deepEqual(await cli.execute([...versioned, "status", "Example"]), {
    type: "warn",
    missingContextParameters: ["environment"],
  });
  server.use(http.get(path + "/status", () => HttpResponse.text("{synthetic-hidden")));
  await assert.rejects(cli.execute([...versioned, "status", "Example"]), {
    message: "TeamCity response was not valid JSON.",
  });
});

test("S8 persistent RPC isolates secure mappings and cloud Update between profiles", async (testContext) => {
  const mapping = [...versioned, "tokens", "set", "Example", "--mapping", "Remote=deployment"];
  const commands = [
    [...versioned, "tokens", "set", "--help"],
    mapping,
    [...mapping, "--profile", "uat"],
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
  await runtime.secretStore.set(service, "default:input-secret:deployment", "synthetic-default");
  await runtime.secretStore.set(service, "uat:input-secret:deployment", "synthetic-uat");
  let calls = 0;
  server.use(
    http.post(
      "https://uat.test/app/rest/projects/id:Example/versionedSettings/tokens",
      async ({ request }) => {
        calls++;
        assert.equal(request.headers.get("Authorization"), "Bearer fixture-uat-token");
        assert.deepEqual(await request.json(), {
          versionedSettingsToken: [{ name: "Remote", value: "synthetic-uat" }],
        });
        return HttpResponse.json({ versionedSettingsToken: [{ name: "Remote" }] });
      },
    ),
  );
  assert.equal(await runtime.createCli().run(["--json-rpc"]), 0);
  const frames = runtime
    .stdout()
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  assert.match(frames[0].result.help, /Credentials/);
  assert.match(frames[1].error.message, /Permission 'Credentials'/);
  assert.deepEqual(frames[2].result, { names: ["Remote"], updated: true });
  assert.equal(calls, 1);
  assert.ok(!runtime.stdout().includes("synthetic-uat"));
});
