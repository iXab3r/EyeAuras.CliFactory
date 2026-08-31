import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  AppArguments,
  MemorySecretStore,
  createCli,
} from "@eyeauras/cli-factory";
import { BrowserRuntime } from "@eyeauras/cli-factory-playwright";
import { liveCases } from "@eyeauras/random-common";
import { createRandomPwDefinition } from "../src/cli.js";
import { site, type SiteState } from "./fixture.js";

async function fixture(t: test.TestContext) {
  const root = await mkdtemp(join(tmpdir(), "random-browser-"));
  const appArguments = new AppArguments({
    AppName: "random-pw-cli",
    Environment: {
      EnvironmentAppData: root,
      EnvironmentLocalAppData: root,
      AppDomainDirectory: root,
      ApplicationExecutablePath: join(root, "fixture.js"),
      ProcessId: process.pid,
    },
  });
  const state: SiteState = { quota: 1000, requests: [], submits: 0 };
  const browser = new BrowserRuntime({ prepareContext: site(state) });
  const app = createCli(
    createRandomPwDefinition(
      { appArguments, secretStore: new MemorySecretStore() },
      browser,
    ),
  );
  t.after(async () => {
    await app.dispose();
    await rm(root, { recursive: true, force: true });
  });
  await app.execute([
    "profile",
    "configure",
    "default",
    "--contact",
    "operator@example.com",
  ]);
  return { app, browser, state };
}
test("the complete shared contract runs through real Chromium forms with one warm browser", async (t) => {
  const { app, browser, state } = await fixture(t);
  for (const item of liveCases) {
    const data = (await app.execute(item.argv)) as { values: number[] };
    assert.equal(data.values.length, item.count);
    assert.ok(
      data.values.every(
        (value) =>
          Number.isInteger(value) && value >= item.min && value <= item.max,
      ),
    );
    if (item.unique) assert.equal(new Set(data.values).size, item.count);
  }
  assert.equal(state.submits, 4);
  assert.equal(browser.diagnostics.launches, 1);
  assert.equal(browser.diagnostics.pages, 0);
  assert.equal(state.requests.filter((path) => path === "/quota/").length, 4);
});
test("validation and permission denial do not start a browser", async (t) => {
  const { app, browser, state } = await fixture(t);
  await assert.rejects(
    app.execute(["integers", "--count", "101", "--headed", "--record-video"]),
    /between 1 and 100/,
  );
  await assert.rejects(
    app.execute(["sequence", "--min", "0", "--max", "0"]),
    /less than/,
  );
  await app.execute(["permissions", "revoke", "ReadOnly"]);
  await assert.rejects(
    app.execute(["integers", "--headed", "--record-video"]),
    /ReadOnly/,
  );
  assert.equal(browser.diagnostics.launches, 0);
  assert.equal(state.requests.length, 0);
});
test("negative quota is remembered across commands without generation or repeated polling", async (t) => {
  const { app, state } = await fixture(t);
  state.quota = -1;
  await assert.rejects(app.execute(["integers"]), /quota is exhausted/);
  await assert.rejects(
    app.execute(["sequence", "--headed", "--record-video"]),
    /quota is exhausted/,
  );
  assert.equal(state.submits, 0);
  assert.deepEqual(state.requests, ["/quota/"]);
});
test("resource registration invalidates changed profiles and owns final browser cleanup", async (t) => {
  const { app, browser } = await fixture(t);
  await app.execute(["integers"]);
  assert.equal(browser.diagnostics.contexts, 1);
  await app.execute([
    "profile",
    "set",
    "default",
    "--contact",
    "changed@example.com",
  ]);
  assert.equal(browser.diagnostics.contexts, 0);
  await app.execute(["integers"]);
  assert.equal(browser.diagnostics.launches, 1);
  await app.dispose();
  assert.equal(browser.diagnostics.contexts, 0);
  assert.equal(browser.diagnostics.pages, 0);
});

test("invalid DOM values, duplicate sequences and HTTP errors are bounded sanitized failures with no replay", async (t) => {
  const { app, state, browser } = await fixture(t);
  for (const mode of ["bad", "duplicate", "http-error"] as const) {
    state.mode = mode;
    await assert.rejects(
      app.execute(["sequence"]),
      (error) =>
        error instanceof Error &&
        !error.message.includes("synthetic-private-marker"),
    );
  }
  assert.equal(state.submits, 3);
  assert.equal(browser.diagnostics.pages, 0);
});
