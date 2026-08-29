import { Readable, Writable } from "node:stream";
import {
  MemorySecretStore,
  type CliRuntime,
  type Profile,
  type ProfileStoreContract,
  type ProfileValues,
} from "@eyeauras/cli-factory";

export class TestProfileStore implements ProfileStoreContract {
  readonly #profiles = new Map<string, ProfileValues>();
  readonly #permissions = new Map<string, string[]>();
  #active: string;

  public constructor(
    profiles: Array<{
      name: string;
      url: string;
      permissions?: readonly string[];
    }> = [{ name: "default", url: "https://teamcity.test" }],
  ) {
    const first = profiles[0];
    if (!first) {
      throw new Error("At least one test profile is required.");
    }
    this.#active = first.name;
    for (const profile of profiles) {
      this.#profiles.set(profile.name, { url: profile.url });
      if (profile.permissions !== undefined) {
        this.#permissions.set(profile.name, [...profile.permissions]);
      }
    }
  }

  public async get(name = this.#active): Promise<Profile> {
    const values = this.#profiles.get(name);
    if (!values) {
      throw new Error(`Unknown test profile '${name}'.`);
    }
    return { name, values: structuredClone(values) };
  }

  public async list(): Promise<{ active: string; profiles: Profile[] }> {
    return {
      active: this.#active,
      profiles: [...this.#profiles].map(([name, values]) => ({
        name,
        values: structuredClone(values),
      })),
    };
  }

  public async set(name: string, values: ProfileValues): Promise<Profile> {
    const next = { ...(this.#profiles.get(name) ?? {}), ...values };
    this.#profiles.set(name, next);
    return { name, values: structuredClone(next) };
  }

  public async use(name: string): Promise<Profile> {
    const profile = await this.get(name);
    this.#active = name;
    return profile;
  }

  public async getPermissions(name = this.#active): Promise<readonly string[] | undefined> {
    const permissions = this.#permissions.get(name);
    return permissions === undefined ? undefined : [...permissions];
  }

  public async setPermissions(
    name: string,
    permissions: readonly string[],
  ): Promise<readonly string[]> {
    const next = [...permissions];
    this.#permissions.set(name, next);
    return next;
  }
}

export interface TestRuntime {
  runtime: CliRuntime;
  profileStore: TestProfileStore;
  secretStore: MemorySecretStore;
  stdout(): string;
  stderr(): string;
  resetOutput(): void;
}

export async function createTestRuntime(options: {
  profiles?: Array<{ name: string; url: string; permissions?: readonly string[] }>;
  tokens?: Record<string, string>;
  input?: string;
} = {}): Promise<TestRuntime> {
  const profileStore = new TestProfileStore(options.profiles);
  const secretStore = new MemorySecretStore();
  for (const [profile, token] of Object.entries(options.tokens ?? { default: "fixture-token" })) {
    await secretStore.set("ai-cli-factory:teamcity-cli", `${profile}:token`, token);
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
