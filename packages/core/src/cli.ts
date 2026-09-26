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
import { validateArgv } from "./argv.js";
import { visitResources } from "./resources.js";
import { KeyringSecretStore, ProfileSecrets } from "./secret-store.js";
import { nextCommands, type HumanView } from "./view.js";
import { CliError, machineError } from "./errors.js";
import { ProfileFileError } from "./profile-file.js";
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
  /** The caller's own signal: its abort is an interrupt, unlike closing the application. */
  interrupt?: AbortSignal;
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

/** `--json` given as a global option, before any `--` that turns the rest into data. */
function jsonRequested(argv: readonly string[]): boolean {
  const end = argv.indexOf("--");
  return (end < 0 ? argv : argv.slice(0, end)).includes("--json");
}

/**
 * After an interrupt every failure exits 130; a typed one keeps its code, message and data. A
 * download error keeps its static message: it says whether private data was left behind.
 */
function afterInterrupt(error: unknown, interrupt: AbortSignal | undefined): unknown {
  if (interrupt?.aborted !== true || (error instanceof CliError && error.exitCode === 130)) {
    return error;
  }
  // No cause: an aborted request rejects with the caller's own abort reason, which stays private.
  if (!(error instanceof CliError)) {
    const message = error instanceof ProfileFileError ? error.message : "Interrupted.";
    return new CliError(message, { code: "interrupted", exitCode: 130 });
  }
  return new CliError(error.message, {
    code: error.code, exitCode: 130, next: error.next,
    ...(error.result === undefined ? {} : { result: error.result }),
  });
}

/** Parser errors show one usage line instead of a command's complete help. */
function shortUsage(command: Command, path: string): string {
  return `Usage: ${path} ${command.usage()}\nRun '${path} --help' for details.`;
}

function addExamples(command: Command, cliName: string, examples?: readonly string[]): void {
  if (!examples?.length) return;
  const lines = examples.map((example) => `  ${cliName} ${example}`).join("\n");
  command.addHelpText("after", `\nExamples:\n${lines}\n`);
}

/** Groups keep an action so a bare group shows help; a stray word is still an unknown command. */
function rejectUnknownSubcommand(group: Command): void {
  const unknown = group.args[0];
  if (unknown === undefined) return;
  // Commander's own report adds its "(Did you mean ...?)" suggestion.
  const report = (group as Command & { unknownCommand?: () => never }).unknownCommand;
  if (typeof report === "function") report.call(group);
  group.error(`error: unknown command '${unknown}'`, { code: "commander.unknownCommand" });
}

function commandParts(syntax: string): { name: string; arguments: string[] } {
  const [name, ...arguments_] = syntax.trim().split(/\s+/);
  if (!name) {
    throw new Error("A command name cannot be empty.");
  }
  return { name, arguments: arguments_ };
}

