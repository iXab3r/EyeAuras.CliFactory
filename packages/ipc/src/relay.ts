import { PassThrough, Writable, type Readable } from "node:stream";
import { finished } from "node:stream/promises";
import { status, type ServerDuplexStream } from "@grpc/grpc-js";
import { validateArgv } from "@eyeauras/cli-factory";
import type {
  CliApplication,
  CliInvocation,
  CliIo,
} from "@eyeauras/cli-factory";
import type { CliHostClient } from "./generated/clifactory/CliHost.js";
import type { RunInput__Output } from "./generated/clifactory/RunInput.js";
import type { RunOutput } from "./generated/clifactory/RunOutput.js";
import { bufferBytes, chunkBytes, protocol } from "./protocol.js";

type Call = ServerDuplexStream<RunInput__Output, RunOutput>;
type Callback = (error?: Error | null) => void;

/** Internal shared writer. Cancellation releases the caller, not ownership of a pending write. */
export function write(
  target: Writable,
  chunk: unknown,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const closed = () => finish(new Error("Invocation stream closed."));
    const cancelled = () => {
      signal?.removeEventListener("abort", cancelled);
      reject(new Error("Invocation write cancelled."));
    };
    const finish = (error?: Error | null) => {
      target.off("close", closed).off("error", finish);
      signal?.removeEventListener("abort", cancelled);
      if (error) reject(error);
      else resolve();
    };
    if (target.destroyed || target.writableEnded || signal?.aborted) {
      closed();
      return;
    }
    target.once("close", closed).once("error", finish);
    signal?.addEventListener("abort", cancelled, { once: true });
    try {
      target.write(chunk, (error) => {
        // A Writable emits error after its failed write callback. Keep its listener until then,
        // including when cancellation has already returned control to the caller.
        if (!error) finish();
      });
    } catch {
      finish(new Error("Invocation write failed."));
    }
  });
}

/** Stop/detach input without destroying a caller-owned stream. */
function forwardInput(
  input: Readable,
  send: (chunk: Buffer) => Promise<void>,
  end: () => void,
  fail: (error: unknown) => void,
): () => void {
  let stopped = false,
    busy = false,
    ended = false;
  const finish = () => {
    if (!busy && ended && !stopped) end();
  };
  const onData = (data: Buffer | string) => {
    input.pause();
    busy = true;
    void (async () => {
      const bytes = Buffer.isBuffer(data) ? data : Buffer.from(data);
      for (
        let offset = 0;
        offset < bytes.length && !stopped;
        offset += chunkBytes
      )
        await send(bytes.subarray(offset, offset + chunkBytes));
    })().then(() => {
      busy = false;
      if (!stopped) {
        finish();
        if (!ended) input.resume();
      }
    }, fail);
  };
  const onEnd = () => {
    ended = true;
    finish();
  };
  const onError = (error: Error) => fail(error);
  const onClose = () => {
    if (!ended) fail(new Error("Invocation input closed before EOF."));
  };
  input
    .on("data", onData)
    .once("end", onEnd)
    .once("error", onError)
    .once("close", onClose);
  if (input.readableEnded) onEnd();
  else if (input.destroyed) onClose();
  else input.resume();
  return () => {
    stopped = true;
    input.pause();
    input
      .off("data", onData)
      .off("end", onEnd)
      .off("error", onError)
      .off("close", onClose);
  };
}

