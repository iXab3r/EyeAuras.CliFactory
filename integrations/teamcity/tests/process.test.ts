import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const executable = fileURLToPath(new URL("../src/bin.js", import.meta.url));

test("the packaged CLI process separates help, JSON-RPC and errors without profiles", () => {
  const run = (argv: readonly string[], input?: string) =>
    spawnSync(process.execPath, [executable, ...argv], {
      encoding: "utf8",
      ...(input === undefined ? {} : { input }),
    });

  const root = run([]);
  assert.equal(root.status, 0, root.stderr);
  assert.match(root.stdout, /Usage: teamcity-cli/);
  assert.match(root.stdout, /projects/);
  assert.equal(root.stderr, "");

  const profileHelp = run(["profile", "--help"]);
  assert.equal(profileHelp.status, 0, profileHelp.stderr);
  for (const command of ["create", "set", "set-default", "delete"]) {
    assert.match(profileHelp.stdout, new RegExp(`\\b${command}\\b`));
  }
  assert.equal(profileHelp.stderr, "");

  const permissionHelp = run(["jobs", "run", "--help"]);
  assert.equal(permissionHelp.status, 0, permissionHelp.stderr);
  assert.match(permissionHelp.stdout, /Required permission: Update/);
  assert.equal(permissionHelp.stderr, "");

  // Help exercises the real protocol without reading the operator's profiles/permissions.
  // JSON profile/permission behavior is covered by injected fixtures and test:packages.
  const json = run(["--json-rpc"], JSON.stringify({
    jsonrpc: "2.0", id: 1, method: "cli.execute", params: { argv: ["--help"] },
  }) + "\n");
  assert.equal(json.status, 0, json.stderr);
  const frame = JSON.parse(json.stdout);
  assert.equal(frame.jsonrpc, "2.0");
  assert.equal(frame.id, 1);
  assert.match(frame.result.help, /Usage: teamcity-cli/);
  assert.equal(json.stderr, "");

  const invalid = run(["builds", "list", "--limit", "0"]);
  assert.equal(invalid.status, 1);
  assert.equal(invalid.stdout, "");
  assert.match(invalid.stderr, /positive/);
});
