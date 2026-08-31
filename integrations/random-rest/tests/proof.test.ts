import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  checkLiveCase,
  parseProofProfile,
} from "@eyeauras/random-common/proof";
import { liveCases } from "@eyeauras/random-common";

test("live inventory is fixed, small, and uses only the two read commands", async () => {
  assert.equal(liveCases.length, 4);
  assert.equal(parseProofProfile(["--profile", "demo"], {}), "demo");
  for (const caseSpec of liveCases) {
    assert.ok(
      caseSpec.argv[0] === "integers" || caseSpec.argv[0] === "sequence",
    );
    assert.ok(caseSpec.count <= 5);
    assert.ok(caseSpec.min < caseSpec.max);
    await checkLiveCase(caseSpec, "demo", async (argv) => {
      assert.deepEqual(argv, [...caseSpec.argv, "--profile", "demo", "--json"]);
      const values = Array.from({ length: caseSpec.count }, (_, index) =>
        caseSpec.unique ? caseSpec.min + index : caseSpec.min,
      );
      return { stdout: JSON.stringify({ values }), stderr: "" };
    });
  }
});

test("proof rejects CI, missing profile and arbitrary overrides", () => {
  for (const key of [
    "CI",
    "GITHUB_ACTIONS",
    "TF_BUILD",
    "BUILD_BUILDID",
    "JENKINS_URL",
    "TEAMCITY_VERSION",
  ]) {
    assert.throws(
      () => parseProofProfile(["--profile", "demo"], { [key]: "true" }),
      /local-only/,
    );
  }
  for (const argv of [
    [],
    ["--profile", "../outside"],
    ["--profile", "demo", "--url", "https://example.com"],
    ["--profile", "demo", "integers"],
  ]) {
    assert.throws(() => parseProofProfile(argv, {}), /Usage:/);
  }
});

test("live assertions reject bad results and never print payloads or subprocess errors", async () => {
  const caseSpec = liveCases[0]!;
  for (const stdout of [
    "synthetic-private-marker",
    "{}",
    '{"values":[]}',
    '{"values":[1,2,3,4,5]}',
    '{"values":[1,1,1,1,1.5]}',
  ]) {
    await assert.rejects(
      checkLiveCase(caseSpec, "demo", async () => ({ stdout, stderr: "" })),
      (error: Error) => {
        assert.doesNotMatch(error.message, /synthetic-private-marker|\[/);
        return true;
      },
    );
  }
  await assert.rejects(
    checkLiveCase(caseSpec, "demo", async () => {
      throw Object.assign(new Error("synthetic-private-marker"), {
        stderr:
          "RANDOM.ORG HTTP request failed (503). synthetic-private-marker",
      });
    }),
    (error: Error) => {
      assert.match(error.message, /HTTP 503/);
      assert.doesNotMatch(error.message, /synthetic-private-marker/);
      return true;
    },
  );
  await assert.rejects(
    checkLiveCase(liveCases[2]!, "demo", async () => ({
      stdout: '{"values":[0,0,0,0,0]}',
      stderr: "",
    })),
    /uniqueness/,
  );
  await assert.rejects(
    checkLiveCase(caseSpec, "demo", async () => ({
      stdout: "{}",
      stderr: "synthetic-private-marker",
    })),
    /unexpected diagnostics/,
  );
});

test("same live runner and CLI processes pass under MSW, stop after failure, and refuse CI", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "rr-"));

  const preload = new URL("./fixtures/process-preload.js", import.meta.url)
    .href;
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    RANDOM_CLI_TEST_ROOT: root,
    NODE_OPTIONS: `--import=${preload}`,
  };
  // The standalone runner must not inherit the enclosing node:test worker protocol.
  delete env.NODE_TEST_CONTEXT;
  for (const key of [
    "CI",
    "GITHUB_ACTIONS",
    "TF_BUILD",
    "BUILD_BUILDID",
    "JENKINS_URL",
    "TEAMCITY_VERSION",
  ])
    delete env[key];
  const cli = fileURLToPath(new URL("../src/bin.js", import.meta.url));
  const runner = fileURLToPath(
    new URL("../integration-tests/profile-proof.js", import.meta.url),
  );
  const run = (file: string, argv: string[], environment = env) =>
    spawnSync(process.execPath, [file, ...argv], {
      env: environment,
      encoding: "utf8",
      windowsHide: true,
      timeout: 30_000,
    });
  context.after(async () => {
    run(cli, ["ipc-server", "stop", "--json"]);
    await rm(root, { recursive: true, force: true });
  });
  assert.equal(
    run(cli, [
      "profile",
      "configure",
      "demo",
      "--contact",
      "operator@example.com",
    ]).status,
    0,
  );
  const success = run(runner, ["--profile", "demo"]);
  assert.equal(success.status, 0, success.stderr + success.stdout);
  assert.match(success.stdout, /pass 4/);
  assert.match(success.stdout, /fail 0/);
  assert.equal(
    run(cli, [
      "profile",
      "configure",
      "unavailable",
      "--url",
      "https://failed.test",
      "--contact",
      "operator@example.com",
    ]).status,
    0,
  );
  const failure = run(runner, ["--profile", "unavailable"]);
  assert.equal(failure.status, 1);
  assert.match(failure.stdout, /HTTP 503/);
  assert.match(failure.stdout, /skipped 3/);
  assert.doesNotMatch(
    failure.stdout + failure.stderr,
    /synthetic-private-marker/,
  );
  const ci = run(runner, ["--profile", "demo"], { ...env, CI: "true" });
  assert.equal(ci.status, 1);
  assert.match(ci.stderr, /local-only/);
  assert.equal(ci.stdout, "");
});
