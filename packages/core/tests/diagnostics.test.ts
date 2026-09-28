import assert from "node:assert/strict";
import test from "node:test";
import {
  CliError,
  conciseCause,
  diagnosticCause,
  diagnosticText,
  HttpError,
  machineError,
  rememberSecret,
  withDiagnostics,
} from "../src/errors.js";
import { command, createCli, tokenAuth } from "../src/index.js";
import { createCliFixture } from "../src/testing.js";

test("causal diagnostics retain codes and frames, redact credentials, and handle aggregates/cycles", () => {
  const leaf = Object.assign(new Error("connect ECONNREFUSED Bearer synthetic-token https://user:pass@example.test/api?signature=synthetic-signature"), { code: "ECONNREFUSED" });
  leaf.cause = leaf;
  const cause = new AggregateError([leaf, new TypeError("second failure"), { token: "synthetic-object-secret" }], "Both connections failed");
  const error = new CliError("Could not query the service.", { code: "request.failed", cause });
  const machine = machineError(error, { verbose: true });
  assert.equal(machine.cause?.errors?.[0]?.code, "ECONNREFUSED");
  assert.equal(machine.cause?.errors?.[1]?.name, "TypeError");
  assert.match(machine.cause?.errors?.[0]?.stack ?? "", /diagnostics.test/);
  assert.match(JSON.stringify(machine), /Circular/);
  assert.doesNotMatch(JSON.stringify(machine), /synthetic-token|synthetic-signature|user:pass|synthetic-object-secret/);
  assert.match(diagnosticText(machine), /Caused by: AggregateError/);
  assert.match(diagnosticText(machine), /Related error: Error \[ECONNREFUSED\]/);
  // The default form keeps the chain's names, codes and messages, never frames.
  const concise = machineError(error);
  assert.equal(concise.cause?.errors?.[0]?.code, "ECONNREFUSED");
  assert.doesNotMatch(JSON.stringify(concise), /"stack"|"name":"CliError"/);
  assert.equal(machineError("arbitrary secret").message, "A non-Error value was thrown (string).");
});

test("the concise cause names the nearest new text and the deepest detail once", () => {
  const native = Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:59999"), { code: "ECONNREFUSED" });
  const classified = new CliError("The server refused the connection; check the address and port.", {
    code: "request.connection", cause: new TypeError("fetch failed", { cause: native }),
  });
  const lost = new CliError("The service could not be reached; nothing was changed.", { code: "request.failed", cause: classified });
  assert.equal(
    conciseCause(machineError(lost)),
    "Cause: The server refused the connection; check the address and port. (connect ECONNREFUSED 127.0.0.1:59999)",
  );
  // A cause that repeats the headline, or says nothing, adds no line.
  const repeated = new CliError("Response was not valid JSON.", { code: "response.invalid", cause: new Error("Response was not valid JSON.") });
  assert.equal(conciseCause(machineError(repeated)), undefined);
  const empty = new CliError("Download failed.", { code: "download.failed", cause: new Error() });
  assert.equal(conciseCause(machineError(empty)), undefined);
  assert.equal(conciseCause(machineError(new CliError("Typed.", { code: "typed" }))), undefined);
});

test("an untyped failure keeps its type, frames and cause instead of nesting itself", () => {
  const wrapped = CliError.from(new RangeError("Out of range.", { cause: new Error("root") }));
  assert.equal(wrapped.code, "error");
  assert.equal(wrapped.name, "RangeError");
  assert.equal(wrapped.message, "Out of range.");
  assert.equal((wrapped.cause as Error).message, "root");
  assert.match(wrapped.stack ?? "", /^RangeError: Out of range\.\n\s+at /);
  assert.match(wrapped.stack ?? "", /diagnostics.test/);
  assert.equal(machineError(wrapped, { verbose: true }).name, "RangeError");
  // An aggregate is nested, so every independent failure stays visible.
  const aggregate = CliError.from(new AggregateError([new Error("first"), new Error("second")], "Both failed."));
  assert.equal(aggregate.message, "Both failed.");
  assert.equal(conciseCause(machineError(aggregate)), "Cause: first");
  assert.match(diagnosticText(machineError(aggregate, { verbose: true })), /Related error: Error: second/);
});

