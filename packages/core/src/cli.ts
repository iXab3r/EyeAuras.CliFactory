import { Command, CommanderError, Option } from "commander";
import type { Readable, Writable } from "node:stream";
import { promptSecret, readStdin } from "./auth.js";
import { runJsonRpc } from "./json-rpc.js";
import { writeResult } from "./output.js";
import {
  resolvePermissionCategories,
  validateCommandPermissions,
  validatePermissionsDisabled,
} from "./permissions.js";
import { ProfileStore } from "./profile-store.js";
import { KeyringSecretStore, ProfileSecrets } from "./secret-store.js";
import type {
  CliApplication,
  CliDefinition,
  CommandContext,
  CommandDefinition,
  CommandInput,
  PermissionCategory,
  Profile,
  ProfileStoreContract,
  SecretStore,
} from "./types.js";

interface ExecutionOptions {
  render: boolean;
  signal: AbortSignal;
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

    const runHandler = async (
      handler: CommandDefinition["run"],
      command: Command,
      commandInput: CommandInput,
      requiredPermission?: string,
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
      const globals = command.optsWithGlobals() as { json?: boolean; profile?: string };
      const profile = await resolveProfile(globals.profile);
      const context: CommandContext = {
        profile,
        secrets: new ProfileSecrets(secretStore, applicationId, profile.name),
        fetch: fetchImplementation,
        signal: execution.signal,
      };
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
        .description(item.description)
        .configureOutput(parent.configureOutput());
      if (item.permission) {
        current.addHelpText("after", `\nRequired permission: ${item.permission}\n`);
      }
      for (const argument of parts.arguments) {
        current.argument(argument);
      }
      for (const specification of item.options ?? []) {
        const option = new Option(specification.flags, specification.description);
        if (specification.defaultValue !== undefined) {
          option.default(specification.defaultValue);
        }
        if (specification.parse) {
          option.argParser(specification.parse);
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
        await runHandler(item.run, actionCommand, { args, options }, item.permission);
      });
      parent.addCommand(current);
    };

    const profileCommand = new Command("profile")
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
              active: profile.name === list.active,
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

    const setProfile = profileCommand
      .command("set <name>")
      .description("Create or update a profile");
    for (const field of profileDefinition.fields ?? []) {
      setProfile.addOption(new Option(field.flags, field.description));
    }
    setProfile.action(async (name: string, options: Record<string, unknown>, command: Command) => {
      const values = Object.fromEntries(
        (profileDefinition.fields ?? [])
          .map((field) => [field.name, options[optionKey(field.flags)]])
          .filter((entry) => entry[1] !== undefined),
      );
      await runHandler(async () => profileStore.set(name, values), command, {
        args: { name },
        options,
      });
    });
    profileCommand
      .command("use <name>")
      .description("Switch the active profile")
      .action(async (name: string, _options: unknown, command: Command) => {
        await runHandler(async () => profileStore.use(name), command, {
          args: { name },
          options: {},
        });
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
        .description("Manage authentication")
        .configureOutput(program.configureOutput());
      authCommand
        .command("login")
        .description("Validate and securely store a credential for the active profile")
        .option("--token-stdin", "Read the token from stdin")
        .action(async (options: { tokenStdin?: boolean }, command: Command) => {
          await runHandler(
            async (_commandInput, context) => {
              const token = options.tokenStdin
                ? await readStdin(input)
                : auth.environmentVariable && process.env[auth.environmentVariable]
                  ? process.env[auth.environmentVariable]
                  : await promptSecret(input, output);
              if (!token) {
                throw new Error("The token is empty.");
              }
              const identity = await auth.validate?.({
                profile: context.profile,
                token,
                fetch: context.fetch,
                signal: context.signal,
              });
              await context.secrets.set(auth.secretName, token);
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
              const token = await context.secrets.get(auth.secretName);
              if (!token) {
                return { authenticated: false, profile: context.profile.name };
              }
              const identity = await auth.validate?.({
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
              return { authenticated: false, profile: context.profile.name };
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

    program.action(() => {
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
