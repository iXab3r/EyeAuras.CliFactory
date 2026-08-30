import assert from "node:assert/strict";
import { PassThrough, Writable } from "node:stream";
import test from "node:test";
import { promptSecret, promptText } from "../src/auth.js";

function terminal() {
  const input = new PassThrough() as PassThrough & {
    isTTY: boolean;
    setRawMode(enabled: boolean): void;
  };
  const rawModes: boolean[] = [];
  input.isTTY = true;
  input.setRawMode = (enabled) => { rawModes.push(enabled); };
  let text = "";
  const output = new Writable({
    write(chunk, _encoding, done) {
      text += chunk.toString();
      done();
    },
  }) as Writable & { isTTY: boolean };
  output.isTTY = true;
  return { input, output, rawModes, text: () => text };
}

test("split CRLF between text and secret prompts cannot submit an empty credential", async (t) => {
  const tty = terminal();
  t.after(() => tty.input.destroy());
  const url = promptText(tty.input, tty.output, "Service URL");
  tty.input.write("https://example.com/context\r");
  assert.equal(await url, "https://example.com/context");
  await new Promise<void>((resolve) => setImmediate(resolve));
  let settled = false;
  const secret = promptSecret(tty.input, tty.output).then((value) => {
    settled = true;
    return value;
  });
  tty.input.write("\n");
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(settled, false, "The delayed LF must not finish the secret prompt");
  tty.input.write("synthetic-token\r\n");
  assert.equal(await secret, "synthetic-token");
  assert.deepEqual(tty.rawModes, [true, false]);
  assert.equal(tty.input.isPaused(), true);
  assert.equal(tty.input.listenerCount("data"), 0);
  assert.equal(tty.text(), "Service URL: Token: \n");
});

test("secret input ignores empty lines, preserves pasted text and supports backspace", async (t) => {
  const tty = terminal();
  t.after(() => tty.input.destroy());
  const secret = promptSecret(tty.input, tty.output);
  tty.input.write("\r\n\nsynthetic-X\btokenX\u007f\n");
  assert.equal(await secret, "synthetic-token");
  assert.deepEqual(tty.rawModes, [true, false]);
  assert.equal(tty.text(), "Token: \n");
});

test("Ctrl-C after an empty newline still cancels and restores the terminal", async (t) => {
  const tty = terminal();
  t.after(() => tty.input.destroy());
  const secret = promptSecret(tty.input, tty.output);
  tty.input.write("\nsynthetic-partial\u0003");
  await assert.rejects(secret, /^Error: Authentication cancelled\.$/);
  assert.deepEqual(tty.rawModes, [true, false]);
  assert.equal(tty.input.isPaused(), true);
  assert.equal(tty.input.listenerCount("data"), 0);
  assert.equal(tty.text(), "Token: \n");
});

test("secret listener is installed before explicitly resuming input", async (t) => {
  const tty = terminal();
  t.after(() => tty.input.destroy());
  const resume = tty.input.resume.bind(tty.input);
  let emitted = false;
  tty.input.resume = () => {
    if (!emitted) {
      emitted = true;
      assert.ok(tty.input.listenerCount("data") > 0);
      tty.input.emit("data", "synthetic-token\r");
    }
    return resume();
  };
  assert.equal(await promptSecret(tty.input, tty.output), "synthetic-token");
  assert.equal(tty.text(), "Token: \n");
});
