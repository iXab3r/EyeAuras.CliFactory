import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
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
for (const endpoint of ["http://example.test", "https://example.test", "http://example.test:80", "https://example.test:443", "http://example.test:443", "https://example.test:80", "http://example.test:8111", "https://example.test:8443"]) {
  const base = endpoint + "/teamcity";
  const canonical = base;
  const padded = ` \t${base}/// \r\n`;
  const environment = { TEAMCITY_TOKEN: " \tfictional.A+b/c== \r\n" };

  test(endpoint + " normalization preserves context/port and rejects API/page URLs safely", () => {
    for (const value of [base, base + "/", padded]) {
      assert.equal(teamCityUrl(value), canonical);
      assert.equal(teamCityUrl(teamCityUrl(value)), canonical);
    }
    for (const value of [" ", "not-a-url", "https://", "https://example.test?fictional-private", base + "/app/rest/users/current", base + "/viewLog.html", "https://fictional:private@example.test"]) {
      assert.throws(() => teamCityUrl(value), (error: Error) => {
        assert.match(error.message, /TeamCity URL must be http\(s\):\/\/host/);
        assert.doesNotMatch(error.message, /fictional-private|fictional:private/);
        return true;
      });
    }
  });

  test(endpoint + " profile writes and authentication normalize across CLI, execute, RPC and onboarding", async (t) => {
    const previous = process.env.TEAMCITY_TOKEN;
    process.env.TEAMCITY_TOKEN = environment.TEAMCITY_TOKEN;
    t.after(() => {
      if (previous === undefined) delete process.env.TEAMCITY_TOKEN;
      else process.env.TEAMCITY_TOKEN = previous;
    });
    let requests = 0;
    server.use(http.get(new URL(base + "/app/rest/users/current").href, ({ request }) => {
      assert.equal(new URL(request.url).origin, new URL(base).origin);
      assert.equal(new URL(request.url).pathname, "/teamcity/app/rest/users/current");
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
        assert.match(h.stderr(), /TeamCity server URL, such as/);
      } else await invoke(["profile", "configure", "--url", padded]);
      assert.equal((await h.profileStore.get()).values.url, canonical);
      await invoke(["auth", "login"]);
      await invoke(["profile", "create", "other", "--url", padded]);
      assert.equal((await h.profileStore.get("other")).values.url, canonical);
      await invoke(["profile", "set", "other", "--url", "https://other.test:443/isolated"]);
      assert.equal((await h.profileStore.get("other")).values.url, "https://other.test:443/isolated");
      assert.equal((await h.profileStore.get()).values.url, canonical);
      await invoke(["profile", "set", "other", "--url", padded]);
      assert.equal((await h.profileStore.get("other")).values.url, canonical);
      assert.equal(await h.secretStore.get("ai-cli-factory:teamcity-cli", "default:token"), "fictional.A+b/c==");
      assert.equal(await h.secretStore.get("ai-cli-factory:teamcity-cli", "other:token"), undefined);
      await app.dispose();
      const reloaded = h.createApplication(createTeamCityCli);
      const shown = await h.json(reloaded, ["profile", "show"]) as { values: { url: string } };
      assert.equal(shown.values.url, canonical);
      const human = await h.run(reloaded, ["profile", "show"]);
      assert.equal(human.exitCode, 0, human.stderr);
      assert.ok(human.stdout.includes(canonical));
      const before = await h.profileStore.list();
      for (const action of ["configure", "create", "set"]) {
        await assert.rejects(reloaded.execute(["profile", action, action === "create" ? "new" : "default", "--url", base + "/app/rest/users/current"]));
      }
      const replies = await h.rpc(reloaded, [["profile", "configure", "--url", "  "], ["profile", "show"]], { environment });
      assert.ok((replies[0] as { error: unknown }).error);
      assert.equal((replies[1] as { result: { values: { url: string } } }).result.values.url, canonical);
      assert.deepEqual(await h.profileStore.list(), before);
      assert.equal(await h.secretStore.get("ai-cli-factory:teamcity-cli", "default:token"), "fictional.A+b/c==");
    }
    assert.equal(requests, 8);
  });
}

test("redirect destinations never rewrite existing configured URLs", async (t) => {
  const configured = "http://example.test:80/teamcity";
  const first = "http://example.test/teamcity/app/rest/users/current";
  const destination = "https://example.test:8443/redirected/app/rest/users/current";
  const requests: string[] = [];
  server.use(
    http.get(first, ({ request }) => {
      requests.push(request.url);
      return HttpResponse.redirect(destination, 302);
    }),
    http.get(destination, ({ request }) => {
      requests.push(request.url);
      return HttpResponse.json({ id: 1, username: "fixture-user" });
    }),
  );
  const h = await createCliFixture(t, {
    applicationId: "teamcity-cli",
    profiles: [{ name: "default", values: { url: configured }, secrets: { token: "synthetic-test-token" } }],
  });
  const file = join(h.appArguments.RoamingAppDataDirectory, "profiles.json");
  const before = await readFile(file, "utf8");
  const app = h.createApplication(createTeamCityCli);
  await h.json(app, ["auth", "status"]);
  assert.equal(requests.length, 2);
  assert.equal(new URL(requests[0]!).origin, new URL(configured).origin);
  assert.equal(new URL(requests[0]!).pathname, new URL(first).pathname);
  assert.equal(new URL(requests[1]!).origin, new URL(destination).origin);
  assert.equal(await readFile(file, "utf8"), before);
  await app.dispose();
  const reloaded = h.createApplication(createTeamCityCli);
  const shown = await h.json(reloaded, ["profile", "show"]) as { values: { url: string } };
  assert.equal(shown.values.url, configured);
  assert.equal(await readFile(file, "utf8"), before);
});
