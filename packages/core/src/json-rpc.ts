import { createInterface } from "node:readline";
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
  return Array.isArray(argv) && argv.every((entry) => typeof entry === "string")
    ? { argv }
    : undefined;
}

function response(output: Writable, value: unknown): void {
  output.write(`${JSON.stringify(value)}\n`);
}

function errorResponse(
  output: Writable,
  id: JsonRpcRequest["id"],
  code: number,
  message: string,
): void {
  response(output, {
    jsonrpc: "2.0",
    id: id ?? null,
    error: { code, message },
  });
}

export async function runJsonRpc(options: {
  input: Readable;
  output: Writable;
  execute: (argv: readonly string[]) => Promise<unknown>;
}): Promise<void> {
  const lines = createInterface({ input: options.input, crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line.trim()) {
      continue;
    }

    let request: unknown;
    try {
      request = JSON.parse(line);
    } catch {
      errorResponse(options.output, null, -32700, "Parse error");
      continue;
    }

    if (!isRequest(request)) {
      errorResponse(options.output, null, -32600, "Invalid Request");
      continue;
    }

    const expectsResponse = request.id !== undefined;
    if (request.method !== "cli.execute") {
      if (expectsResponse) {
        errorResponse(options.output, request.id, -32601, "Method not found");
      }
      continue;
    }

    const params = executeParams(request.params);
    if (!params) {
      if (expectsResponse) {
        errorResponse(options.output, request.id, -32602, "Expected params.argv to be a string array");
      }
      continue;
    }

    try {
      const result = await options.execute(params.argv);
      if (expectsResponse) {
        response(options.output, { jsonrpc: "2.0", id: request.id ?? null, result: result ?? null });
      }
    } catch (error) {
      if (expectsResponse) {
        errorResponse(
          options.output,
          request.id,
          -32000,
          error instanceof Error ? error.message : String(error),
        );
      }
    }
  }
}
