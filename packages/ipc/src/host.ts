import {
  AppArguments,
  createCli,
  visitResources,
  validateArgv,
  type CliApplication,
  type CommandDefinition,
  type CliIo,
  type CliDefinition,
} from "@eyeauras/cli-factory";
import { createHash } from "node:crypto";
import { isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { readBuildManifest } from "./build.js";
import { connect } from "./protocol.js";
import { write } from "./relay.js";
import { startup, StartupFailure } from "./startup.js";
import { hostPaths, internalMode } from "./endpoint.js";
import { management, isManagement } from "./commands.js";
import { control, runRemote } from "./client.js";
import { serveHost } from "./server.js";

export interface HostedCliOptions {
  entryPoint: string | URL;
  createDefinition(): CliDefinition;
  idleTimeoutMs?: number;
  maxInvocations?: number;
  nodeArguments?: readonly string[];
}

function validateHostOptions(
  options: Pick<HostedCliOptions, "idleTimeoutMs" | "maxInvocations">,
): void {
  if (
    options.maxInvocations !== undefined &&
    options.maxInvocations !== Infinity &&
    (!Number.isSafeInteger(options.maxInvocations) ||
      options.maxInvocations < 1)
  )
    throw new Error("maxInvocations must be positive or Infinity.");
  if (
    options.idleTimeoutMs !== undefined &&
    (!Number.isSafeInteger(options.idleTimeoutMs) || options.idleTimeoutMs < 1)
  )
    throw new Error("idleTimeoutMs must be a positive integer.");
}

function declaredEnvironment(definition: CliDefinition): readonly string[] {
  const keys = [
    ...(definition.environmentKeys ?? []),
    ...(definition.auth?.environmentKeys ?? []),
  ];
  if (
    keys.some(
      (key) => typeof key !== "string" || key.length === 0 || key.includes("="),
    )
  )
    throw new Error(
      "environmentKeys must contain non-empty environment variable names.",
    );
  return [...new Set(keys)];
}

export async function runHosted(
  options: HostedCliOptions,
  argv: readonly string[] = process.argv.slice(2),
  io: CliIo = {
    input: process.stdin,
    output: process.stdout,
    error: process.stderr,
  },
): Promise<number> {
  let definition: CliDefinition | undefined;
  let application: CliApplication | undefined;
  let client: ReturnType<typeof connect> | undefined;
  let code = 1;
  try {
    validateArgv(argv);
    definition = await startup("definition", () => options.createDefinition());
    if (!isManagement(argv)) validateHostOptions(options);
    const environmentKeys = declaredEnvironment(definition);
    const appDefinition = definition;
    const applicationId = definition.applicationId ?? definition.name;
    const appArguments =
      definition.runtime?.appArguments ??
      new AppArguments({
        AppName: applicationId,
        Profile: definition.profile?.defaultName ?? "default",
        Version: definition.version ?? "0.0.0",
      });
    const entryPoint =
      options.entryPoint instanceof URL ||
      options.entryPoint.startsWith("file:")
        ? fileURLToPath(options.entryPoint)
        : options.entryPoint;
    if (!isAbsolute(entryPoint))
      throw new Error(
        "Hosted entryPoint must be an absolute path or file URL.",
      );
    const createApplication = (commands: CommandDefinition[]) => {
      application = createCli({
        ...appDefinition,
        builtins: [...(appDefinition.builtins ?? []), ...commands],
        runtime: { ...appDefinition.runtime, appArguments },
      });
      return application;
    };
    const resolveBuild = () =>
      startup("build", async () =>
        createHash("sha256")
          .update(
            JSON.stringify([
              await readBuildManifest(entryPoint),
              applicationId,
              appDefinition.version ?? "",
            ]),
          )
          .digest("hex"),
      );
    if (argv.length === 1 && argv[0] === internalMode) {
      await serveHost(
        {
          appArguments,
          environmentKeys,
          ...(options.idleTimeoutMs !== undefined
            ? { idleTimeoutMs: options.idleTimeoutMs }
            : {}),
          ...(options.maxInvocations !== undefined
            ? { maxInvocations: options.maxInvocations }
            : {}),
        },
        createApplication,
        resolveBuild,
      );
      code = 0;
    } else if (argv.includes(internalMode)) {
      await write(io.error, "Invalid internal host invocation.\n").catch(
        () => undefined,
      );
      code = 2;
    } else {
      client = connect(hostPaths(appArguments).endpoint);
      const connection = client;
      const local = createApplication(
        management(
          () => control(connection),
          () => control(connection, true),
        ),
      );
      code = isManagement(argv)
        ? await local.run(argv, io)
        : await runRemote(
            {
              entryPoint,
              build: await resolveBuild(),
              environmentKeys,
              ...(options.nodeArguments
                ? { nodeArguments: options.nodeArguments }
                : {}),
            },
            connection,
            argv,
            io,
          );
    }
  } catch (error) {
    if (argv.length === 1 && argv[0] === internalMode) {
      code =
        error instanceof StartupFailure
          ? error.exitCode
          : new StartupFailure("definition").exitCode;
    } else {
      await write(
        io.error,
        `${error instanceof Error ? error.message : "CLI host failed."}\n`,
      ).catch(() => undefined);
    }
  } finally {
    client?.close();
    try {
      if (application) await application.dispose();
      else if (definition) {
        await visitResources(definition.resources ?? [], (resource) =>
          resource.dispose(),
        );
      }
    } catch {
      await write(io.error, "CLI resource cleanup failed.\n").catch(
        () => undefined,
      );
      code = 1;
    }
  }
  return code;
}
