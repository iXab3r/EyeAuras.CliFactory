import { once } from "node:events";
import { requestLines } from "./lines.js";
import { validateArgv } from "./argv.js";
import { CliError } from "./errors.js";
import type { Readable, Writable } from "node:stream";

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: unknown;
}

interface ExecuteParams {
  argv: string[];
}

function isRequest(value: unknown): value is JsonRpcRequest {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Partial<JsonRpcRequest>;
  return candidate.jsonrpc === "2.0" && typeof candidate.method === "string";
}

function executeParams(value: unknown): ExecuteParams | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  const argv = (value as Partial<ExecuteParams>).argv;
  try {
    validateArgv(argv);
    return { argv: [...argv] };
  } catch {
    return undefined;
  }
}

async function response(
  output: Writable,
  value: unknown,
  signal?: AbortSignal,
): Promise<void> {
  if (output.destroyed || output.writableEnded)
    throw new Error("JSON-RPC output is closed.");
  const closed = new AbortController();
  const onClose = () =>
    closed.abort(new Error("JSON-RPC output closed while writing."));
  output.once("close", onClose);
  try {
    if (!output.write(`${JSON.stringify(value)}\n`))
      await once(output, "drain", {
        signal: signal
          ? AbortSignal.any([signal, closed.signal])
          : closed.signal,
      });
  } finally {
    output.off("close", onClose);
  }
}

function errorResponse(
  output: Writable,
  id: JsonRpcRequest["id"],
  code: number,
  message: string,
  signal?: AbortSignal,
  data?: Record<string, unknown>,
): Promise<void> {
  return response(
    output,
    {
      jsonrpc: "2.0",
      id: id ?? null,
      error: { code, message, ...(data === undefined ? {} : { data }) },
    },
    signal,
  );
}

/** Machine form of a CliError: follow-up argv are ready for cli.execute in the same profile. */
function cliErrorData(error: CliError): Record<string, unknown> {
  const profile = error.profile;
  return {
    code: error.code,
    exitCode: error.exitCode,
    ...(profile === undefined ? {} : { profile }),
    ...(error.next.length === 0
      ? {}
      : { next: error.next.map((argv) => (profile === undefined ? [...argv] : [...argv, "--profile", profile])) }),
    ...(error.result === undefined ? {} : { result: error.result }),
  };
}

export async function runJsonRpc(options: {
  input: Readable;
  output: Writable;
  execute: (argv: readonly string[]) => Promise<unknown>;
  signal?: AbortSignal;
}): Promise<void> {
  options.signal?.throwIfAborted();
  for await (const line of requestLines(
    options.input,
    options.signal,
  )) {
    options.signal?.throwIfAborted();
    if (!line.trim()) {
      continue;
    }

    let request: unknown;
    try {
      request = JSON.parse(line);
    } catch {
      await errorResponse(
        options.output,
        null,
        -32700,
        "Parse error",
        options.signal,
      );
      continue;
    }

    if (!isRequest(request)) {
      await errorResponse(
        options.output,
        null,
        -32600,
        "Invalid Request",
        options.signal,
      );
      continue;
    }

    const expectsResponse = request.id !== undefined;
    if (request.method !== "cli.execute") {
      if (expectsResponse) {
        await errorResponse(
          options.output,
          request.id,
          -32601,
          "Method not found",
          options.signal,
        );
      }
      continue;
    }

    const params = executeParams(request.params);
    if (!params) {
      if (expectsResponse) {
        await errorResponse(
          options.output,
          request.id,
          -32602,
          "Expected params.argv to be an array of strings",
          options.signal,
        );
      }
      continue;
    }

    let result: unknown;
    try {
      result = await options.execute(params.argv);
    } catch (error) {
      if (expectsResponse)
        await errorResponse(
          options.output,
          request.id,
          -32000,
          error instanceof Error ? error.message : String(error),
          options.signal,
          error instanceof CliError ? cliErrorData(error) : undefined,
        );
      continue;
    }
    if (expectsResponse)
      await response(
        options.output,
        {
          jsonrpc: "2.0",
          id: request.id ?? null,
          result: result ?? null,
        },
        options.signal,
      );
  }
}
