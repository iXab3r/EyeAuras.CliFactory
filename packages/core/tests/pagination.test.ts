import assert from "node:assert/strict";
import test from "node:test";
import { advanceOffset, traversePages } from "../src/pagination.js";

test("traversal keeps service state local and returns the final result without retries", async () => {
  const visits: string[] = [];
  let position = "opaque before";
  const result = await traversePages(async () => {
    visits.push(position);
    if (position === "opaque after") return visits;
    position = "opaque after";
  });
  assert.equal(result, visits);
  assert.deepEqual(result, ["opaque before", "opaque after"]);
  const cause = new Error("synthetic failure");
  let calls = 0;
  await assert.rejects(traversePages(async () => { calls++; throw cause; }), error => error === cause);
  assert.equal(calls, 1);
});

test("only undefined requests another page; empty and false results finish", async () => {
  for (const value of [[], null, false, 0, ""]) {
    let calls = 0;
    assert.equal(await traversePages(async () => { calls++; return value; }), value);
    assert.equal(calls, 1);
  }
});

test("cancellation covers the first visit, page transitions and the final result", async () => {
  const reason = new Error("synthetic stop");
  await assert.rejects(traversePages(async () => assert.fail("visit"), AbortSignal.abort(reason)), error => error === reason);
  for (const result of [undefined, []]) {
    const controller = new AbortController();
    let calls = 0;
    await assert.rejects(traversePages(async () => {
      calls++; controller.abort(reason); return result;
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
