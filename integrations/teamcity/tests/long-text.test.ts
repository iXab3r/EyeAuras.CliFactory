import assert from "node:assert/strict";
import test from "node:test";
import { safeText, pluginXml } from "../src/system-models.js";
import { serverPath, remotePath, sensitiveSegment } from "../src/file-models.js";

test("text and path projections validate structure without arbitrary length caps", () => {
  const text = "synthetic-long-content".repeat(4000);
  assert.equal(safeText(text), text);
  assert.equal(serverPath("/" + text).serverPath, "/" + text);
  assert.equal(remotePath(text), text);
  assert.equal(sensitiveSegment(text), text);
  assert.equal(pluginXml(`<plugin name="${text}"/>`).name, text);
  assert.throws(() => safeText(text + "\u0000"));
  assert.throws(() => remotePath("../" + text));
  assert.throws(() => pluginXml('<!DOCTYPE plugin><plugin name="fixture"/>'));
});
