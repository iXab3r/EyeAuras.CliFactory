import { failedCommandOutput, writeOutput } from "./output-write.js";
import { requestLines } from "./lines.js";
import { globalFlagRequested, validateArgv } from "./argv.js";
import { CliError, machineError } from "./errors.js";
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
  await writeOutput(output, `${JSON.stringify(value)}\n`, signal);
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

/** Every command failure carries its machine form; a failed outcome also keeps its result. */
function errorData(error: unknown, argv: readonly string[]): { message: string; data: Record<string, unknown> } {
  const { message, ...data } = machineError(error, { verbose: globalFlagRequested(argv, "--verbose") });
  return {
    message,
    data: error instanceof CliError && error.result !== undefined ? { ...data, result: error.result } : data,
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
      // Preserve a command/cleanup failure when the disconnected transport cannot report it.
      if (options.output.destroyed || options.output.writableEnded) throw error;
      if (expectsResponse) {
        const { message, data } = errorData(error, params.argv);
        try { await errorResponse(options.output, request.id, -32000, message, options.signal, data); }
        catch (writeError) { throw failedCommandOutput(error, writeError); }
      }
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
