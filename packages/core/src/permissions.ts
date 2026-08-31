import type {
  CommandDefinition,
  PermissionCategory,
  PermissionGateDefinition,
  ProfileStoreContract,
} from "./types.js";
import { command } from "./command.js";

/** Core-only declarations; admission policy stays in the shared command adapter. */
export function createPermissionCommand(
  categories: readonly PermissionCategory[],
  store: ProfileStoreContract,
  enabledPermissions: (profile: string) => Promise<Set<string>>,
): CommandDefinition {
  const names = categories.map((category) => category.name);
  return command("permissions", "Manage profile-specific safety permissions", [
    command(
      "list",
      "List permissions for the selected profile",
      async (_input, context) => {
        const enabled = await enabledPermissions(context.profile.name);
        return categories.map((category) => ({
          name: category.name,
          enabled: enabled.has(category.name),
          description: category.description,
        }));
      },
    ),
    ...(["grant", "revoke"] as const).map((action) =>
      command(
        `${action} <permission>`,
        `${action === "grant" ? "Enable" : "Disable"} a permission for the selected profile`,
        async ({ args }, context) => {
          const permission = String(args.permission);
          if (!names.includes(permission))
            throw new Error(
              `Unknown permission '${permission}'. Available permissions: ${names.join(", ")}.`,
            );
          const enabled = await enabledPermissions(context.profile.name);
          if (action === "grant") enabled.add(permission);
          else enabled.delete(permission);
          await store.setPermissions(
            context.profile.name,
            names.filter((name) => enabled.has(name)),
          );
          return {
            profile: context.profile.name,
            permission,
            enabled: action === "grant",
          };
        },
      ),
    ),
  ]);
}

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
      throw new Error(
        `Permission category '${category.name}' is declared more than once.`,
      );
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

export function validatePermissionsDisabled(
  commands: readonly CommandDefinition[],
): void {
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
