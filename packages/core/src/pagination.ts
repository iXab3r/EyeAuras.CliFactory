/** Advance an offset without losing integer precision. No local content ceiling is imposed. */
export function advanceOffset(start: number, count: number): number {
  if (!Number.isSafeInteger(start) || start < 0 ||
      !Number.isSafeInteger(count) || count < 0 || count > Number.MAX_SAFE_INTEGER - start) {
    throw new Error("The result offset must remain a nonnegative safe integer.");
  }
  return start + count;
}

/**
 * Visit service-owned positions sequentially until the adapter returns undefined.
 * The adapter owns progress/end evidence, result accumulation and budgets. It must either
 * advance its position or stop; no HTTP, DTO, identity or completeness rule is inferred here.
 * Cancellation is checked around every visit, including the final one. No retry occurs.
 */
export async function traversePages<Position>(
  initial: Position,
  visit: (position: Position) => Promise<Position | undefined>,
  signal?: AbortSignal,
): Promise<void> {
  let position: Position | undefined = initial;
  while (position !== undefined) {
    signal?.throwIfAborted();
    position = await visit(position);
    signal?.throwIfAborted();
  }
}
