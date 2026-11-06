import assert from "node:assert/strict";
import test from "node:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createTestRuntime } from "./support.js";

const server = setupServer();
test.before(() => server.listen({ onUnhandledRequest: "error" }));
test.afterEach(() => server.resetHandlers());
test.after(() => server.close());

test("native job copy is Credentials-gated and never returns protected settings", async (t) => {
  const runtime = await createTestRuntime(t);
  const cli = runtime.createCli();
  const copy = ["jobs", "copy", "Source", "Copied", "--name", "Copied job", "--project", "Destination"];
  await cli.execute(["permissions", "grant", "Update"]);
  await assert.rejects(cli.execute(copy), /Credentials/);
  await cli.execute(["permissions", "grant", "Credentials"]);
  server.use(http.post("https://teamcity.test/app/rest/projects/id:Destination/buildTypes", async ({ request }) => {
    assert.deepEqual(await request.json(), { id: "Copied", name: "Copied job",
      sourceBuildType: { id: "Source" }, copyAllAssociatedSettings: true });
    return HttpResponse.json({ id: "Copied", name: "Copied job", projectId: "Destination",
      parameters: { property: [{ name: "npm.token", value: "synthetic-not-for-output" }] } });
  }));
  assert.deepEqual(await cli.execute(copy), { id: "Copied", name: "Copied job", projectId: "Destination" });
});

test("masked build resolutions are not stored as usable input credentials", async (t) => {
  const runtime = await createTestRuntime(t);
  const cli = runtime.createCli();
  await cli.execute(["permissions", "grant", "Credentials"]);
  server.use(http.get("https://teamcity.test/app/rest/builds/id:123/resolved/%25npm.token%25",
    () => HttpResponse.text("******")));
  await assert.rejects(cli.execute(["builds", "resolve-parameter", "123", "npm.token", "--store-as", "masked"]), /unresolved/);
  assert.equal(await runtime.secretStore.get("ai-cli-factory:teamcity-cli", "default:input-secret:masked"), undefined);
});
