import assert from "node:assert/strict";
import { after, afterEach, before, test, type TestContext } from "node:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createTestRuntime } from "./support.js";

const server = setupServer();
before(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
after(() => server.close());
const service = "ai-cli-factory:teamcity-cli";

function environment(t: TestContext, value?: string): void {
  const previous = process.env.TEAMCITY_TOKEN;
  if (value === undefined) delete process.env.TEAMCITY_TOKEN;
  else process.env.TEAMCITY_TOKEN = value;
  t.after(() => {
    if (previous === undefined) delete process.env.TEAMCITY_TOKEN;
    else process.env.TEAMCITY_TOKEN = previous;
  });
}

test("TeamCity configure validates the environment candidate at the new endpoint before replacing stored auth", async (t) => {
  environment(t, "synthetic-replacement");
  const h = await createTestRuntime(t, {
    profiles: [{ name: "default", url: "https://old.teamcity.test" }, { name: "other", url: "https://other.teamcity.test" }],
    tokens: { default: "synthetic-old", other: "synthetic-other" },
  });
  const cli = h.createCli();
  let calls = 0;
  server.use(http.get("https://new.teamcity.test/app/rest/users/current", async ({ request }) => {
    calls++;
    assert.equal(request.headers.get("authorization"), "Bearer synthetic-replacement");
    assert.equal((await h.profileStore.get()).values.url, "https://old.teamcity.test");
    assert.equal(await h.secretStore.get(service, "default:token"), "synthetic-old");
    return HttpResponse.json({ id: 1, username: "fixture-user" });
  }));
  const result = await cli.execute(["profile", "configure", "default", "--url", "https://new.teamcity.test"]);
  assert.equal(calls, 1);
  assert.equal((result as { authenticated: boolean }).authenticated, true);
  assert.equal((await h.profileStore.get()).values.url, "https://new.teamcity.test");
  assert.equal(await h.secretStore.get(service, "default:token"), "synthetic-replacement");
  assert.equal(await h.secretStore.get(service, "other:token"), "synthetic-other");
  assert.doesNotMatch(JSON.stringify(result), /synthetic-/);
});

test("TeamCity rejected endpoint replacement preserves the original profile and credential", async (t) => {
  environment(t, "synthetic-rejected");
  const h = await createTestRuntime(t, { tokens: { default: "synthetic-old" } });
  const cli = h.createCli();
  server.use(http.get("https://new.teamcity.test/app/rest/users/current", () => new HttpResponse(null, { status: 401 })));
  await assert.rejects(cli.execute(["profile", "configure", "default", "--url", "https://new.teamcity.test"]), /401/);
  assert.equal((await h.profileStore.get()).values.url, "https://teamcity.test");
  assert.equal(await h.secretStore.get(service, "default:token"), "synthetic-old");
});

test("TeamCity guest configuration and guest login refusal never touch credentials or auth HTTP", async (t) => {
  environment(t, "synthetic-unused");
  const h = await createTestRuntime(t, { tokens: {} });
  h.secretStore.get = async () => { assert.fail("Guest configuration read credentials"); };
  h.secretStore.set = async () => { assert.fail("Guest configuration wrote credentials"); };
  h.secretStore.delete = async () => { assert.fail("Guest configuration deleted credentials"); };
  h.runtime.fetch = async () => { assert.fail("Guest configuration reached auth HTTP"); };
  const cli = h.createCli();
  assert.deepEqual(await cli.execute([
    "profile", "configure", "guest", "--url", "https://guest.teamcity.test", "--guest",
  ]), { configured: true, profile: "guest", authenticated: true, identity: null });
  assert.equal((await h.profileStore.get("guest")).values.guest, true);
  await assert.rejects(cli.execute(["auth", "login", "--profile", "guest"]), /does not require authentication/);
});
