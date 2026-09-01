interface ConsumeOptions {
  maxBytes: number;
  signal?: AbortSignal | undefined;
}

async function consumeResponseBody(
  response: Response,
  options: ConsumeOptions,
  consume: (chunk: Uint8Array) => void | Promise<void>,
): Promise<number> {
  const { maxBytes, signal } = options;
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  const cancel = () => { void reader?.cancel().catch(() => undefined); };
  try {
    reader = response.body?.getReader();
    signal?.addEventListener("abort", cancel, { once: true });
    if (signal?.aborted || !Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new Error();
    const header = response.headers.get("content-length");
    const declared = header === null ? undefined : Number(header);
    const encoding = response.headers.get("content-encoding")?.trim().toLowerCase();
    const identity = !encoding || encoding === "identity";
    if (header !== null && (!/^\d+$/.test(header) || !Number.isSafeInteger(declared) ||
        (identity && declared! > maxBytes))) {
      throw new Error();
    }
    let bytes = 0;
    while (reader) {
      if (signal?.aborted) throw new Error();
      const chunk = await reader.read();
      if (signal?.aborted) throw new Error();
      if (chunk.done) break;
      if (!chunk.value.byteLength) continue;
      const next = bytes + chunk.value.byteLength;
      if (next > maxBytes) throw new Error();
      await consume(chunk.value);
      bytes = next;
    }
    if (declared !== undefined && identity && bytes !== declared) throw new Error();
    return bytes;
  } catch {
    throw new Error("Response body failed, exceeded its byte bound, or was cancelled.");
  } finally {
    signal?.removeEventListener("abort", cancel);
    cancel();
    reader?.releaseLock();
  }
}

/**
 * Consume one response as bounded bytes. HTTP status, decoding and JSON/media policy stay local.
 * Cancellation is observed but never awaited: a tee's other branch may still be unread.
 */
export async function readBoundedResponseBody(
  response: Response,
  options: ConsumeOptions,
): Promise<Uint8Array> {
  const { maxBytes } = options;
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