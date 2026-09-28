import type { CommandDefinition } from "./types.js";

export type HelpLayout = ReadonlyArray<readonly [group: string, names: readonly string[]]>;

/** Orders a branch's children for help: each named group in turn, then the rest under `rest`. */
export function helpLayout(
  layout: HelpLayout,
  children: readonly CommandDefinition[],
  rest = "More",
): CommandDefinition[] {
  const nameOf = (child: CommandDefinition) => child.name.split(" ", 1)[0] ?? child.name;
  const placed = new Set<CommandDefinition>();
  const ordered = layout.flatMap(([group, names]) =>
    names.map((name) => {
      const child = children.find((candidate) => nameOf(candidate) === name);
      if (!child) throw new Error(`Help group '${group}' lists missing command '${name}'.`);
      placed.add(child);
      return { ...child, group };
    }),
  );
  return [
    ...ordered,
    ...children.filter((child) => !placed.has(child)).map((child) => ({ ...child, group: rest })),
  ];
}
