import type {
  CommandDefinition,
  CommandHandler,
  CommandSettings,
} from "./types.js";

export function command(
  name: string,
  description: string,
  children: readonly CommandDefinition[],
): CommandDefinition;
export function command(
  name: string,
  description: string,
  run: CommandHandler,
  settings?: CommandSettings,
): CommandDefinition;
export function command(
  name: string,
  description: string,
  childrenOrRun: readonly CommandDefinition[] | CommandHandler,
  settings: CommandSettings = {},
): CommandDefinition {
  if (typeof childrenOrRun === "function") {
    return {
      name,
      description,
      run: childrenOrRun,
      ...(settings.options === undefined ? {} : { options: settings.options }),
      ...(settings.permission === undefined ? {} : { permission: settings.permission }),
    };
  }

  return { name, description, children: childrenOrRun };
}
