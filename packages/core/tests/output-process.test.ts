import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import test from "node:test";

const fixture = fileURLToPath(new URL("./output-process-fixture.js", import.meta.url));
const request = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "cli.execute", params: { argv: ["value"] } }) + "\n";

for (const argv of [["--help"], ["--version"], ["value"], ["value", "--json"], ["items", "--json"], ["--json-rpc"]]) {
  test(`closed reader: ${argv.join(" ")} exits 141 after cleanup without diagnostics`, { timeout: 10_000 }, async t => {
    const child = spawn(process.execPath, [fixture, ...argv], { stdio: ["pipe", "pipe", "pipe", "ipc"] });
    t.after(() => { if (child.exitCode === null) child.kill(); });
    let stderr = "";
    const messages: unknown[] = [];
    child.on("message", message => messages.push(message));
    child.stderr!.setEncoding("utf8").on("data", chunk => { stderr += chunk; });
    const closed = once(child, "close");
    await once(child, "message");
    child.stdout!.destroy();
    child.stdin!.end(argv[0] === "--json-rpc" ? request : "");
    child.send("start");
    const [code, signal] = await closed;
    assert.equal(signal, null);
    assert.equal(code, 141, stderr);
    assert.equal(stderr, "");
    assert.ok(messages.includes("disposed"));
    if (argv[0] === "items") assert.ok(messages.includes("iterator closed"));
  });
}

test("full help remains successful and disposes resources", { timeout: 10_000 }, async t => {
  const child = spawn(process.execPath, [fixture, "--help"], { stdio: ["pipe", "pipe", "pipe", "ipc"] });
  t.after(() => { if (child.exitCode === null) child.kill(); });
  let stdout = "", stderr = "";
  child.stdout!.setEncoding("utf8").on("data", chunk => { stdout += chunk; });
  child.stderr!.setEncoding("utf8").on("data", chunk => { stderr += chunk; });
  const closed = once(child, "close");
  await once(child, "message");
  child.stdin!.end();
  child.send("start");
  assert.deepEqual(await closed, [0, null]);
  assert.match(stdout, /Usage: output-test-cli/);
  assert.match(stdout, /List items/);
  assert.equal(stderr, "");
});
