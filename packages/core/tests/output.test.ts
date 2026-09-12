import assert from "node:assert/strict";
import test from "node:test";
import { formatHuman } from "../src/output.js";

test("human fallback output preserves long arrays, strings and deep values", () => {
  const array = [...Array.from({ length: 150 }, (_, i) => i), "last-item-marker"];
  assert.match(formatHuman(array), /last-item-marker/);
  assert.doesNotMatch(formatHuman(array), /more items/);
  const text = "x".repeat(20_000) + "last-character-marker";
  assert.ok(formatHuman([text]).includes(text));
  let nested: unknown = "deep-value-marker";
  for (let i = 0; i < 12; i++) nested = [nested];
  assert.match(formatHuman(nested), /deep-value-marker/);
});
