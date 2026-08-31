import { once } from "node:events";
import { boundedLines } from "./bounded-lines.js";
import { inputLimits, validateArgv } from "./input-limits.js";
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
): Promise<void> {
  return response(
    output,
    {
      jsonrpc: "2.0",
      id: id ?? null,
      error: { code, message },
    },
    signal,
  );
}

export async function runJsonRpc(options: {
  input: Readable;
  output: Writable;
  execute: (argv: readonly string[]) => Promise<unknown>;
  signal?: AbortSignal;
}): Promise<void> {
  options.signal?.throwIfAborted();
  for await (const line of boundedLines(
    options.input,
    inputLimits.rpcLineBytes,
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
          "Expected params.argv within the command argument count and byte limits",
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
