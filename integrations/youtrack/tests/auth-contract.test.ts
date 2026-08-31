import assert from "node:assert/strict";
import { after, afterEach, before, test, type TestContext } from "node:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { fixture } from "./cli-fixture.js";

const server = setupServer();
before(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
after(() => server.close());
const service = "ai-cli-factory:youtrack-cli";

function environment(t: TestContext, value?: string): void {
  const previous = process.env.YOUTRACK_TOKEN;
  if (value === undefined) delete process.env.YOUTRACK_TOKEN;
  else process.env.YOUTRACK_TOKEN = value;
  t.after(() => {
    if (previous === undefined) delete process.env.YOUTRACK_TOKEN;
    else process.env.YOUTRACK_TOKEN = previous;
  });
}

test("YouTrack configure replaces stored credentials only after validating the environment candidate and new endpoint", async (t) => {
  environment(t, "synthetic-replacement");
  const f = await fixture(t);
  await f.cli.execute(["profile", "create", "dev", "--url", "https://old.youtrack.test/track"]);
  await f.cli.execute(["profile", "create", "other", "--url", "https://other.youtrack.test/track"]);
  await f.secrets.set(service, "dev:token", "synthetic-old");
  await f.secrets.set(service, "other:token", "synthetic-other");
  let calls = 0;
  server.use(http.get("https://new.youtrack.test/track/api/users/me", async ({ request }) => {
    calls++;
    assert.equal(request.headers.get("authorization"), "Bearer synthetic-replacement");
    assert.equal((await f.cli.execute(["profile", "show", "dev"]) as { values: { url: string } }).values.url,
      "https://old.youtrack.test/track");
    assert.equal(await f.secrets.get(service, "dev:token"), "synthetic-old");
    return HttpResponse.json({ id: "1-1", login: "fixture-user" });
  }));
  assert.equal(await f.cli.run([
    "profile", "configure", "dev", "--url", "https://new.youtrack.test/track", "--json",
  ]), 0);
  assert.equal(calls, 1);
  assert.equal(await f.secrets.get(service, "dev:token"), "synthetic-replacement");
  assert.equal(await f.secrets.get(service, "other:token"), "synthetic-other");
  assert.doesNotMatch(f.stdout() + f.stderr(), /synthetic-/);
});

test("YouTrack denied replacement preserves the endpoint and does not create a new failed profile", async (t) => {
  environment(t, "synthetic-rejected");
  const f = await fixture(t);
  await f.cli.execute(["profile", "create", "dev", "--url", "https://old.youtrack.test"]);
  await f.secrets.set(service, "dev:token", "synthetic-old");
  server.use(http.get("https://new.youtrack.test/api/users/me", () =>
    new HttpResponse("synthetic-rejected private-response", { status: 403 })));
  for (const name of ["dev", "new-profile"]) {
    await assert.rejects(f.cli.execute([
      "profile", "configure", name, "--url", "https://new.youtrack.test",
    ]), (error: Error) => {
      assert.match(error.message, /HTTP 403/);
      assert.doesNotMatch(error.message, /synthetic-|private-response/);
      return true;
    });
  }
  assert.equal((await f.cli.execute(["profile", "show", "dev"]) as { values: { url: string } }).values.url,
    "https://old.youtrack.test");
  await assert.rejects(f.cli.execute(["profile", "show", "new-profile"]), /does not exist/);
  assert.equal(await f.secrets.get(service, "dev:token"), "synthetic-old");
  assert.equal(await f.secrets.get(service, "new-profile:token"), undefined);
});

test("YouTrack failed credential persistence leaves changed endpoint unauthenticated and stops subsequent reads", async (t) => {
  environment(t, "synthetic-candidate");
  const f = await fixture(t);
  await f.cli.execute(["profile", "create", "dev", "--url", "https://old.youtrack.test"]);
  await f.secrets.set(service, "dev:token", "synthetic-old");
  let calls = 0;
  server.use(http.get("https://new.youtrack.test/api/users/me", () => {
    calls++;
    return HttpResponse.json({ id: "1-1", login: "fixture-user" });
  }));
  f.secrets.set = async () => { throw new Error("OS credential store unavailable."); };
  await assert.rejects(f.cli.execute([
    "profile", "configure", "dev", "--url", "https://new.youtrack.test",
  ]), /profile configure dev --token-stdin/);
  assert.equal(await f.secrets.get(service, "dev:token"), undefined);
  await assert.rejects(f.cli.execute(["user", "me", "--profile", "dev"]), /authentication is missing/);
  assert.equal(calls, 1);
});
