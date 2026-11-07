import { advanceOffset, CliError, traversePages } from "@eyeauras/cli-factory";

/** One bounded selection from a TeamCity collection and what is known about the rest of it. */
export interface TeamCityPage<T> {
  /** Items returned here, at most the requested limit. */
  count: number;
  items: T[];
  /** `true`: more items exist; `false`: TeamCity confirmed the end; `null`: not established. */
  hasMore: boolean | null;
  /** The `--start` that continues this selection, when known. */
  nextStart: number | null;
}

/** Wire chunk size; the caller's selection has no hidden request or elapsed-time cap. */
export const pageSize = 1_000;

interface Continuation {
  start: number;
  lookupLimit?: number;
}

function number(value: string | undefined): number | undefined {
  return value !== undefined && /^\d+$/.test(value) && Number.isSafeInteger(Number(value))
    ? Number(value)
    : undefined;
}

/**
 * The numeric continuation in TeamCity's `nextHref` locator. Only `start` and `lookupLimit` are
 * read, from top-level dimensions: the href is never followed or echoed.
 */
export function continuation(nextHref: unknown): Continuation | undefined {
  if (typeof nextHref !== "string" || nextHref === "") return undefined;
  let locator: string | null;
  try {
    locator = new URL(nextHref, "https://continuation.invalid").searchParams.get("locator");
  } catch {
    return undefined;
  }
  if (locator === null) return undefined;
  const dimensions = new Map<string, string>();
  let depth = 0;
  let part = "";
  for (const character of `${locator},`) {
    if (character === "(") depth++;
    if (character === ")") depth--;
    if (depth < 0) return undefined;
    if (character === "," && depth === 0) {
      const separator = part.indexOf(":");
      if (separator > 0) {
        const name = part.slice(0, separator);
        if (dimensions.has(name)) return undefined;
        dimensions.set(name, part.slice(separator + 1));
      }
      part = "";
    } else {
      part += character;
    }
  }
  if (depth !== 0) return undefined;
  const start = number(dimensions.get("start"));
  if (start === undefined) return undefined;
  const lookupLimit = number(dimensions.get("lookupLimit"));
  if (dimensions.has("lookupLimit") && lookupLimit === undefined) return undefined;
  return lookupLimit === undefined ? { start } : { start, lookupLimit };
}

/**
 * Read up to `limit` items from `start`, following TeamCity's continuation.
 * One extra item proves that more exist, and reading continues after the kept items; a short page
 * without a continuation proves the end; an unexpected continuation, one that makes no progress,
 * leaves completeness unknown.
 *
 * TeamCity continues after the items it served, or, having served none because its lookup limit
 * was reached, at the same start with a deeper `lookupLimit` (`PagerDataImpl` in JetBrains'
 * teamcity-rest). Any other continuation is not followed.
 */
export async function readPages<T>(
  limit: number,
  start: number,
  read: (request: { start: number; count: number; lookupLimit?: number }) => Promise<{
    items: T[];
    nextHref: unknown;
  }>,
  signal?: AbortSignal,
): Promise<TeamCityPage<T>> {
  const items: T[] = [];
  // `--start` cannot carry a lookup limit: only a start past the first one continues anything.
  const page = (hasMore: boolean | null, nextStart: number | null): TeamCityPage<T> => ({
    count: items.length,
    items,
    hasMore,
    nextStart: nextStart !== null && nextStart > start ? nextStart : null,
  });
  advanceOffset(start, limit);
  let result = page(null, null);
  let first = true;
  await traversePages<Continuation>({ start }, async (position) => {
    const take = Math.min(limit - items.length, pageSize);
    let response: Awaited<ReturnType<typeof read>>;
    try {
      response = await read({ ...position, count: take + 1 });
      if (response.items.length > take + 1) {
        throw new Error("More items than the requested page size came back from TeamCity.");
      }
    } catch (error) {
      // A stopped read reports the stop, not an incomplete list.
      if (first || signal?.aborted === true) throw error;
      // Items already read are kept, and the list is never presented as complete.
      throw new CliError("Reading more results failed; the list is incomplete.", {
        code: "list.incomplete", cause: error, result: page(null, position.start),
      });
    }
    first = false;
    for (const item of response.items.slice(0, take)) items.push(item);
    const reached = advanceOffset(position.start, Math.min(response.items.length, take));
    if (response.items.length > take) {
      // The extra item proves that more exist; continue right after the kept items.
      if (items.length >= limit) { result = page(true, reached); return; }
      return { ...position, start: reached };
    }
    const next = continuation(response.nextHref);
    // Without a continuation, a page shorter than requested proves the end.
    if (next === undefined) {
      const ended = response.nextHref === undefined || response.nextHref === null || response.nextHref === "";
      result = page(ended ? false : null, ended ? null : reached);
      return;
    }
    const lookupLimit = next.lookupLimit ?? position.lookupLimit;
    const advances = next.start === reached &&
      (reached > position.start || (lookupLimit ?? 0) > (position.lookupLimit ?? 0));
    if (!advances || items.length >= limit) { result = page(null, reached); return; }
    return lookupLimit === undefined ? { start: reached } : { start: reached, lookupLimit };
  }, signal);
  return result;
}
