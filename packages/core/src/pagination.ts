/** Advance an offset without losing integer precision. No local content ceiling is imposed. */
export function advanceOffset(start: number, count: number): number {
  if (!Number.isSafeInteger(start) || start < 0 ||
      !Number.isSafeInteger(count) || count < 0 || count > Number.MAX_SAFE_INTEGER - start) {
    throw new Error("The result offset must remain a nonnegative safe integer.");
  }
  return start + count;
}
