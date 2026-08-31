import assert from "node:assert/strict";
import childProcess from "node:child_process";
import test from "node:test";
import { mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { AppArguments } from "@eyeauras/cli-factory";
import {
  BrowserRuntime,
  BrowserOperationError,
  type BrowserOperationOptions,
  type BrowserRuntimeOptions,
} from "../src/index.js";
import { chromium, type BrowserContext } from "playwright";

const signal = () => new AbortController().signal;

test(
  "direct dispose waits for cancellation video finalization before closing Chromium",
  { timeout: 20000 },
  async (t) => {
    const { runtime, profile } = await fixture(t);
    const entered = latch();
    const videos: string[] = [];
    const work = runtime.withPage(
      profile,
      signal(),
      async (page) => {
        await page.goto("/");
        entered.resolve();
        await page.waitForSelector("#never-created");
      },
      {
        recordVideo: true,
        onVideo: (path) => {
          videos.push(path);
        },
      },
    );
    const rejected = assert.rejects(
      work,
      (error) =>
        error instanceof Error &&
        error.message === "Browser operation cancelled.",
    );
    await entered.promise;
    const closing = runtime.dispose();
    assert.equal(closing, runtime.dispose());
    await closing;
    assert.equal(runtime.diagnostics.pages, 0);
    assert.equal(videos.length, 1);
    assert.ok((await stat(videos[0]!)).size > 0);
    await rejected;
  },
);

test(
  "dispose reports a bounded failure for a stuck callback and closes browser resources",
  { timeout: 15000 },
  async (t) => {
    const root = await mkdtemp(join(tmpdir(), "pw-stuck-dispose-"));
    const appArguments = new AppArguments({
      AppName: "stuck-fixture",
      Environment: {
        AppDomainDirectory: root,
        ApplicationExecutablePath: join(root, "fixture.js"),
        EnvironmentAppData: root,
        EnvironmentLocalAppData: root,
        ProcessId: process.pid,
      },
    });
    const runtime = new BrowserRuntime();
    const entered = latch(),
      release = latch();
    const work = runtime.withPage(
      { appArguments, baseURL: "https://fixture.test" },
      signal(),
      async (page) => {
        await page.setContent("<h1>Synthetic</h1>");
        entered.resolve();
        await release.promise;
      },
    );
    const result = assert.rejects(work, /cancelled/);
    await entered.promise;
    try {
      await assert.rejects(runtime.dispose(), /shutdown timed out/);
      assert.equal(runtime.diagnostics.contexts, 0);
      await assert.rejects(runtime.dispose(), /shutdown timed out/);
    } finally {
      release.resolve();
      await result;
      await rm(root, { recursive: true, force: true });
    }
  },
);
const latch = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
async function fixture(
  t: test.TestContext,
  options: BrowserRuntimeOptions = {},
) {
  const root = await mkdtemp(join(tmpdir(), "pw-observation-"));
  const appArguments = new AppArguments({
    AppName: "observation-fixture",
    Environment: {
      AppDomainDirectory: root,
      ApplicationExecutablePath: join(root, "fixture.js"),
      EnvironmentAppData: root,
      EnvironmentLocalAppData: root,
      ProcessId: process.pid,
    },
  });
  const contexts: BrowserContext[] = [];
  const runtime = new BrowserRuntime({
    ...options,
    prepareContext: async (context) => {
      contexts.push(context);
      await context.route("**/*", (route) =>
        route.request().url().startsWith("https://fixture.test/")
          ? route.fulfill({
              contentType: "text/html",
              body: "<!doctype html><h1>Synthetic browser observation</h1>",
            })
          : route.abort(),
      );
    },
  });
  t.after(async () => {
    await runtime.dispose();
    await rm(root, { recursive: true, force: true });
  });
  const profile = {
    appArguments,
    baseURL: "https://fixture.test",
    persistAuth: true,
  };
  return { runtime, profile, contexts, root };
}

test(
  "visibility switches restart only the browser; compatible calls reuse it and restore profile auth",
  { timeout: 30000 },
  async (t) => {
    const { runtime, profile } = await fixture(t);
    await runtime.withPage(profile, signal(), async (page) => {
      await page.goto("/");
      await page.evaluate(() =>
        localStorage.setItem("synthetic_identity", "fixture"),
      );
    });
    const first = runtime.diagnostics.browserIdentity;
    for (const headless of [false, false, true]) {
      await runtime.withPage(
        profile,
        signal(),
        async (page) => {
          await page.goto("/");
          const cdp = await page.context().browser()!.newBrowserCDPSession();
          const version = await cdp.send("Browser.getVersion");
          assert.equal(version.userAgent.includes("HeadlessChrome"), headless);
          await cdp.detach();
          assert.equal(
            await page.evaluate(() =>
              localStorage.getItem("synthetic_identity"),
            ),
            "fixture",
          );
        },
        { headless },
      );
    }
    assert.notEqual(runtime.diagnostics.browserIdentity, first);
    assert.equal(runtime.diagnostics.launches, 3);
    assert.equal(runtime.diagnostics.pages, 0);
  },
);

test(
  "Playwright hides only console helpers, including the video encoder, and keeps headed Chromium visible",
  { timeout: 30000 },
  async (t) => {
    const { runtime, profile } = await fixture(t);
    const original = childProcess.spawn;
    const observed: { binary: string; hidden: boolean | undefined }[] = [];
    t.mock.method(
      childProcess,
      "spawn",
      (...args: Parameters<typeof original>) => {
        const [file, , options] = args;
        observed.push({
          binary: String(file).split(/[\\/]/).pop()!,
          hidden: options?.windowsHide,
        });
        return original(...args);
      },
    );
    await runtime.withPage(profile, signal(), (page) => page.goto("/"), {
      recordVideo: true,
    });
    await runtime.withPage(profile, signal(), (page) => page.goto("/"), {
      headless: false,
    });
    if (process.platform === "win32") {
      for (const name of ["chrome-headless-shell.exe", "ffmpeg-win64.exe"]) {
        const launches = observed.filter((item) => item.binary === name);
        assert.ok(launches.length > 0, "Expected helper " + name);
        assert.ok(launches.every((item) => item.hidden === true));
      }
      const headed = observed.filter((item) => item.binary === "chrome.exe");
      assert.equal(headed.length, 1);
      assert.equal(headed[0]!.hidden, false);
    } else {
      assert.ok(observed.length > 0);
      // The targeted dependency workaround is a no-op on non-Windows platforms.
      assert.ok(
        observed
          .filter((item) => /chrome|ffmpeg/.test(item.binary))
          .every((item) => item.hidden === false),
      );
    }
  },
);

test(
  "explicit video finalizes before completion, does not restart Chromium, and is not inherited",
  { timeout: 30000 },
  async (t) => {
    const { runtime, profile, contexts } = await fixture(t);
    const videos: string[] = [];
    const options: BrowserOperationOptions = {
      recordVideo: true,
      onVideo: (path) => {
        videos.push(path);
      },
    };
    await runtime.withPage(profile, signal(), (page) => page.goto("/"));
    const firstContext = contexts[0],
      identity = runtime.diagnostics.browserIdentity;
    for (let i = 0; i < 2; i++) {
      await runtime.withPage(
        profile,
        signal(),
        async (page) => {
          assert.ok(page.video());
          await page.goto("/");
          await page.evaluate(
            () =>
              new Promise<void>((r) =>
                requestAnimationFrame(() => requestAnimationFrame(() => r())),
              ),
          );
        },
        options,
      );
      assert.equal(videos.length, i + 1);
      assert.ok((await stat(videos[i]!)).size > 0);
      assert.equal(
        (await readFile(videos[i]!)).subarray(0, 4).toString("hex"),
        "1a45dfa3",
      );
    }
    assert.notEqual(contexts[1], firstContext);
    assert.equal(contexts.length, 2);
    assert.equal(runtime.diagnostics.browserIdentity, identity);
    await runtime.withPage(profile, signal(), async (page) => {
      assert.equal(page.video(), null);
      await page.goto("/");
    });
    assert.equal(contexts.length, 3);
    assert.equal(runtime.diagnostics.launches, 1);
    assert.notEqual(videos[0], videos[1]);
    for (const path of videos)
      assert.ok(
        !relative(
          join(profile.appArguments.AppDataDirectory, "browser", "artifacts"),
          path,
        ).startsWith(".."),
      );
    const files = await readdir(
      join(profile.appArguments.AppDataDirectory, "browser", "artifacts"),
      { recursive: true },
    );
    assert.equal(files.filter((f) => f.endsWith(".webm")).length, 2);
  },
);

test(
  "conflicting request drains active work fairly; compatible operations remain concurrent",
  { timeout: 30000 },
  async (t) => {
    const { runtime, profile } = await fixture(t);
    const entered = latch(),
      release = latch(),
      both = latch(),
      releaseBoth = latch();
    const order: string[] = [];
    let active = 0;
    const first = runtime.withPage(profile, signal(), async (page) => {
      await page.goto("/");
      order.push("first");
      entered.resolve();
      await release.promise;
      assert.equal(page.isClosed(), false);
    });
    await entered.promise;
    const second = runtime.withPage(
      profile,
      signal(),
      async () => {
        order.push("switch");
      },
      { headless: false },
    );
    const third = runtime.withPage(profile, signal(), async () => {
      order.push("after");
    });
    assert.deepEqual(order, ["first"]);
    release.resolve();
    await Promise.all([first, second, third]);
    assert.deepEqual(order, ["first", "switch", "after"]);
    const work = () =>
      runtime.withPage(profile, signal(), async () => {
        if (++active === 2) both.resolve();
        await releaseBoth.promise;
      });
    const a = work(),
      b = work();
    await both.promise;
    releaseBoth.resolve();
    await Promise.all([a, b]);
    assert.equal(runtime.diagnostics.launches, 3);
  },
);

test(
  "cancelled mode switch is removed without restarting or blocking compatible peers",
  { timeout: 30000 },
  async (t) => {
    const { runtime, profile } = await fixture(t);
    const entered = latch(),
      release = latch(),
      peerEntered = latch();
    const first = runtime.withPage(profile, signal(), async () => {
      entered.resolve();
      await release.promise;
    });
    await entered.promise;
    const abort = new AbortController();
    let actions = 0;
    const waiting = runtime.withPage(
      profile,
      abort.signal,
      async () => {
        actions++;
      },
      { headless: false },
    );
    const rejected = assert.rejects(waiting, /cancelled/);
    const peer = runtime.withPage(profile, signal(), async () => {
      peerEntered.resolve();
    });
    abort.abort();
    await rejected;
    await peerEntered.promise;
    release.resolve();
    await Promise.all([first, peer]);
    assert.equal(actions, 0);
    assert.equal(runtime.diagnostics.launches, 1);
  },
);

test(
  "application can forbid mode changes without affecting the existing browser",
  { timeout: 30000 },
  async (t) => {
    const { runtime, profile } = await fixture(t, { allowRestart: false });
    await runtime.withPage(profile, signal(), (page) => page.goto("/"));
    const identity = runtime.diagnostics.browserIdentity;
    for (const options of [{ headless: false }, { recordVideo: true }])
      await assert.rejects(
        runtime.withPage(
          profile,
          signal(),
          async () => assert.fail("must not run"),
          options,
        ),
        /disabled by this application/,
      );
    await runtime.withPage(profile, signal(), (page) => page.goto("/"));
    assert.equal(runtime.diagnostics.browserIdentity, identity);
    assert.equal(runtime.diagnostics.launches, 1);
  },
);

test(
  "videos survive action error and cancellation, including popups, without leaking raw errors",
  { timeout: 30000 },
  async (t) => {
    const { runtime, profile } = await fixture(t);
    const files: string[] = [];
    const options: BrowserOperationOptions = {
      recordVideo: true,
      onVideo: (path) => {
        files.push(path);
      },
    };
    await assert.rejects(
      runtime.withPage(
        profile,
        signal(),
        async (page) => {
          await page.goto("/");
          const popup = page.waitForEvent("popup");
          await page.evaluate(() => {
            window.open("/popup");
          });
          await (await popup).waitForLoadState("domcontentloaded");
          throw new BrowserOperationError("Synthetic application failure.");
        },
        options,
      ),
      /Synthetic application failure/,
    );
    assert.equal(files.length, 2);
    const abort = new AbortController();
    await assert.rejects(
      runtime.withPage(
        profile,
        abort.signal,
        async (page) => {
          await page.goto("/");
          abort.abort();
          await page.locator("#never").click();
        },
        options,
      ),
      /cancelled/,
    );
    assert.equal(files.length, 3);
    for (const path of files) assert.ok((await stat(path)).size > 0);
    assert.equal(runtime.diagnostics.pages, 0);
    assert.equal(runtime.diagnostics.launches, 1);
  },
);

test(
  "parallel recordings and different-profile modes never share artifact paths or auth",
  { timeout: 30000 },
  async (t) => {
    const { runtime, profile } = await fixture(t);
    const other = {
      ...profile,
      appArguments: profile.appArguments.WithProfile("other"),
    };
    const files: string[] = [];
    const options = {
      recordVideo: true,
      onVideo: (path: string) => {
        files.push(path);
      },
    };
    await runtime.withPage(
      profile,
      signal(),
      async (page) => {
        await page.goto("/");
        await page.evaluate(() =>
          localStorage.setItem("synthetic_identity", "first"),
        );
      },
      options,
    );
    const ready = latch(),
      release = latch();
    let started = 0;
    const use = () =>
      runtime.withPage(
        profile,
        signal(),
        async (page) => {
          await page.goto("/");
          if (++started === 2) ready.resolve();
          await release.promise;
        },
        options,
      );
    const a = use(),
      b = use();
    await ready.promise;
    // Same browser, other profile with recording off is compatible with the recording profile.
    await runtime.withPage(other, signal(), async (page) => {
      assert.equal(page.video(), null);
      await page.goto("/");
      assert.equal(
        await page.evaluate(() => localStorage.getItem("synthetic_identity")),
        null,
      );
    });
    release.resolve();
    await Promise.all([a, b]);
    await runtime.withPage(
      profile,
      signal(),
      async (page) => {
        assert.equal(page.video(), null);
        await page.goto("/");
        assert.equal(
          await page.evaluate(() => localStorage.getItem("synthetic_identity")),
          "first",
        );
      },
      { headless: false },
    );
    assert.equal(new Set(files).size, 3);
    assert.equal(runtime.diagnostics.launches, 2);
    await assert.rejects(
      stat(join(other.appArguments.AppDataDirectory, "browser", "artifacts")),
      { code: "ENOENT" },
    );
  },
);

test(
  "queued deadlines and disposal release waiters without executing their browser actions",
  { timeout: 30000 },
  async (t) => {
    const { runtime, profile } = await fixture(t);
    const entered = latch(),
      release = latch();
    const first = runtime.withPage(profile, signal(), async () => {
      entered.resolve();
      await release.promise;
    });
    const firstResult = assert.rejects(first, /cancelled/);
    await entered.promise;
    const timeout = runtime.withPage(
      profile,
      AbortSignal.timeout(50),
      async () => assert.fail("timed out action"),
      { headless: false },
    );
    await assert.rejects(timeout, /cancelled/);
    const queued = runtime.withPage(
      profile,
      signal(),
      async () => assert.fail("disposed action"),
      { headless: false },
    );
    const queuedResult = assert.rejects(queued, /cancelled/);
    const closing = runtime.dispose();
    release.resolve();
    await closing;
    await Promise.all([firstResult, queuedResult]);
    assert.equal(runtime.diagnostics.launches, 1);
  },
);

test(
  "artifact reporting failures are sanitized and never replay the action",
  { timeout: 30000 },
  async (t) => {
    const { runtime, profile } = await fixture(t);
    let actions = 0,
      file = "";
    await assert.rejects(
      runtime.withPage(
        profile,
        signal(),
        async (page) => {
          actions++;
          await page.goto("/");
        },
        {
          recordVideo: true,
          onVideo: (path) => {
            file = path;
            throw new Error("synthetic-private-marker");
          },
        },
      ),
      (error) =>
        error instanceof Error &&
        /artifact reporting failed/.test(error.message) &&
        !error.message.includes("synthetic-private-marker"),
    );
    assert.equal(actions, 1);
    assert.ok((await stat(file)).size > 0);
    assert.equal(runtime.diagnostics.pages, 0);
  },
);

test(
  "bounded browser queue rejects overload and drains cancelled waiters",
  { timeout: 30000 },
  async (t) => {
    const { runtime, profile } = await fixture(t);
    const entered = latch(),
      release = latch();
    const first = runtime.withPage(profile, signal(), async () => {
      entered.resolve();
      await release.promise;
    });
    await entered.promise;
    const abort = new AbortController();
    const pending = Array.from({ length: 128 }, () =>
      assert.rejects(
        runtime.withPage(
          profile,
          abort.signal,
          async () => assert.fail("cancelled waiter"),
          { headless: false },
        ),
        /cancelled/,
      ),
    );
    await assert.rejects(
      runtime.withPage(
        profile,
        signal(),
        async () => assert.fail("overflow waiter"),
        { headless: false },
      ),
      /queue is full/,
    );
    abort.abort();
    release.resolve();
    await Promise.all([first, ...pending]);
    await runtime.withPage(profile, signal(), (page) => page.goto("/"));
    assert.equal(runtime.diagnostics.launches, 1);
  },
);

test(
  "failed headed launch has no silent headless fallback; next request recovers without replay",
  { timeout: 30000 },
  async (t) => {
    const { runtime, profile } = await fixture(t);
    const launch = chromium.launch.bind(chromium);
    const attempts: boolean[] = [];
    t.mock.method(
      chromium,
      "launch",
      async (options: Parameters<typeof launch>[0]) => {
        attempts.push(options?.headless ?? true);
        if (options?.headless === false)
          throw new Error("synthetic-private-launch-detail");
        return launch(options);
      },
    );
    await runtime.withPage(profile, signal(), (page) => page.goto("/"));
    await assert.rejects(
      runtime.withPage(
        profile,
        signal(),
        async () => assert.fail("launch failed"),
        { headless: false },
      ),
      (error) =>
        error instanceof Error &&
        /No headless fallback/.test(error.message) &&
        !error.message.includes("synthetic-private-launch-detail"),
    );
    assert.deepEqual(attempts, [true, false]);
    await runtime.withPage(profile, signal(), (page) => page.goto("/"));
    assert.deepEqual(attempts, [true, false, true]);
  },
);

test(
  "mode switching waits for video finalization and reporting, not just page closure",
  { timeout: 30000 },
  async (t) => {
    const { runtime, profile } = await fixture(t);
    const saving = latch(),
      release = latch();
    const order: string[] = [];
    const first = runtime.withPage(
      profile,
      signal(),
      (page) => page.goto("/"),
      {
        recordVideo: true,
        onVideo: async (path) => {
          assert.ok((await stat(path)).size > 0);
          order.push("video-ready");
          saving.resolve();
          await release.promise;
          order.push("reported");
        },
      },
    );
    await saving.promise;
    const switched = runtime.withPage(
      profile,
      signal(),
      async () => {
        order.push("switched");
      },
      { headless: false },
    );
    release.resolve();
    await Promise.all([first, switched]);
    assert.deepEqual(order, ["video-ready", "reported", "switched"]);
    assert.equal(runtime.diagnostics.launches, 2);
  },
);

test(
  "auth persistence is not silently enabled by recording or a mode switch",
  { timeout: 30000 },
  async (t) => {
    const { runtime, profile } = await fixture(t);
    const anonymous = { ...profile, persistAuth: false };
    await runtime.withPage(anonymous, signal(), async (page) => {
      await page.goto("/");
      await page.evaluate(() =>
        localStorage.setItem("synthetic_transient", "not-persisted"),
      );
    });
    await runtime.withPage(
      anonymous,
      signal(),
      async (page) => {
        await page.goto("/");
        assert.equal(
          await page.evaluate(() =>
            localStorage.getItem("synthetic_transient"),
          ),
          null,
        );
      },
      { recordVideo: true },
    );
    await assert.rejects(
      stat(
        join(
          profile.appArguments.AppDataDirectory,
          "browser",
          "auth-state.json",
        ),
      ),
      { code: "ENOENT" },
    );
    const artifacts = join(
      profile.appArguments.AppDataDirectory,
      "browser",
      "artifacts",
    );
    if (process.platform !== "win32")
      assert.equal((await stat(artifacts)).mode & 0o777, 0o700);
    await runtime.withPage(anonymous, signal(), async (page) => {
      assert.equal(page.video(), null);
    });
  },
);

test(
  "cancellation during artifact reporting still returns cancellation after saving the video",
  { timeout: 30000 },
  async (t) => {
    const { runtime, profile } = await fixture(t);
    const saving = latch(),
      release = latch(),
      abort = new AbortController();
    let file = "";
    const work = runtime.withPage(
      profile,
      abort.signal,
      (page) => page.goto("/"),
      {
        recordVideo: true,
        onVideo: async (path) => {
          file = path;
          saving.resolve();
          await release.promise;
        },
      },
    );
    const rejected = assert.rejects(work, /cancelled/);
    await saving.promise;
    abort.abort();
    release.resolve();
    await rejected;
    assert.ok((await stat(file)).size > 0);
    assert.equal(runtime.diagnostics.pages, 0);
  },
);
