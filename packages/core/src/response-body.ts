import { diagnosticCause } from "./errors.js";

interface ConsumeOptions {
  maxBytes?: number | undefined;
  signal?: AbortSignal | undefined;
}

async function consumeResponseBody(
  response: Response,
  options: ConsumeOptions,
  consume: (chunk: Uint8Array) => void | Promise<void>,
): Promise<number> {
  const { maxBytes = Infinity, signal } = options;
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  const cancel = () => { void reader?.cancel().catch(() => undefined); };
  try {
    reader = response.body?.getReader();
    signal?.addEventListener("abort", cancel, { once: true });
    signal?.throwIfAborted();
    if (options.maxBytes !== undefined && (!Number.isSafeInteger(maxBytes) || maxBytes < 1)) throw new Error("The response byte bound must be a positive safe integer.");
    const header = response.headers.get("content-length");
    const declared = header === null ? undefined : Number(header);
    const encoding = response.headers.get("content-encoding")?.trim().toLowerCase();
    const identity = !encoding || encoding === "identity";
    if (header !== null && (!/^\d+$/.test(header) || !Number.isSafeInteger(declared) ||
        (identity && declared! > maxBytes))) {
      throw new Error("The response Content-Length is invalid or exceeds the requested byte bound.");
    }
    let bytes = 0;
    while (reader) {
      signal?.throwIfAborted();
      const chunk = await reader.read();
      signal?.throwIfAborted();
      if (chunk.done) break;
      if (!chunk.value.byteLength) continue;
      const next = bytes + chunk.value.byteLength;
      if (next > maxBytes) throw new Error("The response exceeded the requested byte bound.");
      await consume(chunk.value);
      bytes = next;
    }
    if (declared !== undefined && identity && bytes !== declared) throw new Error("The response length does not match Content-Length.");
    return bytes;
  } catch (cause) {
    throw new Error("Could not read the complete response body.", { cause: diagnosticCause(cause) });
  } finally {
    signal?.removeEventListener("abort", cancel);
    cancel();
    reader?.releaseLock();
  }
}

/**
 * Consume one response as owned bytes, optionally bounded by an explicit caller budget. HTTP status, decoding and JSON/media policy stay local.
 * Cancellation is observed but never awaited: a tee's other branch may still be unread.
 */
export async function readResponseBody(
  response: Response,
  options: ConsumeOptions = {},
): Promise<Uint8Array> {
  const { maxBytes = Infinity } = options;
  let buffer = new Uint8Array(0);
  let written = 0;
  const bytes = await consumeResponseBody(response, options, (chunk) => {
    const next = written + chunk.byteLength;
    if (next > buffer.length) {
      const grown = new Uint8Array(
        Math.min(maxBytes, Math.max(next, buffer.length * 2, 16384)),
      );
      grown.set(buffer.subarray(0, written));
      buffer = grown;
    }
    // Own every chunk immediately: a producer may reuse its buffer on the next read.
    buffer.set(chunk, written);
    written = next;
  });
  return buffer.subarray(0, bytes);
}

export { consumeResponseBody };
