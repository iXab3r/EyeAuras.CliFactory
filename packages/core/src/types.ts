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
  io: CliIo;
  cwd: string;
  environment: Readonly<NodeJS.ProcessEnv>;
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

export interface AuthStatus {
  authenticated: boolean;
  identity?: unknown;
}

export interface AuthContext extends CommandContext {
  interactive: boolean;
  stdinAvailable: boolean;
  reuseStored: boolean;
}

/** Applications own the protocol. Core owns the common command surface. */
export interface AuthDefinition {
  required?: (profile: Profile) => boolean;
  /** Optional local-only preflight. Must not launch/change browser resources or contact services.
   * Omit when readiness cannot be determined passively; the service handler then enforces auth. */
  isReady?: (context: AuthReadinessContext) => boolean | Promise<boolean>;
  /** Environment inputs consumed by this auth implementation; hosts forward only declared keys. */
  environmentKeys?: readonly string[];
  loginOptions?: readonly OptionDefinition[];
  login: (
    context: AuthContext,
    options: Record<string, unknown>,
  ) => Promise<AuthStatus>;
  /** Explicit auth status command only; may actively validate with the service. */
  status: (context: AuthContext) => Promise<AuthStatus>;
  logout: (context: AuthContext) => Promise<void>;
}

export type AuthReadinessContext = Pick<
  CommandContext,
  "appArguments" | "profile" | "secrets" | "signal" | "environment"
>;

export interface CliIo {
  input: Readable;
  output: Writable;
  error: Writable;
}

export interface CliInvocation {
  input?: Readable;
  output?: Writable;
  error?: Writable;
  signal?: AbortSignal;
  cwd?: string;
  environment?: Readonly<NodeJS.ProcessEnv>;
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
  auth?: AuthDefinition;
  /** Extra per-invocation environment inputs; combined with auth.environmentKeys by the host. */
  environmentKeys?: readonly string[];
  /** Maximum executing logical commands; omitted means no extra limit. */
  concurrency?: number;
  /** Owned instances, closed in reverse registration order. Never register caller-owned I/O. */
  resources?: readonly CliResource[];
  permissions?: PermissionGateDefinition;
  commands: readonly CommandDefinition[];
  /** Module-owned local management commands, not service leaves. */
  builtins?: readonly CommandDefinition[];
  runtime?: CliRuntime;
}

/** Flat ownership only: no service lookup, scopes or dependency graph. */
export interface CliResource {
  dispose(): void | Promise<void>;
  /** Called after profile updates and before deletion, while commands are excluded. */
  invalidateProfile?(appArguments: IAppArguments): void | Promise<void>;
}

export interface ProfileStoreContract {
  get(name?: string): Promise<Profile>;
  list(): Promise<{ active: string; profiles: Profile[] }>;
  create(name: string, values?: ProfileValues): Promise<Profile>;
  set(name: string, values: ProfileValues): Promise<Profile>;
  setDefault(name: string): Promise<Profile>;
  delete(name: string): Promise<{ deleted: string; default: string }>;
  getPermissions(name?: string): Promise<readonly string[] | undefined>;
  setPermissions(
    name: string,
    permissions: readonly string[],
  ): Promise<readonly string[]>;
}

export interface CliApplication {
  run(argv?: readonly string[], invocation?: CliInvocation): Promise<number>;
  dispose(): Promise<void>;
  execute(argv: readonly string[], signal?: AbortSignal): Promise<unknown>;
}
