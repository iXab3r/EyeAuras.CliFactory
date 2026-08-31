import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from "playwright";
import { privateDirectory, type IAppArguments } from "@eyeauras/cli-factory";
import { readFile, writeFile, rename, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { BrowserOperationError } from "./errors.js";
export { BrowserOperationError } from "./errors.js";
import { OperationQueue } from "./operation-queue.js";
export {
  browserCommandOptions,
  browserOperationOptions,
} from "./command-options.js";

export interface BrowserProfile {
  appArguments: IAppArguments;
  baseURL: string;
  userAgent?: string;
  /** Explicit credential-file opt-in; false for anonymous public operations. */
  persistAuth?: boolean;
}
interface Entry {
  identity: string;
  context: Promise<BrowserContext>;
  settings: BrowserProfile;
  browser?: Browser;
  recordVideo: boolean;
}
export interface BrowserRuntimeOptions {
  /** Default for direct withPage callers; CLI helper defaults to headless. */
  headless?: boolean;
  /** False rejects mode-driven browser/context replacement; initial creation remains allowed. */
  allowRestart?: boolean;
  /** Test boundary injection; browser traffic must not escape fixtures. */
  prepareContext?: (context: BrowserContext) => Promise<void>;
}
export interface BrowserOperationOptions {
  headless?: boolean;
  recordVideo?: boolean;
  /** Called only after a video is finalized; must not write domain/protocol stdout. */
  onVideo?: (path: string) => void | Promise<void>;
}

/** Browser mechanics only. The integration owns selectors, login and postconditions. */
export class BrowserRuntime {
  #browser: Promise<Browser> | undefined;
  #entries = new Map<string, Entry>();
  #writes = new Map<string, Promise<void>>();
  #retired = new Set<Promise<void>>();
  #closing = false;
  #dispose: Promise<void> | undefined;
  #launches = 0;
  #identity = "";
  #pages = 0;
  #headless: boolean | undefined;
  #queue = new OperationQueue();
  #lifetime = new AbortController();
  #operations = new Set<Promise<unknown>>();
  #forcedClose = false;
  constructor(private readonly options: BrowserRuntimeOptions = {}) {}
  get diagnostics() {
    return {
      launches: this.#launches,
      browserIdentity: this.#identity,
      contexts: this.#entries.size,
      pages: this.#pages,
      headless: this.#headless,
    };
  }
  #paths(app: IAppArguments) {
    const directory = join(app.AppDataDirectory, "browser");
    return { directory, state: join(directory, "auth-state.json") };
  }
  async #getBrowser(headless: boolean): Promise<Browser> {
    if (this.#closing)
      throw new BrowserOperationError("Browser runtime is disposed.");
    if (!this.#browser) {
      this.#headless = headless;
      const pending = chromium
        .launch({ headless })
        .then(async (browser) => {
          if (this.#closing) {
            await browser.close();
            throw new BrowserOperationError("Browser runtime is closing.");
          }
          browser.once("disconnected", () => {
            if (this.#browser === pending) this.#browser = undefined;
            for (const [key, entry] of this.#entries)
              if (entry.browser === browser) this.#entries.delete(key);
          });
          this.#launches++;
          this.#identity = randomUUID();
          return browser;
        })
        .catch(() => {
          throw new BrowserOperationError(
            "Cannot launch Chromium. Install the matching browser with playwright install chromium, check OS dependencies and an interactive display for headed mode. No headless fallback was made.",
          );
        });
      this.#browser = pending;
      void pending.catch(() => {
        if (this.#browser === pending) this.#browser = undefined;
      });
    }
    return this.#browser;
  }
  #close(entry: Entry): Promise<void> {
    const closing = entry.context
      .catch(() => undefined)
      .then(async (context) => {
        try {
          await context?.close();
        } catch {
          throw new BrowserOperationError("Browser context cleanup failed.");
        }
      });
    this.#retired.add(closing);
    void closing
      .finally(() => this.#retired.delete(closing))
      .catch(() => undefined);
    return closing;
  }
  #profileIdentity(settings: BrowserProfile): string {
    return JSON.stringify({
      baseURL: settings.baseURL,
      userAgent: settings.userAgent ?? "",
      persistAuth: settings.persistAuth === true,
    });
  }
  #compatible(
    settings: BrowserProfile,
    headless: boolean,
    recordVideo: boolean,
  ): boolean {
    if (this.#browser && this.#headless !== headless) return false;
    const entry = this.#entries.get(settings.appArguments.AppDataDirectory);
    return (
      !entry ||
      (entry.identity === this.#profileIdentity(settings) &&
        entry.recordVideo === recordVideo)
    );
  }
  async #prepare(
    settings: BrowserProfile,
    headless: boolean,
    recordVideo: boolean,
  ): Promise<Entry> {
    if (this.#closing)
      throw new BrowserOperationError("Browser runtime is disposed.");
    const current = this.#entries.get(settings.appArguments.AppDataDirectory);
    const browserChange = !!this.#browser && this.#headless !== headless;
    const recordingChange = !!current && current.recordVideo !== recordVideo;
    if (
      (browserChange || recordingChange) &&
      this.options.allowRestart === false
    )
      throw new BrowserOperationError(
        "Automatic browser mode changes are disabled by this application. Dispose the runtime before changing headed/video settings.",
      );
    if (browserChange) {
      // Admission has drained all operations, including page/video finalization.
      const entries = [...this.#entries.values()];
      this.#entries.clear();
      const results = await Promise.allSettled(
        entries.map((entry) => this.#close(entry)),
      );
      const browser = await this.#browser?.catch(() => undefined);
      await browser?.close();
      this.#browser = undefined;
      if (results.some((result) => result.status === "rejected"))
        throw new BrowserOperationError(
          "Browser context cleanup failed during mode change.",
        );
    }
    const entry = this.#entry(settings, headless, recordVideo);
    await entry.context;
    return entry;
  }
  #entry(
    settings: BrowserProfile,
    headless: boolean,
    recordVideo: boolean,
  ): Entry {
    if (this.#closing)
      throw new BrowserOperationError("Browser runtime is disposed.");
    const key = settings.appArguments.AppDataDirectory;
    const identity = this.#profileIdentity(settings);
    const current = this.#entries.get(key);
    if (current?.identity === identity && current.recordVideo === recordVideo)
      return current;
    // Install the new epoch synchronously; concurrent callers cannot create duplicate contexts.
    const previous = current ? this.#close(current) : Promise.resolve();
    const entry: Entry = {
      identity,
      settings,
      recordVideo,
      context: Promise.resolve().then(async () => {
        await previous;
        let stored:
          | Awaited<ReturnType<BrowserContext["storageState"]>>
          | undefined;
        if (settings.persistAuth) {
          const paths = this.#paths(settings.appArguments);
          await privateDirectory(paths.directory);
          await this.#writes.get(key);
          try {
            if ((await stat(paths.state)).size > 4_194_304)
              throw new Error("Oversized browser state.");
            const value = JSON.parse(await readFile(paths.state, "utf8")) as {
              identity: string;
              state: typeof stored;
            };
            if (value.identity === identity) stored = value.state;
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT")
              throw new BrowserOperationError(
                "Cannot read browser authentication state. Clear it explicitly before logging in again.",
              );
          }
        }
        let videoDirectory: string | undefined;
        if (recordVideo) {
          const artifacts = join(
            this.#paths(settings.appArguments).directory,
            "artifacts",
          );
          await privateDirectory(artifacts);
          const pending = join(artifacts, ".pending");
          await privateDirectory(pending);
          videoDirectory = join(pending, randomUUID());
          await privateDirectory(videoDirectory);
        }
        const browser = await this.#getBrowser(headless);
        entry.browser = browser;
        const context = await browser.newContext({
          baseURL: settings.baseURL,
          serviceWorkers: "block",
          ...(videoDirectory ? { recordVideo: { dir: videoDirectory } } : {}),
          ...(settings.userAgent ? { userAgent: settings.userAgent } : {}),
          ...(stored ? { storageState: stored } : {}),
        });
        try {
          if (this.#closing || this.#entries.get(key) !== entry)
            throw new Error("Invalidated profile.");
          await this.options.prepareContext?.(context);
          return context;
        } catch (error) {
          await context.close();
          throw error;
        }
      }),
    };
    this.#entries.set(key, entry);
    void entry.context.catch(() => {
      if (this.#entries.get(key) === entry) this.#entries.delete(key);
    });
    return entry;
  }
  #write(key: string, work: () => Promise<void>): Promise<void> {
    const operation = (this.#writes.get(key) ?? Promise.resolve()).then(work);
    const tail = operation.catch(() => undefined);
    this.#writes.set(key, tail);
    void tail.then(() => {
      if (this.#writes.get(key) === tail) this.#writes.delete(key);
    });
    return operation;
  }
  async #checkpoint(entry: Entry): Promise<void> {
    if (!entry.settings.persistAuth) return;
    const key = entry.settings.appArguments.AppDataDirectory;
    await this.#write(key, async () => {
      if (this.#closing || this.#entries.get(key) !== entry) return;
      const state = await (
        await entry.context
      ).storageState({ indexedDB: true });
      if (this.#closing || this.#entries.get(key) !== entry) return;
      const path = this.#paths(entry.settings.appArguments).state;
      const temporary = path + "." + randomUUID() + ".tmp";
      try {
        const serialized = JSON.stringify({ identity: entry.identity, state });
        if (Buffer.byteLength(serialized) > 4_194_304)
          throw new BrowserOperationError(
            "Browser authentication state exceeds its size limit.",
          );
        await writeFile(temporary, serialized, { mode: 0o600 });
        await rename(temporary, path);
      } finally {
        await rm(temporary, { force: true });
      }
    });
  }
  async withPage<T>(
    settings: BrowserProfile,
    signal: AbortSignal,
    action: (page: Page) => Promise<T>,
    options: BrowserOperationOptions = {},
  ): Promise<T> {
    if (this.#closing)
      throw new BrowserOperationError("Browser runtime is disposed.");
    // Snapshot each caller's settings; neither queued callers nor cached clients mutate modes.
    settings = { ...settings };
    options = { ...options };
    const headless = options.headless ?? this.options.headless ?? true;
    const recordVideo = options.recordVideo === true;
    const bounded = AbortSignal.any([signal, this.#lifetime.signal]);
    let entry!: Entry;
    let operation: Promise<T> | undefined;
    try {
      operation = this.#queue.run(
        () => this.#compatible(settings, headless, recordVideo),
        async () => {
          if (bounded.aborted) throw new Error("Cancelled.");
          entry = await this.#prepare(settings, headless, recordVideo);
        },
        () => this.#operate(entry, bounded, action, options),
        bounded,
      );
      this.#operations.add(operation);
      return await operation;
    } catch (error) {
      if (error instanceof BrowserOperationError) throw error;
      if (bounded.aborted)
        throw new BrowserOperationError("Browser operation cancelled.");
      throw new BrowserOperationError(
        "Browser operation failed (navigation, page, state or timeout). No action was replayed.",
      );
    } finally {
      if (operation) this.#operations.delete(operation);
    }
  }
  async #operate<T>(
    entry: Entry,
    signal: AbortSignal,
    action: (page: Page) => Promise<T>,
    options: BrowserOperationOptions,
  ): Promise<T> {
    let page: Page | undefined;
    let failure: BrowserOperationError | undefined;
    let result!: T;
    const pages = new Set<Page>();
    const track = (owned: Page) => {
      pages.add(owned);
      owned.on("popup", track);
      if (signal.aborted) void owned.close().catch(() => undefined);
    };
    const cancel = () => {
      for (const owned of pages) void owned.close().catch(() => undefined);
    };
    signal.addEventListener("abort", cancel, { once: true });
    try {
      if (signal.aborted) throw new Error("Cancelled.");
      const context = await entry.context;
      if (signal.aborted) throw new Error("Cancelled.");
      page = await context.newPage();
      track(page);
      this.#pages++;
      if (signal.aborted) throw new Error("Cancelled.");
      page.setDefaultTimeout(120000);
      page.setDefaultNavigationTimeout(120000);
      result = await action(page);
      if (signal.aborted) throw new Error("Cancelled.");
      if (
        this.#entries.get(entry.settings.appArguments.AppDataDirectory) !==
        entry
      )
        throw new Error("Invalidated profile.");
      await this.#checkpoint(entry);
      if (
        this.#entries.get(entry.settings.appArguments.AppDataDirectory) !==
        entry
      )
        throw new Error("Invalidated profile.");
    } catch (error) {
      // Playwright call logs may contain URLs, DOM and credentials. Never forward them.
      failure = signal.aborted
        ? new BrowserOperationError("Browser operation cancelled.")
        : error instanceof BrowserOperationError
          ? error
          : new BrowserOperationError(
              "Browser operation failed (navigation, page, state or timeout). No action was replayed.",
            );
    } finally {
      try {
        // Set iteration also visits popups added while parent pages are closing.
        for (const owned of pages) await owned.close().catch(() => undefined);
        if (entry.recordVideo && pages.size && !this.#forcedClose) {
          const directory = join(
            this.#paths(entry.settings.appArguments).directory,
            "artifacts",
            randomUUID(),
          );
          await privateDirectory(directory);
          let index = 0;
          for (const owned of pages) {
            if (this.#forcedClose) throw new Error("Forced shutdown.");
            const video = owned.video();
            if (!video) throw new Error("Missing video.");
            const path = join(directory, "page-" + ++index + ".webm");
            await video.saveAs(path);
            await video.delete();
            await options.onVideo?.(path);
          }
        }
      } catch {
        failure = new BrowserOperationError(
          (failure ? failure.message + " " : "") +
            "Browser video finalization or artifact reporting failed. Protected partial files may remain; no action was replayed.",
        );
      } finally {
        signal.removeEventListener("abort", cancel);
        for (const owned of pages) owned.off("popup", track);
        if (page) this.#pages--;
      }
    }
    if (failure) throw failure;
    if (signal.aborted)
      throw new BrowserOperationError("Browser operation cancelled.");
    return result;
  }
  async invalidateProfile(app: IAppArguments): Promise<void> {
    const key = app.AppDataDirectory,
      entry = this.#entries.get(key);
    this.#entries.delete(key);
    if (entry) await this.#close(entry);
  }
  async clearAuth(app: IAppArguments): Promise<void> {
    const closing = this.invalidateProfile(app);
    const deletion = this.#write(app.AppDataDirectory, () =>
      rm(this.#paths(app).state, { force: true }),
    );
    await Promise.all([closing, deletion]);
  }
  dispose(): Promise<void> {
    if (!this.#dispose) {
      this.#closing = true;
      const entries = [...this.#entries.values()];
      this.#entries.clear();
      this.#dispose = Promise.resolve().then(async () => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          const drained = await Promise.race([
            Promise.allSettled([...this.#operations]).then(() => true),
            new Promise<false>((resolve) => {
              timer = setTimeout(() => resolve(false), 5000);
            }),
          ]);
          this.#forcedClose = !drained;
        } finally {
          clearTimeout(timer);
        }
        const results = await Promise.allSettled([
          ...entries.map((entry) => this.#close(entry)),
          ...this.#retired,
        ]);
        await Promise.all([...this.#writes.values()]);
        const browser = await this.#browser?.catch(() => undefined);
        try {
          await browser?.close();
        } catch {
          throw new BrowserOperationError("Browser cleanup failed.");
        }
        if (results.some((result) => result.status === "rejected"))
          throw new BrowserOperationError("Browser context cleanup failed.");
        if (this.#forcedClose)
          throw new BrowserOperationError(
            "Browser shutdown timed out waiting for operations; browser resources were closed and partial artifacts may remain.",
          );
      });
      this.#lifetime.abort();
    }
    return this.#dispose;
  }
}
