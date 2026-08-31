import { Command, CommanderError, Option } from "commander";
import { rm } from "node:fs/promises";
import type { Readable, Writable } from "node:stream";
import { AppArguments } from "./app-arguments.js";
import { canPrompt, promptSecret, promptText, readStdin } from "./auth.js";
import { runJsonRpc } from "./json-rpc.js";
import { writeResult } from "./output.js";
import {
  resolvePermissionCategories,
  validateCommandPermissions,
  validatePermissionsDisabled,
} from "./permissions.js";
import { assertProfileName, assertUniqueProfileName, ProfileStore } from "./profile-store.js";
import { KeyringSecretStore, ProfileSecrets } from "./secret-store.js";
import type {
  CliApplication,
  CliDefinition,
  CommandContext,
  CommandDefinition,
  CommandInput,
  PermissionCategory,
  Profile,
  ProfileField,
  ProfileStoreContract,
  SecretStore,
} from "./types.js";

interface ExecutionOptions {
  render: boolean;
  signal: AbortSignal;
}

interface ConfigurationState {
  missingFields: readonly ProfileField[];
  authenticationMissing: boolean;
}

interface ConfigureProfileOptions {
  values: Record<string, unknown>;
  tokenStdin: boolean;
  interactive: boolean;
}

interface GlobalOptions {
  json?: boolean;
  profile?: string;
}

function hasProfileValue(value: unknown): boolean {
  return value !== undefined && value !== null && (typeof value !== "string" || value.trim() !== "");
}

function configureSyntax(field: ProfileField): string {
  return field.flags.match(/--[a-z0-9-]+(?:[ =](?:<[^>]+>|\[[^\]]+\]))?/i)?.[0] ?? field.flags;
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

function commandParts(syntax: string): { name: string; arguments: string[] } {
  const [name, ...arguments_] = syntax.trim().split(/\s+/);
  if (!name) {
    throw new Error("A command name cannot be empty.");
  }
  return { name, arguments: arguments_ };
}

