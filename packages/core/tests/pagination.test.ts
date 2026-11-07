import assert from "node:assert/strict";
import test from "node:test";
import { advanceOffset, traversePages } from "../src/pagination.js";

test("traversal preserves service positions and sequences visits without retries", async () => {
  const visits: string[] = [];
  await traversePages("opaque before", async position => {
    visits.push(position);
    return position === "opaque before" ? "opaque after" : undefined;
  });
  assert.deepEqual(visits, ["opaque before", "opaque after"]);
  const cause = new Error("synthetic failure");
  let calls = 0;
  await assert.rejects(traversePages(0, async () => { calls++; throw cause; }), error => error === cause);
  assert.equal(calls, 1);
});

test("cancellation covers the first visit, page transitions and the final visit", async () => {
  const reason = new Error("synthetic stop");
  await assert.rejects(traversePages(0, async () => assert.fail("visit"), AbortSignal.abort(reason)), error => error === reason);
  for (const next of [1, undefined]) {
    const controller = new AbortController();
    let calls = 0;
    await assert.rejects(traversePages(0, async () => {
      calls++; controller.abort(reason); return next;
    }, controller.signal), error => error === reason);
    assert.equal(calls, 1);
  }
});

test("offset arithmetic accepts the safe boundary and rejects precision loss", () => {
  assert.equal(advanceOffset(Number.MAX_SAFE_INTEGER, 0), Number.MAX_SAFE_INTEGER);
  assert.equal(advanceOffset(0, Number.MAX_SAFE_INTEGER), Number.MAX_SAFE_INTEGER);
  for (const [start, count] of [[Number.MAX_SAFE_INTEGER, 1], [-1, 0], [0, 0.5], [Infinity, 0]]) {
    assert.throws(() => advanceOffset(start!, count!), /safe integer/);
  }
});
