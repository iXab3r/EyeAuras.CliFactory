import { addAbortListener } from "node:events";
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

/** Cancellation releases the command while a pending caller-owned write keeps its error listener. */
function writeLine(output: Writable, line: string, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const closed = () => finish(new Error("Command output closed."));
    const finish = (error?: Error | null) => {
      output.off("close", closed).off("error", finish);
      aborted[Symbol.dispose]();
      if (error) reject(error); else resolve();
    };
    const aborted = addAbortListener(signal, () => reject(signal.reason));
    output.once("close", closed).once("error", finish);
    try {
      output.write(line, error => {
        // Node emits error after a failed callback. Keep ownership until that event, even if
        // cancellation already returned control to the command. A successful callback drains it.
        if (!error) finish();
      });
    } catch (error) {
      finish(error instanceof Error ? error : new Error("Command output write failed."));
    }
  });
}

/** Internal runner boundary: consume before leaving command admission and diagnostic lifetime. */
export async function consumeStreamResult(
  value: StreamResult<unknown>, signal: AbortSignal, output: Writable, ndjson: boolean,
): Promise<unknown[] | undefined> {
  const disconnected = new AbortController();
  const ownedSignal = AbortSignal.any([signal, disconnected.signal]);
  const closed = () => disconnected.abort(new Error("Command output closed."));
  const failed = (error: Error) => disconnected.abort(error);
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
        await writeLine(output, `${json}\n`, ownedSignal);
      } else items!.push(item.value);
    }
  } catch (error) {
    didFail = true;
    failure = error;
    // Abort in-flight service work before asking the iterator to release its resources.
    disconnected.abort(error);
    try { await iterator?.return?.(); }
    catch (cleanup) {
      const cause = new AggregateError([error, cleanup], "Stream consumption and cleanup failed.");
      failure = error instanceof CliError
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