test("HttpError maps statuses to stable codes and suggests login for 401", () => {
  const unauthorized = new HttpError(401, "Service request failed with HTTP 401.");
  assert.equal(unauthorized.code, "http.unauthorized");
  assert.equal(unauthorized.status, 401);
  assert.deepEqual(unauthorized.next, [["auth", "login"]]);
  assert.equal(new HttpError(404, "x").code, "http.notFound");
  assert.equal(new HttpError(429, "x").code, "http.rateLimited");
  assert.equal(new HttpError(503, "x").code, "http.serverError");
  assert.equal(new HttpError(418, "x", { next: [["retry"]] }).code, "http.rejected");
  assert.deepEqual(new HttpError(418, "x", { next: [["retry"]] }).next, [["retry"]]);
  assert.deepEqual(new HttpError(401, "x", { next: [] }).next, []);
});

test("syntax diagnostics retain source frames while excluding reflected input and multiline headers", () => {
  const original = new SyntaxError('Invalid "synthetic-secret"\nsecond private line');
  const safe = diagnosticCause(original, [], "Invalid JSON syntax.");
  assert.equal(safe.name, "SyntaxError");
  assert.match(safe.stack ?? "", /diagnostics.test/);
  assert.doesNotMatch(safe.stack ?? "", /synthetic-secret|private line/);
});

test("raw native codes survive generic envelopes and cookie and signed-path diagnostics are redacted", () => {
  const original = Object.assign(new Error(
    "Cookie: session=synthetic-first; refresh=synthetic-second\n" +
    "Set-Cookie: session=synthetic-third; HttpOnly\n" +
    "Download https://service.test/files/1/sign=synthetic-signature and https://service.test/files/1/sign%3Dsynthetic-encoded",
  ), { code: "ECONNRESET" });
  const result = machineError(original, { verbose: true });
  assert.equal(result.code, "error");
  assert.equal(result.cause?.code, "ECONNRESET");
  assert.match(result.cause?.stack ?? "", /diagnostics.test/);
  assert.doesNotMatch(JSON.stringify(result), /synthetic-(?:first|second|third|signature|encoded)/);
  assert.equal(machineError(new DOMException("Cancelled", "AbortError")).cause?.code, 20);
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
  assert.doesNotMatch(JSON.stringify(errors.map((error) => machineError(error, { verbose: true }))), /synthetic-alpha-credential|synthetic-beta-credential/);
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
  // The explanation, then the technical reason on one line; frames need --verbose.
  assert.equal(human.stderr, "Could not read service status.\nCause: Connection failed with [redacted]\n");
  const verbose = await fixture.run(app, ["read", "--verbose"]);
  assert.ok(verbose.stderr.startsWith("Could not read service status.\n"));
  assert.match(verbose.stderr, /Caused by: Error \[ECONNRESET\]/);
  assert.match(verbose.stderr, /diagnostics.test/);
  const json = await fixture.run(app, ["read", "--json"]);
  const failure = JSON.parse(json.stderr).error;
  assert.equal(failure.cause.code, "ECONNRESET");
  assert.equal(failure.stack, undefined);
  assert.equal(failure.cause.stack, undefined);
  const jsonVerbose = JSON.parse((await fixture.run(app, ["read", "--json", "--verbose"])).stderr).error;
  assert.match(jsonVerbose.stack, /diagnostics.test/);
  assert.match(jsonVerbose.cause.stack, /diagnostics.test/);
  const replies = await fixture.rpc(app, [["read"], ["read", "--verbose"]]) as { error: { data: { stack?: string; cause: { code: string; stack?: string } } } }[];
  assert.equal(replies[0]?.error.data.cause.code, "ECONNRESET");
  assert.equal(replies[0]?.error.data.stack, undefined);
  assert.match(replies[1]?.error.data.stack ?? "", /diagnostics.test/);
  await assert.rejects(app.execute(["read"]), error => {
    assert.ok(error instanceof Error && error.cause instanceof Error);
    assert.doesNotMatch(error.cause.message, /synthetic-profile-token/);
    return true;
  });
  assert.doesNotMatch(human.stderr + verbose.stderr + json.stderr + JSON.stringify(replies), /synthetic-profile-token/);
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
