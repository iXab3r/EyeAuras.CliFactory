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

test("human fallback does not multiply a long non-final cell across every row", () => {
  const details = "long-cell-marker-" + "x".repeat(20_000);
  const rows = Array.from({ length: 200 }, (_, index) => ({
    id: index,
    details: index === 0 ? details : "",
    state: "done",
  }));
  const rendered = formatHuman(rows);
  assert.ok(rendered.length < JSON.stringify(rows).length * 2,
    `Unexpected layout amplification: ${rendered.length} characters`);
  assert.ok(rendered.includes(details));
  for (const row of rows) assert.ok(rendered.includes(`id: ${row.id}\n`));
  assert.equal(rendered.match(/state: done/g)?.length, rows.length);
});

test("ordinary short fallback tables remain aligned", () => {
  assert.equal(formatHuman([{ id: 1, state: "done" }, { id: 22, state: "busy" }]),
    "id  state\n--  -----\n1   done\n22  busy");
});
