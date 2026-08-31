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
/** Only routing of the module's root; Core parses/validates the actual declaration. */
export function isManagement(argv: readonly string[]): boolean {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--json") continue;
    if (arg === "--profile" || arg === "-p") {
      i++;
      continue;
    }
    if (
      arg.startsWith("--profile=") ||
      (arg.startsWith("-p") && !arg.startsWith("--"))
    )
      continue;
    return arg === "ipc-server";
  }
  return false;
}
