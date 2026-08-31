import assert from "node:assert/strict";
import test from "node:test";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Readable, Writable } from "node:stream";
import {
  AppArguments,
  MemorySecretStore,
  command,
  createCli,
} from "@eyeauras/cli-factory";
import { runHosted } from "../src/host.js";
import {
  buildFingerprint,
  manifestName,
  readBuildManifest,
  writeBuildManifest,
} from "../src/build.js";

test("IPC is opt-in and ipc-server does not reserve the service's server root", async (t) => {
  assert.deepEqual(Object.keys(await import("@eyeauras/cli-factory-ipc")), [
    "runHosted",
  ]);
  const f = await fixture(t);
  const appArguments = new AppArguments({
    AppName: "synthetic-build",
    Environment: {
      AppDomainDirectory: f.root,
      ApplicationExecutablePath: f.entry,
      EnvironmentAppData: f.root,
      EnvironmentLocalAppData: f.root,
      ProcessId: process.pid,
    },
  });
  const createDefinition = () => ({
    name: "synthetic-build",
    description: "Synthetic standalone or IPC app",
    runtime: { appArguments, secretStore: new MemorySecretStore() },
    commands: [
      command("server", "Service server", [
        command("status", "Service status", () => ({ service: true })),
      ]),
    ],
  });
  const standalone = createCli(createDefinition());
  t.after(() => standalone.dispose());
  assert.deepEqual(await standalone.execute(["server", "status"]), {
    service: true,
  });
  await assert.rejects(standalone.execute(["ipc-server", "status"]));
  assert.doesNotMatch(
    ((await standalone.execute(["--help"])) as { help: string }).help,
    /ipc-server/,
  );
  let output = "",
    error = "";
  const io = {
    input: Readable.from([]),
    output: new Writable({
      write(c, _e, done) {
        output += c;
        done();
      },
    }),
    error: new Writable({
      write(c, _e, done) {
        error += c;
        done();
      },
    }),
  };
  assert.equal(
    await runHosted(
      { entryPoint: f.entry, createDefinition },
      ["ipc-server", "status", "--json"],
      io,
    ),
    0,
    error,
  );
  assert.deepEqual(JSON.parse(output), { running: false });
});

test("missing build blocks Run, but management ignores invalid launch limits and disposes resources", async (t) => {
  const f = await fixture(t);
  const appArguments = new AppArguments({
    AppName: "synthetic-build",
    Environment: {
      AppDomainDirectory: f.root,
      ApplicationExecutablePath: f.entry,
      EnvironmentAppData: f.root,
      EnvironmentLocalAppData: f.root,
      ProcessId: process.pid,
    },
  });
  let output = "",
    error = "",
    disposed = 0;
  const io = {
    input: Readable.from([]),
    output: new Writable({
      write(chunk, _encoding, done) {
        output += chunk;
        done();
      },
    }),
    error: new Writable({
      write(chunk, _encoding, done) {
        error += chunk;
        done();
      },
    }),
  };
  const options = {
    entryPoint: f.entry,
    createDefinition: () => ({
      name: "synthetic-build",
      description: "Synthetic fixture",
      commands: [],
      runtime: { appArguments, secretStore: new MemorySecretStore() },
      resources: [
        {
          dispose() {
            disposed++;
          },
        },
      ],
    }),
  };
  assert.equal(await runHosted(options, ["--help"], io), 1);
  assert.match(error, /npm run build/);
  for (const command of ["status", "stop"]) {
    output = "";
    error = "";
    assert.equal(
      await runHosted(
        { ...options, idleTimeoutMs: 0, maxInvocations: 0 },
        ["ipc-server", command, "--json"],
        io,
      ),
      0,
    );
    assert.deepEqual(JSON.parse(output), { running: false });
    assert.equal(error, "");
  }
  assert.equal(disposed, 3);
});