export function createCli(definition: CliDefinition): CliApplication {
  const input = definition.runtime?.input ?? process.stdin;
  const output = definition.runtime?.output ?? process.stdout;
  const error = definition.runtime?.error ?? process.stderr;
  const fetchImplementation = definition.runtime?.fetch ?? globalThis.fetch;
  const applicationId = definition.applicationId ?? definition.name;
  const profileDefinition = definition.profile ?? {};
  const appArguments =
    definition.runtime?.appArguments ??
    new AppArguments({
      AppName: applicationId,
      ...(definition.version === undefined ? {} : { Version: definition.version }),
      Profile: profileDefinition.defaultName ?? "default",
    });
  if (appArguments.AppName !== applicationId) {
    throw new Error(
      `Cli applicationId '${applicationId}' does not match AppArguments.AppName '${appArguments.AppName}'.`,
    );
  }
  const permissionCategories: readonly PermissionCategory[] | undefined =
    definition.permissions === undefined
      ? undefined
      : resolvePermissionCategories(definition.permissions);
  if (permissionCategories) {
    validateCommandPermissions(definition.commands, permissionCategories);
  } else {
    validatePermissionsDisabled(definition.commands);
  }
  const defaultPermissions =
    permissionCategories
      ?.filter((category) => category.enabledByDefault === true)
      .map((category) => category.name) ?? [];
  const profileStore: ProfileStoreContract =
    definition.runtime?.profileStore ??
    new ProfileStore({
      applicationId,
      appArguments,
      ...(profileDefinition.defaultName === undefined
        ? {}
        : { defaultName: profileDefinition.defaultName }),
      ...(profileDefinition.defaults === undefined ? {} : { defaults: profileDefinition.defaults }),
      ...(profileDefinition.validate === undefined ? {} : { validate: profileDefinition.validate }),
    });
  const secretStore: SecretStore = definition.runtime?.secretStore ?? new KeyringSecretStore();

  const resolveProfile = async (requestedName?: string): Promise<Profile> =>
    profileStore.get(requestedName);
  const enabledPermissions = async (profileName: string): Promise<Set<string>> =>
    new Set((await profileStore.getPermissions(profileName)) ?? defaultPermissions);
  const missingRequiredFields = (profile: Profile): readonly ProfileField[] =>
    (profileDefinition.fields ?? []).filter(
      (field) => field.required === true && !hasProfileValue(profile.values[field.name]),
    );
  const authenticationRequired = (profile: Profile): boolean =>
    definition.auth !== undefined && (definition.auth.required?.(profile) ?? true);
  const configurationState = async (profile: Profile): Promise<ConfigurationState> => {
    const missingFields = missingRequiredFields(profile);
    const authenticationMissing =
      missingFields.length === 0 &&
      authenticationRequired(profile) &&
      (await new ProfileSecrets(secretStore, applicationId, profile.name).get(
        definition.auth!.secretName,
      )) === undefined;
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
      ...(state.authenticationMissing ? ["--token-stdin"] : []),
    ];
    const details = [
      ...(state.missingFields.length > 0
        ? [`missing fields: ${state.missingFields.map((field) => field.name).join(", ")}`]
        : []),
      ...(state.authenticationMissing ? ["authentication is missing"] : []),
    ].join("; ");
    return new Error(
      `Profile '${profile.name}' is not configured (${details}). ` +
        `Run '${definition.name} profile configure ${profile.name}${missing.length > 0 ? ` ${missing.join(" ")}` : ""}'.`,
    );
  };
  const contextFor = (profile: Profile, signal: AbortSignal): CommandContext => ({
    appArguments: appArguments.WithProfile(profile.name),
    profile,
    secrets: new ProfileSecrets(secretStore, applicationId, profile.name),
    fetch: fetchImplementation,
    signal,
  });

  const execute = async (
    argv: readonly string[],
    execution: ExecutionOptions,
  ): Promise<unknown> => {
    let result: unknown;
    let handled = false;
    let capturedOutput = "";
    let capturedError = "";
    const program = new Command()
      .name(definition.name)
      .description(definition.description)
      .showHelpAfterError()
      .showSuggestionAfterError()
      .helpCommand(true)
      .option("--json", "Emit machine-readable JSON")
      .option("--json-rpc", "Start a persistent newline-delimited JSON-RPC session")
      .option("-p, --profile <name>", "Use a profile for this command without switching the default");

    if (definition.version) {
      program.version(definition.version);
    }

    program.configureOutput({
      writeOut: (text) => {
        if (execution.render) output.write(text);
        else capturedOutput += text;
      },
      writeErr: (text) => {
        if (execution.render) error.write(text);
        else capturedError += text;
      },
    });
    program.exitOverride();

    const canInteract = (globals: GlobalOptions): boolean =>
      execution.render &&
      globals.json !== true &&
      canPrompt(input, output) &&
      canPrompt(input, error);

    const resolveToken = async (
      profile: Profile,
      tokenStdin: boolean,
      interactive: boolean,
    ): Promise<string> => {
      let token: string | undefined;
      if (tokenStdin) {
        if (!execution.render) {
          throw new Error(
            "--token-stdin is unavailable through JSON-RPC or programmatic execution because stdin belongs to the transport.",
          );
        }
        token = await readStdin(input);
      } else {
        const variable = definition.auth!.environmentVariable;
        token = variable === undefined ? undefined : process.env[variable];
        if (!token && interactive) {
          token = await promptSecret(input, error);
        }
      }
      if (!token) {
        throw configurationError(profile, {
          missingFields: [],
          authenticationMissing: true,
        });
      }
      return token;
    };

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
      const existing = listed.profiles.find((profile) => profile.name === profileName);
      if (!existing) {
        assertUniqueProfileName(profileName, listed.profiles.map((profile) => profile.name));
      }
      const values = {
        ...(profileDefinition.defaults ?? {}),
        ...(existing?.values ?? {}),
        ...options.values,
      };
      let candidate: Profile = { name: profileName, values };
      let missing = missingRequiredFields(candidate);

      if (missing.length > 0 && options.interactive) {
        for (const field of missing) {
          const value = await promptText(input, error, field.description);
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
        await saveProfile();
        return {
          configured: true,
          profile: candidate.name,
          authenticated: true,
          identity: null,
        };
      }

      const auth = definition.auth;
      const token = await resolveToken(candidate, options.tokenStdin, options.interactive);
      const context = contextFor(candidate, execution.signal);
      const identity = await auth.validate?.({
        appArguments: context.appArguments,
        profile: candidate,
        token,
        fetch: context.fetch,
        signal: context.signal,
      });
      try {
        // Remove the old credential before changing its connection, including on save failure.
        await context.secrets.delete(auth.secretName);
        await saveProfile();
        await context.secrets.set(auth.secretName, token);
      } catch {
        throw new Error(
          "Could not save profile configuration or authentication. " +
            "Check profile storage and the OS credential store. Authentication may be incomplete. " +
            `Run '${definition.name} profile configure ${profileName} --token-stdin' to complete configuration.`,
        );
      }
      return {
        configured: true,
        profile: candidate.name,
        authenticated: true,
        identity: identity ?? null,
      };
    };

    const ensureConfigured = async (
      profile: Profile,
      globals: GlobalOptions,
    ): Promise<Profile> => {
      const state = await configurationState(profile);
      if (state.missingFields.length === 0 && !state.authenticationMissing) {
        return profile;
      }
      const interactive = canInteract(globals);
      if (!interactive) {
        throw configurationError(profile, state);
      }
      await configureProfile(profile.name, {
        values: {},
        tokenStdin: false,
        interactive: true,
      });
      return resolveProfile(profile.name);
    };

    const runHandler = async (
      handler: CommandDefinition["run"],
      command: Command,
      commandInput: CommandInput,
      requiredPermission?: string,
      requiresConfiguredProfile = false,
    ): Promise<void> => {
      if (!handler) {
        const help = command.helpInformation().trimEnd();
        result = { help };
        handled = true;
        if (execution.render) {
          output.write(`${help}\n`);
        }
        return;
      }
      const globals = command.optsWithGlobals() as GlobalOptions;
      let profile = await resolveProfile(globals.profile);
      if (requiresConfiguredProfile) {
        profile = await ensureConfigured(profile, globals);
      }
      const context = contextFor(profile, execution.signal);
      if (requiredPermission) {
        const enabled = await enabledPermissions(profile.name);
        if (!enabled.has(requiredPermission)) {
          throw new Error(
            `Permission '${requiredPermission}' is disabled for profile '${profile.name}'. ` +
              `Enable it explicitly with '${definition.name} permissions grant ${requiredPermission} --profile ${profile.name}'.`,
          );
        }
      }
      result = await handler(commandInput, context);
      handled = true;
      if (execution.render) {
        writeResult(output, result, globals.json === true);
      }
    };

    const addDefinition = (parent: Command, item: CommandDefinition): void => {
      const parts = commandParts(item.name);
      const current = new Command(parts.name)
        .copyInheritedSettings(parent)
        .description(item.description)
        .configureOutput(parent.configureOutput());
      if (item.permission) {
        current.addHelpText("after", `\nRequired permission: ${item.permission}\n`);
      }
      for (const argument of parts.arguments) {
        current.argument(argument);
      }
      for (const specification of item.options ?? []) {
        const requiredHint = specification.required && specification.defaultValue === undefined
          ? " (required)" : "";
        const option = new Option(specification.flags, specification.description + requiredHint);
        if (specification.defaultValue !== undefined) {
          option.default(specification.defaultValue);
        }
        if (specification.parse) {
          option.argParser(specification.parse);
        }
        if (specification.required) {
          option.makeOptionMandatory();
        }
        current.addOption(option);
      }
      for (const child of item.children ?? []) {
        addDefinition(current, child);
      }
      current.action(async (...parameters: unknown[]) => {
        const actionCommand = parameters.at(-1) as Command;
        const options = (parameters.at(-2) ?? {}) as Record<string, unknown>;
        const positional = parameters.slice(0, -2);
        const args = Object.fromEntries(
          actionCommand.registeredArguments.map((argument, index) => [
            argument.name(),
            positional[index],
          ]),
        );
        await runHandler(item.run, actionCommand, { args, options }, item.permission, true);
      });
      parent.addCommand(current);
    };

    const profileCommand = new Command("profile")
      .copyInheritedSettings(program)
      .description("Manage service profiles")
      .configureOutput(program.configureOutput());
    profileCommand
      .command("list")
      .description("List profiles")
      .action(async (_options: unknown, command: Command) => {
        await runHandler(
          async () => {
            const list = await profileStore.list();
            return list.profiles.map((profile) => ({
              default: profile.name === list.active,
              name: profile.name,
              ...profile.values,
            }));
          },
          command,
          { args: {}, options: {} },
        );
      });
    profileCommand
      .command("show [name]")
      .description("Show one profile")
      .action(async (name: string | undefined, _options: unknown, command: Command) => {
        await runHandler(
          async () => profileStore.get(name),
          command,
          { args: { name }, options: {} },
        );
      });

    const addProfileFields = (target: Command): void => {
      for (const field of profileDefinition.fields ?? []) {
        target.addOption(new Option(field.flags, field.description));
      }
    };
    const profileValues = (options: Record<string, unknown>) =>
      Object.fromEntries(
        (profileDefinition.fields ?? [])
          .map((field) => [field.name, options[optionKey(field.flags)]])
          .filter((entry) => entry[1] !== undefined),
      );

    const configureProfileCommand = profileCommand
      .command("configure [name]")
      .description("Complete profile settings and authentication");
    addProfileFields(configureProfileCommand);
    if (definition.auth) {
      configureProfileCommand.option("--token-stdin", "Read the token from stdin");
    }
    configureProfileCommand.action(
      async (
        name: string | undefined,
        options: Record<string, unknown> & { tokenStdin?: boolean },
        command: Command,
      ) => {
        await runHandler(
          async (_commandInput, context) => {
            const globals = command.optsWithGlobals() as GlobalOptions;
            return configureProfile(name ?? context.profile.name, {
              values: profileValues(options),
              tokenStdin: options.tokenStdin === true,
              interactive: canInteract(globals),
            });
          },
          command,
          { args: { name }, options },
        );
      },
    );

    const createProfile = profileCommand
      .command("create <name>")
      .description("Create a profile without changing the default");
    addProfileFields(createProfile);
    createProfile.action(
      async (name: string, options: Record<string, unknown>, command: Command) => {
        await runHandler(async () => profileStore.create(name, profileValues(options)), command, {
          args: { name },
          options,
        });
      },
    );

    const setProfile = profileCommand
      .command("set <name>")
      .description("Update an existing profile");
    addProfileFields(setProfile);
    setProfile.action(async (name: string, options: Record<string, unknown>, command: Command) => {
      await runHandler(async () => profileStore.set(name, profileValues(options)), command, {
        args: { name },
        options,
      });
    });
    profileCommand
      .command("set-default <name>")
      .description("Choose the default profile")
      .action(async (name: string, _options: unknown, command: Command) => {
        await runHandler(async () => profileStore.setDefault(name), command, {
          args: { name },
          options: {},
        });
      });
    profileCommand
      .command("delete <name>")
      .description("Delete a non-default profile and its stored credential")
      .action(async (name: string, _options: unknown, command: Command) => {
        await runHandler(
          async () => {
            const list = await profileStore.list();
            if (!list.profiles.some((profile) => profile.name === name)) {
              throw new Error(`Profile '${name}' does not exist.`);
            }
            if (list.profiles.length === 1) {
              throw new Error(
                "Cannot delete the only profile. At least one default profile must exist.",
              );
            }
            if (list.active === name) {
              throw new Error(
                `Cannot delete default profile '${name}'. ` +
                  "Set another default with 'profile set-default <name>' first.",
              );
            }
            if (definition.auth) {
              const targetSecrets = new ProfileSecrets(secretStore, applicationId, name);
              if ((await targetSecrets.get(definition.auth.secretName)) !== undefined) {
                await targetSecrets.delete(definition.auth.secretName);
              }
            }
            const deleted = await profileStore.delete(name);
            await rm(appArguments.WithProfile(name).AppDataDirectory, {
              recursive: true,
              force: true,
            });
            return deleted;
          },
          command,
          { args: { name }, options: {} },
        );
      });
    program.addCommand(profileCommand);

    if (permissionCategories) {
      const permissionByName = new Map(
        permissionCategories.map((category) => [category.name, category]),
      );
      const permissionRows = async (profileName: string) => {
        const enabled = await enabledPermissions(profileName);
        return permissionCategories.map((category) => ({
          name: category.name,
          enabled: enabled.has(category.name),
          description: category.description,
        }));
      };
      const requireKnownPermission = (name: string): void => {
        if (!permissionByName.has(name)) {
          throw new Error(
            `Unknown permission '${name}'. Available permissions: ${[...permissionByName.keys()].join(", ")}.`,
          );
        }
      };

      const permissionsCommand = new Command("permissions")
        .copyInheritedSettings(program)
        .description("Manage profile-specific safety permissions")
        .configureOutput(program.configureOutput());
      permissionsCommand
        .command("list")
        .description("List permissions for the selected profile")
        .action(async (_options: unknown, command: Command) => {
          await runHandler(
            async (_commandInput, context) => permissionRows(context.profile.name),
            command,
            { args: {}, options: {} },
          );
        });
      permissionsCommand
        .command("grant <permission>")
        .description("Enable a permission for the selected profile")
        .action(async (permission: string, _options: unknown, command: Command) => {
          await runHandler(
            async (_commandInput, context) => {
              requireKnownPermission(permission);
              const enabled = await enabledPermissions(context.profile.name);
              enabled.add(permission);
              await profileStore.setPermissions(
                context.profile.name,
                permissionCategories
                  .map((category) => category.name)
                  .filter((name) => enabled.has(name)),
              );
              return {
                profile: context.profile.name,
                permission,
                enabled: true,
              };
            },
            command,
            { args: { permission }, options: {} },
          );
        });
      permissionsCommand
        .command("revoke <permission>")
        .description("Disable a permission for the selected profile")
        .action(async (permission: string, _options: unknown, command: Command) => {
          await runHandler(
            async (_commandInput, context) => {
              requireKnownPermission(permission);
              const enabled = await enabledPermissions(context.profile.name);
              enabled.delete(permission);
              await profileStore.setPermissions(
                context.profile.name,
                permissionCategories
                  .map((category) => category.name)
                  .filter((name) => enabled.has(name)),
              );
              return {
                profile: context.profile.name,
                permission,
                enabled: false,
              };
            },
            command,
            { args: { permission }, options: {} },
          );
        });
      program.addCommand(permissionsCommand);
    }

    if (definition.auth) {
      const auth = definition.auth;
      const authCommand = new Command("auth")
        .copyInheritedSettings(program)
        .description("Manage authentication")
        .configureOutput(program.configureOutput());
      authCommand
        .command("login")
        .description("Validate and securely store a credential for the active profile")
        .option("--token-stdin", "Read the token from stdin")
        .action(async (options: { tokenStdin?: boolean }, command: Command) => {
          await runHandler(
            async (_commandInput, context) => {
              const missingFields = missingRequiredFields(context.profile);
              if (missingFields.length > 0) {
                throw configurationError(context.profile, {
                  missingFields,
                  authenticationMissing: false,
                });
              }
              if (!authenticationRequired(context.profile)) {
                throw new Error(
                  `Profile '${context.profile.name}' does not require a token. Change its profile configuration before using auth login.`,
                );
              }
              const token = await resolveToken(
                context.profile,
                options.tokenStdin === true,
                canInteract(command.optsWithGlobals() as GlobalOptions),
              );
              const identity = await auth.validate?.({
                appArguments: context.appArguments,
                profile: context.profile,
                token,
                fetch: context.fetch,
                signal: context.signal,
              });
              try {
                await context.secrets.set(auth.secretName, token);
              } catch {
                throw new Error(
                  "Could not save authentication in the OS credential store. " +
                    `Run '${definition.name} auth login --profile ${context.profile.name} --token-stdin' to retry.`,
                );
              }
              return { authenticated: true, profile: context.profile.name, identity: identity ?? null };
            },
            command,
            { args: {}, options },
          );
        });
      authCommand
        .command("status")
        .description("Show authentication status without revealing the credential")
        .action(async (_options: unknown, command: Command) => {
          await runHandler(
            async (_commandInput, context) => {
              if (!authenticationRequired(context.profile)) {
                return {
                  authenticated: true,
                  profile: context.profile.name,
                  identity: null,
                };
              }
              const token = await context.secrets.get(auth.secretName);
              if (!token) {
                return { authenticated: false, profile: context.profile.name };
              }
              const identity = await auth.validate?.({
                appArguments: context.appArguments,
                profile: context.profile,
                token,
                fetch: context.fetch,
                signal: context.signal,
              });
              return { authenticated: true, profile: context.profile.name, identity: identity ?? null };
            },
            command,
            { args: {}, options: {} },
          );
        });
      authCommand
        .command("logout")
        .description("Delete the stored credential for the active profile")
        .action(async (_options: unknown, command: Command) => {
          await runHandler(
            async (_commandInput, context) => {
              await context.secrets.delete(auth.secretName);
              return {
                authenticated: !authenticationRequired(context.profile),
                profile: context.profile.name,
              };
            },
            command,
            { args: {}, options: {} },
          );
        });
      program.addCommand(authCommand);
    }

    for (const item of definition.commands) {
      addDefinition(program, item);
    }

    program.action(async () => {
      const globals = program.opts() as GlobalOptions;
      const profile = await resolveProfile(globals.profile);
      const state = await configurationState(profile);
      if (
        (state.missingFields.length > 0 || state.authenticationMissing) &&
        canInteract(globals)
      ) {
        result = await configureProfile(profile.name, {
          values: {},
          tokenStdin: false,
          interactive: true,
        });
        handled = true;
        writeResult(output, result, false);
        return;
      }
      const help = program.helpInformation().trimEnd();
      result = { help };
      handled = true;
      if (execution.render) {
        output.write(`${help}\n`);
      }
    });

    try {
      await program.parseAsync(["node", definition.name, ...argv]);
    } catch (error_) {
      if (error_ instanceof CommanderError) {
        if (error_.exitCode === 0) {
          return execution.render
            ? undefined
            : { help: capturedOutput.trimEnd() };
        }
        const message = capturedError.trim() || error_.message;
        throw new Error(message, { cause: error_ });
      }
      throw error_;
    }

    if (!handled && argv.length === 0) {
      const help = program.helpInformation().trimEnd();
      if (execution.render) {
        output.write(`${help}\n`);
      } else {
        result = { help };
      }
    }
    return result;
  };

  return {
    async run(argv = process.argv.slice(2)): Promise<number> {
      if (argv.includes("--json-rpc")) {
        if (argv.length !== 1) {
          error.write("The --json-rpc transport must be started without a CLI command.\n");
          return 2;
        }
        await runJsonRpc({
          input,
          output,
          execute: (rpcArguments) =>
            execute(rpcArguments, { render: false, signal: AbortSignal.timeout(5 * 60_000) }),
        });
        return 0;
      }

      try {
        await execute(argv, { render: true, signal: new AbortController().signal });
        return 0;
      } catch (error_) {
        error.write(`${error_ instanceof Error ? error_.message : String(error_)}\n`);
        return 1;
      }
    },
    execute(argv, signal = new AbortController().signal): Promise<unknown> {
      return execute(argv, { render: false, signal });
    },
  };
}
