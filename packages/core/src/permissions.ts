import type {
  CommandDefinition,
  PermissionCategory,
  PermissionGateDefinition,
} from "./types.js";

export const Permission = Object.freeze({
  ReadOnly: "ReadOnly",
  Update: "Update",
} as const);

const builtInCategories: readonly PermissionCategory[] = [
  {
    name: Permission.ReadOnly,
    description: "Read remote state without changing it",
    enabledByDefault: true,
  },
  {
    name: Permission.Update,
    description: "Perform operations that may change remote state",
    enabledByDefault: false,
  },
];

const categoryNamePattern = /^[A-Za-z][A-Za-z0-9._-]{0,63}$/;

export function resolvePermissionCategories(
  definition: PermissionGateDefinition,
): readonly PermissionCategory[] {
  const categories = [...builtInCategories, ...(definition.categories ?? [])];
  const names = new Set<string>();
  for (const category of categories) {
    if (!categoryNamePattern.test(category.name)) {
      throw new Error(
        `Permission category '${category.name}' must start with a letter and contain at most 64 letters, numbers, dots, dashes, or underscores.`,
      );
    }
    if (names.has(category.name)) {
      throw new Error(`Permission category '${category.name}' is declared more than once.`);
    }
    names.add(category.name);
  }
  return categories;
}

export function validateCommandPermissions(
  commands: readonly CommandDefinition[],
  categories: readonly PermissionCategory[],
): void {
  const known = new Set(categories.map((category) => category.name));
  const visit = (command: CommandDefinition, parentPath: string): void => {
    const commandName = command.name.trim().split(/\s+/, 1)[0] ?? command.name;
    const path = parentPath ? `${parentPath} ${commandName}` : commandName;
    if (command.run && !command.permission) {
      throw new Error(
        `Command '${path}' must declare a permission because the permission gate is enabled.`,
      );
    }
    if (command.permission && !known.has(command.permission)) {
      throw new Error(
        `Command '${path}' requires unknown permission '${command.permission}'.`,
      );
    }
    for (const child of command.children ?? []) {
      visit(child, path);
    }
  };
  for (const command of commands) {
    visit(command, "");
  }
}

export function validatePermissionsDisabled(commands: readonly CommandDefinition[]): void {
  const visit = (command: CommandDefinition): void => {
    if (command.permission) {
      throw new Error(
        `Command '${command.name}' declares permission '${command.permission}', but the CLI permission gate is not enabled.`,
      );
    }
    for (const child of command.children ?? []) {
      visit(child);
    }
  };
  for (const command of commands) {
    visit(command);
  }
}
