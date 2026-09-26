import { CliError } from "@eyeauras/cli-factory";

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

/**
 * Requests per selection, the time after which no new page starts, and the items one request
 * keeps; each request asks for one more, which proves that more exist.
 */
export const pageBudget = { requests: 10, milliseconds: 30_000, size: 1_000 };

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
    if (character === "," && depth === 0) {
      const separator = part.indexOf(":");
      if (separator > 0) dimensions.set(part.slice(0, separator), part.slice(separator + 1));
      part = "";
    } else {
      part += character;
    }
  }
  const start = number(dimensions.get("start"));
  if (start === undefined) return undefined;
  const lookupLimit = number(dimensions.get("lookupLimit"));
  return lookupLimit === undefined ? { start } : { start, lookupLimit };
}

/**
 * Read up to `limit` items from `start`, following TeamCity's continuation within the budget.
 * One extra item proves that more exist, and reading continues after the kept items; a short page
 * without a continuation proves the end; an unexpected continuation, one that makes no progress,
 * or an exhausted budget leaves it open.
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
  now: () => number = Date.now,
  signal?: AbortSignal,
): Promise<TeamCityPage<T>> {
  const began = now();
  const items: T[] = [];
  // `--start` cannot carry a lookup limit: only a start past the first one continues anything.
  const page = (hasMore: boolean | null, nextStart: number | null): TeamCityPage<T> => ({
    count: items.length,
    items,
    hasMore,
    nextStart: nextStart !== null && nextStart > start ? nextStart : null,
  });
  let position: Continuation = { start };
  for (let request = 1; ; request++) {
    const take = Math.min(limit - items.length, pageBudget.size);
    let response: Awaited<ReturnType<typeof read>>;
    try {
      response = await read({ ...position, count: take + 1 });
    } catch (error) {
      // A stopped read reports the stop, not an incomplete list.
      if (request === 1 || signal?.aborted === true) throw error;
      // Items already read are kept, and the list is never presented as complete.
      throw new CliError("Reading more results failed; the list is incomplete.", {
        code: "list.incomplete", result: page(null, position.start),
      });
    }
    items.push(...response.items.slice(0, take));
    const reached = position.start + Math.min(response.items.length, take);
    const spent = request >= pageBudget.requests || now() - began >= pageBudget.milliseconds;
    if (response.items.length > take) {
      // The extra item proves that more exist; continue right after the kept items.
      if (items.length >= limit || spent) return page(true, reached);
      position = { ...position, start: reached };
      continue;
    }
    const next = continuation(response.nextHref);
    // Without a continuation, a page shorter than requested proves the end.
    if (next === undefined) return page(false, null);
    const lookupLimit = next.lookupLimit ?? position.lookupLimit;
    const advances = next.start === reached &&
      (reached > position.start || (lookupLimit ?? 0) > (position.lookupLimit ?? 0));
    if (!advances || items.length >= limit || spent) return page(null, reached);
    position = lookupLimit === undefined ? { start: reached } : { start: reached, lookupLimit };
  }
}
