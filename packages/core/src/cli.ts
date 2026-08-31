import { Command, CommanderError, Option } from "commander";
import { AppArguments } from "./app-arguments.js";
import { canPrompt } from "./auth.js";
import { runJsonRpc } from "./json-rpc.js";
import { writeResult } from "./output.js";
import {
  resolvePermissionCategories,
  validateCommandPermissions,
  validatePermissionsDisabled,
  createPermissionCommand,
} from "./permissions.js";
import { ProfileStore } from "./profile-store.js";
import { createProfileCommands } from "./profile-commands.js";
import { CommandGate } from "./command-gate.js";
import { validateArgv } from "./input-limits.js";
import { visitResources } from "./resources.js";
import { KeyringSecretStore, ProfileSecrets } from "./secret-store.js";
import type {
  CliApplication,
  CliInvocation,
  CliIo,
  CliDefinition,
  CommandContext,
  CommandDefinition,
  CommandInput,
  PermissionCategory,
  OptionDefinition,
  Profile,
  ProfileStoreContract,
  SecretStore,
} from "./types.js";

interface ExecutionOptions {
  render: boolean;
  signal: AbortSignal;
  io: CliIo;
  cwd: string;
  environment: Readonly<NodeJS.ProcessEnv>;
}

interface GlobalOptions {
  json?: boolean;
  profile?: string;
}

function declaredOption(specification: OptionDefinition): Option {
  const requiredHint =
    specification.required && specification.defaultValue === undefined
      ? " (required)"
      : "";
  const option = new Option(
    specification.flags,
    specification.description + requiredHint,
  );
  if (specification.required) option.makeOptionMandatory();
  if (specification.defaultValue !== undefined)
    option.default(specification.defaultValue);
  if (specification.parse) option.argParser(specification.parse);
  return option;
}

function commandParts(syntax: string): { name: string; arguments: string[] } {
  const [name, ...arguments_] = syntax.trim().split(/\s+/);
  if (!name) {
    throw new Error("A command name cannot be empty.");
  }
  return { name, arguments: arguments_ };
}

