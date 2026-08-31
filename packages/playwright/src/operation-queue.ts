import { BrowserOperationError } from "./errors.js";

interface Pending {
  compatible(): boolean;
  start(): void;
  abort(): void;
}

/** FIFO admission, not a command scheduler. Preparation is serial; compatible work is parallel. */
export class OperationQueue {
  #active = 0;
  #preparing = false;
  #pending: Pending[] = [];

  run<T>(
    compatible: () => boolean,
    prepare: () => Promise<void>,
    work: () => Promise<T>,
    signal: AbortSignal,
  ): Promise<T> {
    if (signal.aborted) return Promise.reject(new Error("Cancelled."));
    if (this.#pending.length >= 128)
      return Promise.reject(
        new BrowserOperationError("Browser operation queue is full."),
      );
    return new Promise<T>((resolve, reject) => {
      const pending: Pending = {
        compatible,
        abort: () => {
          const index = this.#pending.indexOf(pending);
          if (index >= 0) this.#pending.splice(index, 1);
          signal.removeEventListener("abort", pending.abort);
          reject(new Error("Cancelled."));
          this.#pump();
        },
        start: () => {
          signal.removeEventListener("abort", pending.abort);
          this.#active++;
          this.#preparing = true;
          void (async () => {
            try {
              try {
                await prepare();
              } finally {
                this.#preparing = false;
                this.#pump();
              }
              if (signal.aborted) throw new Error("Cancelled.");
              return await work();
            } finally {
              this.#active--;
              this.#pump();
            }
          })().then(resolve, reject);
        },
      };
      this.#pending.push(pending);
      signal.addEventListener("abort", pending.abort, { once: true });
      this.#pump();
    });
  }
  #pump(): void {
    if (this.#preparing) return;
    const next = this.#pending[0];
    if (!next || (this.#active && !next.compatible())) return;
    this.#pending.shift();
    next.start();
  }
}
