import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test, { type TestContext } from "node:test";
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  symlink,
  stat,
  unlink,
  utimes,
  writeFile,
} from "node:fs/promises";
import {
  ProfileFileError,
  publishProfileFile,
  type ProfileFileOptions,
} from "../src/index.js";

async function temporary(t: TestContext): Promise<string> {
  const root = await realpath(await mkdtemp(join(tmpdir(), "profile-file-test-")));
  t.after(async () => {
    assert.equal(await realpath(root), root);
    assert.equal(dirname(root), await realpath(tmpdir()));
    await rm(root, { recursive: true, force: true });
  });
  return root;
}

function stream(chunks: readonly Uint8Array[], headers: Record<string, string> = {}): Response {
  return new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  }), { headers });
}

function options(
  root: string,
  name: string,
  response: Response,
  overrides: Partial<ProfileFileOptions> = {},
): ProfileFileOptions {
  return {
    appDataDirectory: root,
    name,
    maxBytes: 1024,
    openResponse: async () => response,
    inspectResponse() {},
    ...overrides,
  };
}

function assertDisposition(
  published: boolean,
  cleanupFailed: boolean,
  pattern?: RegExp,
): (error: unknown) => boolean {
  return (error) => {
    assert.ok(error instanceof ProfileFileError);
    assert.equal(error.published, published);
    assert.equal(error.cleanupFailed, cleanupFailed);
    assert.equal(error.cause, undefined);
    if (pattern) assert.match(error.message, pattern);
    assert.doesNotMatch(error.message, /synthetic-private|outside/);
    return true;
  };
}

