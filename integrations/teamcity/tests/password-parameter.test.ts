import assert from "node:assert/strict";
import test from "node:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createTestRuntime } from "./support.js";

const base = "https://teamcity.test/app/rest/buildTypes/id:Example/parameters";
const argv = ["jobs", "parameters", "create-password", "Example", "env.NPM_TOKEN", "--value-secret", "fixture-npm"];
const server = setupServer();
test.before(() => server.listen({ onUnhandledRequest: "error" }));
test.afterEach(() => server.resetHandlers());
test.after(() => server.close());

test("password creation uses only its profile keyring alias and discards server echoes", async (t) => {
  const runtime = await createTestRuntime(t);
  const cli = runtime.createCli();
  const secret = " synthetic-password-with-whitespace \n";
  await runtime.secretStore.set("ai-cli-factory:teamcity-cli", "default:input-secret:fixture-npm", secret);
  await cli.execute(["permissions", "grant", "Credentials"]);
  let writes = 0;
  server.use(
    http.get(`${base}/env.NPM_TOKEN`, () => new HttpResponse(null, { status: 404 })),
    http.post(base, async ({ request }) => {
      writes++;
      assert.deepEqual(await request.json(), { name: "env.NPM_TOKEN", value: secret, type: { rawValue: "password" } });
      return HttpResponse.json({ name: "env.NPM_TOKEN", value: secret });
    }),
  );
  assert.equal(await cli.run([...argv, "--json"]), 0, runtime.stderr());
  assert.deepEqual(JSON.parse(runtime.stdout()), { jobId: "Example", name: "env.NPM_TOKEN", stored: true });
  assert.equal(writes, 1);
  assert.equal((runtime.stdout() + runtime.stderr()).includes(secret.trim()), false);
});

test("Update cannot create passwords and missing/profile-mismatched aliases cause no network", async (t) => {
  const runtime = await createTestRuntime(t, { profiles: [
    { name: "default", url: "https://teamcity.test" }, { name: "other", url: "https://teamcity.test" },
  ], tokens: { default: "fixture-token", other: "fixture-other-token" } });
  const cli = runtime.createCli();
  await cli.execute(["permissions", "grant", "Update"]);
  await assert.rejects(cli.execute(argv), /Credentials/);
  await cli.execute(["permissions", "grant", "Credentials"]);
  await runtime.secretStore.set("ai-cli-factory:teamcity-cli", "other:input-secret:fixture-npm", "synthetic-other-profile");
  await assert.rejects(cli.execute(argv), /input-secret is unavailable/);
});

for (const status of [200, 403, 500]) {
  test(`password creation refuses existing or unreadable parameters (${status})`, async (t) => {
    const runtime = await createTestRuntime(t);
    const cli = runtime.createCli();
    await cli.execute(["permissions", "grant", "Credentials"]);
    await runtime.secretStore.set("ai-cli-factory:teamcity-cli", "default:input-secret:fixture-npm", "synthetic-npm-value");
    let writes = 0;
    server.use(
      http.get(`${base}/env.NPM_TOKEN`, () => status === 200
        ? HttpResponse.json({ name: "env.NPM_TOKEN" }) : new HttpResponse(null, { status })),
      http.post(base, () => { writes++; return new HttpResponse(null, { status: 204 }); }),
    );
    await assert.rejects(cli.execute(argv));
    assert.equal(writes, 0);
  });
}