export function createCli(definition: CliDefinition): CliApplication {
  const rpcModeError = new CliError(
    "The --json-rpc transport must be started without a CLI command.",
    { code: "usage.jsonRpc", exitCode: 2 },
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
    human = false,
  ): CommandContext => ({
    appArguments: appArguments.WithProfile(profile.name),
    profile,
    secrets: new ProfileSecrets(secretStore, applicationId, profile.name),
    fetch: fetchImplementation,
    signal: execution.signal,
    io: execution.io,
    cwd: execution.cwd,
    environment: execution.environment,
    // Plain lines only: JSON, JSON-RPC and execute callers never see progress.
    progress: human ? (message) => void execution.io.error.write(`${message}\n`) : () => undefined,
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
    // Set once an action starts; earlier failures are parser (usage) errors.
    let parsed = false;
    const needsConfiguration = Symbol("needs exclusive onboarding");
    const program = new Command()
      .name(definition.name)
      .description(definition.description)
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
        capturedOutput += text;
        if (execution.render) output.write(text);
      },
      // Parser errors become the thrown message, so every caller reports them exactly once.
      writeErr: (text) => {
        capturedError += text;
      },
    });
    program.exitOverride();
    // Commander's own output, so a bare group shows exactly what --help shows, examples included.
    const showHelp = (target: Command) => {
      const start = capturedOutput.length;
      target.outputHelp();
      result = { help: capturedOutput.slice(start).trimEnd() };
    };

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
      view?: HumanView,
    ): Promise<void> => {
      if (!handler) {
        showHelp(command);
        return;
      }
      const invoke = async (ownsExclusive: boolean) => {
        const globals = command.optsWithGlobals() as GlobalOptions;
        let profile = await resolveProfile(globals.profile);
        try {
          if (requiredPermission) {
            const enabled = await enabledPermissions(profile.name);
            if (!enabled.has(requiredPermission)) {
              throw new CliError(
                `Permission '${requiredPermission}' is disabled for profile '${profile.name}'.`,
                { code: "permission.denied", next: [["permissions", "grant", requiredPermission]] },
              );
            }
          }
          if (requiresConfiguredProfile)
            profile = await ensureConfigured(profile, globals, ownsExclusive);
          const context = contextFor(profile, execution, execution.render && globals.json !== true);
          context.signal.throwIfAborted();
          const presentation = view && { view, cliName: definition.name, profile: profile.name };
          try {
            result = await handler(commandInput, context);
          } catch (caught) {
            const failure = afterInterrupt(caught, execution.interrupt);
            // A failed outcome still shows its data; `run` reports the reason and exit code.
            if (execution.render && failure instanceof CliError && failure.result !== undefined)
              writeResult(output, failure.result, globals.json === true, presentation);
            throw failure;
          }
          if (execution.render) {
            writeResult(output, result, globals.json === true, presentation);
          }
        } catch (caught) {
          const failure = afterInterrupt(caught, execution.interrupt);
          if (failure instanceof CliError) failure.profile = profile.name;
          throw failure;
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
      parentPath: string,
      item: CommandDefinition,
      configured = true,
      exclusive = false,
    ): void => {
      const parts = commandParts(item.name);
      const path = `${parentPath} ${parts.name}`;
      if (item.view && !item.run) {
        throw new Error(`Command '${path}' declares a view but has no handler.`);
      }
      const current = new Command(parts.name)
        .copyInheritedSettings(parent)
        .description(item.description)
        .configureOutput(parent.configureOutput())
        .allowExcessArguments(item.run === undefined);
      if (item.group) current.helpGroup(`${item.group}:`);
      if (item.permission) {
        current.addHelpText(
          "after",
          `\nRequired permission: ${item.permission}\n`,
        );
      }
      addExamples(current, definition.name, item.examples);
      for (const argument of parts.arguments) {
        current.argument(argument);
      }
      for (const specification of item.options ?? []) {
        current.addOption(declaredOption(specification));
      }
      for (const child of item.children ?? []) {
        addDefinition(current, path, child, configured, exclusive);
      }
      current.showHelpAfterError(shortUsage(current, path));
      current.action(async (...parameters: unknown[]) => {
        const actionCommand = parameters.at(-1) as Command;
        if (!item.run) rejectUnknownSubcommand(actionCommand);
        parsed = true;
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
          item.view,
        );
      });
      parent.addCommand(current);
    };

    // Service commands lead the root help; Core's local configuration follows under its own heading.
    for (const item of definition.commands) {
      addDefinition(program, definition.name, item);
    }
    for (const item of profileCommands)
      addDefinition(program, definition.name, { group: "Configuration", ...item }, false, true);
    if (permissionCategories)
      addDefinition(
        program,
        definition.name,
        {
          group: "Configuration",
          ...createPermissionCommand(permissionCategories, profileStore, enabledPermissions),
        },
        false,
        true,
      );
    for (const item of definition.builtins ?? [])
      addDefinition(program, definition.name, item, false);
    program
      .allowExcessArguments(true)
      .showHelpAfterError(shortUsage(program, definition.name));
    addExamples(program, definition.name, definition.examples);

    program.action(async () => {
      rejectUnknownSubcommand(program);
      parsed = true;
      await gate.run(
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
          showHelp(program);
        },
        execution.signal,
        true,
      );
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
        throw new CliError(message, { code: "usage", cause: error_ });
      }
      // An option parser rejected its value before any handler ran: that is invalid usage too.
      if (!parsed && error_ instanceof Error && !(error_ instanceof CliError))
        throw new CliError(error_.message, { code: "usage", cause: error_ });
      throw error_;
    }

    return result;
  };

  /** The one place a CLI failure is reported: a JSON envelope, or text with follow-ups. */
  const report = (error: unknown, argv: readonly string[], stream: CliIo["error"]): number => {
    const failure = machineError(error);
    if (jsonRequested(argv)) {
      stream.write(`${JSON.stringify({ error: failure })}\n`);
      return failure.exitCode;
    }
    // A rendered result carries its own suggestions; stderr adds them only without one.
    const next = error instanceof CliError && error.result === undefined && error.profile !== undefined
      ? nextCommands(error.next, definition.name, error.profile)
      : [];
    stream.write(`${failure.message}\n${next.length ? `Next:\n${next.map((line) => `  ${line}\n`).join("")}` : ""}`);
    return failure.exitCode;
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
    ...(invocation.signal ? { interrupt: invocation.signal } : {}),
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
                  signal: execution.signal,
                }).catch((error: unknown) => {
                  // Also before the handler runs: while queued or checking the profile.
                  throw afterInterrupt(error, invocation.signal);
                }),
            });
            return 0;
          }
          await execute(argv, execution);
          return 0;
        });
      } catch (error) {
        return report(afterInterrupt(error, invocation.signal), argv, execution.io.error);
      }
    },
    execute(argv, signal): Promise<unknown> {
      const execution = executionFor(false, signal ? { signal } : {});
      return track(() => execute(argv, execution)).catch((error: unknown) => {
        throw afterInterrupt(error, signal);
      });
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