test("publishes complete owned bytes with prefix validation, hash and private staging cleanup", async (t) => {
  const root = await temporary(t);
  const chunks = [
    Uint8Array.of(1, 2, 3),
    new Uint8Array(0),
    Uint8Array.of(4, 5, 6, 7, 8),
    Uint8Array.of(9),
  ];
  let validated = 0;
  const saved = await publishProfileFile(options(root, "fixture.bin", stream(chunks, {
    "content-length": "9",
  }), {
    maxBytes: 9,
    async validateFile(file) {
      validated++;
      assert.equal(file.bytes, 9);
      assert.deepEqual([...file.prefix], [1, 2, 3, 4, 5, 6, 7, 8]);
      assert.deepEqual([...await readFile(file.path)], [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    },
  }));
  assert.equal(validated, 1);
  assert.deepEqual(saved, {
    path: join(root, "downloads", "fixture.bin"),
    bytes: 9,
    sha256: createHash("sha256").update(Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9]))
      .digest("hex"),
  });
  assert.deepEqual([...await readFile(saved.path)], [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual(await readdir(join(root, "temp")), []);
  const stat = await lstat(saved.path);
  assert.equal(stat.isFile(), true);
  assert.equal(stat.isSymbolicLink(), false);
  if (process.platform !== "win32") assert.equal(stat.mode & 0o077, 0);
});

test("local validation and existing destinations fail before response acquisition", async (t) => {
  const root = await temporary(t);
  let calls = 0;
  const openResponse = async () => { calls++; return new Response(); };
  for (const [appDataDirectory, name, maxBytes] of [
    ["relative", "fixture.bin", 1],
    [root, "../fixture.bin", 1],
    [root, "folder/fixture.bin", 1],
    [root, "folder\\fixture.bin", 1],
    [root, "CON.txt", 1],
    [root, "fixture. ", 1],
    [root, "fixture.bin", 0],
    [root, "fixture.bin", Number.MAX_SAFE_INTEGER + 1],
  ] as const) {
    await assert.rejects(publishProfileFile({
      appDataDirectory, name, maxBytes, openResponse, inspectResponse() {},
    }), assertDisposition(false, false));
  }
  await mkdir(join(root, "downloads"), { recursive: true });
  const destination = join(root, "downloads", "fixture.bin");
  await writeFile(destination, "existing");
  await assert.rejects(publishProfileFile({
    appDataDirectory: root, name: "fixture.bin", maxBytes: 1,
    openResponse, inspectResponse() {},
  }), assertDisposition(false, false, /already exists/));
  assert.equal(await readFile(destination, "utf8"), "existing");
  assert.equal(calls, 0);
});

test("directory links and pre-acquisition cancellation fail without response or outside writes", async (t) => {
  for (const directory of ["downloads", "temp"]) {
    const root = await temporary(t);
    const outside = join(root, "outside");
    await mkdir(outside);
    await symlink(outside, join(root, directory), process.platform === "win32" ? "junction" : "dir");
    let calls = 0;
    await assert.rejects(publishProfileFile(options(root, "fixture.bin", new Response(), {
      openResponse: async () => { calls++; return new Response(); },
    })), assertDisposition(false, false, /symlinks|junctions/));
    assert.equal(calls, 0);
    assert.deepEqual(await readdir(outside), []);
  }
  const root = await temporary(t);
  const controller = new AbortController();
  controller.abort(new Error("synthetic-private-abort"));
  let calls = 0;
  await assert.rejects(publishProfileFile(options(root, "fixture.bin", new Response(), {
    signal: controller.signal,
    openResponse: async () => { calls++; return new Response(); },
  })), assertDisposition(false, false));
  assert.equal(calls, 0);
});

test("a linked AppData ancestor fails before response acquisition or outside writes", async (t) => {
  const root = await temporary(t);
  const outside = join(root, "outside");
  await mkdir(outside);
  await symlink(outside, join(root, "linked"), process.platform === "win32" ? "junction" : "dir");
  let calls = 0;
  await assert.rejects(publishProfileFile(options(
    join(root, "linked", "profile"),
    "fixture.bin",
    new Response(),
    { openResponse: async () => { calls++; return new Response(); } },
  )), assertDisposition(false, false, /symlinks|junctions/));
  assert.equal(calls, 0);
  assert.deepEqual(await readdir(outside), []);
});

test("existing AppData ancestors retain identity and are not permission-mutated", async (t) => {
  const root = await temporary(t);
  if (process.platform !== "win32") await chmod(root, 0o751);
  const identity = await lstat(root, { bigint: true });
  const before = (await stat(root)).mode & 0o777;
  await publishProfileFile(options(join(root, "profile"), "empty.bin", stream([])));
  const after = await lstat(root, { bigint: true });
  assert.equal(after.isDirectory(), true);
  assert.equal(after.isSymbolicLink(), false);
  assert.equal(after.dev, identity.dev);
  assert.equal(after.ino, identity.ino);
  if (process.platform !== "win32") assert.equal(after.mode & 0o777n, BigInt(before));
});

test("marked service checks survive only inspect/file validation with clean unpublished staging", async (t) => {
  const root = await temporary(t);
  for (const [name, override, pattern] of [
    ["inspect.bin", {
      inspectResponse() {
        throw new ProfileFileError("Static service status rejection.");
      },
    }, /service status/],
    ["inspect-async.bin", {
      async inspectResponse() {
        await Promise.resolve();
        throw new ProfileFileError("Static asynchronous service status rejection.");
      },
    }, /asynchronous service status/],
    ["validate.bin", {
      validateFile() {
        throw new ProfileFileError("Static service format rejection.");
      },
    }, /service format/],
  ] as const) {
    await assert.rejects(
      publishProfileFile(options(root, name, stream([Uint8Array.of(1)]), override)),
      assertDisposition(false, false, pattern),
    );
  }
  for (const [name, override] of [
    ["fetch.bin", {
      openResponse: async () => { throw new ProfileFileError("synthetic-private-fetch"); },
    }],
    ["stream.bin", {
      openResponse: async () => new Response(new ReadableStream<Uint8Array>({
        start(controller) { controller.error(new ProfileFileError("synthetic-private-stream")); },
      })),
    }],
  ] as const) {
    await assert.rejects(
      publishProfileFile(options(root, name, new Response(), override)),
      assertDisposition(false, false, /Download failed/),
    );
  }
  assert.deepEqual(await readdir(join(root, "downloads")), []);
  assert.deepEqual(await readdir(join(root, "temp")), []);
});

test("declared wire and actual byte limits, truncation and abort clean all staging", async (t) => {
  const root = await temporary(t);
  const controller = new AbortController();
  const aborted = new Response(new ReadableStream<Uint8Array>({
    pull(stream) {
      stream.enqueue(Uint8Array.of(1));
      controller.abort(new Error("synthetic-private-abort"));
    },
  }));
  for (const [name, response, maxBytes, signal] of [
    ["invalid.bin", stream([], { "content-length": "synthetic-private" }), 4, undefined],
    ["truncated.bin", stream([Uint8Array.of(1)], { "content-length": "2" }), 4, undefined],
    ["overflow.bin", stream([Uint8Array.of(1, 2, 3)]), 2, undefined],
    ["abort.bin", aborted, 4, controller.signal],
  ] as const) {
    await assert.rejects(
      publishProfileFile(options(root, name, response, { maxBytes, signal })),
      assertDisposition(false, false, /byte limit|incomplete transfer|cancelled/),
    );
  }
  assert.deepEqual(await readdir(join(root, "downloads")), []);
  assert.deepEqual(await readdir(join(root, "temp")), []);
  const encoded = await publishProfileFile(options(root, "encoded.bin", stream([
    Uint8Array.of(1),
  ], {
    "content-length": "4",
    "content-encoding": "gzip",
  }), { maxBytes: 2 }));
  assert.equal(encoded.bytes, 1);
});

test("directory and staged-file replacement never delete untrusted files", async (t) => {
  const root = await temporary(t);
  const originalDownloads = join(root, "downloads-moved");
  await assert.rejects(publishProfileFile(options(root, "directory.bin", stream([
    Uint8Array.of(1),
  ]), {
    async openResponse() {
      await rename(join(root, "downloads"), originalDownloads);
      await mkdir(join(root, "downloads"));
      return stream([Uint8Array.of(1)]);
    },
  })), assertDisposition(false, false, /directories|replacement/));
  assert.deepEqual(await readdir(join(root, "temp")), []);

  let replacement = "";
  await assert.rejects(publishProfileFile(options(root, "staging.bin", stream([
    Uint8Array.of(1, 2),
  ]), {
    async validateFile(file) {
      replacement = file.path;
      await unlink(file.path);
      await writeFile(file.path, "untrusted replacement");
    },
  })), assertDisposition(false, true, /not published.*cleanup failed/));
  assert.equal(await readFile(replacement, "utf8"), "untrusted replacement");
});

test("publication races preserve existing data and exactly one concurrent writer succeeds", async (t) => {
  const root = await temporary(t);
  const destination = join(root, "downloads", "race.bin");
  await assert.rejects(publishProfileFile(options(root, "race.bin", stream([Uint8Array.of(1)]), {
    async validateFile() {
      await writeFile(destination, "racing owner", { flag: "wx" });
    },
  })), assertDisposition(false, false, /already exists/));
  assert.equal(await readFile(destination, "utf8"), "racing owner");
  await unlink(destination);
  const results = await Promise.allSettled([
    publishProfileFile(options(root, "race.bin", stream([Uint8Array.of(1)]))),
    publishProfileFile(options(root, "race.bin", stream([Uint8Array.of(2)]))),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected").length, 1);
  assert.equal((await readFile(destination)).byteLength, 1);
  assert.deepEqual(await readdir(join(root, "temp")), []);
});

test("unsupported links and post-publication cleanup failures report truthful disposition", async (t) => {
  const root = await temporary(t);
  t.mock.method(fs.promises, "link", async () => {
    throw Object.assign(new Error("synthetic-private-link"), { code: "ENOTSUP" });
  });
  syncBuiltinESMExports();
  t.after(() => { t.mock.restoreAll(); syncBuiltinESMExports(); });
  await assert.rejects(
    publishProfileFile(options(root, "unsupported.bin", stream([Uint8Array.of(1)]))),
    assertDisposition(false, false, /hard links/),
  );
  t.mock.restoreAll();
  syncBuiltinESMExports();

  const originalUnlink = fs.promises.unlink;
  t.mock.method(fs.promises, "unlink", async (...args: Parameters<typeof originalUnlink>) => {
    const [path] = args;
    if (String(path).includes(".download-")) {
      throw new Error("synthetic-private-cleanup");
    }
    return originalUnlink(...args);
  });
  syncBuiltinESMExports();
  await assert.rejects(
    publishProfileFile(options(root, "retained.bin", stream([Uint8Array.of(3)]))),
    assertDisposition(true, true, /was published.*cleanup failed/),
  );
  assert.deepEqual([...await readFile(join(root, "downloads", "retained.bin"))], [3]);
});

test("a staging-handle close failure retains every path for inspection", async (t) => {
  const root = await temporary(t);
  const originalOpen = fs.promises.open;
  let closeOwned: (() => Promise<void>) | undefined;
  t.mock.method(fs.promises, "open", async (...args: Parameters<typeof originalOpen>) => {
    const handle = await originalOpen(...args);
    closeOwned = handle.close.bind(handle);
    return new Proxy(handle, {
      get(target, property) {
        if (property === "close") {
          return async () => { throw new Error("synthetic-private-close"); };
        }
        const value = Reflect.get(target, property, target) as unknown;
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
  });
  syncBuiltinESMExports();
  try {
    await assert.rejects(
      publishProfileFile(options(root, "close.bin", stream([Uint8Array.of(4)]))),
      assertDisposition(true, true, /was published.*cleanup failed/),
    );
    assert.deepEqual([...await readFile(join(root, "downloads", "close.bin"))], [4]);
    const stages = await readdir(join(root, "temp"));
    assert.equal(stages.length, 1);
    assert.deepEqual(await readdir(join(root, "temp", stages[0]!)), ["content"]);
  } finally {
    await closeOwned?.();
    t.mock.restoreAll();
    syncBuiltinESMExports();
  }
});

test("destination replacement after link is detected and never removed", async (t) => {
  const root = await temporary(t);
  const originalLink = fs.promises.link;
  t.mock.method(fs.promises, "link", async (...args: Parameters<typeof originalLink>) => {
    const [, newPath] = args;
    await originalLink(...args);
    await unlink(newPath);
    await writeFile(newPath, "untrusted destination");
  });
  syncBuiltinESMExports();
  t.after(() => { t.mock.restoreAll(); syncBuiltinESMExports(); });
  await assert.rejects(
    publishProfileFile(options(root, "replaced.bin", stream([Uint8Array.of(1)]))),
    assertDisposition(true, false, /identity could not be verified/),
  );
  assert.equal(await readFile(join(root, "downloads", "replaced.bin"), "utf8"),
    "untrusted destination");
  assert.deepEqual(await readdir(join(root, "temp")), []);
});
test("retries partial filesystem writes until every response byte is staged", async (t) => {
  const root = await temporary(t);
  const originalOpen = fs.promises.open;
  t.mock.method(fs.promises, "open", async (...args: Parameters<typeof originalOpen>) => {
    const [, flags, mode] = args;
    assert.equal(flags, "wx");
    assert.equal(mode, 0o600);
    const handle = await originalOpen(...args);
    const originalWrite = handle.write.bind(handle);
    return new Proxy(handle, {
      get(target, property) {
        if (property === "write") {
          return async (buffer: Uint8Array, offset = 0, length = buffer.byteLength - offset) =>
            originalWrite(buffer, offset, Math.min(length, 2));
        }
        const value = Reflect.get(target, property, target) as unknown;
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
  });
  syncBuiltinESMExports();
  t.after(() => { t.mock.restoreAll(); syncBuiltinESMExports(); });
  const expected = Uint8Array.of(1, 2, 3, 4, 5, 6, 7);
  const result = await publishProfileFile(options(root, "partial.bin", stream([expected])));
  assert.deepEqual(new Uint8Array(await readFile(result.path)), expected);
  assert.equal(result.sha256, createHash("sha256").update(expected).digest("hex"));
});
test("publishes a real empty file with the empty SHA-256", async (t) => {
  const root = await temporary(t);
  const result = await publishProfileFile(options(root, "empty.bin", stream([])));
  assert.equal(result.bytes, 0);
  assert.equal(result.sha256, createHash("sha256").digest("hex"));
  assert.equal((await readFile(result.path)).byteLength, 0);
  assert.deepEqual(await readdir(join(root, "temp")), []);
});

test("zero-progress filesystem writes fail statically and clean private staging", async (t) => {
  const root = await temporary(t);
  const originalOpen = fs.promises.open;
  t.mock.method(fs.promises, "open", async (...args: Parameters<typeof originalOpen>) => {
    const handle = await originalOpen(...args);
    return new Proxy(handle, {
      get(target, property) {
        if (property === "write") {
          return async (buffer: Uint8Array) => ({ bytesWritten: 0, buffer });
        }
        const value = Reflect.get(target, property, target) as unknown;
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
  });
  syncBuiltinESMExports();
  t.after(() => { t.mock.restoreAll(); syncBuiltinESMExports(); });
  await assert.rejects(
    publishProfileFile(options(root, "zero.bin", stream([Uint8Array.of(1)]))),
    assertDisposition(false, false, /Download failed/),
  );
  assert.deepEqual(await readdir(join(root, "downloads")), []);
  assert.deepEqual(await readdir(join(root, "temp")), []);
});

test("abort during asynchronous file validation prevents publication and cleans staging", async (t) => {
  const root = await temporary(t);
  const controller = new AbortController();
  await assert.rejects(publishProfileFile(options(root, "cancelled.bin", stream([
    Uint8Array.of(1),
  ]), {
    signal: controller.signal,
    async validateFile() {
      await Promise.resolve();
      controller.abort(new Error("synthetic-private-validation-abort"));
    },
  })), assertDisposition(false, false, /cancelled.*no destination was published/));
  assert.deepEqual(await readdir(join(root, "downloads")), []);
  assert.deepEqual(await readdir(join(root, "temp")), []);
});

test("staged-file validation cannot mutate content in place", async (t) => {
  const root = await temporary(t);
  await assert.rejects(publishProfileFile(options(root, "mutated.bin", stream([
    Uint8Array.of(1, 2, 3),
  ]), {
    async validateFile(file) {
      await writeFile(file.path, Uint8Array.of(3, 2, 1));
      const changedTime = new Date("2040-01-01T00:00:00.000Z");
      await utimes(file.path, changedTime, changedTime);
    },
  })), assertDisposition(false, false, /changed during validation/));
  assert.deepEqual(await readdir(join(root, "downloads")), []);
  assert.deepEqual(await readdir(join(root, "temp")), []);
});

test("downloads-directory replacement after link is detected with truthful publication state", async (t) => {
  const root = await temporary(t);
  const originalLink = fs.promises.link;
  const moved = join(root, "downloads-moved-after-link");
  t.mock.method(fs.promises, "link", async (...args: Parameters<typeof originalLink>) => {
    await originalLink(...args);
    await rename(join(root, "downloads"), moved);
    await mkdir(join(root, "downloads"));
    await writeFile(join(root, "downloads", "late.bin"), "untrusted destination");
  });
  syncBuiltinESMExports();
  t.after(() => { t.mock.restoreAll(); syncBuiltinESMExports(); });
  await assert.rejects(
    publishProfileFile(options(root, "late.bin", stream([Uint8Array.of(7)]))),
    assertDisposition(true, false, /identity could not be verified/),
  );
  assert.deepEqual([...await readFile(join(moved, "late.bin"))], [7]);
  assert.equal(await readFile(join(root, "downloads", "late.bin"), "utf8"),
    "untrusted destination");
  assert.deepEqual(await readdir(join(root, "temp")), []);
});
