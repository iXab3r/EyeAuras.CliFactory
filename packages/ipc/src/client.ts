import { status } from "@grpc/grpc-js";
import type { CliIo } from "@eyeauras/cli-factory";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { protocol } from "./protocol.js";
import { internalMode } from "./endpoint.js";
import { relay } from "./relay.js";
import { ownershipExitCode, startupMessage } from "./startup.js";
import type { CliHostClient } from "./generated/clifactory/CliHost.js";
import type { HostStatus__Output } from "./generated/clifactory/HostStatus.js";

function request(
  client: CliHostClient,
  method: "Status" | "Stop",
  build: string,
  timeout = 1000,
): Promise<HostStatus__Output> {
  return new Promise((resolve, reject) =>
    client[method](
      { protocol, build },
      { deadline: Date.now() + timeout },
      (error, result) =>
        error
          ? reject(error)
          : result
            ? resolve(result)
            : reject(new Error("Missing host status.")),
    ),
  );
}

export async function control(client: CliHostClient, stop = false) {
  let current: HostStatus__Output;
  try {
    current = await request(client, stop ? "Stop" : "Status", "");
  } catch (error) {
    if ((error as { code?: number }).code === status.UNAVAILABLE)
      return { running: false };
    throw new Error(
      "Existing host is incompatible or unavailable; no new host was started.",
    );
  }
  if (stop) {
    // Core drain + resource/browser drain + transport drain, with filesystem/IPC margin.
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
      await delay(50);
      try {
        await request(client, "Status", "", 300);
      } catch (error) {
        if ((error as { code?: number }).code === status.UNAVAILABLE)
          return { running: false };
      }
    }
    throw new Error("Host did not stop before its deadline.");
  }
  return {
    running: true,
    pid: current.pid,
    build: current.build,
    closing: current.closing,
  };
}

interface ClientOptions {
  build: string;
  entryPoint: string;
  environmentKeys: readonly string[];
  nodeArguments?: readonly string[];
}
export async function runRemote(
  options: ClientOptions,
  client: CliHostClient,
  argv: readonly string[],
  io: CliIo,
): Promise<number> {
  let connected = false;
  try {
    const current = await request(client, "Status", options.build, 500);
    if (current.build !== options.build)
      throw new Error(
        "Host build mismatch. Run ipc-server stop before using this build.",
      );
    if (current.closing)
      throw new Error("Host is closing; no command was sent.");
    connected = true;
  } catch (error) {
    if (
      (error as { code?: number }).code !== status.UNAVAILABLE &&
      (error as { code?: number }).code !== status.DEADLINE_EXCEEDED
    ) {
      throw new Error(
        "Host build/protocol mismatch or closing. Run ipc-server status/stop before retrying.",
      );
    }
  }
  if (!connected) {
    const child = spawn(
      process.execPath,
      [
        ...(options.nodeArguments ?? process.execArgv),
        options.entryPoint,
        internalMode,
      ],
      { detached: true, stdio: "ignore", windowsHide: true },
    );
    let spawnFailed = false;
    let exited = false;
    child.on("error", () => {
      spawnFailed = true;
    });
    child.on("exit", () => {
      exited = true;
    });
    child.unref();
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
      try {
        const current = await request(client, "Status", options.build, 500);
        if (current.build !== options.build || current.closing)
          throw new Error("Existing host build mismatch or closing.");
        // The elected peer owns the application now. Our unused startup child must not
        // survive this caller and later acquire a lease after an explicit stop.
        if (child.pid !== current.pid && !exited) child.kill();
        connected = true;
        break;
      } catch (error) {
        if (
          ![
            status.UNAVAILABLE,
            status.DEADLINE_EXCEEDED,
            status.FAILED_PRECONDITION,
          ].includes((error as { code: number }).code)
        )
          throw error;
        // An owner can answer before readiness; do not send any work yet.
      }
      if (spawnFailed)
        throw new Error(
          "CLI host process could not be started. Check the executable and runtime access.",
        );
      if (exited && child.exitCode !== ownershipExitCode)
        throw new Error(startupMessage(child.exitCode));
      await delay(100);
    }
    if (!connected)
      throw new Error(
        exited
          ? startupMessage(child.exitCode)
          : "CLI host startup timed out; no command was sent.",
      );
  }
  const cancellation = new AbortController();
  const cancel = () => cancellation.abort();
  process.on("SIGINT", cancel).on("SIGTERM", cancel);
  try {
    const environment = Object.fromEntries(
      options.environmentKeys.flatMap((key) =>
        process.env[key] === undefined ? [] : [[key, process.env[key]!]],
      ),
    );
    return await relay(client, argv, options.build, io, {
      signal: cancellation.signal,
      cwd: process.cwd(),
      environment,
    });
  } finally {
    process.off("SIGINT", cancel).off("SIGTERM", cancel);
  }
}
