interface Pending {
  exclusive: boolean;
  start(): void;
  abort(): void;
}

/** Bounded FIFO; built-ins coordinate application-wide profile/auth changes. */
export class CommandGate {
  #running = 0;
  #exclusive = false;
  #pending: Pending[] = [];
  constructor(
    private readonly limit = Infinity,
    private readonly maxPending = 128,
  ) {
    if (limit !== Infinity && (!Number.isSafeInteger(limit) || limit < 1)) {
      throw new Error("concurrency must be a positive integer or omitted.");
    }
  }
  run<T>(
    work: () => Promise<T>,
    signal: AbortSignal,
    exclusive = false,
  ): Promise<T> {
    if (signal.aborted) return Promise.reject(new Error("Command cancelled."));
    if (this.#pending.length >= this.maxPending)
      return Promise.reject(new Error("CLI command queue is full."));
    return new Promise<T>((resolve, reject) => {
      const pending: Pending = {
        exclusive,
        abort: () => {
          const index = this.#pending.indexOf(pending);
          if (index >= 0) this.#pending.splice(index, 1);
          signal.removeEventListener("abort", pending.abort);
          reject(new Error("Command cancelled while queued."));
          this.#pump();
        },
        start: () => {
          signal.removeEventListener("abort", pending.abort);
          this.#running++;
          if (exclusive) this.#exclusive = true;
          void Promise.resolve()
            .then(work)
            .then(resolve, reject)
            .finally(() => {
              this.#running--;
              if (exclusive) this.#exclusive = false;
              this.#pump();
            });
        },
      };
      this.#pending.push(pending);
      signal.addEventListener("abort", pending.abort, { once: true });
      this.#pump();
    });
  }
  #pump(): void {
    while (
      this.#pending.length &&
      !this.#exclusive &&
      this.#running < this.limit
    ) {
      const next = this.#pending[0]!;
      if (next.exclusive && this.#running) break;
      this.#pending.shift();
      next.start();
    }
  }
}
