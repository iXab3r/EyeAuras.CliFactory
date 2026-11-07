import { addAbortListener } from "node:events";
import type { Writable } from "node:stream";
import { CliError } from "./errors.js";

/** Only a failure observed at the output boundary receives the broken-pipe policy. */
export function outputFailure(error: Error): Error {
  return (error as NodeJS.ErrnoException).code === "EPIPE"
    ? new CliError("The output reader closed the pipe.", { code: "output.brokenPipe", exitCode: 141, cause: error })
    : error;
}

/** Await the callback even below the high-water mark; retain ownership of late write errors. */
export function writeOutput(output: Writable, text: string, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    signal?.throwIfAborted();
    if (output.destroyed || output.writableEnded) {
      reject(outputFailure(output.errored ?? new Error("Command output is closed.")));
      return;
    }
    const closed = () => finish(new Error("Command output closed while writing."));
    const failed = (error: Error) => finish(outputFailure(error));
    const finish = (error?: Error) => {
      output.off("close", closed).off("error", failed);
      aborted?.[Symbol.dispose]();
      if (error) reject(error); else resolve();
    };
    const aborted = signal && addAbortListener(signal, () => reject(signal.reason));
    output.once("close", closed).once("error", failed);
    try {
      output.write(text, error => {
        // Node emits error after a failed callback. Cancellation may already have returned;
        // keep the listener until that event. A successful callback releases ownership.
        if (!error) finish();
      });
    } catch (error) {
      finish(outputFailure(error instanceof Error ? error : new Error("Command output write failed.")));
    }
  });
}
