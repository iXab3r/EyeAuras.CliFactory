import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createCli } from "@eyeauras/cli-factory";
import { createCliFixture } from "@eyeauras/cli-factory/testing";
import { createRandomRestDefinition } from "../src/cli.js";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

test("HTTPS origin ports round-trip through profile mutations, output and reload", async (t) => {
  for (const port of ["", ":443", ":80", ":8111", ":8443"]) {
    for (const mode of ["cli", "execute", "rpc"]) {
      const url = "https://example.test" + port;
      const h = await createCliFixture(t, { applicationId: "random-rest-cli" });
      const app = h.createApplication(runtime => createCli(createRandomRestDefinition(runtime)));
      const invoke = async (argv: string[]) => {
        if (mode === "execute") return app.execute(argv);
        if (mode === "rpc") {
          const reply = (await h.rpc(app, [argv]))[0] as { error?: unknown };
          assert.equal(reply.error, undefined);
        } else await h.json(app, argv);
      };
      await invoke(["profile", "configure", "--url", url, "--contact", "operator@example.test"]);
      await invoke(["profile", "create", "other", "--url", url]);
      assert.equal((await h.profileStore.get("other")).values.url, url);
      await invoke(["profile", "set", "other", "--url", "https://other.test:443"]);
      assert.equal((await h.profileStore.get("other")).values.url, "https://other.test:443");
      assert.equal((await h.profileStore.get()).values.url, url);
      await invoke(["profile", "set", "other", "--url", url]);
      assert.equal((await h.profileStore.get("other")).values.url, url);
      assert.equal((await h.profileStore.get()).values.url, url);
      await app.dispose();
      const fresh = h.createApplication(runtime => createCli(createRandomRestDefinition(runtime)));
      const shown = await h.json(fresh, ["profile", "show"]) as { values: { url: string } };
      assert.equal(shown.values.url, url);
      const human = await h.run(fresh, ["profile", "show"]);
      assert.equal(human.exitCode, 0, human.stderr);
      assert.ok(human.stdout.includes(url));
      const reply = (await h.rpc(fresh, [["profile", "show", "other"]]))[0] as { result: { values: { url: string } } };
      assert.equal(reply.result.values.url, url);
      for (const unsupported of ["http://example.test:80", "https://example.test/context"]) {
        await assert.rejects(fresh.execute(["profile", "set", "default", "--url", unsupported]), /HTTPS/);
      }
      assert.equal((await h.profileStore.get()).values.url, url);
    }
  }
});

test("HTTP requests use the effective configured endpoint without saving redirect targets", async (t) => {
  const server = setupServer();
  server.listen({ onUnhandledRequest: "error" });
  t.after(() => server.close());
  for (const port of ["", ":443", ":80", ":8111", ":8443"]) {
    const configured = "https://example.test" + port;
    const requests: string[] = [];
    server.use(
      http.get(new URL("/quota/", configured).href, ({ request }) => {
        requests.push(request.url);
        return HttpResponse.redirect("https://redirected.test/quota/", 302);
      }),
      http.get("https://redirected.test/quota/", ({ request }) => {
        requests.push(request.url);
        return HttpResponse.text("-1");
      }),
    );
    const h = await createCliFixture(t, { applicationId: "random-rest-cli", profiles: [
      { name: "default", values: { url: configured, contact: "operator@example.test" } },
    ] });
    const app = h.createApplication(runtime => createCli(createRandomRestDefinition(runtime)));
    const file = join(h.appArguments.RoamingAppDataDirectory, "profiles.json");
    const before = await readFile(file, "utf8");
    await assert.rejects(app.execute(["integers"]), /quota is exhausted/);
    assert.equal(requests.length, 2);
    assert.equal(new URL(requests[0]!).origin, new URL(configured).origin);
    assert.equal(new URL(requests[0]!).pathname, "/quota/");
    assert.equal(new URL(requests[1]!).origin, "https://redirected.test");
    assert.equal(await readFile(file, "utf8"), before);
    server.resetHandlers();
  }
});
