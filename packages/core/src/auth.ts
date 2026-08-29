import type { Readable, Writable } from "node:stream";
import { createInterface } from "node:readline/promises";
import type { TokenAuthDefinition } from "./types.js";

export interface TokenAuthOptions {
  secretName?: string;
  env?: string;
  required?: TokenAuthDefinition["required"];
  validate?: TokenAuthDefinition["validate"];
}

export function tokenAuth(options: TokenAuthOptions = {}): TokenAuthDefinition {
  const definition: TokenAuthDefinition = {
    kind: "token",
    secretName: options.secretName ?? "token",
  };
  if (options.env !== undefined) {
    definition.environmentVariable = options.env;
  }
  if (options.required !== undefined) {
    definition.required = options.required;
  }
  if (options.validate !== undefined) {
    definition.validate = options.validate;
  }
  return definition;
}

export async function readStdin(input: Readable): Promise<string> {
  let value = "";
  input.setEncoding("utf8");
  for await (const chunk of input) {
    value += chunk;
  }
  return value.trim();
}

interface TtyReadable extends Readable {
  isTTY?: boolean;
  setRawMode?: (enabled: boolean) => void;
}

interface TtyWritable extends Writable {
  isTTY?: boolean;
}

export function canPrompt(input: Readable, output: Writable): boolean {
  return (input as TtyReadable).isTTY === true && (output as TtyWritable).isTTY === true;
}

export async function promptText(
  input: Readable,
  output: Writable,
  label: string,
): Promise<string> {
  if (!canPrompt(input, output)) {
    throw new Error("Interactive profile configuration requires a TTY.");
  }
  const prompt = createInterface({ input, output, terminal: false });
  try {
    return (await prompt.question(`${label}: `)).trim();
  } finally {
    prompt.close();
  }
}

export async function promptSecret(input: Readable, output: Writable): Promise<string> {
  const ttyInput = input as TtyReadable;
  if (!canPrompt(input, output) || !ttyInput.setRawMode) {
    throw new Error("No token was provided. Use --token-stdin or the documented environment variable.");
  }

  output.write("Token: ");
  ttyInput.setRawMode(true);
  ttyInput.resume();
  let value = "";

  return new Promise<string>((resolve, reject) => {
    const restore = (): void => {
      ttyInput.off("data", onData);
      ttyInput.setRawMode?.(false);
      ttyInput.pause();
      output.write("\n");
    };

    const onData = (chunk: Buffer | string): void => {
      const text = chunk.toString();
      for (const character of text) {
        if (character === "\r" || character === "\n") {
          restore();
          resolve(value);
          return;
        }
        if (character === "\u0003") {
          restore();
          reject(new Error("Authentication cancelled."));
          return;
        }
        if (character === "\u007f" || character === "\b") {
          value = value.slice(0, -1);
          continue;
        }
        if (character >= " ") {
          value += character;
        }
      }
    };

    ttyInput.on("data", onData);
  });
}
