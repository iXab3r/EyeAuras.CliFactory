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

test("nested fallback records preserve keys, lists and empty values without JSON cells", () => {
  assert.equal(formatHuman({ authenticated: true, identity: {
    items: [{ id: 1 }, { id: 2 }], count: 2, roles: ["reader", "monitor"],
    metadata: {}, pending: [],
  }, profile: "default" }), [
    "authenticated: true", "identity:", "  items:", "    -", "      id: 1",
    "    -", "      id: 2", "  count: 2", "  roles:", "    - reader",
    "    - monitor", "  metadata: (empty record)", "  pending: (empty list)", "profile: default",
  ].join("\n"));
  assert.equal(formatHuman({ active: false, identity: null, missing: undefined }),
    "active: false\nidentity: \nmissing: ");
});

test("complex outer rows and empty rows each keep a visible record block", () => {
  assert.equal(formatHuman([{ id: 1, identity: { user: "operator" } }, { id: 2, roles: ["reader"] }]),
    "id: 1\nidentity:\n  user: operator\n\nid: 2\nroles:\n  - reader");
  assert.equal(formatHuman([{}, {}]), "(empty record)\n\n(empty record)");
  assert.equal(formatHuman([{}, { id: 1 }]), "(empty record)\n\nid: 1");
  assert.equal(formatHuman([]), "No results.");
});

test("outer selections group scalar summaries and then nested details without changing nested items", () => {
  assert.equal(formatHuman({
    metadata: { items: [{ id: 9 }], count: 1 }, count: 1,
    items: [{ id: 1 }], hasMore: null, warnings: ["stale", { source: "replica" }],
  }), [
    "id", "--", "1", "", "count: 1  hasMore: null", "", "metadata:",
    "  items:", "    -", "      id: 9", "  count: 1", "warnings:",
    "  - stale", "  -", "    source: replica",
  ].join("\n"));
});

test("recursive fallback retains complete values and repeated acyclic references", () => {
  const text = "x".repeat(20_000) + "last-character-marker";
  let nested: unknown = { text };
  for (let i = 0; i < 12; i++) nested = { child: [nested] };
  const shared = { nested };
  const rendered = formatHuman({ first: shared, second: shared });
  assert.equal(rendered.split(text).length, 3);
  assert.equal(rendered.match(/child:/g)?.length, 24);
  assert.doesNotMatch(rendered, /more items|Circular/);
  const date = new Date("2026-01-01T00:00:00Z");
  assert.equal(formatHuman({ date }), `date: ${JSON.stringify(date)}`);
  assert.equal(formatHuman(date), "");
  assert.equal(formatHuman([date]), "");
});

/** WHAT: Review found nested lists bypassing toJSON and exposing an instance's private projection. */
test("nested non-plain instances retain their serialized projection in lists and mixed rows", () => {
  class CredentialSummary {
    token = "synthetic-secret-marker";
    toJSON() { return { stored: true }; }
  }
  const credentials = new CredentialSummary();
  const rendered = formatHuman({ identity: { credentials: [credentials] } });
  assert.equal(rendered, 'identity:\n  credentials:\n    - {"stored":true}');
  assert.doesNotMatch(rendered, /synthetic-secret-marker|CredentialSummary/);
  class InstanceRow { identity = { credentials: [credentials] }; }
  assert.equal(formatHuman([{}, new InstanceRow()]),
    '(empty record)\n\nidentity: {"credentials":[{"stored":true}]}');
  // The previous inspect-based outer mixed-array path remains distinct from JSON-based fields.
  const date = new Date("2026-01-01T00:00:00Z");
  assert.equal(formatHuman([1, date]), "- 1\n- 2026-01-01T00:00:00.000Z");
});
