/** A global flag given before any `--` that turns the rest into data. */
export function globalFlagRequested(argv: readonly string[], flag: string): boolean {
  const end = argv.indexOf("--");
  return (end < 0 ? argv : argv.slice(0, end)).includes(flag);
}

/** Validate command shape without imposing content size or argument count policy. */
export function validateArgv(value: unknown): asserts value is readonly string[] {
  if (!Array.isArray(value)) throw new Error("Command argv must be an array.");
  for (const arg of value) {
    if (typeof arg !== "string")
      throw new Error("Command arguments must be strings.");
  }
}
