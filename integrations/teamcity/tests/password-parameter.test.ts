import assert from "node:assert/strict";
import test from "node:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createTestRuntime } from "./support.js";

const path = "https://teamcity.test/app/rest/buildTypes/id:Example/parameters/npm.token";
const argv = ["jobs", "parameters", "set-password", "Example", "npm.token", "--value-secret", "fixture-npm"];
const secret = " synthetic-password-with-whitespace \n";
const server = setupServer();
test.before(() => server.listen({ onUnhandledRequest: "error" }));
test.afterEach(() => server.resetHandlers());
test.after(() => server.close());

test("password replacement preserves its specification and discards server echoes", async (t) => {
  const runtime = await createTestRuntime(t);
  const cli = runtime.createCli();
  await runtime.secretStore.set("ai-cli-factory:teamcity-cli", "default:input-secret:fixture-npm", secret);
  await cli.execute(["permissions", "grant", "Credentials"]);
  const type = { rawValue: "password display='hidden'" };
  let writes = 0;
  server.use(
    http.get(path, ({ request }) => {
      assert.equal(new URL(request.url).searchParams.get("fields"), "name,inherited,type(rawValue)");
      return HttpResponse.json({ name: "npm.token", inherited: false, type });
    }),
    http.put(path, async ({ request }) => {
      writes++;
      assert.deepEqual(await request.json(), { name: "npm.token", value: secret, type });
      return HttpResponse.json({ name: "npm.token", value: secret });
    }),
  );
  assert.equal(await cli.run([...argv, "--json"]), 0, runtime.stderr());
  assert.deepEqual(JSON.parse(runtime.stdout()), { jobId: "Example", name: "npm.token", stored: true });
  assert.equal(writes, 1);
  assert.equal((runtime.stdout() + runtime.stderr()).includes(secret.trim()), false);
});

test("password replacement requires Credentials and the selected profile's alias before networking", async (t) => {
  const runtime = await createTestRuntime(t, { profiles: [
    { name: "default", url: "https://teamcity.test" }, { name: "other", url: "https://teamcity.test" },
  ], tokens: { default: "fixture-token", other: "fixture-other-token" } });
  const cli = runtime.createCli();
  await cli.execute(["permissions", "grant", "Update"]);
  await assert.rejects(cli.execute(argv), /Credentials/);
  await cli.execute(["permissions", "grant", "Credentials"]);
  await runtime.secretStore.set("ai-cli-factory:teamcity-cli", "other:input-secret:fixture-npm", secret);
  await assert.rejects(cli.execute(argv), /input-secret is unavailable/);
});

for (const metadata of [
  { name: "npm.token" },
  { name: "other", type: { rawValue: "password" } },
  { name: "npm.token", type: { rawValue: "text display='hidden'" } },
  { name: "npm.token", inherited: true, type: { rawValue: "password" } },
]) {
  test(`password replacement refuses unsuitable metadata ${JSON.stringify(metadata)}`, async (t) => {
    const runtime = await createTestRuntime(t);
    const cli = runtime.createCli();
    await cli.execute(["permissions", "grant", "Credentials"]);
    await runtime.secretStore.set("ai-cli-factory:teamcity-cli", "default:input-secret:fixture-npm", secret);
    server.use(http.get(path, () => HttpResponse.json(metadata)));
    await assert.rejects(cli.execute(argv), /job-owned password/);
  });
}

test("password write failures redact the submitted secret from verbose diagnostics", async (t) => {
  const runtime = await createTestRuntime(t);
  let writes = 0;
  runtime.runtime.fetch = async (_url, init) => {
    if (init?.method === "GET") return Response.json({ name: "npm.token", type: { rawValue: "password" } });
    writes++;
    throw new Error(secret);
  };
  const cli = runtime.createCli();
  await cli.execute(["permissions", "grant", "Credentials"]);
  await runtime.secretStore.set("ai-cli-factory:teamcity-cli", "default:input-secret:fixture-npm", secret);
  assert.equal(await cli.run([...argv, "--json", "--verbose"]), 1);
  assert.equal(writes, 1);
  assert.equal((runtime.stdout() + runtime.stderr()).includes(secret.trim()), false);
});
