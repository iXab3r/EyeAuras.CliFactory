import type { Readable, Writable } from "node:stream";
import type { IAppArguments } from "./app-arguments.js";

export type ProfileValues = Record<string, unknown>;

export interface Profile {
  name: string;
  values: ProfileValues;
}

export interface ProfileField {
  name: string;
  flags: string;
  description: string;
  /** A service command cannot run until this field has a non-empty value. */
  required?: boolean;
}

export interface ProfileDefinition {
  defaultName?: string;
  defaults?: ProfileValues;
  fields?: readonly ProfileField[];
  validate?: (values: ProfileValues) => void | Promise<void>;
}

export interface SecretStore {
  get(service: string, account: string): Promise<string | undefined>;
  set(service: string, account: string, value: string): Promise<void>;
  delete(service: string, account: string): Promise<void>;
}

export interface ScopedSecrets {
  get(name: string): Promise<string | undefined>;
  require(name: string): Promise<string>;
  set(name: string, value: string): Promise<void>;
  delete(name: string): Promise<void>;
}

export interface CommandContext {
  appArguments: IAppArguments;
  profile: Profile;
  secrets: ScopedSecrets;
  fetch: typeof globalThis.fetch;
  signal: AbortSignal;
}

export interface CommandInput {
  args: Record<string, unknown>;
  options: Record<string, unknown>;
}

export type CommandHandler = (
  input: CommandInput,
  context: CommandContext,
) => unknown | Promise<unknown>;

export interface OptionDefinition {
  flags: string;
  description: string;
  /** Require a value (or declared default) before profile onboarding or handler execution. */
  required?: boolean;
  defaultValue?: unknown;
  parse?: (value: string, previous: unknown) => unknown;
}

export interface CommandSettings {
  options?: readonly OptionDefinition[];
  permission?: string;
}

export interface CommandDefinition {
  /** Command name followed by optional Commander-style arguments, for example `show <id>`. */
  name: string;
  description: string;
  options?: readonly OptionDefinition[];
  permission?: string;
  children?: readonly CommandDefinition[];
  run?: CommandHandler;
}

export interface PermissionCategory {
  name: string;
  description: string;
  enabledByDefault?: boolean;
}

export interface PermissionGateDefinition {
  categories?: readonly PermissionCategory[];
}

export interface TokenValidationContext {
  appArguments: IAppArguments;
  profile: Profile;
  token: string;
  fetch: typeof globalThis.fetch;
  signal: AbortSignal;
}

export interface TokenAuthDefinition {
  kind: "token";
  secretName: string;
  environmentVariable?: string;
  /** Allows a configured profile (for example guest access) to opt out of token auth. */
  required?: (profile: Profile) => boolean;
  validate?: (context: TokenValidationContext) => unknown | Promise<unknown>;
}

export interface CliRuntime {
  appArguments?: IAppArguments;
  input?: Readable;
  output?: Writable;
  error?: Writable;
  fetch?: typeof globalThis.fetch;
  profileStore?: ProfileStoreContract;
  secretStore?: SecretStore;
}

export interface CliDefinition {
  name: string;
  description: string;
  version?: string;
  applicationId?: string;
  profile?: ProfileDefinition;
  auth?: TokenAuthDefinition;
  permissions?: PermissionGateDefinition;
  commands: readonly CommandDefinition[];
  runtime?: CliRuntime;
}

export interface ProfileStoreContract {
  get(name?: string): Promise<Profile>;
  list(): Promise<{ active: string; profiles: Profile[] }>;
  create(name: string, values?: ProfileValues): Promise<Profile>;
  set(name: string, values: ProfileValues): Promise<Profile>;
  setDefault(name: string): Promise<Profile>;
  delete(name: string): Promise<{ deleted: string; default: string }>;
  getPermissions(name?: string): Promise<readonly string[] | undefined>;
  setPermissions(name: string, permissions: readonly string[]): Promise<readonly string[]>;
}

export interface CliApplication {
  run(argv?: readonly string[]): Promise<number>;
  execute(argv: readonly string[], signal?: AbortSignal): Promise<unknown>;
}
