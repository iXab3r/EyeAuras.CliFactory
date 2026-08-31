import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  AppArguments,
  createCli,
  command,
  MemorySecretStore,
} from "@eyeauras/cli-factory";
import {
  BrowserRuntime,
  browserCommandOptions,
  browserOperationOptions,
  BrowserOperationError,
} from "../src/index.js";
import { chromium, type BrowserContext } from "playwright";

const signal = () => new AbortController().signal;

test("checkpoints serialize snapshot capture, not only file writes", async (t) => {
  const f = await fixture(t);
  let release!: () => void;
  let captured!: () => void;
  const firstCaptured = new Promise<void>((r) => {
    captured = r;
  });
  const finishFirst = new Promise<void>((r) => {
    release = r;
  });
  let calls = 0;
  const runtime = new BrowserRuntime({
    prepareContext: async (context) => {
      const original = context.storageState.bind(context);
      context.storageState = async (options) => {
        const state = await original(options);
        if (++calls === 1) {
          captured();
          await finishFirst;
        }
        return state;
      };
    },
  });
  t.after(() => runtime.dispose());
  let secondAction!: () => void;
  const secondChanged = new Promise<void>((r) => {
    secondAction = r;
  });
  const use = (value: string) =>
    runtime.withPage(f.settings, signal(), async (page) => {
      await page
        .context()
        .addCookies([
          { name: "synthetic_revision", value, url: f.settings.baseURL },
        ]);
      if (value === "2") secondAction();
    });
  const first = use("1");
  await firstCaptured;
  const second = use("2");
  await secondChanged;
  // Give a wrongly concurrent second capture a chance to finish before the first.
  await new Promise((r) => setTimeout(r, 100));
  release();
  await Promise.all([first, second]);
  const saved = JSON.parse(
    await readFile(
      join(f.appArguments.AppDataDirectory, "browser", "auth-state.json"),
      "utf8",
    ),
  );
  assert.equal(saved.state.cookies[0].value, "2");
});
async function fixture(t: test.TestContext) {
  const root = await mkdtemp(join(tmpdir(), "pw-runtime-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const appArguments = new AppArguments({
    AppName: "browser-fixture",
    Environment: {
      AppDomainDirectory: root,
      ApplicationExecutablePath: join(root, "fixture.js"),
      EnvironmentAppData: root,
      EnvironmentLocalAppData: root,
      ProcessId: process.pid,
    },
  });
  const contexts: BrowserContext[] = [];
  const prepareContext = async (context: BrowserContext) => {
    contexts.push(context);
    await context.route("**/*", async (route) => {
      if (!route.request().url().startsWith("https://fixture.test/")) {
        await route.abort();
        return;
      }
      await route.fulfill({
        contentType: "text/html",
        body: `<!doctype html><button onclick="document.cookie='synthetic_session=example; path=/';localStorage.setItem('synthetic_identity','fixture')">Log in</button>`,
      });
    });
  };
  const create = () => new BrowserRuntime({ prepareContext });
  const settings = {
    appArguments,
    baseURL: "https://fixture.test",
    persistAuth: true,
  };
  return { settings, contexts, create, appArguments };
}

test("lazy browser, per-operation pages, parallel profile contexts and one reusable browser", async (t) => {
  const f = await fixture(t),
    runtime = f.create();
  t.after(() => runtime.dispose());
  assert.equal(runtime.diagnostics.launches, 0);
  const barrier: (() => void)[] = [];
  const use = (profile: string) =>
    runtime.withPage(
      {
        ...f.settings,
        persistAuth: false,
        appArguments: f.appArguments.WithProfile(profile),
      },
      signal(),
      async (page) => {
        await page.goto("/");
        await new Promise<void>((resolve) => {
          barrier.push(resolve);
          if (barrier.length === 3) for (const release of barrier) release();
        });
        return page.url();
      },
    );
  await Promise.all([use("first"), use("first"), use("second")]);
  assert.equal(runtime.diagnostics.launches, 1);
  assert.equal(runtime.diagnostics.contexts, 2);
  assert.equal(runtime.diagnostics.pages, 0);
  const identity = runtime.diagnostics.browserIdentity;
  await runtime.withPage(
    { ...f.settings, persistAuth: false },
    signal(),
    async (page) => {
      await page.goto("/");
    },
  );
  assert.equal(runtime.diagnostics.browserIdentity, identity);
  const closing = runtime.dispose();
  assert.equal(closing, runtime.dispose());
  await closing;
  assert.equal(
    f.contexts.every((context) => context.pages().length === 0),
    true,
  );
  await assert.rejects(
    runtime.withPage(f.settings, signal(), async () => {}),
    /disposed/,
  );
});

