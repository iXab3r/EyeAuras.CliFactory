import assert from "node:assert/strict";
import { PassThrough, Writable } from "node:stream";
import test from "node:test";
import { promptSecret, promptText } from "../src/auth.js";

function terminal(columns = 80, wasRaw = false) {
  const input = new PassThrough() as PassThrough & {
    isTTY: boolean;
    isRaw: boolean;
    setRawMode(enabled: boolean): void;
  };
  const rawModes: boolean[] = [];
  input.isTTY = true;
  input.isRaw = wasRaw;
  input.setRawMode = (enabled) => { rawModes.push(enabled); input.isRaw = enabled; };
  let text = "";
  const output = new Writable({
    write(chunk, _encoding, done) {
      text += chunk.toString();
      done();
    },
  }) as Writable & { isTTY: boolean; columns: number };
  output.isTTY = true;
  output.columns = columns;
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
  assert.doesNotMatch(tty.text(), /synthetic/);
  assert.match(tty.text(), /Token: \*{15}\n$/);
});

test("secret input ignores empty lines, preserves pasted text and supports backspace", async (t) => {
  const tty = terminal();
  t.after(() => tty.input.destroy());
  const secret = promptSecret(tty.input, tty.output);
  tty.input.write("\r\n\nsynthetic-X\btokenX\u007f\n");
  assert.equal(await secret, "synthetic-token");
  assert.deepEqual(tty.rawModes, [true, false]);
  assert.doesNotMatch(tty.text(), /synthetic/);
  assert.match(tty.text(), /Token: \*+\n$/);
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
  assert.doesNotMatch(tty.text(), /synthetic/);
  assert.match(tty.text(), /Token: \*+\n$/);
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
  assert.doesNotMatch(tty.text(), /synthetic/);
  assert.match(tty.text(), /Token: \*+\n$/);
});

function lastFrame(text: string): string {
  return text.split("\r\u001b[2K").at(-1)!;
}

test("typing, paste and both backspace keys update only a visible mask", async (t) => {
  const tty = terminal();
  t.after(() => tty.input.destroy());
  const secret = promptSecret(tty.input, tty.output);
  await new Promise<void>((resolve) => setImmediate(resolve));
  for (const character of "synthetic") {
    tty.input.write(character);
    assert.match(lastFrame(tty.text()), /^Token: \*+$/);
  }
  tty.input.write("-paste");
  assert.equal(lastFrame(tty.text()), "Token: " + "*".repeat(15));
  tty.input.write("\b\u007f");
  assert.equal(lastFrame(tty.text()), "Token: " + "*".repeat(13));
  tty.input.write("\b".repeat(20));
  assert.equal(lastFrame(tty.text()), "Token: ");
  tty.input.write("synthetic-final\r");
  assert.equal(await secret, "synthetic-final");
  assert.doesNotMatch(tty.text(), /synthetic|paste|final/);
});

test("long pasted secrets stay editable on one terminal row without truncating the candidate", async (t) => {
  for (const columns of [12, 40, 80]) {
    const tty = terminal(columns);
    t.after(() => tty.input.destroy());
    const secret = promptSecret(tty.input, tty.output);
    await new Promise<void>((resolve) => setImmediate(resolve));
    const pasted = "synthetic-long-".repeat(1000);
    tty.input.write(pasted);
    assert.match(lastFrame(tty.text()), /^Token: \+\*+$/);
    tty.input.write("\b".repeat(pasted.length - 2));
    assert.equal(lastFrame(tty.text()), "Token: **");
    tty.input.write(pasted + "X\u007f\r\n");
    assert.equal(await secret, "sy" + pasted);
    for (const frame of tty.text().split("\r\u001b[2K").slice(1)) {
      assert.ok(frame.trimEnd().length < columns, "Mask must not wrap");
    }
    assert.doesNotMatch(tty.text(), /synthetic|long/);
  }
});

test("split UTF-8 input and backspace preserve complete characters", async (t) => {
  const tty = terminal();
  t.after(() => tty.input.destroy());
  const secret = promptSecret(tty.input, tty.output);
  await new Promise<void>((resolve) => setImmediate(resolve));
  for (const byte of Buffer.from("synthetic-🔑")) tty.input.write(Buffer.from([byte]));
  assert.equal(lastFrame(tty.text()), "Token: " + "*".repeat(11));
  tty.input.write("\b-end\n");
  assert.equal(await secret, "synthetic--end");
  assert.doesNotMatch(tty.text(), /synthetic|🔑|end/);
});

test("cancellation and input termination restore prior raw mode and remove listeners", async (t) => {
  for (const wasRaw of [false, true]) {
    for (const reason of ["ctrl-c", "abort", "end", "close", "error"]) {
      const tty = terminal(80, wasRaw);
      t.after(() => tty.input.destroy());
      const abort = new AbortController();
      const secret = promptSecret(tty.input, tty.output, abort.signal);
      const rejected = assert.rejects(secret, /^Error: Authentication cancelled\.$/);
      await new Promise<void>((resolve) => setImmediate(resolve));
      tty.input.write("synthetic-partial");
      if (reason === "ctrl-c") tty.input.write("\u0003");
      else if (reason === "abort") abort.abort(new Error("synthetic-abort"));
      else tty.input.emit(reason, new Error("synthetic-input"));
      await rejected;
      assert.deepEqual(tty.rawModes, [true, wasRaw]);
      assert.equal(tty.input.isRaw, wasRaw);
      assert.equal(tty.input.isPaused(), true);
      for (const event of ["data", "end", "close", "error"]) {
        assert.equal(tty.input.listenerCount(event), 0);
      }
      assert.doesNotMatch(tty.text(), /synthetic/);
      assert.ok(tty.text().endsWith("\n"));
    }
  }
});

test("already aborted or closed input cannot leave a prompt waiting in raw mode", async () => {
  const abort = new AbortController();
  abort.abort();
  const tty = terminal();
  await assert.rejects(promptSecret(tty.input, tty.output, abort.signal), /Authentication cancelled/);
  assert.deepEqual(tty.rawModes, []);
  assert.equal(tty.text(), "");
  tty.input.destroy();
  await assert.rejects(promptSecret(tty.input, tty.output), /Authentication cancelled/);
  assert.deepEqual(tty.rawModes, [true, false]);
});
