import type { Readable } from "node:stream";

function readable(input: Readable, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const finish = (error?: Error) => {
      input
        .off("readable", ready)
        .off("end", ready)
        .off("close", ready)
        .off("error", fail);
      signal?.removeEventListener("abort", aborted);
      error ? reject(error) : resolve();
    };
    const ready = () => finish();
    const fail = (error: Error) => finish(error);
    const aborted = () => finish(new Error("JSON-RPC input cancelled."));
    input
      .once("readable", ready)
      .once("end", ready)
      .once("close", ready)
      .once("error", fail);
    signal?.addEventListener("abort", aborted, { once: true });
    if (signal?.aborted) aborted();
    else if (input.readableEnded || input.destroyed || input.readableLength)
      ready();
  });
}

/** Pull only when the previous request completed; never destroy caller-owned stdin. */
export async function* boundedLines(
  input: Readable,
  limit: number,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  let parts: Buffer[] = [],
    length = 0;
  try {
    for (;;) {
      if (signal?.aborted) throw new Error("JSON-RPC input cancelled.");
      const chunk: Buffer | string | null = input.read();
      if (chunk === null) {
        if (input.readableEnded) break;
        if (input.destroyed)
          throw new Error("JSON-RPC input closed before EOF.");
        await readable(input, signal);
        continue;
      }
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      let start = 0;
      while (start < bytes.length) {
        const newline = bytes.indexOf(10, start);
        const end = newline < 0 ? bytes.length : newline;
        length += end - start;
        if (length > limit)
          throw new Error("JSON-RPC line exceeds its byte size limit.");
        parts.push(bytes.subarray(start, end));
        if (newline >= 0) {
          const line = Buffer.concat(parts, length).toString("utf8");
          parts = [];
          length = 0;
          yield line;
        }
        start = end + 1;
      }
    }
    if (length) yield Buffer.concat(parts, length).toString("utf8");
  } finally {
    input.pause();
  }
}
