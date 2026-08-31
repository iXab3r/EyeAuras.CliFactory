import { rm } from "node:fs/promises";
import { promptText } from "./auth.js";
import { command } from "./command.js";
import { assertProfileName, assertUniqueProfileName } from "./profile-store.js";
import type {
  AuthContext,
  CliDefinition,
  CommandContext,
  Profile,
  ProfileField,
  ProfileStoreContract,
  ScopedSecrets,
} from "./types.js";

interface ConfigurationState {
  missingFields: readonly ProfileField[];
  authenticationMissing: boolean;
}

interface ConfigureProfileOptions {
  values: Record<string, unknown>;
  authOptions: Record<string, unknown>;
  interactive: boolean;
}

interface ProfileInvocation {
  contextFor(profile: Profile): CommandContext;
  stdinAvailable: boolean;
  interactive(): boolean;
}

function hasProfileValue(value: unknown): boolean {
  return (
    value !== undefined &&
    value !== null &&
    (typeof value !== "string" || value.trim() !== "")
  );
}

function configureSyntax(field: { flags: string }): string {
  return (
    field.flags.match(/--[a-z0-9-]+(?:[ =](?:<[^>]+>|\[[^\]]+\]))?/i)?.[0] ??
    field.flags
  );
}

/** Configure validates against candidate values without persisting credentials early. */
function deferSecrets(store: ScopedSecrets) {
  const pending = new Map<string, string | undefined>();
  const secrets: ScopedSecrets = {
    get: async (name) =>
      pending.has(name) ? pending.get(name) : store.get(name),
    async require(name) {
      const value = await secrets.get(name);
      if (!value)
        throw new Error("No credential is available. Run 'auth login' first.");
      return value;
    },
    set: async (name, value) => {
      pending.set(name, value);
    },
    delete: async (name) => {
      pending.set(name, undefined);
    },
  };
  return {
    secrets,
    async commit(saveProfile: () => Promise<Profile>) {
      // Fail closed: never bind an old credential to a newly saved endpoint.
      for (const name of pending.keys()) await store.delete(name);
      await saveProfile();
      for (const [name, value] of pending) {
        if (value !== undefined) await store.set(name, value);
      }
    },
  };
}

