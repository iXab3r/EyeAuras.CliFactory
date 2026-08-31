import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createProofInvoker, parseProofProfile } from "../src/proof.js";

const executable = new URL("./fixtures/proof-child.js", import.meta.url);
const ciNames = ["CI", "GITHUB_ACTIONS", "TF_BUILD", "BUILD_BUILDID", "TEAMCITY_VERSION", "JENKINS_URL", "BUILDKITE"];
const environment = Object.fromEntries(Object.entries(process.env).filter(([name]) =>
  ![...ciNames, "NODE_OPTIONS", "NODE_TEST_CONTEXT"].includes(name.toUpperCase())));

test("proof preflight rejects every CI spelling and invalid selector before invocation", async () => {
  assert.equal(parseProofProfile(["--profile", "Synthetic-1"], {}), "Synthetic-1");
  for (const name of ciNames.flatMap(name => [name, name.toLowerCase()])) {
    assert.throws(() => parseProofProfile([], { [name]: "false" }), /local-only.*CI/);
    assert.throws(() => createProofInvoker({ executable, environment: { [name]: "true" } }), /local-only.*CI/);
  }
  for (const argv of [[], ["--profile"], ["--profile", "../outside"], ["--profile", "PROFILES.JSON"],
    ["--profile", "a".repeat(65)], ["--profile", "--json"], ["--profile", "synthetic", "issues", "create"],
    ["--profile", "synthetic", "--url", "https://example.com"], ["--profile", "synthetic", "--token", "synthetic"]]) {
    assert.throws(() => parseProofProfile(argv, {}), /Usage:/);
  }
  const mutable: NodeJS.ProcessEnv = {};
  const invoke = createProofInvoker({ executable, environment: mutable });
  mutable.GitHub_Actions = "true";
  await assert.rejects(invoke({ argv: ["failure"] }), /local-only.*CI/);
});

test("proof process limits and executable reject invalid options statically", () => {
  for (const value of [0, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    for (const option of ["timeoutMs", "maxOutputBytes"]) {
      assert.throws(() => createProofInvoker({ executable, environment: {}, [option]: value }), /positive finite/);
    }
  }
  assert.throws(() => createProofInvoker({ executable, environment: {}, timeoutMs: 2_147_483_648 }), /bounds/);
  assert.throws(() => createProofInvoker({ executable: new URL("https://example.com/synthetic-private"), environment: {} }),
    error => error instanceof Error && error.message === "Proof executable must be a local file URL.");
});

test("compiled fixture child reads closed stdin and receives no declared token override in any casing", async () => {
  const invoke = createProofInvoker({ executable, environment });
  assert.deepEqual(JSON.parse(await invoke({ argv: ["json"], stdin: "synthetic-input" })),
    { value: "synthetic", stdin: "synthetic-input" });
  for (const name of ["SYNTHETIC_TOKEN", "synthetic_token", "Synthetic_Token"]) {
    const filtered = createProofInvoker({ executable,
      environment: { ...environment, [name]: "synthetic-credential", SYNTHETIC_KEEP: "kept" },
      credentialEnvironment: ["Synthetic_Token"],
    });
    assert.deepEqual(JSON.parse(await filtered({ argv: ["environment"] })), { credentialPresent: false, retained: "kept" });
  }
});

test("proof child preserves one persistent two-request stdin session", async () => {
  const invoke = createProofInvoker({ executable, environment });
  const stdout = await invoke({ argv: ["rpc"], stdin: '{"id":1}\n{"id":2}\n' });
  const frames = stdout.trim().split("\n").map(line => JSON.parse(line));
  assert.deepEqual(frames.map(frame => frame.id), [1, 2]);
  assert.equal(frames[0].result.pid, frames[1].result.pid);
});

test("stdout and stderr limits count UTF-8 bytes separately, including exact boundaries", async () => {
  const invoke = createProofInvoker({ executable, environment, maxOutputBytes: 8 });
  assert.equal(await invoke({ argv: ["bytes", "4", "4"] }), "é".repeat(4));
  await assert.rejects(invoke({ argv: ["bytes", "5", "0"] }), /stdout exceeded its byte limit/);
  await assert.rejects(invoke({ argv: ["bytes", "0", "5"] }), /stderr exceeded its byte limit/);
});

test("unsuccessful exits and spawn failures expose only static errors", async () => {
  const invoke = createProofInvoker({ executable, environment });
  await assert.rejects(invoke({ argv: ["failure"] }), error => {
    assert.ok(error instanceof Error);
    assert.equal(error.message, "Proof CLI process exited unsuccessfully.");
    assert.deepEqual(Object.keys(error), []);
    return true;
  });
  const original = process.execPath;
  try {
    process.execPath = fileURLToPath(new URL("./synthetic-private-missing-node", import.meta.url));
    await assert.rejects(invoke({ argv: [] }), error => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, "Proof CLI process could not start.");
      assert.deepEqual(Object.keys(error), []);
      return true;
    });
  } finally {
    process.execPath = original;
  }
});

test("timeout, overflow and closed stdin reap their own child before settling", { timeout: 15_000 }, async t => {
  const root = await mkdtemp(join(tmpdir(), "proof-child-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const mode of ["hang", "overflow", "closed-input"]) {
    const pidFile = join(root, `${mode}.pid`);
    const invoke = createProofInvoker({ executable, environment, timeoutMs: 3000, maxOutputBytes: 64 });
    const started = performance.now();
    await assert.rejects(invoke({ argv: [mode, pidFile], stdin: "x".repeat(4 * 1024 * 1024) }), error => {
      assert.ok(error instanceof Error);
      assert.match(error.message, mode === "hang" ? /timed out/ : mode === "overflow" ? /stdout exceeded/ : /input failed/);
      assert.doesNotMatch(error.message, /synthetic|private|pid/);
      return true;
    });
    assert.ok(performance.now() - started < 10_000);
    const pid = Number(await readFile(pidFile, "utf8"));
    assert.throws(() => process.kill(pid, 0), (error: NodeJS.ErrnoException) => error.code === "ESRCH");
  }
});
