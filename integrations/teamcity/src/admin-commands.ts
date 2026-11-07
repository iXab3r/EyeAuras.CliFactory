import { stringList, withView } from "./presentation.js";
import {
  command,
  Permission,
  type CommandContext,
  type CommandDefinition,
  type OptionDefinition,
} from "@eyeauras/cli-factory";
import type { TeamCityClient } from "./client.js";
import {
  clientLeaf,
  option,
  text,
  optionalText,
  repeatOption,
  jsonOption,
} from "./command-support.js";
import { forgetIssuedToken, type AccountKind, type RoleInput } from "./admin-models.js";

export function createAdminCommands(
  clientFor: (context: CommandContext) => Promise<TeamCityClient>,
  pageOptions: readonly OptionDefinition[],
  userCommands: readonly CommandDefinition[],
) {
  const leaf = clientLeaf(clientFor);
  const optional = (options: Record<string, unknown>, key: string) =>
    typeof options[key] === "string" ? options[key] : undefined;
  const groupOption = repeatOption("--group <key>", "Select direct group keys; repeat for more");
  const scopeOptions = [
    option("--global", "Select global role scope"),
    option("--project <id>", "Select a project scope"),
  ];
  const roleInput = (
    args: Record<string, unknown>,
    options: Record<string, unknown>,
  ): RoleInput => ({
    roleId: text(args, "role-id"),
    ...(options.global === true ? { global: true } : {}),
    ...optionalText(options, "project"),
  });
  function properties(kind: AccountKind) {
    return command(
      "properties",
      "Manage property names and assignments",
      [
        withView(stringList, leaf("list <id>", "List property names", Permission.ReadOnly, (c, { args }) =>
          c.listAccountPropertyNames(kind, args.id),
        )),
        leaf(
          "exists <id> <name>",
          "Check property existence",
          Permission.ReadOnly,
          (c, { args }) => c.checkAccountProperty(kind, args.id, args.name),
        ),
        leaf(
          "set <id> <name> <value>",
          "Set a property",
          "Admin",
          (c, { args }) =>
            c.setAccountProperty(kind, args.id, args.name, args.value),
        ),
        leaf("delete <id> <name>", "Delete one property", "Admin", (c, { args }) =>
          c.deleteAccountProperty(kind, args.id, args.name),
        ),
      ],
    );
  }
  function roles(kind: AccountKind) {
    return command("roles", "Manage direct role assignments", [
      leaf("list <id>", "List direct roles", Permission.ReadOnly, (c, { args }) =>
        c.listAccountRoles(kind, args.id),
      ),
      leaf(
        "add <id> <role-id>",
        "Add a role assignment",
        "Admin",
        (c, { args, options }) =>
          c.addAccountRole(kind, args.id, roleInput(args, options)),
        scopeOptions,
      ),
      leaf(
        "replace <id>",
        "Replace direct role assignments",
        "Admin",
        (c, { args, options }) =>
          c.replaceAccountRoles(kind, args.id, (options.item ?? []) as unknown[]),
        [
          {
            ...jsonOption("--item <json>", "Supply roleId and global or project; repeat", true),
            required: false,
          },
        ],
      ),
      leaf(
        "show <id> <role-id>",
        "Read one scoped assignment",
        Permission.ReadOnly,
        (c, { args, options }) =>
          c.getAccountRole(kind, args.id, roleInput(args, options)),
        scopeOptions,
      ),
      leaf(
        "grant <id> <role-id>",
        "Grant a scoped role",
        "Admin",
        (c, { args, options }) =>
          c.grantAccountRole(kind, args.id, roleInput(args, options)),
        scopeOptions,
      ),
      leaf(
        "revoke <id> <role-id>",
        "Revoke one scoped assignment",
        "Admin",
        (c, { args, options }) =>
          c.revokeAccountRole(kind, args.id, roleInput(args, options)),
        scopeOptions,
      ),
    ]);
  }
  function memberships(kind: AccountKind) {
    return [
      leaf("list <id>", "List directly assigned groups", Permission.ReadOnly, (c, { args }) =>
        c.listAccountGroups(kind, args.id),
      ),
      leaf(
        "replace <id>",
        kind === "users"
          ? "Replace direct group memberships"
          : "Replace direct parent groups",
        "Admin",
        (c, { args, options }) =>
          c.replaceAccountGroups(kind, args.id, (options.group ?? []) as string[]),
        [groupOption],
      ),
    ];
  }
  const tokens = command("tokens", "Manage current-user tokens", [
    leaf("list", "List token metadata", Permission.ReadOnly, (c) =>
      c.listCurrentUserTokens(),
    ),
    command(
      "create <name>",
      "Issue and save a token for this profile",
      async ({ args, options }, context) =>
        (await clientFor(context)).createCurrentUserToken(
          {
            name: args.name,
            alias: text(options, "alias"),
            ...optionalText(options, "expires"),
            noExpiration: options.expiration === false,
            samePermissions: options.samePermissions === true,
            restrictions: (options.restriction ?? []) as unknown[],
          },
          context.secrets,
        ),
      {
        permission: "Credentials",
        options: [
          option("--alias <name>", "Choose a new issued-token alias", true),
          option("--expires <timestamp>", "Set the token expiration timestamp"),
          option("--no-expiration", "Request a permanent token"),
          option("--same-permissions", "Inherit current-user permissions"),
          {
            ...jsonOption(
              "--restriction <json>",
              "Supply permission and global or project; repeat",
              true,
            ),
            required: false,
          },
        ],
      },
    ),
    command(
      "delete <name>",
      "Revoke a token",
      async ({ args, options }, context) =>
        (await clientFor(context)).deleteCurrentUserToken(
          args.name,
          context.secrets,
          optional(options, "alias"),
        ),
      {
        permission: "Credentials",
        options: [
          option("--alias <name>", "Remove the matching alias after revocation"),
        ],
      },
    ),
    command(
      "forget",
      "Forget a local issued-token record",
      ({ options }, context) => forgetIssuedToken(context.secrets, text(options, "alias")),
      {
        permission: "Credentials",
        options: [option("--alias <name>", "Select an issued-token alias", true)],
      },
    ),
  ]);
  const users = command("users", "Inspect accounts and administer access", [
    ...userCommands,
    leaf(
      "list",
      "List account identities",
      Permission.ReadOnly,
      (c, { options }) =>
        c.listAccountUsers({ limit: Number(options.limit), start: Number(options.start) }),
      pageOptions,
    ),
    leaf(
      "create <username>",
      "Create an account identity",
      "Admin",
      (c, { args, options }) =>
        c.createAccountUser(args.username, optional(options, "name")),
      [option("--name <text>", "Set the display name")],
    ),
    leaf(
      "update <id>",
      "Update account identity fields",
      "Admin",
      (c, { args, options }) =>
        c.updateAccountUser(args.id, {
          ...optionalText(options, "username"),
          ...optionalText(options, "name"),
        }),
      [option("--username <text>", "Set the username"), option("--name <text>", "Set the display name")],
    ),
    leaf("delete <id>", "Delete the remote account", "Admin", (c, { args }) =>
      c.deleteAccountUser(args.id),
    ),
    command("sessions", "Manage remote sessions", [
      leaf(
        "forget-remembered <id>",
        "Clear remembered logins",
        "Admin",
        (c, { args }) => c.forgetRememberedSessions(args.id),
      ),
      leaf(
        "logout <id>",
        "Terminate remote sessions",
        "Admin",
        (c, { args }) => c.terminateAccountSessions(args.id),
      ),
    ]),
    command("groups", "Manage direct memberships", [
      ...memberships("users"),
      leaf(
        "show <id> <key>",
        "Read one group membership",
        Permission.ReadOnly,
        (c, { args }) => c.getAccountUserGroup(args.id, args.key),
      ),
      leaf("remove <id> <key>", "Remove one membership", "Admin", (c, { args }) =>
        c.removeAccountUserGroup(args.id, args.key),
      ),
    ]),
    command("permissions", "Inspect resolved remote permission assignments", [
      leaf(
        "list <id>",
        "Read permission/project IDs and global flags",
        Permission.ReadOnly,
        (c, { args, options }) =>
          c.listAccountPermissions(args.id, optional(options, "project")),
        [option("--project <id>", "Resolve within one project")],
      ),
    ]),
    properties("users"),
    roles("users"),
    tokens,
    command("fields", "Read and write user fields", [
      leaf("get <id> <field>", "Read a user field", Permission.ReadOnly, (c, { args }) =>
        c.getAccountUserField(args.id, args.field),
      ),
      leaf("set <id> <field> <value>", "Set a user field", "Admin", (c, { args }) =>
        c.setAccountUserField(args.id, args.field, args.value),
      ),
      leaf("clear <id> <field>", "Clear a user field", "Admin", (c, { args }) =>
        c.clearAccountUserField(args.id, args.field),
      ),
    ]),
  ]);
  const groups = command("groups", "Inspect and administer user groups", [
    leaf("list", "List group identities", Permission.ReadOnly, (c) =>
      c.listAccountGroupsAll(),
    ),
    leaf(
      "create <key>",
      "Create a group identity",
      "Admin",
      (c, { args, options }) =>
        c.createAccountGroup(
          args.key,
          text(options, "name"),
          optional(options, "description"),
        ),
      [option("--name <text>", "Set the name", true), option("--description <text>", "Set the description")],
    ),
    leaf("show <key>", "Read one group identity", Permission.ReadOnly, (c, { args }) =>
      c.getAccountGroup(args.key),
    ),
    leaf("delete <key>", "Delete one remote group", "Admin", (c, { args }) =>
      c.deleteAccountGroup(args.key),
    ),
    command(
      "parents",
      "Replace direct parent groups",
      memberships("groups"),
    ),
    properties("groups"),
    roles("groups"),
  ]);
  const server = [
    leaf("api-version", "Read REST API version text", Permission.ReadOnly, (c) =>
      c.getApiVersion(),
    ),
    command("nodes", "Inspect cluster nodes", [
      leaf(
        "list",
        "List nodes by role and state",
        Permission.ReadOnly,
        (c, { options }) =>
          c.listServerNodes(optional(options, "role"), optional(options, "state")),
        [
          option("--role <role>", "Select main_node or secondary_node"),
          option("--state <state>", "Select online, offline, stopping or starting"),
        ],
      ),
      leaf("show <id>", "Read node identity/state", Permission.ReadOnly, (c, { args }) =>
        c.getServerNode(args.id),
      ),
      command("responsibilities", "Inspect node responsibility", [
        ...(["disabled", "effective", "enabled"] as const).map((kind) =>
          leaf(kind + " <id>", "Read responsibility metadata", Permission.ReadOnly, (c, { args }) =>
            c.getNodeResponsibilities(text(args, "id"), kind),
          ),
        ),
        leaf(
          "set <id> <name> <enabled>",
          "Set build-message processing",
          "Admin",
          (c, { args }) =>
            c.setNodeResponsibility(args.id, args.name, args.enabled),
        ),
      ]),
    ]),
  ];
  return { users, groups, server };
}