function optionKey(flags: string): string {
  const longFlag = flags.split(/[ ,|]+/).find((part) => part.startsWith("--"));
  if (!longFlag) {
    throw new Error(`Option '${flags}' must include a long flag.`);
  }
  return longFlag
    .replace(/^--(?:no-)?/, "")
    .replace(/[ <[].*$/, "")
    .replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}

/** Profile/auth declarations and onboarding share the same operations, not a second parser. */
export function createProfileCommands(
  definition: Pick<CliDefinition, "name" | "profile" | "auth">,
  profileStore: ProfileStoreContract,
  invocation: ProfileInvocation,
  invalidateProfile: (profile: Profile) => Promise<void>,
) {
  const profileDefinition = definition.profile ?? {};
  const missingRequiredFields = (profile: Profile): readonly ProfileField[] =>
    (profileDefinition.fields ?? []).filter(
      (field) =>
        field.required === true && !hasProfileValue(profile.values[field.name]),
    );
  const authenticationRequired = (profile: Profile): boolean =>
    definition.auth !== undefined &&
    (definition.auth.required?.(profile) ?? true);
  const configurationState = async (
    profile: Profile,
  ): Promise<ConfigurationState> => {
    const missingFields = missingRequiredFields(profile);
    const readiness = definition.auth?.isReady;
    const { appArguments, secrets, signal, environment } =
      invocation.contextFor(profile);
    const authenticationMissing =
      missingFields.length === 0 &&
      authenticationRequired(profile) &&
      readiness !== undefined &&
      !(await readiness({
        appArguments,
        profile,
        secrets,
        signal,
        environment,
      }));
    return {
      missingFields,
      authenticationMissing,
    };
  };
  const configurationError = (
    profile: Profile,
    state: ConfigurationState,
  ): Error => {
    const missing = [
      ...state.missingFields.map((field) => configureSyntax(field)),
      ...(state.authenticationMissing
        ? (definition.auth?.loginOptions ?? []).map(configureSyntax)
        : []),
    ];
    const details = [
      ...(state.missingFields.length > 0
        ? [
            `missing fields: ${state.missingFields.map((field) => field.name).join(", ")}`,
          ]
        : []),
      ...(state.authenticationMissing ? ["authentication is missing"] : []),
    ].join("; ");
    return new Error(
      `Profile '${profile.name}' is not configured (${details}). ` +
        `Run '${definition.name} profile configure ${profile.name}${missing.length > 0 ? ` ${missing.join(" ")}` : ""}'.`,
    );
  };

  const authContext = (profile: Profile, interactive = false): AuthContext => ({
    ...invocation.contextFor(profile),
    interactive,
    stdinAvailable: invocation.stdinAvailable,
  });
  const configureProfile = async (
    profileName: string,
    options: ConfigureProfileOptions,
  ): Promise<{
    configured: true;
    profile: string;
    authenticated: true;
    identity: unknown;
  }> => {
    assertProfileName(profileName);
    const listed = await profileStore.list();
    const existing = listed.profiles.find(
      (profile) => profile.name === profileName,
    );
    if (!existing)
      assertUniqueProfileName(
        profileName,
        listed.profiles.map((profile) => profile.name),
      );
    const values = {
      ...(profileDefinition.defaults ?? {}),
      ...(existing?.values ?? {}),
      ...options.values,
    };
    let candidate: Profile = { name: profileName, values };
    const context = invocation.contextFor(candidate);
    let missing = missingRequiredFields(candidate);

    if (missing.length > 0 && options.interactive) {
      for (const field of missing) {
        const value = await promptText(
          context.io.input,
          context.io.error,
          field.description,
          context.signal,
        );
        if (hasProfileValue(value)) {
          values[field.name] = value;
        }
      }
      candidate = { name: profileName, values };
      missing = missingRequiredFields(candidate);
    }
    if (missing.length > 0) {
      throw configurationError(candidate, {
        missingFields: missing,
        authenticationMissing: false,
      });
    }

    await profileDefinition.validate?.(values);
    const saveProfile = () =>
      existing
        ? profileStore.set(profileName, values)
        : profileStore.create(profileName, values);
    if (!definition.auth || !authenticationRequired(candidate)) {
      const profile = await saveProfile();
      await invalidateProfile(profile);
      return {
        configured: true,
        profile: profile.name,
        authenticated: true,
        identity: null,
      };
    }

    await invalidateProfile(candidate);
    const loginContext = authContext(candidate, options.interactive);
    const deferred = deferSecrets(loginContext.secrets);
    const status = await definition.auth.login(
      { ...loginContext, secrets: deferred.secrets },
      options.authOptions,
    );
    if (!status.authenticated)
      throw configurationError(candidate, {
        missingFields: [],
        authenticationMissing: true,
      });
    loginContext.signal.throwIfAborted();
    try {
      await deferred.commit(saveProfile);
    } catch {
      const flags = (definition.auth.loginOptions ?? [])
        .map(configureSyntax)
        .join(" ");
      throw new Error(
        "Could not save profile configuration or authentication. Check the OS credential store. Authentication may be incomplete. " +
          `Run '${definition.name} profile configure ${profileName}${flags ? ` ${flags}` : ""}' again.`,
      );
    }
    return {
      configured: true,
      profile: profileName,
      authenticated: true,
      identity: status.identity ?? null,
    };
  };

  const fields = profileDefinition.fields ?? [];
  // Profile prerequisites may already be stored or prompted; they are not mandatory CLI options.
  const fieldOptions = fields.map(({ flags, description }) => ({
    flags,
    description,
  }));
  const profileValues = (options: Record<string, unknown>) =>
    Object.fromEntries(
      fields
        .map((field) => [field.name, options[optionKey(field.flags)]])
        .filter((entry) => entry[1] !== undefined),
    );
  const profileCommands = command("profile", "Manage service profiles", [
    command("list", "List profiles", async () => {
      const list = await profileStore.list();
      return list.profiles.map((profile) => ({
        default: profile.name === list.active,
        name: profile.name,
        ...profile.values,
      }));
    }),
    command("show [name]", "Show one profile", ({ args }, context) =>
      args.name === undefined
        ? context.profile
        : profileStore.get(String(args.name)),
    ),
    command(
      "configure [name]",
      "Complete profile settings and authentication",
      ({ args, options }, context) =>
        configureProfile(
          args.name === undefined ? context.profile.name : String(args.name),
          {
            values: profileValues(options),
            authOptions: options,
            interactive: invocation.interactive(),
          },
        ),
      { options: [...fieldOptions, ...(definition.auth?.loginOptions ?? [])] },
    ),
    command(
      "create <name>",
      "Create a profile without changing the default",
      ({ args, options }) =>
        profileStore.create(String(args.name), profileValues(options)),
      { options: fieldOptions },
    ),
    command(
      "set <name>",
      "Update an existing profile",
      async ({ args, options }) => {
        const profile = await profileStore.set(
          String(args.name),
          profileValues(options),
        );
        await invalidateProfile(profile);
        return profile;
      },
      { options: fieldOptions },
    ),
    command("set-default <name>", "Choose the default profile", ({ args }) =>
      profileStore.setDefault(String(args.name)),
    ),
    command(
      "delete <name>",
      "Delete a non-default profile and its stored credential",
      async ({ args }) => {
        const name = String(args.name);
        const list = await profileStore.list();
        if (!list.profiles.some((profile) => profile.name === name))
          throw new Error(`Profile '${name}' does not exist.`);
        if (list.profiles.length === 1)
          throw new Error(
            "Cannot delete the only profile. At least one default profile must exist.",
          );
        if (list.active === name)
          throw new Error(
            `Cannot delete default profile '${name}'. Set another default with 'profile set-default <name>' first.`,
          );
        const profile = await profileStore.get(name);
        const context = authContext(profile);
        await definition.auth?.logout(context);
        await invalidateProfile(profile);
        const deleted = await profileStore.delete(name);
        await rm(context.appArguments.AppDataDirectory, {
          recursive: true,
          force: true,
        });
        return deleted;
      },
    ),
  ]);
  const commands = [profileCommands];
  const auth = definition.auth;
  if (auth)
    commands.push(
      command("auth", "Manage application authentication", [
        command(
          "login",
          "Authenticate the selected profile",
          async ({ options }, context) => {
            const missingFields = missingRequiredFields(context.profile);
            if (missingFields.length)
              throw configurationError(context.profile, {
                missingFields,
                authenticationMissing: false,
              });
            if (!authenticationRequired(context.profile))
              throw new Error("This profile does not require authentication.");
            const status = await auth.login(
              authContext(context.profile, invocation.interactive()),
              options,
            );
            return {
              ...status,
              profile: context.profile.name,
              identity: status.identity ?? null,
            };
          },
          { options: auth.loginOptions ?? [] },
        ),
        command(
          "status",
          "Show authentication status",
          async (_input, context) => {
            const status = authenticationRequired(context.profile)
              ? await auth.status(authContext(context.profile))
              : { authenticated: true, identity: null };
            return { ...status, profile: context.profile.name };
          },
        ),
        command(
          "logout",
          "Invalidate authentication for the selected profile",
          async (_input, context) => {
            await auth.logout(authContext(context.profile));
            return {
              authenticated: !authenticationRequired(context.profile),
              profile: context.profile.name,
            };
          },
        ),
      ]),
    );
  return { commands, configureProfile, configurationState, configurationError };
}
