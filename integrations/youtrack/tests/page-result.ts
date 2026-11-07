/** Expected public offset envelope. Service fixtures remain native arrays. */
export function pageResult(items: unknown, start = 0): unknown {
  if (!Array.isArray(items)) return items;
  return { count: items.length, items, hasMore: items.length === 0 ? false : null,
    nextStart: items.length === 0 ? null : start + items.length };
}
export function completeResult(items: readonly unknown[]): unknown {
  return { count: items.length, items, hasMore: false, nextStart: null };
}
