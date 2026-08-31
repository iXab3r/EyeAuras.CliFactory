import assert from "node:assert/strict";
import test from "node:test";
import { parseProofProfile, type ProofInvocation, type ProofInvoker } from "@eyeauras/cli-factory/proof";
import {
  formatProofReport,
  runProfileProof,
} from "../integration-tests/profile-proof.js";

test("profile proof accepts only an explicit profile", () => {
  assert.equal(parseProofProfile(["--profile", "default"], {}), "default");
  assert.throws(() => parseProofProfile([], {}), /Usage/);
  assert.throws(() => parseProofProfile(["--profile", "default", "jobs", "run"], {}), /Usage/);
  assert.throws(() => parseProofProfile(["--profile", "../escape"], {}), /Usage/);
});

test("profile proof refuses CI before invoking the CLI", async () => {
  let invocations = 0;
  await assert.rejects(
    runProfileProof(
      { profile: "default" },
      {
        environment: { ci: "true" },
        invoke: async () => {
          invocations += 1;
          throw new Error("must not run");
        },
      },
    ),
    /local-only/,
  );
  assert.equal(invocations, 0);
  await assert.rejects(runProfileProof({ profile: "profiles.json" }, {
    environment: {}, invoke: async () => { assert.fail("Invalid profile invoked CLI"); },
  }), /Usage/);
});

function json(value: unknown): string {
  return JSON.stringify(value);
}

test("profile proof uses a fixed bounded read-only inventory and safe summaries", async () => {
  const invocations: ProofInvocation[] = [];
  const privateValues = {
    project: "private-project-id",
    job: "private-job-id",
    build: 4242,
    agent: 73,
    root: "private-root-id",
  };
  const invoke: ProofInvoker = async (invocation) => {
    invocations.push(invocation);
    if (invocation.argv[0] === "--json-rpc") {
      return (
          '{"jsonrpc":"2.0","id":1,"result":{"version":"private"}}\n' +
          '{"jsonrpc":"2.0","id":2,"result":[]}\n'
      );
    }
    const command = invocation.argv.slice(0, -3).join(" ");
    if (command === "permissions list") {
      return json([
        { name: "ReadOnly", enabled: true },
        { name: "Update", enabled: true },
      ]);
    }
    if (command === "auth status") return json({ authenticated: true, identity: { token: "secret" } });
    if (command === "server status") return json({ version: "private-version" });
    if (command === "projects list --limit 3") return json([{ id: privateValues.project }]);
    if (command === "jobs list --limit 3") return json([{ id: privateValues.job }]);
    if (command === "builds list --limit 3") return json([{ id: privateValues.build }]);
    if (command === "queue list --limit 3") return json([]);
    if (command === "agents list --limit 3") return json([{ id: privateValues.agent }]);
    if (command === "vcs roots list --limit 3") return json([{ id: privateValues.root }]);
    if (command.startsWith("builds tests")) return json([]);
    if (command.startsWith("builds problems")) return json([]);
    if (command.startsWith("builds changes")) return json([]);
    return json({ ok: true, url: "https://private.example.test" });
  };

  const report = await runProfileProof(
    { profile: "default" },
    { environment: {}, invoke },
  );
  assert.equal(report.success, true);
  assert.equal(invocations.length, 19);
  assert.deepEqual(
    invocations.slice(0, -1).map((invocation) => invocation.argv.slice(0, -3)),
    [
      ["permissions", "list"],
      ["auth", "status"],
      ["server", "status"],
      ["projects", "list", "--limit", "3"],
      ["projects", "show", privateValues.project],
      ["jobs", "list", "--limit", "3"],
      ["jobs", "show", privateValues.job],
      ["jobs", "status", privateValues.job],
      ["builds", "list", "--limit", "3"],
      ["builds", "show", String(privateValues.build)],
      ["builds", "tests", String(privateValues.build), "--limit", "3"],
      ["builds", "problems", String(privateValues.build), "--limit", "3"],
      ["builds", "changes", String(privateValues.build), "--limit", "3"],
      ["queue", "list", "--limit", "3"],
      ["agents", "list", "--limit", "3"],
      ["agents", "show", String(privateValues.agent)],
      ["vcs", "roots", "list", "--limit", "3"],
      ["vcs", "roots", "show", privateValues.root],
    ],
  );
  for (const invocation of invocations.slice(0, -1)) {
    assert.deepEqual(invocation.argv.slice(-3), ["--profile", "default", "--json"]);
    assert.equal(invocation.argv.includes("run"), false);
    assert.equal(invocation.argv.includes("cancel"), false);
  }
  assert.deepEqual(invocations.at(-1)?.argv, ["--json-rpc"]);
  assert.deepEqual(invocations.at(-1)?.stdin?.trim().split("\n").map(line => JSON.parse(line)), [
    { jsonrpc: "2.0", id: 1, method: "cli.execute", params: { argv: ["server", "status", "--profile", "default"] } },
    { jsonrpc: "2.0", id: 2, method: "cli.execute", params: { argv: ["queue", "list", "--limit", "1", "--profile", "default"] } },
  ]);

  const output = formatProofReport(report);
  assert.match(output, /Summary: 19 passed, 0 skipped, 0 failed/);
  for (const privateValue of [
    ...Object.values(privateValues).map(String),
    "private-version",
    "private.example.test",
    "secret",
  ]) {
    assert.equal(output.includes(privateValue), false);
  }
});

