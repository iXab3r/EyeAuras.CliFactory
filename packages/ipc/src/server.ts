import { Server, ServerCredentials, status } from "@grpc/grpc-js";
import {
  privateDirectory,
  privateEndpoint,
  type CliApplication,
  type CommandDefinition,
  type IAppArguments,
} from "@eyeauras/cli-factory";
import { randomUUID } from "node:crypto";
import { readFile, writeFile, rm } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import lockfile from "proper-lockfile";
import { hostPaths } from "./endpoint.js";
import { management } from "./commands.js";
import { CliHost, channelOptions, protocol } from "./protocol.js";
import { serveRun } from "./relay.js";
import { startup, StartupFailure } from "./startup.js";
import type { CliHostHandlers } from "./generated/clifactory/CliHost.js";

interface ServerOptions {
  appArguments: IAppArguments;
  environmentKeys: readonly string[];
  idleTimeoutMs?: number;
  /** Concurrent Run safety cap, separate from the application command limit. Default 128. */
  maxInvocations?: number;
}
function alive(pid: number): boolean {
  if (!Number.isSafeInteger(pid) || pid < 1) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== "ESRCH";
  }
}
export async function serveHost(
  options: ServerOptions,
  createApplication: (commands: CommandDefinition[]) => CliApplication,
  resolveBuild: () => Promise<string>,
): Promise<void> {
  // Bind local controls before Core construction; neither calls back into a remote client.
  const application = createApplication(
    management(
      async () => snapshot(),
      async () => {
        closing = true;
        setImmediate(() => {
          void shutdown();
        });
        return { stopping: true };
      },
    ),
  );
  const build = await resolveBuild();
  const paths = hostPaths(options.appArguments);
  const maxInvocations = options.maxInvocations ?? 128;
  await startup("storage", () => privateDirectory(paths.directory));
  const readOwner = () =>
    startup("storage", () =>
      readFile(paths.owner, "utf8").catch((error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return undefined;
        throw error;
      }),
    );
  const previousOwner = await readOwner();
  // A live PID never becomes stale merely because its JS event loop missed heartbeats.
  if (previousOwner !== undefined) {
    const owner = (await startup("storage", () =>
      JSON.parse(previousOwner),
    )) as {
      pid: number;
    };
    if (alive(owner.pid)) throw new StartupFailure("ownership");
    const deadline = Date.now() + 11000;
    while (
      await startup("storage", () =>
        lockfile.check(paths.directory, { realpath: false, stale: 10000 }),
      )
    ) {
      if (Date.now() >= deadline || (await readOwner()) !== previousOwner)
        throw new StartupFailure("ownership");
      await delay(100);
    }
  }
  let compromised = false;
  const instance = randomUUID();
  const release = await lockfile
    .lock(paths.directory, {
      realpath: false,
      stale: 10000,
      update: 2000,
      retries: 0,
      onCompromised() {
        compromised = true;
        void shutdown();
      },
    })
    .catch((error: NodeJS.ErrnoException) => {
      throw new StartupFailure(
        error.code === "ELOCKED" ? "ownership" : "storage",
      );
    });
  const server = new Server(channelOptions);
  let closing = false,
    ready = false,
    active = 0,
    used = false;
  let idle: ReturnType<typeof setTimeout> | undefined;
  let shutdownPromise: Promise<void> | undefined;
  let doneResolve!: () => void;
  const done = new Promise<void>((resolve) => {
    doneResolve = resolve;
  });
  const snapshot = () => ({ pid: process.pid, build, closing });
  const armIdle = () => {
    clearTimeout(idle);
    if (ready && !closing && active === 0)
      idle = setTimeout(
        () => {
          void shutdown();
        },
        used
          ? (options.idleTimeoutMs ?? 60000)
          : Math.max(options.idleTimeoutMs ?? 60000, 20000),
      );
  };
  const shutdown = (): Promise<void> => {
    if (!shutdownPromise) {
      closing = true;
      clearTimeout(idle);
      shutdownPromise = (async () => {
        try {
          await application.dispose();
        } finally {
          await new Promise<void>((resolve) => {
            const timer = setTimeout(() => {
              server.forceShutdown();
              resolve();
            }, 5000);
            server.tryShutdown(() => {
              clearTimeout(timer);
              resolve();
            });
          });
          try {
            const owner = JSON.parse(await readFile(paths.owner, "utf8")) as {
              instance?: string;
            };
            if (owner.instance === instance)
              await rm(paths.owner, { force: true });
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT")
              process.exitCode = 1;
          }
          await release().catch(() => undefined);
          doneResolve();
        }
      })();
      void shutdownPromise.catch(() => {
        process.exitCode = 1;
      });
    }
    return shutdownPromise;
  };
  const validate = (control: { protocol: string }) =>
    ready && !compromised && control.protocol === protocol;
  const handlers: CliHostHandlers = {
    Run(call) {
      if (!ready) {
        call.emit(
          "error",
          Object.assign(new Error("Host is not ready."), {
            code: status.UNAVAILABLE,
          }),
        );
        return;
      }
      serveRun(call, {
        application,
        build,
        environmentKeys: options.environmentKeys,
        admitted: () => !closing && !compromised && active < maxInvocations,
        started() {
          used = true;
          active++;
          clearTimeout(idle);
        },
        completed() {
          active--;
          armIdle();
        },
      });
    },
    Status(call, callback) {
      if (!validate(call.request)) {
        callback({
          code: status.FAILED_PRECONDITION,
          message: "Host control protocol mismatch or not ready.",
        });
        return;
      }
      callback(null, snapshot());
    },
    Stop(call, callback) {
      if (!validate(call.request)) {
        callback({
          code: status.FAILED_PRECONDITION,
          message: "Host control protocol mismatch or not ready.",
        });
        return;
      }
      closing = true;
      callback(null, snapshot());
      setImmediate(() => {
        void shutdown();
      });
    },
  };
  const signal = () => {
    void shutdown();
  };
  try {
    // A delayed recovery belongs to the observed owner, not to a later generation.
    // Stop removes that generation's metadata; it must not turn a waiter into a new host.
    if ((await readOwner()) !== previousOwner)
      throw new StartupFailure("ownership");
    // The exclusive lease plus dead previous owner makes an old Unix socket recoverable.
    if (process.platform !== "win32")
      await startup("endpoint", () => rm(paths.path, { force: true }));
    server.addService(CliHost.service, handlers);
    await startup(
      "endpoint",
      () =>
        new Promise<void>((resolve, reject) =>
          server.bindAsync(
            paths.endpoint,
            ServerCredentials.createInsecure(),
            (error) => (error ? reject(error) : resolve()),
          ),
        ),
    );
    await startup("endpoint", () => privateEndpoint(paths.path));
    await startup("storage", () =>
      writeFile(
        paths.owner,
        JSON.stringify({ pid: process.pid, build, instance }),
        { mode: 0o600 },
      ),
    );
    ready = true;
    process.on("SIGINT", signal).on("SIGTERM", signal);
    armIdle();
    await done;
  } finally {
    process.off("SIGINT", signal).off("SIGTERM", signal);
    await shutdown();
  }
}
