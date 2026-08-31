/** Shared logical command limits. Protocols may additionally bound their own envelopes. */
export const inputLimits = Object.freeze({
  arguments: 256,
  argumentBytes: 8192,
  argvBytes: 32768,
  rpcLineBytes: 262144,
});

export function validateArgv(
  value: unknown,
): asserts value is readonly string[] {
  if (!Array.isArray(value) || value.length > inputLimits.arguments)
    throw new Error(
      "Command argument count exceeds its limit or argv is invalid.",
    );
  let total = 0;
  for (const arg of value) {
    if (typeof arg !== "string")
      throw new Error("Command arguments must be strings.");
    const bytes = Buffer.byteLength(arg);
    if (
      bytes > inputLimits.argumentBytes ||
      (total += bytes) > inputLimits.argvBytes
    )
      throw new Error("Command arguments exceed their byte size limit.");
  }
}
