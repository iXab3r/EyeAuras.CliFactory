import { Entry } from "@napi-rs/keyring";
import type { ScopedSecrets, SecretStore } from "./types.js";

export class KeyringSecretStore implements SecretStore {
  public async get(service: string, account: string): Promise<string | undefined> {
    try {
      return new Entry(service, account).getPassword() ?? undefined;
    } catch (error) {
      throw keyringError("read", error);
    }
  }

  public async set(service: string, account: string, value: string): Promise<void> {
    try {
      new Entry(service, account).setPassword(value);
    } catch (error) {
      throw keyringError("write", error);
    }
  }

  public async delete(service: string, account: string): Promise<void> {
    const entry = new Entry(service, account);
    try {
      if (entry.getPassword() !== null) {
        entry.deletePassword();
      }
    } catch (error) {
      throw keyringError("delete", error);
    }
  }
}

function keyringError(operation: string, error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  return new Error(
    `Could not ${operation} the OS credential store: ${message}. No plaintext fallback is used.`,
    { cause: error },
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

  public get(name: string): Promise<string | undefined> {
    return this.#store.get(this.#service, `${this.#profileName}:${name}`);
  }

  public async require(name: string): Promise<string> {
    const value = await this.get(name);
    if (!value) {
      throw new Error(
        `No credential is stored for profile '${this.#profileName}'. Run 'auth login' first.`,
      );
    }
    return value;
  }

  public set(name: string, value: string): Promise<void> {
    return this.#store.set(this.#service, `${this.#profileName}:${name}`, value);
  }

  public delete(name: string): Promise<void> {
    return this.#store.delete(this.#service, `${this.#profileName}:${name}`);
  }
}
