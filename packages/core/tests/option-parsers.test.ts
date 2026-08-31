import assert from "node:assert/strict";
import test from "node:test";
import { command, createCli, integerParser, jsonParser } from "../src/index.js";
import { createCliFixture } from "../src/testing.js";

function parserTypeChecks() {
  const value = jsonParser("Invalid JSON.")("{}");
  // @ts-expect-error JSON syntax does not establish an object schema.
  value.id;
}

test("integer parser retains decimal spelling, signed zero and inclusive safe bounds", () => {
  const signed = integerParser({
    min: Number.MIN_SAFE_INTEGER, max: Number.MAX_SAFE_INTEGER, signed: true, errorMessage: "Invalid number.",
  });
  for (const [input, expected] of [
    ["0", 0], ["-0", -0], ["001", 1], ["-001", -1],
    ["9007199254740991", Number.MAX_SAFE_INTEGER], ["-9007199254740991", Number.MIN_SAFE_INTEGER],
  ] as const) assert.equal(signed(input), expected);
  const unsigned = integerParser({ min: 0, max: 100, signed: false, errorMessage: "Invalid number." });
  assert.equal(unsigned("000"), 0);
  assert.equal(unsigned("100"), 100);
  for (const input of ["-0", "-1", "101"]) assert.throws(() => unsigned(input), /^Error: Invalid number\.$/);
  for (const input of [
    "", " 1", "1 ", "1\n", "1\r\n", "+1", "1.0", "1e2", "0x10", "1_000",
    "9007199254740992", "-9007199254740992", "9".repeat(400), "synthetic-secret\u0000value",
  ]) assert.throws(() => signed(input), error => {
    assert.ok(error instanceof Error);
    assert.equal(error.message, "Invalid number.");
    assert.equal(error.cause, undefined);
    return true;
  });
  assert.throws(() => integerParser({ min: 2, max: 1, signed: true, errorMessage: "Invalid." }), /ordered safe integers/);
  for (const bound of [NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => integerParser({ min: bound, max: 10, signed: true, errorMessage: "Invalid." }), /ordered safe integers/);
    assert.throws(() => integerParser({ min: 0, max: bound, signed: true, errorMessage: "Invalid." }), /ordered safe integers/);
  }
});

test("JSON parser returns any JSON value and never exposes malformed input or native causes", () => {
  const parse = jsonParser("Invalid body.");
  for (const value of [null, true, 3, "text", [1, null], { id: "fixture" }]) {
    assert.deepEqual(parse(JSON.stringify(value)), value);
  }
  assert.deepEqual(parse(" \n{}\t"), {});
  for (const value of ["", " ", "{", "undefined", '{"synthetic-secret":"unterminated', "\u0000synthetic-secret"]) {
    assert.throws(() => parse(value), error => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, "Invalid body.");
      assert.equal(error.cause, undefined);
      return true;
    });
  }
});

test("parser callbacks retain required options and defaults across execute, CLI and RPC", async t => {
  const f = await createCliFixture(t, { applicationId: "parser-fixture" });
  const cli = f.createApplication(runtime => createCli({
    name: "parser-fixture", description: "Synthetic option parser contract", runtime,
    commands: [command("read", "Read parsed values", ({ options }) => options, { options: [
      {
        flags: "--count <number>", description: "Count", required: true, defaultValue: 2,
        parse: integerParser({ min: 1, max: 3, signed: false, errorMessage: "Invalid count." }),
      },
      { flags: "--body <json>", description: "Body", required: true, parse: jsonParser("Invalid body.") },
    ] })],
  }));
  assert.deepEqual(await cli.execute(["read", "--body", "17"]), { count: 2, body: 17 });
  // Commander already normalizes a null callback result for a required-value option to "".
  assert.deepEqual(await cli.execute(["read", "--body", "null"]), { count: 2, body: "" });
  assert.deepEqual(await f.json(cli, ["read", "--body", "true"]), { count: 2, body: true });
  assert.deepEqual(await cli.execute(["read", "--body", "[]", "--count", "003"]), { count: 3, body: [] });
  await assert.rejects(cli.execute(["read"]), /required option/);
  const missing = await f.run(cli, ["read"]);
  assert.equal(missing.exitCode, 1);
  assert.match(missing.stderr, /required option/);
  assert.deepEqual(await f.rpc(cli, [["read", "--body", "{"], ["read", "--body", "{}"]]), [
    { jsonrpc: "2.0", id: 0, error: { code: -32000, message: "Invalid body." } },
    { jsonrpc: "2.0", id: 1, result: { count: 2, body: {} } },
  ]);
});
