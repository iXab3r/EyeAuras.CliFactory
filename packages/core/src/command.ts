import type {
  CommandContext,
  CommandDefinition,
  CommandHandler,
  CommandHelp,
  CommandSettings,
} from "./types.js";
import type { InferredCommandHandler } from "./command-input.js";

export function command(
  name: string,
  description: string,
  children: readonly CommandDefinition[],
  help?: CommandHelp,
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
  const help = {
    ...(settings.group === undefined ? {} : { group: settings.group }),
    ...(settings.examples === undefined ? {} : { examples: settings.examples }),
  };
  if (typeof childrenOrRun === "function") {
    return {
      name,
      description,
      // The unchanged Core parser supplies arguments from this name; stored definitions stay broad.
      run: childrenOrRun as CommandHandler,
      ...(settings.options === undefined ? {} : { options: settings.options }),
      ...(settings.permission === undefined ? {} : { permission: settings.permission }),
      ...(settings.view === undefined ? {} : { view: settings.view }),
      ...help,
    };
  }

  return { name, description, children: childrenOrRun, ...help };
}
