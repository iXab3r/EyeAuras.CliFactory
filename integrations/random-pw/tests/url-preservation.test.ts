import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createCli } from "@eyeauras/cli-factory";
import { createCliFixture } from "@eyeauras/cli-factory/testing";
import { createRandomPwDefinition } from "../src/cli.js";
import { BrowserRuntime } from "@eyeauras/cli-factory-playwright";

test("HTTPS origin ports round-trip through profile mutations, output and reload", async (t) => {
  for (const port of ["", ":443", ":80", ":8111", ":8443"]) {
    for (const mode of ["cli", "execute", "rpc"]) {
      const url = "https://example.test" + port;
      const h = await createCliFixture(t, { applicationId: "random-pw-cli" });
      const app = h.createApplication(runtime => createCli(createRandomPwDefinition(runtime)));
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
      const fresh = h.createApplication(runtime => createCli(createRandomPwDefinition(runtime)));
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

test("real Chromium uses the effective configured endpoint without saving redirect targets", async (t) => {
  // Chromium follows a fulfilled HTTP redirect outside Playwright routing. Keep its destination local.
  const server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/html" });
    response.end("<p>Current allowance: -1 bits</p>");
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const destination = "http://127.0.0.1:" + address.port + "/quota/";
  for (const port of [":443", ":8443"]) {
    const configured = "https://example.test" + port;
    const requests: string[] = [];
    const browser = new BrowserRuntime({ prepareContext: async context => {
      context.on("request", request => requests.push(request.url()));
      await context.route("**/*", async route => {
        const url = new URL(route.request().url());
        if (url.origin === new URL(configured).origin && url.pathname === "/quota/") {
          await route.fulfill({ status: 302, headers: { location: destination } });
        } else await route.abort();
      });
    } });
    const h = await createCliFixture(t, { applicationId: "random-pw-cli", profiles: [
      { name: "default", values: { url: configured, contact: "operator@example.test" } },
    ] });
    const app = h.createApplication(runtime => createCli(createRandomPwDefinition(runtime, browser)));
    const file = join(h.appArguments.RoamingAppDataDirectory, "profiles.json");
    const before = await readFile(file, "utf8");
    await assert.rejects(app.execute(["integers"]), /quota is exhausted/);
    assert.deepEqual(requests, [new URL("/quota/", configured).href, destination]);
    assert.equal(await readFile(file, "utf8"), before);
    await app.dispose();
    const fresh = h.createApplication(runtime => createCli(createRandomPwDefinition(runtime)));
    const shown = await h.json(fresh, ["profile", "show"]) as { values: { url: string } };
    assert.equal(shown.values.url, configured);
  }
});
