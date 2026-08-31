import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const executable = fileURLToPath(new URL("../src/bin.js", import.meta.url));

test("the packaged CLI process separates help, JSON output, and errors", async (context) => {
  const configRoot = await mkdtemp(join(tmpdir(), "teamcity-cli-process-"));
  context.after(() => rm(configRoot, { recursive: true, force: true }));

  const run = (argv: readonly string[]) =>
    spawnSync(process.execPath, [executable, ...argv], {
      encoding: "utf8",
      env: { ...process.env, CLI_FACTORY_HOME: configRoot },
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

  const json = run(["permissions", "list", "--json"]);
  assert.equal(json.status, 0, json.stderr);
  assert.deepEqual(JSON.parse(json.stdout), [
    {
      name: "ReadOnly",
      enabled: true,
      description: "Read remote state without changing it",
    },
    {
      name: "Update",
      enabled: false,
      description: "Perform operations that may change remote state",
    },
    {
      name: "Admin",
      enabled: false,
      description: "Change remote accounts, access policy and server administration",
    },
    {
      name: "Credentials",
      enabled: false,
      description: "Issue/revoke remote credentials or remove explicitly owned local credentials",
    },
  ]);
  assert.equal(json.stderr, "");

  const invalid = run(["builds", "list", "--limit", "101"]);
  assert.equal(invalid.status, 1);
  assert.equal(invalid.stdout, "");
  assert.match(invalid.stderr, /between 1 and 100/);
});
