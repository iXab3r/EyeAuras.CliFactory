import type {
  CommandDefinition,
  CommandHandler,
  OptionDefinition,
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
  options?: readonly OptionDefinition[],
): CommandDefinition;
export function command(
  name: string,
  description: string,
  childrenOrRun: readonly CommandDefinition[] | CommandHandler,
  options: readonly OptionDefinition[] = [],
): CommandDefinition {
  if (typeof childrenOrRun === "function") {
    return { name, description, run: childrenOrRun, options };
  }

  return { name, description, children: childrenOrRun };
}
