import type {
  CommandContext,
  CommandDefinition,
  CommandHandler,
  CommandSettings,
} from "./types.js";
import type { InferredCommandHandler } from "./command-input.js";

export function command(
  name: string,
  description: string,
  children: readonly CommandDefinition[],
): CommandDefinition;
export function command<const Syntax extends string>(
  name: Syntax,
  description: string,
  run: InferredCommandHandler<Syntax>,
  settings?: CommandSettings,
): CommandDefinition;
export function command(
  name: string,
  description: string,
  childrenOrRun: readonly CommandDefinition[] | ((input: never, context: CommandContext) => unknown),
  settings: CommandSettings = {},
): CommandDefinition {
  if (typeof childrenOrRun === "function") {
    return {
      name,
      description,
      // The unchanged Core parser supplies arguments from this name; stored definitions stay broad.
      run: childrenOrRun as CommandHandler,
      ...(settings.options === undefined ? {} : { options: settings.options }),
      ...(settings.permission === undefined ? {} : { permission: settings.permission }),
    };
  }

  return { name, description, children: childrenOrRun };
}
