import type { RandomRange, RandomValues } from "./models.js";

/** The plain HTTP response and browser result element contain the same bounded integer list. */
export function parseRandomValues(
  text: string,
  range: RandomRange,
  count: number,
  unique: boolean,
): RandomValues | undefined {
  const parts = text.trim().split(/\s+/);
  const values = parts.map(Number);
  if (
    parts.length !== count ||
    parts.some((part) => !/^-?\d+$/.test(part)) ||
    values.some(
      (value) =>
        !Number.isSafeInteger(value) || value < range.min || value > range.max,
    ) ||
    (unique && new Set(values).size !== count)
  )
    return undefined;
  return { values };
}