test("app-owned browser login/status/logout restores cookies and origin state, isolates profiles and invalidates config", async (t) => {
  const f = await fixture(t);
  let browser = f.create();
  t.after(() => browser.dispose());
  const application = () =>
    createCli({
      name: "browser-fixture",
      description: "Synthetic login",
      runtime: {
        appArguments: f.appArguments,
        secretStore: new MemorySecretStore(),
      },
      resources: [browser],
      auth: {
        async login(context) {
          return browser.withPage(
            { ...f.settings, appArguments: context.appArguments },
            context.signal,
            async (page) => {
              await page.goto("/");
              await page.getByRole("button", { name: "Log in" }).click();
              return { authenticated: true };
            },
          );
        },
        async status(context) {
          return browser.withPage(
            { ...f.settings, appArguments: context.appArguments },
            context.signal,
            async (page) => {
              await page.goto("/");
              return {
                authenticated: await page.evaluate(
                  () =>
                    document.cookie.includes("synthetic_session=example") &&
                    localStorage.getItem("synthetic_identity") === "fixture",
                ),
              };
            },
          );
        },
        async logout(context) {
          await browser.clearAuth(context.appArguments);
        },
      },
      commands: [
        command("inspect", "authenticated operation", (_input, context) =>
          browser.withPage(
            { ...f.settings, appArguments: context.appArguments },
            context.signal,
            async (page) => {
              await page.goto("/");
              if (
                !(await page.evaluate(() =>
                  document.cookie.includes("synthetic_session=example"),
                ))
              )
                throw new BrowserOperationError(
                  "Not authenticated. Run auth login.",
                );
              return { ok: true };
            },
          ),
        ),
      ],
    });
  let app = application();
  assert.equal(
    ((await app.execute(["auth", "login"])) as { authenticated: boolean })
      .authenticated,
    true,
  );
  const state = join(
    f.appArguments.AppDataDirectory,
    "browser",
    "auth-state.json",
  );
  assert.ok((await stat(state)).size > 0);
  await app.dispose();
  await browser.dispose();
  browser = f.create();
  app = application();
  assert.equal(
    ((await app.execute(["auth", "status"])) as { authenticated: boolean })
      .authenticated,
    true,
  );
  assert.deepEqual(await app.execute(["inspect"]), { ok: true });
  await app.execute(["profile", "create", "other"]);
  assert.equal(
    (
      (await app.execute(["auth", "status", "--profile", "other"])) as {
        authenticated: boolean;
      }
    ).authenticated,
    false,
  );
  await assert.rejects(
    app.execute(["inspect", "--profile", "other"]),
    /Not authenticated/,
  );
  await app.execute(["auth", "logout"]);
  await assert.rejects(stat(state), { code: "ENOENT" });
  assert.equal(
    ((await app.execute(["auth", "status"])) as { authenticated: boolean })
      .authenticated,
    false,
  );
  await app.execute(["auth", "login"]);
  const before = f.contexts.length;
  const altered = await browser.withPage(
    { ...f.settings, userAgent: "changed-fixture" },
    signal(),
    async (page) => {
      await page.goto("/");
      return page.evaluate(() => document.cookie);
    },
  );
  assert.equal(altered, "");
  assert.equal(f.contexts.length, before + 1);
  await app.dispose();
});

