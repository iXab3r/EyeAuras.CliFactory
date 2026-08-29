import type { TeamCityPageOptions } from "./models.js";

export const defaultPageLimit = 100;

const simpleLocatorValuePattern = /^[A-Za-z0-9_]+$/;

function requireInteger(value: number, description: string): number {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${description} must be an integer.`);
  }
  return value;
}

export function normalizePage(options: TeamCityPageOptions = {}): {
  limit: number;
  start: number;
} {
  const limit = requireInteger(options.limit ?? defaultPageLimit, "TeamCity page limit");
  const start = requireInteger(options.start ?? 0, "TeamCity page start");
  if (limit < 1 || limit > 100) {
    throw new Error("TeamCity page limit must be between 1 and 100.");
  }
  if (start < 0) {
    throw new Error("TeamCity page start must be non-negative.");
  }
  return { limit, start };
}

export function requiredText(value: string, description: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${description} cannot be empty.`);
  }
  return normalized;
}

export function locatorValue(value: string, description: string): string {
  const normalized = requiredText(value, description);
  return simpleLocatorValuePattern.test(normalized)
    ? normalized
    : `($base64:${Buffer.from(normalized).toString("base64url")})`;
}

export function idLocator(value: string, description: string): string {
  return `id:${locatorValue(value, description)}`;
}

export function nestedId(
  dimension: string,
  value: string,
  description: string,
): string {
  return `${dimension}:(${idLocator(value, description)})`;
}

export function joinLocator(...dimensions: Array<string | undefined>): string {
  return dimensions.filter((value): value is string => value !== undefined).join(",");
}

export function pageDimensions(options: TeamCityPageOptions = {}): [string, string] {
  const page = normalizePage(options);
  return [`start:${page.start}`, `count:${page.limit}`];
}

export function idPath(value: string, description: string): string {
  return idLocator(value, description);
}

export function positiveId(value: number, description: string): string {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${description} must be a positive integer.`);
  }
  return String(value);
}
