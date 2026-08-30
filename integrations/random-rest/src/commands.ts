import { command, Permission, type CommandContext, type CommandDefinition } from "@eyeauras/cli-factory";
import type { RandomClient } from "./models.js";
import { integerRequest, sequenceRequest } from "./validation.js";

/** One declaration for HTTP now and the browser implementation later. */
export function createRandomCommands(clientFor: (context: CommandContext) => RandomClient): CommandDefinition[] {
  return [
    command("integers", "Generate up to 100 independent integers (duplicates allowed)",
      ({ options }, context) => {
        const request = integerRequest(options);
        return clientFor(context).integers(request, context.signal);
      }, {
        permission: Permission.ReadOnly,
        options: [
          { flags: "--count <count>", description: "Number of integers (1-100)", defaultValue: 1 },
          { flags: "--min <min>", description: "Inclusive minimum (-1e9 to 1e9)", defaultValue: 1 },
          { flags: "--max <max>", description: "Inclusive maximum (-1e9 to 1e9)", defaultValue: 100 },
        ],
      }),
    command("sequence", "Shuffle an inclusive interval of up to 100 integers without duplicates",
      ({ options }, context) => {
        const request = sequenceRequest(options);
        return clientFor(context).sequence(request, context.signal);
      }, {
        permission: Permission.ReadOnly,
        options: [
          { flags: "--min <min>", description: "Inclusive minimum (-1e9 to 1e9)", defaultValue: 1 },
          { flags: "--max <max>", description: "Inclusive maximum (-1e9 to 1e9)", defaultValue: 10 },
        ],
      }),
  ];
}