test("service auth does not prelaunch headless or break repeated headed calls with restart disabled", async (t) => {
  const f = await fixture(t);
  const launch = chromium.launch.bind(chromium);
  const requested: boolean[] = [];
  // Inspect the production launch request, but keep this fixture invisible on desktops/CI.
  t.mock.method(chromium, "launch", (options: Parameters<typeof launch>[0]) => {
    requested.push(options?.headless ?? true);
    return launch({ ...options, headless: true });
  });
  const browser = new BrowserRuntime({ allowRestart: false });
  let activeStatus = 0;
  const app = createCli({
    name: "browser-fixture",
    description: "fixture",
    runtime: {
      appArguments: f.appArguments,
      secretStore: new MemorySecretStore(),
    },
    resources: [browser],
    auth: {
      login: async () => ({ authenticated: true }),
      logout: async () => {},
      status: async (context) => {
        activeStatus++;
        return browser.withPage(f.settings, context.signal, async () => ({
          authenticated: true,
        }));
      },
    },
    commands: [
      command(
        "inspect",
        "inspect",
        (input, context) =>
          browser.withPage(
            { ...f.settings, persistAuth: false },
            context.signal,
            async () => ({ ok: true }),
            browserOperationOptions(input.options, context),
          ),
        { options: browserCommandOptions },
      ),
    ],
  });
  try {
    for (let i = 0; i < 2; i++)
      assert.deepEqual(await app.execute(["inspect", "--headed"]), {
        ok: true,
      });
    assert.equal(activeStatus, 0);
    assert.deepEqual(requested, [false]);
    assert.equal(browser.diagnostics.launches, 1);
  } finally {
    await app.dispose();
  }
});

test("logout during an in-flight operation cannot resurrect state; cancelled page leaves peers intact", async (t) => {
  const f = await fixture(t),
    browser = f.create();
  t.after(() => browser.dispose());
  let ready!: () => void, finish!: () => void;
  const started = new Promise<void>((r) => {
      ready = r;
    }),
    barrier = new Promise<void>((r) => {
      finish = r;
    });
  const work = browser.withPage(f.settings, signal(), async (page) => {
    await page.goto("/");
    await page.getByRole("button").click();
    ready();
    await barrier;
  });
  void work.catch(() => {});
  await started;
  await browser.clearAuth(f.appArguments);
  finish();
  await assert.rejects(work, /Browser operation failed/);
  await assert.rejects(
    stat(join(f.appArguments.AppDataDirectory, "browser", "auth-state.json")),
    { code: "ENOENT" },
  );
  const abort = new AbortController();
  const cancelled = browser.withPage(
    { ...f.settings, persistAuth: false },
    abort.signal,
    async (page) => {
      await page.goto("/");
      abort.abort();
      await page.locator("#never").click();
    },
  );
  const peer = browser.withPage(
    { ...f.settings, persistAuth: false },
    signal(),
    async (page) => {
      await page.goto("/");
      return true;
    },
  );
  await assert.rejects(cancelled, /cancelled/);
  assert.equal(await peer, true);
  assert.equal(browser.diagnostics.pages, 0);
});

test("changed DOM, partial context init and browser crash are sanitized; next invocation can recreate browser without replay", async (t) => {
  const f = await fixture(t),
    browser = f.create();
  t.after(() => browser.dispose());
  await assert.rejects(
    browser.withPage(
      { ...f.settings, persistAuth: false },
      signal(),
      async (page) => {
        await page.goto("/");
        throw new Error("synthetic-private-marker");
      },
    ),
    (error) =>
      error instanceof Error &&
      !error.message.includes("synthetic-private-marker"),
  );
  let attempts = 0;
  await assert.rejects(
    browser.withPage(
      { ...f.settings, persistAuth: false },
      signal(),
      async (page) => {
        attempts++;
        await page.goto("/");
        await page.context().browser()!.close();
        await page.locator("#lost").click();
      },
    ),
    /No action was replayed/,
  );
  assert.equal(attempts, 1);
  await browser.withPage(
    { ...f.settings, persistAuth: false },
    signal(),
    async (page) => {
      await page.goto("/");
    },
  );
  assert.equal(browser.diagnostics.launches, 2);
  const broken = new BrowserRuntime({
    prepareContext: async () => {
      throw new Error("synthetic-init-detail");
    },
  });
  await assert.rejects(
    broken.withPage(f.settings, signal(), async () => {}),
    (error) =>
      error instanceof Error &&
      !error.message.includes("synthetic-init-detail"),
  );
  await broken.dispose();
  assert.equal(broken.diagnostics.pages, 0);
});
