import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("packaged bin: help, configuration, HTTP output, errors and JSON-RPC", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "random-cli-process-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const bin = fileURLToPath(new URL("../src/bin.js", import.meta.url));
  const preload = new URL("./fixtures/process-preload.js", import.meta.url).href;
  const run = (argv: string[], input = "") => spawnSync(process.execPath, ["--import", preload, bin, ...argv], {
    env: { ...process.env, RANDOM_CLI_TEST_ROOT: root }, input, encoding: "utf8", windowsHide: true, timeout: 10_000,
  });
  const help = run(["integers", "--help"]);
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /--count/);
  assert.match(help.stdout, /Required permission: ReadOnly/);
  const setup = run(["profile", "configure", "default", "--contact", "operator@example.com", "--json"]);
  assert.equal(setup.status, 0, setup.stderr);
  const draw = run(["integers", "--count", "3", "--min", "2", "--max", "6", "--json"]);
  assert.equal(draw.status, 0, draw.stderr);
  assert.equal(draw.stderr, "");
  assert.deepEqual(JSON.parse(draw.stdout), { values: [2, 2, 2] });
  const sequence = run(["sequence", "--min", "1", "--max", "3"]);
  assert.equal(sequence.status, 0, sequence.stderr);
  assert.equal(sequence.stdout, "values: [3,2,1]\n");
  const invalid = run(["integers", "--count", "101", "--json"]);
  assert.equal(invalid.status, 1);
  assert.equal(invalid.stdout, "");
  assert.match(invalid.stderr, /between 1 and 100/);
  for (const command of ["integers", "sequence"]) {
    const equalBounds = run([command, "--min", "0", "--max", "0", "--json"]);
    assert.equal(equalBounds.status, 1);
    assert.equal(equalBounds.stdout, "");
    assert.match(equalBounds.stderr, /min must be less than max/);
  }
  assert.equal(run(["profile", "configure", "unavailable", "--url", "https://failed.test", "--contact", "operator@example.com"]).status, 0);
  const failure = run(["integers", "--profile", "unavailable", "--json"]);
  assert.equal(failure.status, 1);
  assert.equal(failure.stdout, "");
  assert.match(failure.stderr, /503/);
  assert.doesNotMatch(failure.stderr, /synthetic-private-marker/);
  const rpc = run(["--json-rpc"], [
    { jsonrpc: "2.0", id: 1, method: "cli.execute", params: { argv: ["integers"] } },
    { jsonrpc: "2.0", id: 2, method: "cli.execute", params: { argv: ["sequence", "--max", "3"] } },
  ].map((frame) => JSON.stringify(frame)).join("\n") + "\n");
  assert.equal(rpc.status, 0, rpc.stderr);
  const frames = rpc.stdout.trim().split("\n").map((line) => JSON.parse(line));
  assert.deepEqual(frames.map((frame) => frame.result), [{ values: [1] }, { values: [3, 2, 1] }]);
  assert.equal(rpc.stderr, "");
});