async function fixture(t: test.TestContext) {
  const root = await mkdtemp(join(tmpdir(), "cli-build-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const put = async (path: string, contents: string) => {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), contents);
  };
  await put(
    "package.json",
    JSON.stringify({ name: "synthetic-build", workspaces: ["packages/*"] }),
  );
  await put(
    "package-lock.json",
    JSON.stringify({ lockfileVersion: 3, packages: {} }),
  );
  await put("packages/README.md", "Not a workspace package.");
  await put(
    "packages/app/package.json",
    JSON.stringify({ name: "synthetic-app", main: "dist/bin.js" }),
  );
  await put("packages/app/dist/bin.js", "export const app = 1;");
  await put(
    "packages/core/package.json",
    JSON.stringify({ name: "synthetic-core", main: "dist/index.js" }),
  );
  await put("packages/core/dist/index.js", "export const core = 1;");
  const entry = join(root, "packages/app/dist/bin.js");
  return { root, put, entry };
}

test("host and Core declaration errors surface before build lookup and still dispose resources", async (t) => {
  const f = await fixture(t);
  for (const kind of ["idle", "capacity", "concurrency", "permission"]) {
    let error = "",
      disposed = 0;
    const io = {
      input: Readable.from([]),
      output: new Writable({
        write(_c, _e, done) {
          done();
        },
      }),
      error: new Writable({
        write(c, _e, done) {
          error += c;
          done();
        },
      }),
    };
    const code = await runHosted(
      {
        entryPoint: f.entry,
        ...(kind === "idle" ? { idleTimeoutMs: 0 } : {}),
        ...(kind === "capacity" ? { maxInvocations: 0 } : {}),
        createDefinition: () => ({
          name: "synthetic-build",
          description: "fixture",
          ...(kind === "concurrency" ? { concurrency: 0 } : {}),
          ...(kind === "permission" ? { permissions: {} } : {}),
          commands:
            kind === "permission"
              ? [{ name: "inspect", description: "fixture", run: () => null }]
              : [],
          resources: [
            {
              dispose() {
                disposed++;
              },
            },
          ],
        }),
      },
      ["--help"],
      io,
    );
    assert.equal(code, 1);
    assert.match(
      error,
      kind === "idle"
        ? /idleTimeoutMs/
        : kind === "capacity"
          ? /maxInvocations/
          : kind === "concurrency"
            ? /concurrency/
            : /must declare a permission/,
    );
    assert.equal(disposed, 1);
  }
});

test("failed diagnostic sink does not crash runHosted or skip resource disposal", async (t) => {
  const f = await fixture(t);
  for (const cleanupFails of [false, true]) {
    let disposed = 0;
    const error = new Writable({
      write(_chunk, _encoding, done) {
        done(new Error("synthetic diagnostic failure"));
      },
    });
    const code = await runHosted(
      {
        entryPoint: f.entry,
        idleTimeoutMs: 0,
        createDefinition: () => ({
          name: "synthetic-build",
          description: "fixture",
          commands: [],
          resources: [
            {
              dispose() {
                disposed++;
                if (cleanupFails) throw new Error("synthetic cleanup failure");
              },
            },
          ],
        }),
      },
      [],
      {
        input: Readable.from([]),
        output: new Writable({
          write(_c, _e, done) {
            done();
          },
        }),
        error,
      },
    );
    assert.equal(code, 1);
    assert.equal(disposed, 1);
    assert.equal(error.listenerCount("error"), 0);
  }
});

test("build manifest follows local workspace code, additions and missing artifacts", async (t) => {
  const f = await fixture(t);
  const initial = await writeBuildManifest(f.root);
  assert.equal(await readBuildManifest(f.entry), initial);
  await f.put("packages/core/dist/index.js", "export const core = 2;");
  await assert.rejects(readBuildManifest(f.entry), /stale or incomplete/);
  assert.notEqual(await writeBuildManifest(f.root), initial);
  await f.put("packages/core/dist/extra.js", "export const extra = 1;");
  await assert.rejects(readBuildManifest(f.entry), /stale or incomplete/);
  await writeBuildManifest(f.root);
  await rm(join(f.root, "packages/core/dist/index.js"));
  await assert.rejects(readBuildManifest(f.entry), /stale or incomplete/);
  await assert.rejects(writeBuildManifest(f.root), /ENOENT/);
});

test("dependency lock, installed lock and explicitly patched runtime input affect identity", async (t) => {
  const f = await fixture(t);
  await writeBuildManifest(f.root);
  await f.put(
    "package-lock.json",
    JSON.stringify({
      lockfileVersion: 3,
      packages: { "synthetic-dependency": { version: "2.0.0" } },
    }),
  );
  await assert.rejects(readBuildManifest(f.entry), /stale or incomplete/);
  await writeBuildManifest(f.root);
  await f.put("node_modules/.package-lock.json", "{}");
  await assert.rejects(readBuildManifest(f.entry), /stale or incomplete/);
  await f.put(
    "node_modules/synthetic-dependency/package.json",
    JSON.stringify({ name: "synthetic-dependency", main: "index.js" }),
  );
  await f.put(
    "node_modules/synthetic-dependency/index.js",
    "export const patched = 1;",
  );
  await f.put(
    "packages/core/package.json",
    JSON.stringify({
      name: "synthetic-core",
      main: "dist/index.js",
      cliFactory: { runtimeInputs: ["synthetic-dependency"] },
    }),
  );
  await writeBuildManifest(f.root);
  await f.put(
    "node_modules/synthetic-dependency/index.js",
    "export const patched = 2;",
  );
  await assert.rejects(readBuildManifest(f.entry), /stale or incomplete/);
});

test("manifest identity is relocatable and excludes tests and source-only edits", async (t) => {
  const f = await fixture(t);
  const initial = await writeBuildManifest(f.root);
  await f.put(
    "packages/app/dist/tests/fixture.js",
    "synthetic test-only content",
  );
  await f.put("packages/app/src/bin.ts", "export const source = 2;");
  assert.equal(await buildFingerprint(f.root), initial);
  const copy = await mkdtemp(join(tmpdir(), "cli-build-copy-"));
  t.after(() => rm(copy, { recursive: true, force: true }));
  await cp(f.root, copy, { recursive: true });
  assert.equal(
    await readBuildManifest(join(copy, "packages/app/dist/bin.js")),
    initial,
  );
});

test("an absent or interrupted build marker never publishes readiness", async (t) => {
  const f = await fixture(t);
  await assert.rejects(readBuildManifest(f.entry), /npm run build/);
  await writeBuildManifest(f.root);
  await rm(join(f.root, manifestName));
  await f.put("packages/app/dist/bin.js", "export const app = 2;");
  await assert.rejects(readBuildManifest(f.entry), /npm run build/);
  await f.put(manifestName, "{interrupted");
  await assert.rejects(readBuildManifest(f.entry), /npm run build/);
  const build = await writeBuildManifest(f.root);
  assert.equal(
    JSON.parse(await readFile(join(f.root, manifestName), "utf8")).build,
    build,
  );
});
