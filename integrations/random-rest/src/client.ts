import type { IntegerRequest, RandomClient, RandomRange, RandomValues } from "./models.js";
import { contactEmail, integerRequest, sequenceRequest, serviceUrl } from "./validation.js";

export interface RandomHttpClientOptions {
  url: string;
  contact: string;
  fetch?: typeof globalThis.fetch;
}

export class RandomHttpClient implements RandomClient {
  readonly #url: URL;
  readonly #userAgent: string;
  readonly #fetch: typeof globalThis.fetch;
  #pending: Promise<void> = Promise.resolve();
  #blockedUntil = 0;

  constructor(options: RandomHttpClientOptions) {
    this.#url = serviceUrl(options.url);
    this.#userAgent = `random-rest-cli/0.1.0 (${contactEmail(options.contact)})`;
    this.#fetch = options.fetch ?? globalThis.fetch;
  }

  async integers(request: IntegerRequest, signal?: AbortSignal): Promise<RandomValues> {
    const validated = integerRequest(request);
    return this.#generate("integers/", {
      num: String(validated.count), min: String(validated.min), max: String(validated.max),
      col: "1", base: "10", format: "plain", rnd: "new",
    }, validated, validated.count, false, signal);
  }

  async sequence(request: RandomRange, signal?: AbortSignal): Promise<RandomValues> {
    const validated = sequenceRequest(request);
    return this.#generate("sequences/", {
      min: String(validated.min), max: String(validated.max), col: "1", format: "plain", rnd: "new",
    }, validated, validated.max - validated.min + 1, true, signal);
  }

  #generate(path: string, parameters: Record<string, string>, range: RandomRange,
    count: number, unique: boolean, signal?: AbortSignal): Promise<RandomValues> {
    // Serialize this client's quota+generation pair. This is not a cross-process scheduler.
    const operation = this.#pending.then(async () => {
      if (signal?.aborted) throw new Error("RANDOM.ORG request cancelled.");
      if (Date.now() < this.#blockedUntil) throw this.#quotaError();
      const quotaText = await this.#text("quota/", { format: "plain" }, signal);
      const quota = Number(quotaText.trim());
      if (!/^-?\d+$/.test(quotaText.trim()) || !Number.isSafeInteger(quota)) {
        throw new Error("RANDOM.ORG returned an invalid quota response.");
      }
      if (quota < 0) {
        this.#blockedUntil = Date.now() + 10 * 60_000;
        throw this.#quotaError();
      }
      const text = await this.#text(path, parameters, signal);
      const parts = text.trim().split(/\s+/);
      const values = parts.map(Number);
      if (parts.length !== count || parts.some((part) => !/^-?\d+$/.test(part)) ||
          values.some((value) => !Number.isSafeInteger(value) || value < range.min || value > range.max) ||
          (unique && new Set(values).size !== count)) {
        throw new Error("RANDOM.ORG returned invalid random values (count, range or uniqueness).");
      }
      return { values };
    });
    this.#pending = operation.then(() => undefined, () => undefined);
    return operation;
  }

  #quotaError(): Error {
    return new Error("RANDOM.ORG quota is exhausted. Wait at least 10 minutes before trying again.");
  }

  async #text(path: string, parameters: Record<string, string>, signal?: AbortSignal): Promise<string> {
    const url = new URL(path, this.#url);
    url.search = new URLSearchParams(parameters).toString();
    const timeout = AbortSignal.timeout(120_000);
    const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
    try {
      requestSignal.throwIfAborted();
      const response = await this.#fetch(url, {
        headers: { Accept: "text/plain", "User-Agent": this.#userAgent },
        signal: requestSignal,
        redirect: "error",
      });
      if (!response.ok) {
        // Do not wait for cancellation of a tee'd stream's other consumer (e.g. instrumentation).
        void response.body?.cancel().catch(() => undefined);
        throw new Error(`RANDOM.ORG HTTP request failed (${response.status}). No automatic retry was made.`);
      }
      // A bounded example must not buffer an arbitrary error page or oversized response.
      const reader = response.body?.getReader();
      if (!reader) throw new Error("RANDOM.ORG returned an empty response.");
      const decoder = new TextDecoder();
      let text = "";
      let bytes = 0;
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          bytes += chunk.value.byteLength;
          if (bytes > 16_384) {
            void reader.cancel().catch(() => undefined);
            throw new Error("RANDOM.ORG response exceeded the example's size limit.");
          }
          text += decoder.decode(chunk.value, { stream: true });
        }
        text += decoder.decode();
      } finally { reader.releaseLock(); }
      if (text.trimStart().startsWith("Error:")) {
        throw new Error("RANDOM.ORG returned a service error. No automatic retry was made.");
      }
      return text;
    } catch (error) {
      if (requestSignal.aborted) {
        throw new Error(signal?.aborted ? "RANDOM.ORG request cancelled." : "RANDOM.ORG request timed out.");
      }
      if (error instanceof Error && error.message.startsWith("RANDOM.ORG ")) throw error;
      throw new Error("RANDOM.ORG request failed. Check connectivity; no automatic retry was made.");
    }
  }
}
