import assert from "node:assert/strict";
import { after, afterEach, before, test } from "node:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createCliFixture } from "@eyeauras/cli-factory/testing";
import { createTeamCityCli } from "../src/cli.js";
import { teamCityUrl } from "../src/server-url.js";

const server = setupServer();
before(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
after(() => server.close());
const base = "https://example.test:8443/teamcity";
const canonical = base + "";
const padded = ` \t${base}/// \r\n`;
const environment = { TEAMCITY_TOKEN: " \tfictional.A+b/c== \r\n" };

test("URL normalization preserves context/port and rejects API/page URLs safely", () => {
  for (const value of [base, base + "/", padded]) {
    assert.equal(teamCityUrl(value), canonical);
    assert.equal(teamCityUrl(teamCityUrl(value)), canonical);
  }
  for (const value of [" ", "not-a-url", "https://", "https://example.test?fictional-private", base + "/app/rest/users/current", base + "/viewLog.html", "https://fictional:private@example.test"]) {
    assert.throws(() => teamCityUrl(value), (error: Error) => {
      assert.match(error.message, /base (?:server )?URL|base server URL/);
      assert.doesNotMatch(error.message, /fictional-private|fictional:private/);
      return true;
    });
  }
});

test("profile writes and authentication normalize across CLI, execute, RPC and onboarding", async (t) => {
  const previous = process.env.TEAMCITY_TOKEN;
  process.env.TEAMCITY_TOKEN = environment.TEAMCITY_TOKEN;
  t.after(() => {
    if (previous === undefined) delete process.env.TEAMCITY_TOKEN;
    else process.env.TEAMCITY_TOKEN = previous;
  });
  let requests = 0;
  server.use(http.get(base + "/app/rest/users/current", ({ request }) => {
    requests++;
    assert.equal(request.headers.get("authorization"), "Bearer fictional.A+b/c==");
    return HttpResponse.json({ id: 1, username: "fixture-user" });
  }));
  for (const mode of ["cli", "execute", "rpc", "prompt"]) {
    const h = await createCliFixture(t, { applicationId: "teamcity-cli", input: padded });
    const app = h.createApplication(createTeamCityCli);
    const invoke = async (argv: string[]) => {
      if (mode === "execute") return app.execute(argv);
      if (mode === "rpc") {
        const reply = (await h.rpc(app, [argv], { environment }))[0] as { error?: unknown };
        assert.equal(reply.error, undefined);
        return;
      }
      const result = await h.run(app, [...argv, "--json"], { environment });
      assert.equal(result.exitCode, 0, result.stderr);
      assert.doesNotMatch(result.stdout + result.stderr, /fictional\.A/);
    };
    if (mode === "prompt") {
      Object.assign(h.runtime.input, { isTTY: true });
      Object.assign(h.runtime.output, { isTTY: true });
      Object.assign(h.runtime.error, { isTTY: true });
      // Root onboarding takes the URL from a TTY and the token from the invocation environment.
      assert.equal(await app.run([], { environment }), 0, h.stderr());
      assert.match(h.stderr(), /including any context path/);
    } else await invoke(["profile", "configure", "--url", padded]);
    assert.equal((await h.profileStore.get()).values.url, canonical);
    await invoke(["auth", "login"]);
    await invoke(["profile", "create", "other", "--url", padded]);
    await invoke(["profile", "set", "other", "--url", padded]);
    assert.equal((await h.profileStore.get("other")).values.url, canonical);
    assert.equal(await h.secretStore.get("ai-cli-factory:teamcity-cli", "default:token"), "fictional.A+b/c==");
    assert.equal(await h.secretStore.get("ai-cli-factory:teamcity-cli", "other:token"), undefined);
    const before = await h.profileStore.list();
    for (const action of ["configure", "create", "set"]) {
      await assert.rejects(app.execute(["profile", action, action === "create" ? "new" : "default", "--url", base + "/app/rest/users/current"]));
    }
    const replies = await h.rpc(app, [["profile", "configure", "--url", "  "], ["profile", "show"]], { environment });
    assert.ok((replies[0] as { error: unknown }).error);
    assert.equal((replies[1] as { result: { values: { url: string } } }).result.values.url, canonical);
    assert.deepEqual(await h.profileStore.list(), before);
    assert.equal(await h.secretStore.get("ai-cli-factory:teamcity-cli", "default:token"), "fictional.A+b/c==");
  }
  assert.equal(requests, 8);
});
