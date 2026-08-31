import assert from "node:assert/strict";
import { lstat, mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Readable, Writable } from "node:stream";
import type { TestContext } from "node:test";
import { AppArguments } from "./app-arguments.js";
import { ProfileStore } from "./profile-store.js";
import { MemorySecretStore, ProfileSecrets } from "./secret-store.js";
import type { CliApplication, CliInvocation, CliRuntime, ProfileValues } from "./types.js";

export interface FixtureProfile {
  name: string;
  values?: ProfileValues;
  permissions?: readonly string[];
  /** Explicit synthetic credentials; no token protocol is assumed. */
  secrets?: Readonly<Record<string, string>>;
}

export interface CliFixtureOptions {
  applicationId: string;
  /** A non-default name requires explicit profiles so its identity is persisted. */
  defaultProfile?: string;
  /** Omission leaves the virtual default unconfigured. No authentication runs. */
  profiles?: readonly FixtureProfile[];
  input?: string;
}

function capture(input = "") {
  let stdout = "", stderr = "";
  return {
    input: Readable.from([input]),
    output: new Writable({ write(chunk, _encoding, done) { stdout += chunk.toString(); done(); } }),
    error: new Writable({ write(chunk, _encoding, done) { stderr += chunk.toString(); done(); } }),
    stdout: () => stdout,
    stderr: () => stderr,
    resetOutput() { stdout = ""; stderr = ""; },
  };
}

/** Offline fixture mechanics only. The caller owns the definition, auth and network mocks. */
export async function createCliFixture(t: Pick<TestContext, "after">, options: CliFixtureOptions) {
  const defaultProfile = options.defaultProfile ?? "default";
  if (defaultProfile !== "default" && !options.profiles?.length) {
    throw new Error("A non-default fixture profile requires explicit profile preparation.");
  }
  const parent = await realpath(tmpdir());
  const root = await mkdtemp(join(parent, "cli-factory-fixture-"));
  const applications = new Set<CliApplication>();
  let identity: Awaited<ReturnType<typeof lstat>> | undefined;
  let disposal: Promise<void> | undefined;
  const dispose = (): Promise<void> => disposal ??= (async () => {
    const failures: unknown[] = [];
    for (const app of [...applications].reverse()) {
      try { await app.dispose(); } catch (error) { failures.push(error); }
    }
    // A failed shutdown may leave resources using the directory. Retain it for inspection.
    if (failures.length) throw new AggregateError(failures, "Fixture application disposal failed; temporary data retained.");
    let current: Awaited<ReturnType<typeof lstat>>;
    try { current = await lstat(root); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
    assert.ok(identity && current.isDirectory() && !current.isSymbolicLink(), "Fixture root is no longer an owned directory.");
    assert.equal(current.dev, identity.dev, "Fixture root device changed.");
    assert.equal(current.ino, identity.ino, "Fixture root identity changed.");
    assert.equal(await realpath(root), root, "Fixture root target changed.");
    assert.equal(dirname(root), parent, "Fixture root escaped its temporary parent.");
    await rm(root, { recursive: true, force: true });
  })();
  // Register before profile preparation or any caller-controlled application factory can fail.
  t.after(dispose);
  identity = await lstat(root);
  const appArguments = new AppArguments({
    AppName: options.applicationId, Profile: defaultProfile,
    Environment: {
      AppDomainDirectory: join(root, "executable"),
      ApplicationExecutablePath: join(root, "executable", "fixture.js"),
      EnvironmentAppData: join(root, "roaming"),
      EnvironmentLocalAppData: join(root, "local"),
      ProcessId: 1,
    },
  });
  // A view of the real backing document. Do not inject this into the application by default:
  // Core must still construct its store with the integration's own defaults and validation.
  const profileStore = new ProfileStore({
    applicationId: options.applicationId, appArguments, defaultName: defaultProfile,
  });
  const secretStore = new MemorySecretStore();
  for (const profile of options.profiles ?? []) {
    if (profile.name === defaultProfile) await profileStore.set(profile.name, profile.values ?? {});
    else await profileStore.create(profile.name, profile.values ?? {});
    if (profile.permissions !== undefined) await profileStore.setPermissions(profile.name, profile.permissions);
    const scoped = new ProfileSecrets(secretStore, options.applicationId, profile.name);
    for (const [name, value] of Object.entries(profile.secrets ?? {})) await scoped.set(name, value);
  }
  const output = capture(options.input);
  const runtime: CliRuntime & Pick<ReturnType<typeof capture>, "input" | "output" | "error"> = {
    appArguments, secretStore, input: output.input, output: output.output, error: output.error,
  };
  const run = async (app: CliApplication, argv: readonly string[], invocation: CliInvocation = {}) => {
    const io = capture();
    const exitCode = await app.run(argv, { ...io, cwd: root, environment: {}, ...invocation });
    return { exitCode, stdout: io.stdout(), stderr: io.stderr() };
  };
  return {
    root, runtime, appArguments, profileStore, secretStore, dispose,
    stdout: output.stdout, stderr: output.stderr, resetOutput: output.resetOutput,
    createApplication(factory: (runtime: CliRuntime) => CliApplication): CliApplication {
      if (disposal) throw new Error("Fixture is disposed.");
      const app = factory(runtime);
      applications.add(app);
      return app;
    },
    run,
    async json(app: CliApplication, argv: readonly string[], invocation?: CliInvocation): Promise<unknown> {
      const result = await run(app, ["--json", ...argv], invocation);
      assert.equal(result.exitCode, 0, result.stderr);
      return JSON.parse(result.stdout);
    },
    async rpc(app: CliApplication, commands: readonly (readonly string[])[], invocation?: CliInvocation): Promise<unknown[]> {
      const input = commands.map((argv, id) =>
        JSON.stringify({ jsonrpc: "2.0", id, method: "cli.execute", params: { argv } })).join("\n") + "\n";
      const result = await run(app, ["--json-rpc"], { ...invocation, input: Readable.from([input]) });
      assert.equal(result.exitCode, 0, result.stderr);
      const replies: unknown[] = result.stdout.trim().split("\n").filter(Boolean).map(line => JSON.parse(line));
      assert.equal(replies.length, commands.length, "RPC response count does not match its request count.");
      return replies;
    },
  };
}

export type CliFixture = Awaited<ReturnType<typeof createCliFixture>>;
export { assertHttpRequest, trackRequests, assertPermissionDenied, assertCliOutput, assertSafeCliFailure, type HttpRequestExpectation } from "./testing-contracts.js";