class Output extends Writable {
  constructor(private readonly send: (bytes: Buffer) => Promise<void>) {
    super({ highWaterMark: chunkBytes });
  }
  override write(
    chunk: Uint8Array | string,
    encoding?: BufferEncoding | Callback,
    callback?: Callback,
  ): boolean {
    if (this.writableLength + Buffer.byteLength(chunk) > bufferBytes) {
      const error = new Error("Invocation output buffer limit exceeded.");
      if (typeof encoding === "function") encoding(error);
      else callback?.(error);
      this.destroy(error);
      return false;
    }
    return typeof encoding === "function"
      ? super.write(chunk, encoding)
      : super.write(chunk, encoding ?? "utf8", callback);
  }
  override _write(
    chunk: Buffer,
    _encoding: BufferEncoding,
    callback: Callback,
  ): void {
    void (async () => {
      for (let offset = 0; offset < chunk.length; offset += chunkBytes)
        await this.send(chunk.subarray(offset, offset + chunkBytes));
    })().then(
      () => callback(),
      (error) =>
        callback(error instanceof Error ? error : new Error("Output failed.")),
    );
  }
}

/** One generated bidi stream owns one invocation and never the application lifetime. */
export function serveRun(
  call: Call,
  options: {
    application: CliApplication;
    build: string;
    environmentKeys: readonly string[];
    admitted(): boolean;
    started(): void;
    completed(): void;
  },
): void {
  const abort = new AbortController();
  const input = new PassThrough({ highWaterMark: chunkBytes });
  let started = false,
    completed = false;
  let writes = Promise.resolve();
  const send = (frame: RunOutput) => {
    const pending = writes.then(() => write(call, frame, abort.signal));
    writes = pending.catch(() => undefined);
    return pending;
  };
  const output = new Output((bytes) => send({ stdout: bytes }));
  const error = new Output((bytes) => send({ stderr: bytes }));
  const cleanup = () => {
    input.destroy();
    output.destroy();
    error.destroy();
  };
  const fail = (code: status, message: string) => {
    abort.abort(new Error(message));
    call.emit("error", Object.assign(new Error(message), { code }));
    cleanup();
  };
  output.on("error", () =>
    fail(
      status.RESOURCE_EXHAUSTED,
      "Invocation output failed or exceeded its buffer limit.",
    ),
  );
  error.on("error", () =>
    fail(
      status.RESOURCE_EXHAUSTED,
      "Invocation diagnostics failed or exceeded its buffer limit.",
    ),
  );
  input.on("error", () => {});
  call.on("error", () => {});
  call.on("cancelled", () => {
    abort.abort(new Error("Client disconnected."));
    cleanup();
  });
  call.on("end", () => {
    if (!started) fail(status.INVALID_ARGUMENT, "Start is required.");
    else input.end();
  });
  const startTimer = setTimeout(
    () => fail(status.DEADLINE_EXCEEDED, "Start deadline exceeded."),
    5000,
  );
  call.on("close", () => clearTimeout(startTimer));
  call.on("data", (message: RunInput__Output) => {
    if (completed && message.payload === "stdin") return;
    if (message.payload === "start" && !started && message.start) {
      started = true;
      clearTimeout(startTimer);
      const first = message.start;
      try {
        validateArgv(first.argv);
      } catch {
        fail(
          status.INVALID_ARGUMENT,
          "Invalid command argument count or byte size.",
        );
        return;
      }
      if (first.protocol !== protocol || first.build !== options.build) {
        fail(
          status.FAILED_PRECONDITION,
          "CLI protocol/build mismatch; stop the existing host before running this build.",
        );
        return;
      }
      if (
        first.cwd.length > 8192 ||
        Object.keys(first.environment).some(
          (key) => !options.environmentKeys.includes(key),
        )
      ) {
        fail(status.INVALID_ARGUMENT, "Invalid invocation metadata.");
        return;
      }
      if (!options.admitted()) {
        fail(
          status.UNAVAILABLE,
          "Host is closing or at capacity; command was not accepted.",
        );
        return;
      }
      options.started();
      void (async () => {
        try {
          const code = await options.application.run(first.argv, {
            input,
            output,
            error,
            signal: abort.signal,
            cwd: first.cwd,
            environment: first.environment,
          });
          if (!abort.signal.aborted) {
            completed = true;
            output.end();
            error.end();
            await Promise.all([finished(output), finished(error)]);
            await send({ exit: { code } });
            call.end();
          }
        } catch {
          if (!abort.signal.aborted)
            fail(status.INTERNAL, "Invocation failed.");
        } finally {
          options.completed();
          clearTimeout(startTimer);
          cleanup();
        }
      })();
    } else if (
      message.payload === "stdin" &&
      started &&
      !completed &&
      message.stdin &&
      message.stdin.length <= chunkBytes
    ) {
      if (!input.write(message.stdin)) {
        call.pause();
        input.once("drain", () => {
          if (!abort.signal.aborted) call.resume();
        });
      }
    } else
      fail(status.INVALID_ARGUMENT, "Invalid invocation frame order or size.");
  });
}

