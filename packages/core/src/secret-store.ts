import type { IAppArguments } from "./app-arguments.js";
import { WindowsDpapiSecretStore } from "./windows-dpapi-secret-store.js";
import { CliError, diagnosticCause, rememberSecret } from "./errors.js";
import type { ScopedSecrets, SecretStore } from "./types.js";

/** Platform storage is selected once; Windows never reads Credential Manager. */
export class PlatformSecretStore implements SecretStore {
  readonly #store: SecretStore;

  public constructor(appArguments: IAppArguments) {
    this.#store = process.platform === "win32"
      ? new WindowsDpapiSecretStore(appArguments)
      : new KeyringSecretStore();
  }

  public get(service: string, account: string): Promise<string | undefined> {
    return this.#store.get(service, account);
  }
  public set(service: string, account: string, value: string): Promise<void> {
    return this.#store.set(service, account, value);
  }
  public delete(service: string, account: string): Promise<void> {
    return this.#store.delete(service, account);
  }
}

class KeyringSecretStore implements SecretStore {
  public async get(service: string, account: string): Promise<string | undefined> {
    try {
      const { Entry } = await import("@napi-rs/keyring");
      return new Entry(service, account).getPassword() ?? undefined;
    } catch (error) {
      throw keyringError("read", error);
    }
  }

  public async set(service: string, account: string, value: string): Promise<void> {
    try {
      const { Entry } = await import("@napi-rs/keyring");
      new Entry(service, account).setPassword(value);
    } catch (error) {
      throw keyringError("write", error, [value]);
    }
  }

  public async delete(service: string, account: string): Promise<void> {
    try {
      const { Entry } = await import("@napi-rs/keyring");
      const entry = new Entry(service, account);
      if (entry.getPassword() !== null) {
        entry.deletePassword();
      }
    } catch (error) {
      throw keyringError("delete", error);
    }
  }
}

function keyringError(operation: string, error: unknown, secrets: readonly string[] = []): Error {
  return new CliError(
    `Could not ${operation} the OS credential store; there is no plaintext fallback.`,
    { code: "secrets.unavailable", cause: diagnosticCause(error, secrets) },
  );
}

export class MemorySecretStore implements SecretStore {
  readonly #values = new Map<string, string>();

  public async get(service: string, account: string): Promise<string | undefined> {
    return this.#values.get(`${service}\0${account}`);
  }

  public async set(service: string, account: string, value: string): Promise<void> {
    this.#values.set(`${service}\0${account}`, value);
  }

  public async delete(service: string, account: string): Promise<void> {
    this.#values.delete(`${service}\0${account}`);
  }
}

export class ProfileSecrets implements ScopedSecrets {
  readonly #store: SecretStore;
  readonly #service: string;
  readonly #profileName: string;

  public constructor(store: SecretStore, applicationId: string, profileName: string) {
    this.#store = store;
    this.#service = `ai-cli-factory:${applicationId}`;
    this.#profileName = profileName;
  }

  public async get(name: string): Promise<string | undefined> {
    const value = await this.#store.get(this.#service, `${this.#profileName}:${name}`);
    rememberSecret(value);
    return value;
  }

  public async require(name: string): Promise<string> {
    const value = await this.get(name);
    if (!value) {
      throw new CliError(`No credential is stored for profile '${this.#profileName}'.`, {
        code: "auth.missing", next: [["auth", "login"]],
      });
    }
    return value;
  }

  public set(name: string, value: string): Promise<void> {
    rememberSecret(value);
    return this.#store.set(this.#service, `${this.#profileName}:${name}`, value);
  }

  public async delete(name: string): Promise<void> {
    await this.get(name);
    await this.#store.delete(this.#service, `${this.#profileName}:${name}`);
  }
}
