import type { Readable, Writable } from "node:stream";
import { StringDecoder } from "node:string_decoder";
import { createInterface } from "node:readline/promises";
import type { AuthDefinition, TokenValidationContext } from "./types.js";

export interface TokenAuthOptions {
  secretName?: string;
  env?: string;
  required?: AuthDefinition["required"];
  validate?: (context: TokenValidationContext) => unknown | Promise<unknown>;
}

export function tokenAuth(options: TokenAuthOptions = {}): AuthDefinition {
  const name = options.secretName ?? "token";
  const validate = async (
    context: Parameters<AuthDefinition["login"]>[0],
    token: string,
  ) =>
    options.validate?.({
      appArguments: context.appArguments,
      profile: context.profile,
      token,
      fetch: context.fetch,
      signal: context.signal,
    });
  return {
    ...(options.required ? { required: options.required } : {}),
    ...(options.env ? { environmentKeys: [options.env] } : {}),
    isReady: async (context) => !!(await context.secrets.get(name)),
    loginOptions: [
      { flags: "--token-stdin", description: "Read the token from stdin" },
    ],
    async login(context, input) {
      if (input.tokenStdin && !context.stdinAvailable) {
        throw new Error(
          "--token-stdin is unavailable through JSON-RPC or programmatic execution because stdin belongs to the transport.",
        );
      }
      let token = input.tokenStdin
        ? await readStdin(context.io.input, context.signal)
        : options.env
          ? context.environment[options.env]
          : undefined;
      if (!input.tokenStdin && !token && context.interactive)
        token = await promptSecret(
          context.io.input,
          context.io.error,
          context.signal,
        );
      if (!token)
        throw new Error(
          `Profile '${context.profile.name}': authentication is missing. No token was provided. ` +
            `Run 'profile configure ${context.profile.name} --token-stdin' or use the documented environment variable.`,
        );
      const identity = await validate(context, token);
      context.signal.throwIfAborted();
      try {
        await context.secrets.set(name, token);
      } catch {
        throw new Error(
          "Could not write the OS credential store. No plaintext fallback is used. Retry 'auth login --token-stdin'.",
        );
      }
      return { authenticated: true, identity: identity ?? null };
    },
    async status(context) {
      const token = await context.secrets.get(name);
      if (!token) return { authenticated: false };
      return {
        authenticated: true,
        identity: (await validate(context, token)) ?? null,
      };
    },
    async logout(context) {
      await context.secrets.delete(name);
    },
  };
}

export function readStdin(
  input: Readable,
  signal?: AbortSignal,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const cleanup = () => {
      input.pause();
      input
        .off("data", data)
        .off("end", end)
        .off("error", fail)
        .off("close", closed);
      signal?.removeEventListener("abort", cancel);
    };
    const fail = (error: Error) => {
      cleanup();
      reject(error);
    };
    const cancel = () => fail(new Error("Authentication cancelled."));
    const closed = () =>
      fail(new Error("Authentication input closed before EOF."));
    const end = () => {
      cleanup();
      resolve(Buffer.concat(chunks).toString("utf8").trim());
    };
    const data = (chunk: Buffer | string) => {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      chunks.push(bytes);
    };
    if (signal?.aborted) {
      cancel();
      return;
    }
    if (input.readableEnded) {
      end();
      return;
    }
    if (input.destroyed) {
      closed();
      return;
    }
    input
      .on("data", data)
      .once("end", end)
      .once("error", fail)
      .once("close", closed);
    signal?.addEventListener("abort", cancel, { once: true });
    input.resume();
  });
}

interface TtyReadable extends Readable {
  isTTY?: boolean;
  setRawMode?: (enabled: boolean) => void;
  isRaw?: boolean;
}

interface TtyWritable extends Writable {
  isTTY?: boolean;
  columns?: number;
}

export function canPrompt(input: Readable, output: Writable): boolean {
  return (
    (input as TtyReadable).isTTY === true &&
    (output as TtyWritable).isTTY === true
  );
}

export async function promptText(
  input: Readable,
  output: Writable,
  label: string,
  signal?: AbortSignal,
): Promise<string> {
  if (!canPrompt(input, output)) {
    throw new Error("Interactive profile configuration requires a TTY.");
  }
  const prompt = createInterface({ input, output, terminal: false });
  try {
    return (await prompt.question(`${label}: `, { signal })).trim();
  } finally {
    prompt.close();
  }
}

export async function promptSecret(
  input: Readable,
  output: Writable,
  signal?: AbortSignal,
): Promise<string> {
  const ttyInput = input as TtyReadable;
  if (!canPrompt(input, output) || !ttyInput.setRawMode) {
    throw new Error(
      "No token was provided. Use --token-stdin or the documented environment variable.",
    );
  }

  if (signal?.aborted) throw new Error("Authentication cancelled.");
  const wasRaw = ttyInput.isRaw === true;
  const characters: string[] = [];
  const decoder = new StringDecoder("utf8");
  const render = (): void => {
    // Keep the mask on one row, leaving the final column unused to avoid wrapping.
    // The complete candidate stays in memory even when its mask is clipped.
    const columns = (output as TtyWritable).columns || 80;
    const width = Math.max(1, columns - 1);
    const label = "Token: ".slice(0, Math.max(0, width - 1));
    const capacity = Math.min(60, width - label.length);
    const mask = characters.length > capacity
      ? "+" + "*".repeat(capacity - 1)
      : "*".repeat(characters.length);
    output.write("\r\u001b[2K" + label + mask);
  };
  render();
  ttyInput.setRawMode(true);

  return new Promise<string>((resolve, reject) => {
    let settled = false;
    const restore = (): void => {
      settled = true;
      ttyInput.off("data", onData);
      ttyInput.off("end", cancel).off("close", cancel).off("error", cancel);
      signal?.removeEventListener("abort", cancel);
      ttyInput.setRawMode?.(wasRaw);
      ttyInput.pause();
      output.write("\n");
    };

    const cancel = () => {
      if (settled) return;
      render();
      restore();
      reject(new Error("Authentication cancelled."));
    };
    const onData = (chunk: Buffer | string): void => {
      if (settled) return;
      const text = typeof chunk === "string" ? chunk : decoder.write(chunk);
      for (const character of text) {
        if (character === "\r" || character === "\n") {
          // A delayed LF from the previous text prompt must not submit an empty secret.
          if (!characters.length) {
            continue;
          }
          render();
          restore();
          resolve(characters.join(""));
          return;
        }
        if (character === "\u0003") {
          cancel();
          return;
        }
        if (character === "\u007f" || character === "\b") {
          characters.pop();
          continue;
        }
        if (character >= " ") {
          characters.push(character);
        }
      }
      render();
    };

    if (input.destroyed || input.readableEnded) {
      cancel();
      return;
    }
    ttyInput
      .on("data", onData)
      .once("end", cancel)
      .once("close", cancel)
      .once("error", cancel);
    signal?.addEventListener("abort", cancel, { once: true });
    ttyInput.resume();
  });
}
