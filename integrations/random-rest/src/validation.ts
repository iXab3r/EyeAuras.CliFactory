import type { IntegerRequest, RandomRange } from "./models.js";

export const maxResults = 100;
const endpointLimit = 1_000_000_000;

export function integer(value: unknown, name: string, min: number, max: number): number {
  const parsed = typeof value === "number" ? value
    : typeof value === "string" && /^-?\d+$/.test(value) ? Number(value) : NaN;
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}.`);
  }
  return parsed;
}

export function range(input: { min?: unknown; max?: unknown }): RandomRange {
  const min = integer(input.min, "min", -endpointLimit, endpointLimit);
  const max = integer(input.max, "max", -endpointLimit, endpointLimit);
  if (min >= max) throw new Error("min must be less than max.");
  return { min, max };
}

export function integerRequest(input: { count?: unknown; min?: unknown; max?: unknown }): IntegerRequest {
  return { ...range(input), count: integer(input.count, "count", 1, maxResults) };
}

export function sequenceRequest(input: { min?: unknown; max?: unknown }): RandomRange {
  const result = range(input);
  if (result.max - result.min + 1 > maxResults) {
    throw new Error(`sequence must contain at most ${maxResults} integers.`);
  }
  return result;
}

export function serviceUrl(value: unknown): URL {
  let url: URL;
  try { url = new URL(typeof value === "string" ? value : ""); }
  catch { throw new Error("url must be an absolute HTTPS URL."); }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("url must be an HTTPS origin without credentials, path, query or fragment.");
  }
  return url;
}

export function contactEmail(value: unknown): string {
  // This is a header-safe contact address, not account authentication. Never echo rejected input.
  if (typeof value !== "string" || value.length > 254 || !/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/.test(value)) {
    throw new Error("contact must be an email address for RANDOM.ORG's User-Agent guideline.");
  }
  return value;
}
