import { command, type CommandDefinition } from "@eyeauras/cli-factory";

export function management(
  statusCall: () => Promise<unknown>,
  stopCall: () => Promise<unknown>,
): CommandDefinition[] {
  return [
    command("ipc-server", "Manage the local IPC server", [
      command("status", "Inspect without starting an IPC server", statusCall),
      command("stop", "Stop without starting an IPC server", stopCall),
    ]),
  ];
}
