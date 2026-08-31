import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const fixture = fileURLToPath(new URL("./builtin-process-fixture.js", import.meta.url));
const cases = [
  { argv: ["profile", "create"], error: /missing required argument 'name'/ },
  { argv: ["auth", "login", "--unknown"], error: /unknown option '--unknown'/ },
  { argv: ["permissions", "grant"], error: /missing required argument 'permission'/ },
  { argv: ["profile", "show", "--help"], help: /Usage: builtin-test-cli profile show/ },
  { argv: ["auth", "login", "--help"], help: /Usage: builtin-test-cli auth login/ },
  { argv: ["permissions", "list", "--help"], help: /Usage: builtin-test-cli permissions list/ },
  ...["profile", "auth", "permissions"].map((name) => ({
    argv: [name], help: new RegExp("Usage: builtin-test-cli " + name),
  })),
  ...["profile", "auth", "permissions"].map((name) => ({
    argv: [name, "--unknown"], error: /unknown option '--unknown'/,
  })),
];

function invoke(mode: string, value?: unknown, input?: string) {
  const result = spawnSync(process.execPath, [fixture, mode, JSON.stringify(value ?? [])], {
    encoding: "utf8",
    windowsHide: true,
    timeout: 10_000,
    maxBuffer: 64 * 1024,
    ...(input === undefined ? {} : { input }),
  });
  assert.equal(result.error, undefined);
  assert.equal(result.signal, null);
  return result;
}

test("built-in parse failures and help never terminate programmatic execution", () => {
  const result = invoke("execute", [...cases.map((row) => row.argv), ["ping"]]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  const replies = result.stdout.trim().split("\n").map((line) => JSON.parse(line));
  assert.equal(replies.length, cases.length + 1);
  for (const [index, row] of cases.entries()) {
    if (row.error) assert.match(replies[index].error, row.error);
    else assert.match(replies[index].result.help, row.help!);
  }
  assert.deepEqual(replies.at(-1), { result: { ok: true } });
});

test("built-in parse failures and help each produce one RPC frame and leave the process alive", () => {
  const input = [...cases.map((row) => row.argv), ["ping"]].map((argv, id) => JSON.stringify({
    jsonrpc: "2.0", id, method: "cli.execute", params: { argv },
  })).join("\n") + "\n";
  const result = invoke("rpc", undefined, input);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  const replies = result.stdout.trim().split("\n").map((line) => JSON.parse(line));
  assert.equal(replies.length, cases.length + 1);
  for (const [index, row] of cases.entries()) {
    assert.equal(replies[index].jsonrpc, "2.0");
    assert.equal(replies[index].id, index);
    if (row.error) {
      assert.equal(replies[index].error.code, -32000);
      assert.match(replies[index].error.message, row.error);
    } else {
      assert.match(replies[index].result.help, row.help!);
    }
  }
  assert.deepEqual(replies.at(-1), { jsonrpc: "2.0", id: cases.length, result: { ok: true } });
});

test("ordinary built-in invocations return error or help exit codes without exiting inside the parser", () => {
  for (const row of cases) {
    const expectedCode = row.error ? 1 : 0;
    const result = invoke("run", row.argv);
    assert.equal(result.status, expectedCode, result.stderr);
    const outputLines = result.stdout.trimEnd().split("\n");
    assert.deepEqual(JSON.parse(outputLines.pop()!), { returned: expectedCode });
    if (row.error) {
      assert.equal(outputLines.join("\n"), "");
      assert.match(result.stderr, row.error);
    } else {
      assert.match(outputLines.join("\n"), row.help!);
      assert.equal(result.stderr, "");
    }
  }
});
