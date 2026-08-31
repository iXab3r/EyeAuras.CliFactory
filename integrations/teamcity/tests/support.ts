import { Readable, Writable } from "node:stream";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TestContext } from "node:test";
import {
  MemorySecretStore,
  type CliRuntime,
  AppArguments,
  ProfileStore,
} from "@eyeauras/cli-factory";

export interface TestRuntime {
  runtime: CliRuntime;
  profileStore: ProfileStore;
  secretStore: MemorySecretStore;
  stdout(): string;
  stderr(): string;
  resetOutput(): void;
}

export async function createTestRuntime(
  t: TestContext,
  options: {
    profiles?: Array<{
      name: string;
      url?: string;
      guest?: boolean;
      permissions?: readonly string[];
    }>;
    tokens?: Record<string, string>;
    input?: string;
  } = {},
): Promise<TestRuntime> {
  const profiles = options.profiles ?? [
    { name: "default", url: "https://teamcity.test" },
  ];
  const first = profiles[0];
  if (!first) throw new Error("At least one test profile is required.");
  const root = await mkdtemp(join(tmpdir(), "teamcity-cli-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const appArguments = new AppArguments({
    AppName: "teamcity-cli",
    Profile: first.name,
    Environment: {
      EnvironmentAppData: root,
      EnvironmentLocalAppData: root,
      AppDomainDirectory: root,
      ApplicationExecutablePath: join(root, "bin.js"),
      ProcessId: process.pid,
    },
  });
  const profileStore = new ProfileStore({
    applicationId: "teamcity-cli",
    appArguments,
    defaultName: first.name,
  });
  for (const { name, permissions, ...values } of profiles) {
    if (name === first.name) await profileStore.set(name, values);
    else await profileStore.create(name, values);
    if (permissions !== undefined)
      await profileStore.setPermissions(name, permissions);
  }
  const secretStore = new MemorySecretStore();
  for (const [profile, token] of Object.entries(
    options.tokens ?? { default: "fixture-token" },
  )) {
    await secretStore.set(
      "ai-cli-factory:teamcity-cli",
      `${profile}:token`,
      token,
    );
  }
  let stdout = "";
  let stderr = "";
  const output = new Writable({
    write(chunk, _encoding, callback) {
      stdout += chunk.toString();
      callback();
    },
  });
  const error = new Writable({
    write(chunk, _encoding, callback) {
      stderr += chunk.toString();
      callback();
    },
  });
  return {
    runtime: {
      appArguments,
      input: Readable.from([options.input ?? ""]),
      output,
      error,
      profileStore,
      secretStore,
    },
    profileStore,
    secretStore,
    stdout: () => stdout,
    stderr: () => stderr,
    resetOutput() {
      stdout = "";
      stderr = "";
    },
  };
}
