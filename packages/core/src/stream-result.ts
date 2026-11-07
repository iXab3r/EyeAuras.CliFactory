import { writeOutput, outputFailure } from "./output-write.js";
import type { Writable } from "node:stream";
import { CliError } from "./errors.js";

const producer = Symbol("streamResult");

/** A lazy finite domain sequence. Core owns consumption, cancellation and presentation. */
export interface StreamResult<T> {
  readonly [producer]: (signal: AbortSignal) => AsyncIterable<T>;
}

/**
 * Return a finite sequence without acquiring resources yet. Use the supplied signal for pending
 * work and release producer-owned resources in finally. Human, execute and RPC callers get T[].
 */
export function streamResult<T>(produce: (signal: AbortSignal) => AsyncIterable<T>): StreamResult<T> {
  return { [producer]: produce };
}

export function isStreamResult(value: unknown): value is StreamResult<unknown> {
  return value !== null && typeof value === "object" && producer in value;
}

/** Internal runner boundary: consume before leaving command admission and diagnostic lifetime. */
export async function consumeStreamResult(
  value: StreamResult<unknown>, signal: AbortSignal, output: Writable, ndjson: boolean,
): Promise<unknown[] | undefined> {
  const disconnected = new AbortController();
  const ownedSignal = AbortSignal.any([signal, disconnected.signal]);
  const closed = () => disconnected.abort(new Error("Command output closed."));
  const failed = (error: Error) => disconnected.abort(outputFailure(error));
  output.on("close", closed);
  output.on("finish", closed);
  output.on("error", failed);
  let iterator: AsyncIterator<unknown> | undefined;
  let failure: unknown;
  let didFail = false;
  const items: unknown[] | undefined = ndjson ? undefined : [];
  try {
    if (output.destroyed || output.writableEnded) closed();
    ownedSignal.throwIfAborted();
    iterator = value[producer](ownedSignal)[Symbol.asyncIterator]();
    while (true) {
      ownedSignal.throwIfAborted();
      const item = await iterator.next();
      ownedSignal.throwIfAborted();
      if (item.done) break;
      if (ndjson) {
        const json = JSON.stringify(item.value ?? null);
        if (json === undefined) throw new Error("Stream item cannot be represented as JSON.");
        await writeOutput(output, `${json}\n`, ownedSignal);
      } else items!.push(item.value);
    }
  } catch (error) {
    didFail = true;
    failure = error;
    // A producer's finally can replace the abort reason while next() is pending.
    const reason: unknown = disconnected.signal.reason;
    if (reason instanceof CliError && reason.code === "output.brokenPipe"
      && !(error instanceof CliError && error.code === "output.brokenPipe")) {
      failure = new AggregateError([reason, error], "Stream consumption and cleanup failed.");
    }
    // Abort in-flight service work before asking the iterator to release its resources.
    disconnected.abort(error);
    try { await iterator?.return?.(); }
    catch (cleanup) {
      const cause = new AggregateError([error, cleanup], "Stream consumption and cleanup failed.");
      failure = error instanceof CliError && error.code !== "output.brokenPipe"
        ? new CliError(error.message, { code: error.code, exitCode: error.exitCode, result: error.result, next: error.next, cause })
        : cause;
    }
  } finally {
    output.off("close", closed);
    output.off("finish", closed);
    output.off("error", failed);
  }
  if (didFail) throw failure;
  return items;
}
