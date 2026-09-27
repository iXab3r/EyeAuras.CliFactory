import assert from "node:assert/strict";
import { after, afterEach, before, test } from "node:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createCliFixture } from "@eyeauras/cli-factory/testing";
import { createYouTrackCli } from "../src/cli.js";
import { youTrackUrl } from "../src/client.js";

const server = setupServer();
before(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
after(() => server.close());
const base = "https://example.test:8443/youtrack";
const canonical = base + "/";
const padded = ` \t${base}/// \r\n`;
const environment = { YOUTRACK_TOKEN: " \tfictional.A+b/c== \r\n" };

test("URL normalization preserves context/port and rejects API/page URLs safely", () => {
  for (const value of [base, base + "/", padded]) {
    assert.equal(youTrackUrl(value), canonical);
    assert.equal(youTrackUrl(youTrackUrl(value)), canonical);
  }
  for (const value of [" ", "not-a-url", "https://", "https://example.test?fictional-private", base + "/api/users/me", base + "/issues/DEMO-1", "https://fictional:private@example.test"]) {
    assert.throws(() => youTrackUrl(value), (error: Error) => {
      assert.match(error.message, /base (?:server )?URL|base server URL/);
      assert.doesNotMatch(error.message, /fictional-private|fictional:private/);
      return true;
    });
  }
});

test("profile writes and authentication normalize across CLI, execute, RPC and onboarding", async (t) => {
  const previous = process.env.YOUTRACK_TOKEN;
  process.env.YOUTRACK_TOKEN = environment.YOUTRACK_TOKEN;
  t.after(() => {
    if (previous === undefined) delete process.env.YOUTRACK_TOKEN;
    else process.env.YOUTRACK_TOKEN = previous;
  });
  let requests = 0;
  server.use(http.get(base + "/api/users/me", ({ request }) => {
    requests++;
    assert.equal(request.headers.get("authorization"), "Bearer fictional.A+b/c==");
    return HttpResponse.json({ id: "1-1", login: "fixture-user" });
  }));
  for (const mode of ["cli", "execute", "rpc", "prompt"]) {
    const h = await createCliFixture(t, { applicationId: "youtrack-cli", input: padded });
    const app = h.createApplication(createYouTrackCli);
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
    assert.equal(await h.secretStore.get("ai-cli-factory:youtrack-cli", "default:token"), "fictional.A+b/c==");
    assert.equal(await h.secretStore.get("ai-cli-factory:youtrack-cli", "other:token"), undefined);
    const before = await h.profileStore.list();
    for (const action of ["configure", "create", "set"]) {
      await assert.rejects(app.execute(["profile", action, action === "create" ? "new" : "default", "--url", base + "/api/users/me"]));
    }
    const replies = await h.rpc(app, [["profile", "configure", "--url", "  "], ["profile", "show"]], { environment });
    assert.ok((replies[0] as { error: unknown }).error);
    assert.equal((replies[1] as { result: { values: { url: string } } }).result.values.url, canonical);
    assert.deepEqual(await h.profileStore.list(), before);
    assert.equal(await h.secretStore.get("ai-cli-factory:youtrack-cli", "default:token"), "fictional.A+b/c==");
  }
  assert.equal(requests, 8);
});
