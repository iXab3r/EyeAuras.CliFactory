/** Validate command shape without imposing content size or argument count policy. */
export function validateArgv(value: unknown): asserts value is readonly string[] {
  if (!Array.isArray(value)) throw new Error("Command argv must be an array.");
  for (const arg of value) {
    if (typeof arg !== "string")
      throw new Error("Command arguments must be strings.");
  }
}
