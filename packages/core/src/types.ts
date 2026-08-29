import type { Readable, Writable } from "node:stream";

export type ProfileValues = Record<string, unknown>;

export interface Profile {
  name: string;
  values: ProfileValues;
}

export interface ProfileField {
  name: string;
  flags: string;
  description: string;
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
  defaultValue?: unknown;
  parse?: (value: string, previous: unknown) => unknown;
}

export interface CommandDefinition {
  /** Command name followed by optional Commander-style arguments, for example `show <id>`. */
  name: string;
  description: string;
  options?: readonly OptionDefinition[];
  children?: readonly CommandDefinition[];
  run?: CommandHandler;
}

export interface TokenValidationContext {
  profile: Profile;
  token: string;
  fetch: typeof globalThis.fetch;
  signal: AbortSignal;
}

export interface TokenAuthDefinition {
  kind: "token";
  secretName: string;
  environmentVariable?: string;
  validate?: (context: TokenValidationContext) => unknown | Promise<unknown>;
}

export interface CliRuntime {
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
  commands: readonly CommandDefinition[];
  runtime?: CliRuntime;
}

export interface ProfileStoreContract {
  get(name?: string): Promise<Profile>;
  list(): Promise<{ active: string; profiles: Profile[] }>;
  set(name: string, values: ProfileValues): Promise<Profile>;
  use(name: string): Promise<Profile>;
}

export interface CliApplication {
  run(argv?: readonly string[]): Promise<number>;
  execute(argv: readonly string[], signal?: AbortSignal): Promise<unknown>;
}
