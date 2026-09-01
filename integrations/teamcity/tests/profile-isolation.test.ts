import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { after, afterEach, before, test, type TestContext } from "node:test";
import { createCliFixture } from "@eyeauras/cli-factory/testing";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createTeamCityCli } from "../src/cli.js";

async function fixture(t: TestContext, input = "") {
  const shared = await createCliFixture(t, { applicationId: "teamcity-cli", input });
  return { ...shared, cli: shared.createApplication(createTeamCityCli), secrets: shared.secretStore };
}

const server = setupServer();
before(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
after(() => server.close());
const service = "ai-cli-factory:teamcity-cli";

test("TeamCity create and configure reject case collisions before authentication, then accept a distinct profile", async (t) => {
  const previous = process.env.TEAMCITY_TOKEN;
  delete process.env.TEAMCITY_TOKEN;
  t.after(() => {
    if (previous === undefined) delete process.env.TEAMCITY_TOKEN;
    else process.env.TEAMCITY_TOKEN = previous;
  });
  const f = await fixture(t, "synthetic-candidate\n");
  const url = "https://teamcity.example.com";
  await f.cli.execute(["profile", "create", "Fixture", "--url", url]);
  await f.cli.execute(["profile", "set-default", "Fixture"]);
  await f.cli.execute(["permissions", "grant", "Update", "--profile", "Fixture"]);
  await f.secrets.set(service, "Fixture:token", "synthetic-original");
  const directory = f.appArguments.WithProfile("Fixture").AppDataDirectory;
  await mkdir(directory, { recursive: true });
  const sentinel = join(directory, "sentinel.txt");
  await writeFile(sentinel, "fixture-data");
  const index = join(f.appArguments.RoamingAppDataDirectory, "profiles.json");
  const before = await readFile(index);
  const original = {
    get: f.secrets.get.bind(f.secrets), set: f.secrets.set.bind(f.secrets), delete: f.secrets.delete.bind(f.secrets),
  };
  let secretCalls = 0;
  const unexpectedSecret = async () => { secretCalls++; throw new Error("Unexpected credential access"); };
  Object.assign(f.secrets, { get: unexpectedSecret, set: unexpectedSecret, delete: unexpectedSecret });
  let prompts = 0;
  assert.ok(f.runtime.input && f.runtime.output && f.runtime.error);
  Object.assign(f.runtime.input, { isTTY: true, setRawMode() { prompts++; throw new Error("Unexpected prompt"); } });
  Object.assign(f.runtime.output, { isTTY: true });
  Object.assign(f.runtime.error, { isTTY: true });
  let calls = 0;
  server.use(http.get(`${url}/app/rest/users/current`, ({ request }) => {
    calls++;
    assert.equal(request.headers.get("authorization"), "Bearer synthetic-candidate");
    return HttpResponse.json({ id: 1, username: "fixture-user" });
  }));
  for (const action of ["create", "configure"]) {
    assert.equal(await f.cli.run(["profile", action, "fixture", "--url", url]), 1);
    assert.deepEqual(await readFile(index), before);
    assert.equal(await readFile(sentinel, "utf8"), "fixture-data");
  }
  assert.match(f.stderr(), /ignoring letter case/);
  assert.doesNotMatch(f.stderr(), /synthetic-|https:|Token:/);
  assert.equal(secretCalls, 0);
  assert.equal(prompts, 0);
  assert.equal(calls, 0);
  Object.assign(f.secrets, original);
  assert.equal(await f.cli.run([
    "profile", "configure", "Other", "--url", url, "--token-stdin", "--json",
  ]), 0);
  assert.equal(calls, 1);
  assert.equal(await f.secrets.get(service, "Other:token"), "synthetic-candidate");
  assert.equal(await f.secrets.get(service, "Fixture:token"), "synthetic-original");
  const retained = await f.cli.execute(["profile", "show", "Fixture"]) as { name: string; values: { url: string } };
  assert.equal(retained.name, "Fixture");
  assert.equal(retained.values.url, url);
  await assert.rejects(f.cli.execute(["profile", "show", "fixture"]), /does not exist/);
  await f.cli.execute(["profile", "delete", "Other"]);
  assert.equal(await f.secrets.get(service, "Other:token"), undefined);
  assert.equal(await readFile(sentinel, "utf8"), "fixture-data");
});

test("TeamCity delete fails closed on legacy case collisions without changing files or credentials", async (t) => {
  const f = await fixture(t);
  const index = join(f.appArguments.RoamingAppDataDirectory, "profiles.json");
  const document = JSON.stringify({
    version: 1, active: "default",
    profiles: {
      default: { url: "https://default.example.com" },
      Fixture: { url: "https://upper.example.com" },
      fixture: { url: "https://lower.example.com" },
    },
    permissions: { Fixture: ["ReadOnly", "Update"], fixture: ["ReadOnly"] },
  }, null, 2) + "\n";
  const sentinels = [];
  for (const [name, basename] of [["Fixture", "upper.txt"], ["fixture", "lower.txt"]]) {
    const directory = f.appArguments.WithProfile(name!).AppDataDirectory;
    await mkdir(directory, { recursive: true });
    const path = join(directory, basename!);
    await writeFile(path, `fixture-${name}`);
    sentinels.push({ path, value: `fixture-${name}` });
    await f.secrets.set(service, `${name}:token`, `synthetic-${name}`);
  }
  await writeFile(index, document);
  const bytes = await readFile(index);
  const get = f.secrets.get.bind(f.secrets);
  let secretCalls = 0;
  const unexpectedSecret = async () => { secretCalls++; throw new Error("Unexpected credential access"); };
  Object.assign(f.secrets, { get: unexpectedSecret, set: unexpectedSecret, delete: unexpectedSecret });
  let calls = 0;
  server.use(http.all("*", () => { calls++; return new HttpResponse(null, { status: 500 }); }));
  for (const name of ["Fixture", "fixture"]) {
    assert.equal(await f.cli.run(["profile", "delete", name, "--json"]), 1);
    assert.deepEqual(await readFile(index), bytes);
    for (const sentinel of sentinels) assert.equal(await readFile(sentinel.path, "utf8"), sentinel.value);
  }
  assert.match(f.stderr(), /differ only by letter case/);
  assert.match(f.stderr(), /Back up.*manually.*reconfigure/);
  assert.doesNotMatch(f.stderr(), /synthetic-|https:/);
  assert.equal(f.stdout(), "");
  assert.equal(secretCalls, 0);
  assert.equal(calls, 0);
  assert.equal(await get(service, "Fixture:token"), "synthetic-Fixture");
  assert.equal(await get(service, "fixture:token"), "synthetic-fixture");
});
