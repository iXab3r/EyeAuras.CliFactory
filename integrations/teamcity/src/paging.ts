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

/** Requests per selection and the time after which no new page starts. */
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
 * One extra item proves that more exist; a short page without a continuation proves the end;
 * an empty page with a continuation, a repeated continuation or an exhausted budget leaves it open.
 */
export async function readPages<T>(
  limit: number,
  start: number,
  read: (request: { start: number; count: number; lookupLimit?: number }) => Promise<{
    items: T[];
    nextHref: unknown;
  }>,
  now: () => number = Date.now,
): Promise<TeamCityPage<T>> {
  const began = now();
  const items: T[] = [];
  const page = (hasMore: boolean | null, nextStart: number | null): TeamCityPage<T> => ({
    count: items.length, items, hasMore, nextStart,
  });
  let position: Continuation = { start };
  for (let request = 1; ; request++) {
    const need = limit - items.length;
    const count = Math.min(need + 1, pageBudget.size);
    let response: Awaited<ReturnType<typeof read>>;
    try {
      response = await read({ ...position, count });
    } catch (error) {
      if (request === 1) throw error;
      // Items already read are kept, and the list is never presented as complete.
      throw new CliError("Reading more results failed; the list is incomplete.", {
        code: "list.incomplete", result: page(null, position.start), cause: error,
      });
    }
    items.push(...response.items.slice(0, need));
    if (response.items.length > need) return page(true, position.start + need);
    const next = continuation(response.nextHref);
    if (next === undefined) {
      // Without a continuation only a short page proves the end.
      return response.items.length < count
        ? page(false, null)
        : page(null, position.start + response.items.length);
    }
    const advances = next.start > position.start ||
      (next.start === position.start && (next.lookupLimit ?? 0) > (position.lookupLimit ?? 0));
    if (!advances || items.length >= limit || request >= pageBudget.requests ||
      now() - began >= pageBudget.milliseconds) {
      return page(null, next.start);
    }
    position = next;
  }
}
