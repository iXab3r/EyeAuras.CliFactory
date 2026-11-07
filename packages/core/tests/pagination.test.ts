import assert from "node:assert/strict";
import test from "node:test";
import { advanceOffset } from "../src/pagination.js";

test("offset arithmetic accepts the safe boundary and rejects precision loss", () => {
  assert.equal(advanceOffset(0, 0), 0);
  assert.equal(advanceOffset(10, 25), 35);
  assert.equal(advanceOffset(Number.MAX_SAFE_INTEGER, 0), Number.MAX_SAFE_INTEGER);
  assert.equal(advanceOffset(0, Number.MAX_SAFE_INTEGER), Number.MAX_SAFE_INTEGER);
  for (const invalid of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => advanceOffset(invalid, 0), /safe integer/);
    assert.throws(() => advanceOffset(0, invalid), /safe integer/);
  }
  assert.throws(() => advanceOffset(Number.MAX_SAFE_INTEGER, 1), /safe integer/);
});
