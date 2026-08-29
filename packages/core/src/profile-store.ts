import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir, platform } from "node:os";
import { dirname, join } from "node:path";
import type {
  Profile,
  ProfileStoreContract,
  ProfileValues,
} from "./types.js";

interface ProfileDocument {
  version: 1;
  active: string;
  profiles: Record<string, ProfileValues>;
  permissions?: Record<string, string[]>;
}

export interface ProfileStoreOptions {
  applicationId: string;
  defaultName?: string;
  defaults?: ProfileValues;
  rootDirectory?: string;
  validate?: (values: ProfileValues) => void | Promise<void>;
}

const profileNamePattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

function defaultConfigRoot(): string {
  const overridden = process.env.CLI_FACTORY_HOME;
  if (overridden) {
    return overridden;
  }

  if (platform() === "win32") {
    return process.env.APPDATA ?? join(homedir(), "AppData", "Roaming");
  }

  if (platform() === "darwin") {
    return join(homedir(), "Library", "Application Support");
  }

  return process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config");
}

function assertProfileName(name: string): void {
  if (!profileNamePattern.test(name)) {
    throw new Error(
      "Profile names must start with a letter or number and contain at most 64 letters, numbers, dots, dashes, or underscores.",
    );
  }
}

export class ProfileStore implements ProfileStoreContract {
  readonly #filePath: string;
  readonly #defaultName: string;
  readonly #defaults: ProfileValues;
  readonly #validate: ((values: ProfileValues) => void | Promise<void>) | undefined;

  public constructor(options: ProfileStoreOptions) {
    this.#defaultName = options.defaultName ?? "default";
    assertProfileName(this.#defaultName);
    this.#defaults = structuredClone(options.defaults ?? {});
    this.#validate = options.validate;
    this.#filePath = join(
      options.rootDirectory ?? defaultConfigRoot(),
      options.applicationId,
      "profiles.json",
    );
  }

  public async get(name?: string): Promise<Profile> {
    const document = await this.#load();
    const selectedName = name ?? document.active;
    const values = document.profiles[selectedName];
    if (!values) {
      throw new Error(`Profile '${selectedName}' does not exist.`);
    }

    return { name: selectedName, values: structuredClone(values) };
  }

  public async list(): Promise<{ active: string; profiles: Profile[] }> {
    const document = await this.#load();
    return {
      active: document.active,
      profiles: Object.entries(document.profiles).map(([name, values]) => ({
        name,
        values: structuredClone(values),
      })),
    };
  }

  public async create(name: string, values: ProfileValues = {}): Promise<Profile> {
    assertProfileName(name);
    const document = await this.#load();
    if (document.profiles[name]) {
      throw new Error(`Profile '${name}' already exists.`);
    }
    const nextValues = { ...this.#defaults, ...values };
    await this.#validate?.(nextValues);
    document.profiles[name] = nextValues;
    await this.#save(document);
    return { name, values: structuredClone(nextValues) };
  }

  public async set(name: string, values: ProfileValues): Promise<Profile> {
    assertProfileName(name);
    const document = await this.#load();
    if (!document.profiles[name]) {
      throw new Error(`Profile '${name}' does not exist. Create it with 'profile create ${name}'.`);
    }
    const nextValues = {
      ...this.#defaults,
      ...document.profiles[name],
      ...values,
    };
    await this.#validate?.(nextValues);
    document.profiles[name] = nextValues;
    await this.#save(document);
    return { name, values: structuredClone(nextValues) };
  }

  public async setDefault(name: string): Promise<Profile> {
    assertProfileName(name);
    const document = await this.#load();
    const values = document.profiles[name];
    if (!values) {
      throw new Error(`Profile '${name}' does not exist. Create it with 'profile create ${name}'.`);
    }

    document.active = name;
    await this.#save(document);
    return { name, values: structuredClone(values) };
  }

  public async delete(name: string): Promise<{ deleted: string; default: string }> {
    assertProfileName(name);
    const document = await this.#load();
    if (!document.profiles[name]) {
      throw new Error(`Profile '${name}' does not exist.`);
    }
    if (Object.keys(document.profiles).length === 1) {
      throw new Error("Cannot delete the only profile. At least one default profile must exist.");
    }
    if (document.active === name) {
      throw new Error(
        `Cannot delete default profile '${name}'. Set another default with 'profile set-default <name>' first.`,
      );
    }

    delete document.profiles[name];
    if (document.permissions) {
      delete document.permissions[name];
      if (Object.keys(document.permissions).length === 0) {
        delete document.permissions;
      }
    }
    await this.#save(document);
    return { deleted: name, default: document.active };
  }

  public async getPermissions(name?: string): Promise<readonly string[] | undefined> {
    const document = await this.#load();
    const selectedName = name ?? document.active;
    if (!document.profiles[selectedName]) {
      throw new Error(`Profile '${selectedName}' does not exist.`);
    }
    const permissions = document.permissions?.[selectedName];
    return permissions === undefined ? undefined : [...permissions];
  }

  public async setPermissions(
    name: string,
    permissions: readonly string[],
  ): Promise<readonly string[]> {
    assertProfileName(name);
    const document = await this.#load();
    if (!document.profiles[name]) {
      throw new Error(`Profile '${name}' does not exist.`);
    }
    const uniquePermissions = [...new Set(permissions)];
    document.permissions ??= {};
    document.permissions[name] = uniquePermissions;
    await this.#save(document);
    return [...uniquePermissions];
  }

  async #load(): Promise<ProfileDocument> {
    try {
      const contents = await readFile(this.#filePath, "utf8");
      const document = JSON.parse(contents) as Partial<ProfileDocument>;
      if (
        document.version !== 1 ||
        typeof document.active !== "string" ||
        !document.profiles ||
        typeof document.profiles !== "object" ||
        Array.isArray(document.profiles) ||
        Object.keys(document.profiles).length === 0 ||
        !Object.hasOwn(document.profiles, document.active) ||
        Object.values(document.profiles).some(
          (values) => values === null || typeof values !== "object" || Array.isArray(values),
        ) ||
        (document.permissions !== undefined &&
          (document.permissions === null ||
            typeof document.permissions !== "object" ||
            Object.values(document.permissions).some(
              (permissions) =>
                !Array.isArray(permissions) ||
                permissions.some((permission) => typeof permission !== "string"),
            )))
      ) {
        throw new Error(`Unsupported profile document at '${this.#filePath}'.`);
      }

      return document as ProfileDocument;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }

      return {
        version: 1,
        active: this.#defaultName,
        profiles: { [this.#defaultName]: structuredClone(this.#defaults) },
      };
    }
  }

  async #save(document: ProfileDocument): Promise<void> {
    await mkdir(dirname(this.#filePath), { recursive: true });
    const temporaryPath = `${this.#filePath}.${process.pid}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(document, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    await rename(temporaryPath, this.#filePath);
  }
}