export async function relay(
  client: CliHostClient,
  argv: readonly string[],
  build: string,
  io: CliIo,
  invocation: Pick<CliInvocation, "signal" | "cwd" | "environment"> = {},
): Promise<number> {
  validateArgv(argv);
  const call = client.Run();
  const transportAbort = new AbortController();
  const signal = AbortSignal.any([
    transportAbort.signal,
    ...(invocation.signal ? [invocation.signal] : []),
  ]);
  let exitCode: number | undefined,
    terminal = false;
  let stopInput: () => void = () => {};
  const statusDone = new Promise<void>((resolve, reject) => {
    call.once("status", (result) =>
      result.code === status.OK
        ? resolve()
        : reject(new Error("IPC invocation failed; it was not replayed.")),
    );
  });
  // Attach both rejection handlers immediately: the terminal status can race the read loop.
  void statusDone.catch(() => {});
  call.on("error", () => transportAbort.abort());
  const cancel = () => call.cancel();
  invocation.signal?.addEventListener("abort", cancel, { once: true });
  const sinks = new Set([io.output, io.error]);
  const outputFailed = () => {
    transportAbort.abort();
    call.cancel();
  };
  for (const sink of sinks) {
    sink
      .on("error", outputFailed)
      .on("close", outputFailed)
      .on("finish", outputFailed);
    if (sink.destroyed || sink.writableEnded) outputFailed();
  }
  const sendInput = async (bytes: Buffer) => {
    if (!terminal) await write(call, { stdin: bytes }, signal);
  };
  try {
    await write(
      call,
      {
        start: {
          argv: [...argv],
          protocol,
          build,
          cwd: invocation.cwd ?? process.cwd(),
          environment: invocation.environment ?? {},
        },
      },
      signal,
    );
    if (invocation.signal?.aborted) call.cancel();
    stopInput = forwardInput(
      io.input,
      sendInput,
      () => {
        if (!terminal) call.end();
      },
      () => call.cancel(),
    );
    for await (const frame of call) {
      if (terminal) throw new Error("IPC output after Exit.");
      if (frame.payload === "stdout" && frame.stdout)
        await write(io.output, frame.stdout, signal);
      else if (frame.payload === "stderr" && frame.stderr)
        await write(io.error, frame.stderr, signal);
      else if (
        frame.payload === "exit" &&
        frame.exit &&
        Number.isInteger(frame.exit.code) &&
        frame.exit.code >= 0 &&
        frame.exit.code <= 255
      ) {
        exitCode = frame.exit.code;
        terminal = true;
        stopInput();
      } else throw new Error("Invalid IPC output frame.");
    }
    await statusDone;
    if (exitCode === undefined)
      throw new Error("IPC ended without Exit; invocation was not replayed.");
    return exitCode;
  } catch {
    call.cancel();
    throw new Error(
      invocation.signal?.aborted
        ? "CLI invocation cancelled."
        : "IPC invocation failed; command outcome may be unknown. No replay was attempted.",
    );
  } finally {
    stopInput();
    invocation.signal?.removeEventListener("abort", cancel);
    for (const sink of sinks)
      sink
        .off("error", outputFailed)
        .off("close", outputFailed)
        .off("finish", outputFailed);
  }
}
