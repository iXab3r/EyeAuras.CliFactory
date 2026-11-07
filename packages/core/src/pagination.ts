/** Advance an offset without losing integer precision. No local content ceiling is imposed. */
export function advanceOffset(start: number, count: number): number {
  if (!Number.isSafeInteger(start) || start < 0 ||
      !Number.isSafeInteger(count) || count < 0 || count > Number.MAX_SAFE_INTEGER - start) {
    throw new Error("The result offset must remain a nonnegative safe integer.");
  }
  return start + count;
}

/** Repeat a service-owned page step until it returns a result; check cancellation around each step. */
export async function traversePages<Result>(
  visit: () => Promise<Result | undefined>,
  signal?: AbortSignal,
): Promise<Result> {
  while (true) {
    signal?.throwIfAborted();
    const result = await visit();
    signal?.throwIfAborted();
    if (result !== undefined) return result;
  }
}