test("profile proof treats empty pages as safe dependent skips", async () => {
  const invoke: ProofInvoker = async (invocation) => {
    if (invocation.argv[0] === "--json-rpc") {
      return '{"jsonrpc":"2.0","id":1,"result":{"version":"version"}}\n{"jsonrpc":"2.0","id":2,"result":[]}\n';
    }
    const command = invocation.argv.slice(0, -3).join(" ");
    if (command === "permissions list") return json([{ name: "ReadOnly", enabled: true }]);
    if (command === "auth status") return json({ authenticated: true });
    if (command === "server status") return json({ version: "version" });
    return json([]);
  };

  const report = await runProfileProof(
    { profile: "empty" },
    { environment: {}, invoke },
  );
  assert.equal(report.success, true);
  assert.equal(report.entries.filter((entry) => entry.status === "skipped").length, 9);
});

test("profile proof never copies failed CLI output into its report", async () => {
  const report = await runProfileProof(
    { profile: "default" },
    {
      environment: {},
      invoke: async () => { throw Object.assign(new Error("synthetic-child-failure"), {
        stdout: '{"token":"secret-value","id":"private-id"}',
        stderr: "request to https://private.example.test failed",
      }); },
    },
  );
  const output = formatProofReport(report);
  assert.equal(report.success, false);
  assert.equal(output.includes("secret-value"), false);
  assert.equal(output.includes("private-id"), false);
  assert.equal(output.includes("private.example.test"), false);
  assert.equal(report.entries.length, 19);
  assert.equal(report.entries.some(entry => entry.status === "passed"), false);
  assert.equal(report.entries.filter(entry => entry.status === "skipped").length, 9);
});

test("persistent RPC rejects malformed envelopes, missing/extra frames and invalid service results", async () => {
  const good = [
    { jsonrpc: "2.0", id: 1, result: { version: "synthetic" } },
    { jsonrpc: "2.0", id: 2, result: [] },
  ];
  for (const frames of [
    [], [good[0]], [...good, good[1]], [good[1], good[0]],
    [{ id: 1, result: {} }, good[1]],
    [{ ...good[0], jsonrpc: "1.0" }, good[1]],
    [{ ...good[0], error: null }, good[1]],
    [{ jsonrpc: "2.0", id: 1 }, good[1]],
    [{ ...good[0], result: [] }, good[1]],
    [good[0], { ...good[1], result: [{}, {}] }],
  ]) {
    const report = await runProfileProof({ profile: "synthetic" }, {
      environment: {}, invoke: async ({ argv }) => argv[0] === "--json-rpc"
        ? frames.map(frame => JSON.stringify(frame)).join("\n") : "synthetic-invalid-json",
    });
    assert.equal(report.success, false);
    assert.equal(report.entries.at(-1)?.status, "failed");
    assert.doesNotMatch(formatProofReport(report), /synthetic/);
  }
});
