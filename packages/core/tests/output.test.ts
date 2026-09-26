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

test("a selection prints its items as a table, then its fields with null spelled out", () => {
  const selection = { count: 2, items: [{ id: 1 }, { id: 2 }], hasMore: null, nextStart: 2 };
  assert.equal(formatHuman(selection), "id\n--\n1\n2\n\ncount: 2  hasMore: null  nextStart: 2");
  assert.equal(formatHuman({ items: [{ id: 1 }], skipped: undefined }), "id\n--\n1");
});
