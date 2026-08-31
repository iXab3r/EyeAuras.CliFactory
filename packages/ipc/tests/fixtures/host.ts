import {
  AppArguments,
  command,
  MemorySecretStore,
  tokenAuth,
} from "@eyeauras/cli-factory";
import { runHosted } from "../../src/index.js";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import lockfile from "proper-lockfile";
import { access, writeFile } from "node:fs/promises";

const root = process.env.CLI_HOST_TEST_ROOT;
if (!root) throw new Error("Missing synthetic AppData.");
const appArguments = new AppArguments({
  AppName: "ipc-fixture",
  Environment: {
    EnvironmentAppData: root,
    EnvironmentLocalAppData: root,
    AppDomainDirectory: root,
    ApplicationExecutablePath: fileURLToPath(import.meta.url),
    ProcessId: process.pid,
  },
});
let active = 0,
  maximum = 0,
  counter = 0;
const identity = randomUUID();
process.exitCode = await runHosted({
  entryPoint: fileURLToPath(import.meta.url),
  idleTimeoutMs: Number(process.env.CLI_HOST_TEST_IDLE ?? 30000),
  maxInvocations: Number(process.env.CLI_HOST_TEST_CAPACITY ?? 128),
  createDefinition: () => {
    if (process.argv.includes("--internal-cli-host")) {
      if (process.env.CLI_HOST_TEST_LEASE_GATE) {
        const acquire = lockfile.lock;
        lockfile.lock = async (...args) => {
          if (process.env.CLI_HOST_TEST_LEASE_GATE === "file") {
            await writeFile(
              join(root, "waiting-child.json"),
              JSON.stringify({ pid: process.pid }),
            );
            while (
              !(await access(join(root, "release-child")).then(
                () => true,
                () => false,
              ))
            )
              await delay(25);
          } else {
            process.stderr.write("started\n");
            await new Promise<void>((resolve) =>
              process.stdin.once("data", () => resolve()),
            );
          }
          return acquire(...args);
        };
      }
      if (process.env.CLI_HOST_TEST_FAIL === "definition")
        throw new Error("synthetic-private-startup-marker");
      if (process.env.CLI_HOST_TEST_FAIL === "lock")
        lockfile.lock = async () => {
          throw Object.assign(new Error("synthetic-private-lock-marker"), {
            code: "EACCES",
          });
        };
    }
    return {
      environmentKeys: ["CLI_TEST_VALUE"],
      ...(process.env.CLI_HOST_TEST_AUTH
        ? { auth: tokenAuth({ env: "CLI_TEST_TOKEN" }) }
        : {}),
      name: "ipc-fixture",
      version: process.env.CLI_HOST_TEST_BUILD ?? "fixture-build",
      description: "Synthetic process fixture",
      concurrency: process.env.CLI_HOST_TEST_LIMIT
        ? Number(process.env.CLI_HOST_TEST_LIMIT)
        : Infinity,
      runtime: { appArguments, secretStore: new MemorySecretStore() },
      commands: [
        command("server", "Service-owned server commands", [
          command("status", "Synthetic service status", () => ({
            service: true,
            pid: process.pid,
          })),
        ]),
        command(
          "environment <expected>",
          "synthetic environment check",
          async ({ args }, context) => ({
            declaredMatches:
              context.environment.CLI_TEST_VALUE === args.expected,
            tokenMatches:
              (await context.secrets.get("token")) ===
              context.environment.CLI_TEST_TOKEN,
            unknownAbsent:
              context.environment.CLI_TEST_UNDECLARED === undefined,
          }),
        ),
        command("info", "identity", () => ({
          pid: process.pid,
          identity,
          active,
          maximum,
          counter,
        })),
        command("increment", "count", () => ({ counter: ++counter })),
        command("echo", "binary echo", async (_input, context) => {
          for await (const chunk of context.io.input) {
            if (context.signal.aborted) break;
            await new Promise<void>((resolve, reject) =>
              context.io.output.write(chunk, (error) =>
                error ? reject(error) : resolve(),
              ),
            );
          }
        }),
        command("gate", "wait for one input byte", async (_input, context) => {
          active++;
          maximum = Math.max(active, maximum);
          context.io.error.write("started\n");
          try {
            await new Promise<void>((resolve, reject) => {
              const done = () => {
                context.io.input.off("data", done);
                context.signal.removeEventListener("abort", cancel);
                resolve();
              };
              const cancel = () => {
                context.io.input.off("data", done);
                reject(new Error("Cancelled fixture."));
              };
              context.io.input.once("data", done);
              context.signal.addEventListener("abort", cancel, { once: true });
              if (context.signal.aborted) cancel();
            });
            return { maximum, identity, pid: process.pid, cwd: context.cwd };
          } finally {
            active--;
          }
        }),
        command("pause", "bounded wait", async (_input, context) => {
          context.io.error.write("started\n");
          await delay(800, undefined, { signal: context.signal });
          return { ok: true };
        }),
        command("fail", "nonzero", () => {
          throw new Error("Synthetic command failure.");
        }),
        command("crash", "owned crash fixture", () => {
          process.kill(process.pid, "SIGKILL");
        }),
      ],
    };
  },
});
