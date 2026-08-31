import {
  command,
  Permission,
  type CommandContext,
  type CommandDefinition,
  type OptionDefinition,
} from "@eyeauras/cli-factory";
import type { RandomClient } from "./models.js";
import { integerRequest, sequenceRequest } from "./validation.js";

/** Shared domain declaration; each backend may append its own runtime options. */
export function createRandomCommands(
  clientFor: (
    context: CommandContext,
    options: Record<string, unknown>,
  ) => RandomClient,
  runtimeOptions: readonly OptionDefinition[] = [],
): CommandDefinition[] {
  return [
    command(
      "integers",
      "Generate up to 100 independent integers (duplicates allowed)",
      ({ options }, context) => {
        const request = integerRequest(options);
        return clientFor(context, options).integers(request, context.signal);
      },
      {
        permission: Permission.ReadOnly,
        options: [
          ...runtimeOptions,
          {
            flags: "--count <count>",
            description: "Number of integers (1-100)",
            defaultValue: 1,
          },
          {
            flags: "--min <min>",
            description: "Inclusive minimum (-1e9 to 1e9)",
            defaultValue: 1,
          },
          {
            flags: "--max <max>",
            description: "Inclusive maximum (-1e9 to 1e9)",
            defaultValue: 100,
          },
        ],
      },
    ),
    command(
      "sequence",
      "Shuffle an inclusive interval of up to 100 integers without duplicates",
      ({ options }, context) => {
        const request = sequenceRequest(options);
        return clientFor(context, options).sequence(request, context.signal);
      },
      {
        permission: Permission.ReadOnly,
        options: [
          ...runtimeOptions,
          {
            flags: "--min <min>",
            description: "Inclusive minimum (-1e9 to 1e9)",
            defaultValue: 1,
          },
          {
            flags: "--max <max>",
            description: "Inclusive maximum (-1e9 to 1e9)",
            defaultValue: 10,
          },
        ],
      },
    ),
  ];
}
