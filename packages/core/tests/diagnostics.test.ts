import assert from "node:assert/strict";
import test from "node:test";
import { CliError, diagnosticCause, diagnosticText, machineError, rememberSecret, withDiagnostics } from "../src/errors.js";
import { command, createCli, tokenAuth } from "../src/index.js";
import { createCliFixture } from "../src/testing.js";

test("causal diagnostics retain codes and frames, redact credentials, and handle aggregates/cycles", () => {
  const leaf = Object.assign(new Error("connect ECONNREFUSED Bearer synthetic-token https://user:pass@example.test/api?signature=synthetic-signature"), { code: "ECONNREFUSED" });
  leaf.cause = leaf;
  const cause = new AggregateError([leaf, new TypeError("second failure"), { token: "synthetic-object-secret" }], "Both connections failed");
  const error = new CliError("Could not query the service.", { code: "request.failed", cause });
  const machine = machineError(error);
  assert.equal(machine.cause?.errors?.[0]?.code, "ECONNREFUSED");
  assert.equal(machine.cause?.errors?.[1]?.name, "TypeError");
  assert.match(machine.cause?.errors?.[0]?.stack ?? "", /diagnostics.test/);
  assert.match(JSON.stringify(machine), /Circular/);
  assert.doesNotMatch(JSON.stringify(machine), /synthetic-token|synthetic-signature|user:pass|synthetic-object-secret/);
  assert.match(diagnosticText(machine), /Caused by: AggregateError/);
  assert.match(diagnosticText(machine), /Related error: Error \[ECONNREFUSED\]/);
  assert.equal(machineError("arbitrary secret").message, "A non-Error value was thrown (string).");
});

test("syntax diagnostics retain source frames while excluding reflected input and multiline headers", () => {
  const original = new SyntaxError('Invalid "synthetic-secret"\nsecond private line');
  const safe = diagnosticCause(original, [], "Invalid JSON syntax.");
  assert.equal(safe.name, "SyntaxError");
  assert.match(safe.stack ?? "", /diagnostics.test/);
  assert.doesNotMatch(safe.stack ?? "", /synthetic-secret|private line/);
});

test("concurrent diagnostic scopes isolate profile secrets and redact secure record values", async () => {
  let ready!: () => void;
  const barrier = new Promise<void>(resolve => { ready = resolve; });
  const first = withDiagnostics(async () => {
    rememberSecret('{"value":"synthetic-alpha-credential"}');
    await barrier;
    return new CliError("First failed", { code: "request.failed", cause: new Error("synthetic-alpha-credential") });
  });
  const second = withDiagnostics(async () => {
    rememberSecret("synthetic-beta-credential");
    ready();
    return new CliError("Second failed", { code: "request.failed", cause: new Error("synthetic-beta-credential") });
  });
  const errors = await Promise.all([first, second]);
  assert.doesNotMatch(JSON.stringify(errors.map(machineError)), /synthetic-alpha-credential|synthetic-beta-credential/);
  assert.equal(diagnosticCause(new Error("synthetic-alpha-credential")).message, "synthetic-alpha-credential");
});

test("human, JSON, RPC and execute retain equivalent diagnostics without exposing profile secrets", async t => {
  const fixture = await createCliFixture(t, {
    applicationId: "diagnostic-cli",
    profiles: [{ name: "default", secrets: { token: "synthetic-profile-token" } }],
  });
  const app = fixture.createApplication(runtime => createCli({
    name: "diagnostic-cli", description: "Diagnostic test", runtime,
    commands: [command("read", "Read", async (_input, context) => {
      const token = await context.secrets.require("token");
      const cause = Object.assign(new Error(`Connection failed with ${token}`), { code: "ECONNRESET" });
      throw new CliError("Could not read service status.", { code: "request.failed", cause });
    })],
  }));
  const human = await fixture.run(app, ["read"]);
  assert.equal(human.exitCode, 1);
  assert.equal(human.stdout, "");
  assert.ok(human.stderr.startsWith("Could not read service status.\n"));
  assert.match(human.stderr, /Caused by: Error \[ECONNRESET\]/);
  assert.match(human.stderr, /diagnostics.test/);
  const json = await fixture.run(app, ["read", "--json"]);
  const failure = JSON.parse(json.stderr).error;
  assert.equal(failure.cause.code, "ECONNRESET");
  const replies = await fixture.rpc(app, [["read"]]) as { error: { data: { cause: { code: string } } } }[];
  assert.equal(replies[0]?.error.data.cause.code, "ECONNRESET");
  await assert.rejects(app.execute(["read"]), error => {
    assert.ok(error instanceof Error && error.cause instanceof Error);
    assert.doesNotMatch(error.cause.message, /synthetic-profile-token/);
    return true;
  });
  assert.doesNotMatch(human.stderr + json.stderr + JSON.stringify(replies), /synthetic-profile-token/);
});

test("candidate token validation failure keeps cause and leaves profile unconfigured", async t => {
  const fixture = await createCliFixture(t, { applicationId: "diagnostic-auth" });
  const app = fixture.createApplication(runtime => createCli({
    name: "diagnostic-auth", description: "Auth", runtime,
    profile: { fields: [{ name: "url", flags: "--url <url>", description: "Server URL", required: true }] },
    auth: tokenAuth({ env: "SYNTHETIC_TOKEN", validate: async ({ token }) => {
      throw new TypeError(`Native failure ${token}`);
    } }), commands: [],
  }));
  const result = await fixture.run(app, ["profile", "configure", "default", "--url", "https://service.test", "--json"], {
    environment: { SYNTHETIC_TOKEN: "synthetic-candidate-token" },
  });
  const error = JSON.parse(result.stderr).error;
  assert.equal(error.code, "auth.validationFailed");
  assert.equal(error.cause.name, "TypeError");
  assert.doesNotMatch(result.stderr, /synthetic-candidate-token/);
  assert.equal((await fixture.profileStore.get()).values.url, undefined);
});