export function createCli(definition: CliDefinition): CliApplication {
  const rpcModeError = new Error(
    "The --json-rpc transport must be started without a CLI command.",
  );
  const defaultIo: CliIo = {
    input: definition.runtime?.input ?? process.stdin,
    output: definition.runtime?.output ?? process.stdout,
    error: definition.runtime?.error ?? process.stderr,
  };
  const gate = new CommandGate(definition.concurrency);
  const resources = [...new Set(definition.resources ?? [])];
  const lifetime = new AbortController();
  const active = new Set<Promise<unknown>>();
  let disposal: Promise<void> | undefined;
  const track = <T>(operation: () => Promise<T>): Promise<T> => {
    if (disposal || lifetime.signal.aborted)
      return Promise.reject(new Error("CLI application is disposed."));
    const work = Promise.resolve().then(operation);
    active.add(work);
    void work.then(
      () => active.delete(work),
      () => active.delete(work),
    );
    return work;
  };
  const fetchImplementation = definition.runtime?.fetch ?? globalThis.fetch;
  const applicationId = definition.applicationId ?? definition.name;
  const profileDefinition = definition.profile ?? {};
  const appArguments =
    definition.runtime?.appArguments ??
    new AppArguments({
      AppName: applicationId,
      ...(definition.version === undefined
        ? {}
        : { Version: definition.version }),
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
      ...(profileDefinition.defaults === undefined
        ? {}
        : { defaults: profileDefinition.defaults }),
      ...(profileDefinition.validate === undefined
        ? {}
        : { validate: profileDefinition.validate }),
    });
  const secretStore: SecretStore =
    definition.runtime?.secretStore ?? new KeyringSecretStore();

  const resolveProfile = async (requestedName?: string): Promise<Profile> =>
    profileStore.get(requestedName);
  const invalidateProfile = (profile: Profile) =>
    visitResources(resources, (resource) =>
      resource.invalidateProfile?.(appArguments.WithProfile(profile.name)),
    );
  const enabledPermissions = async (
    profileName: string,
  ): Promise<Set<string>> =>
    new Set(
      (await profileStore.getPermissions(profileName)) ?? defaultPermissions,
    );
  const contextFor = (
    profile: Profile,
    execution: ExecutionOptions,
  ): CommandContext => ({
    appArguments: appArguments.WithProfile(profile.name),
    profile,
    secrets: new ProfileSecrets(secretStore, applicationId, profile.name),
    fetch: fetchImplementation,
    signal: execution.signal,
    io: execution.io,
    cwd: execution.cwd,
    environment: execution.environment,
  });
  const execute = async (
    argv: readonly string[],
    execution: ExecutionOptions,
  ): Promise<unknown> => {
    validateArgv(argv);
    execution.signal.throwIfAborted();
    const { input, output, error } = execution.io;
    let result: unknown;
    let capturedOutput = "";
    let capturedError = "";
    const needsConfiguration = Symbol("needs exclusive onboarding");
    const program = new Command()
      .name(definition.name)
      .description(definition.description)
      .showHelpAfterError()
      .showSuggestionAfterError()
      .helpCommand(true)
      .option("--json", "Emit machine-readable JSON")
      .option(
        "--json-rpc",
        "Start a persistent newline-delimited JSON-RPC session",
      )
      .on("option:json-rpc", () => {
        // The sole transport invocation is handled by run; parsed occurrences here are misuse.
        throw rpcModeError;
      })
      .option(
        "-p, --profile <name>",
        "Use a profile for this command without switching the default",
      );

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

    const {
      commands: profileCommands,
      configureProfile,
      configurationState,
      configurationError,
    } = createProfileCommands(
      definition,
      profileStore,
      {
        contextFor: (profile) => contextFor(profile, execution),
        stdinAvailable: execution.render,
        interactive: () =>
          execution.render &&
          program.opts().json !== true &&
          canPrompt(input, output) &&
          canPrompt(input, error),
      },
      invalidateProfile,
    );

    const ensureConfigured = async (
      profile: Profile,
      globals: GlobalOptions,
      exclusive: boolean,
    ): Promise<Profile> => {
      const state = await configurationState(profile);
      if (state.missingFields.length === 0 && !state.authenticationMissing) {
        return profile;
      }
      const interactive =
        execution.render &&
        globals.json !== true &&
        canPrompt(input, output) &&
        canPrompt(input, error);
      if (!interactive) {
        throw configurationError(profile, state);
      }
      if (!exclusive) throw needsConfiguration;
      await configureProfile(profile.name, {
        values: {},
        authOptions: {},
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
      exclusive = false,
    ): Promise<void> => {
      if (!handler) {
        const help = command.helpInformation().trimEnd();
        result = { help };
        if (execution.render) {
          output.write(`${help}\n`);
        }
        return;
      }
      const invoke = async (ownsExclusive: boolean) => {
        const globals = command.optsWithGlobals() as GlobalOptions;
        let profile = await resolveProfile(globals.profile);
        if (requiredPermission) {
          const enabled = await enabledPermissions(profile.name);
          if (!enabled.has(requiredPermission)) {
            throw new Error(
              `Permission '${requiredPermission}' is disabled for profile '${profile.name}'. ` +
                `Enable it explicitly with '${definition.name} permissions grant ${requiredPermission} --profile ${profile.name}'.`,
            );
          }
        }
        if (requiresConfiguredProfile)
          profile = await ensureConfigured(profile, globals, ownsExclusive);
        const context = contextFor(profile, execution);
        context.signal.throwIfAborted();
        result = await handler(commandInput, context);
        if (execution.render) {
          writeResult(output, result, globals.json === true);
        }
      };
      try {
        await gate.run(() => invoke(exclusive), execution.signal, exclusive);
      } catch (error) {
        if (error !== needsConfiguration) throw error;
        // Release the shared slot before rechecking/onboarding; the handler has not run yet.
        await gate.run(() => invoke(true), execution.signal, true);
      }
    };

    const addDefinition = (
      parent: Command,
      item: CommandDefinition,
      configured = true,
      exclusive = false,
    ): void => {
      const parts = commandParts(item.name);
      const current = new Command(parts.name)
        .copyInheritedSettings(parent)
        .description(item.description)
        .configureOutput(parent.configureOutput());
      if (item.permission) {
        current.addHelpText(
          "after",
          `\nRequired permission: ${item.permission}\n`,
        );
      }
      for (const argument of parts.arguments) {
        current.argument(argument);
      }
      for (const specification of item.options ?? []) {
        current.addOption(declaredOption(specification));
      }
      for (const child of item.children ?? []) {
        addDefinition(current, child, configured, exclusive);
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
        await runHandler(
          item.run,
          actionCommand,
          { args, options },
          item.permission,
          configured,
          exclusive,
        );
      });
      parent.addCommand(current);
    };

    for (const item of profileCommands)
      addDefinition(program, item, false, true);
    if (permissionCategories)
      addDefinition(
        program,
        createPermissionCommand(
          permissionCategories,
          profileStore,
          enabledPermissions,
        ),
        false,
        true,
      );

    for (const item of definition.commands) {
      addDefinition(program, item);
    }
    for (const item of definition.builtins ?? [])
      addDefinition(program, item, false);

    program.action(async () =>
      gate.run(
        async () => {
          const globals = program.opts() as GlobalOptions;
          if (
            execution.render &&
            globals.json !== true &&
            canPrompt(input, output) &&
            canPrompt(input, error)
          ) {
            const profile = await resolveProfile(globals.profile);
            const state = await configurationState(profile);
            if (state.missingFields.length > 0 || state.authenticationMissing) {
              result = await configureProfile(profile.name, {
                values: {},
                authOptions: {},
                interactive: true,
              });
              writeResult(output, result, false);
              return;
            }
          }
          const help = program.helpInformation().trimEnd();
          result = { help };
          if (execution.render) {
            output.write(`${help}\n`);
          }
        },
        execution.signal,
        true,
      ),
    );

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

    return result;
  };

  const executionFor = (
    render: boolean,
    invocation: CliInvocation = {},
  ): ExecutionOptions => ({
    render,
    io: {
      input: invocation.input ?? defaultIo.input,
      output: invocation.output ?? defaultIo.output,
      error: invocation.error ?? defaultIo.error,
    },
    signal: invocation.signal
      ? AbortSignal.any([lifetime.signal, invocation.signal])
      : lifetime.signal,
    cwd: invocation.cwd ?? process.cwd(),
    environment: Object.freeze({ ...(invocation.environment ?? process.env) }),
  });

  return {
    async run(argv = process.argv.slice(2), invocation = {}): Promise<number> {
      const execution = executionFor(true, invocation);
      try {
        return await track(async () => {
          validateArgv(argv);
          if (argv.length === 1 && argv[0] === "--json-rpc") {
            await runJsonRpc({
              input: execution.io.input,
              output: execution.io.output,
              signal: execution.signal,
              execute: (rpcArguments) =>
                execute(rpcArguments, {
                  ...execution,
                  render: false,
                  signal: AbortSignal.any([
                    execution.signal,
                    AbortSignal.timeout(5 * 60_000),
                  ]),
                }),
            });
            return 0;
          }
          await execute(argv, execution);
          return 0;
        });
      } catch (error) {
        execution.io.error.write(
          `${error instanceof Error ? error.message : String(error)}\n`,
        );
        return error === rpcModeError ? 2 : 1;
      }
    },
    execute(argv, signal): Promise<unknown> {
      const execution = executionFor(false, signal ? { signal } : {});
      return track(() => execute(argv, execution));
    },
    dispose(): Promise<void> {
      if (!disposal) {
        disposal = Promise.resolve().then(async () => {
          lifetime.abort(new Error("CLI application is closing."));
          let timer: ReturnType<typeof setTimeout> | undefined;
          try {
            await Promise.race([
              Promise.allSettled([...active]),
              new Promise((_, reject) => {
                timer = setTimeout(
                  () =>
                    reject(
                      new Error("CLI shutdown timed out waiting for commands."),
                    ),
                  5000,
                );
              }),
            ]);
          } finally {
            clearTimeout(timer);
            await visitResources(resources, (resource) => resource.dispose());
          }
        });
      }
      return disposal;
    },
  };
}
