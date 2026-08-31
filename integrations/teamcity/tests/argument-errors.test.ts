import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";
import { AppArguments } from "@eyeauras/cli-factory";
import { createTeamCityCli } from "../src/cli.js";
import { createTestRuntime } from "./support.js";

test("missing nested TeamCity argument returns RPC error without ending the session", async (testContext) => {
  const input = [
    ["jobs", "show"],
    ["jobs", "show", "--help"],
  ].map((argv, index) => JSON.stringify({
    jsonrpc: "2.0", id: index + 1, method: "cli.execute", params: { argv },
  })).join("\n") + "\n";
  const runtime = await createTestRuntime(testContext, {
    profiles: [{ name: "default", url: "https://teamcity.test", guest: true }],
    tokens: {},
    input,
  });
  runtime.runtime.appArguments = new AppArguments({
    AppName: "teamcity-cli",
    Profile: "default",
    Environment: {
      AppDomainDirectory: join("synthetic", "app"),
      ApplicationExecutablePath: join("synthetic", "app", "teamcity-cli.js"),
      EnvironmentLocalAppData: join("synthetic", "local"),
      EnvironmentAppData: join("synthetic", "roaming"),
      ProcessId: 42,
    },
  });
  let fetchCalls = 0;
  runtime.runtime.fetch = async () => {
    fetchCalls++;
    assert.fail("Argument errors and help must not call TeamCity.");
  };

  assert.equal(await createTeamCityCli(runtime.runtime).run(["--json-rpc"]), 0);
  const frames = runtime.stdout().trim().split("\n").map((line) => JSON.parse(line));
  assert.equal(frames.length, 2);
  assert.equal(frames[0].jsonrpc, "2.0");
  assert.equal(frames[0].id, 1);
  assert.equal(frames[0].error.code, -32000);
  assert.match(frames[0].error.message, /missing required argument 'id'/);
  assert.equal(frames[1].jsonrpc, "2.0");
  assert.equal(frames[1].id, 2);
  assert.match(frames[1].result.help, /Usage: teamcity-cli jobs show/);
  assert.equal(runtime.stderr(), "");
  assert.equal(fetchCalls, 0);
});
