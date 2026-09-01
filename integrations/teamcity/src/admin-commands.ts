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
  const groupOption = repeatOption("--group <key>", "Repeat direct group keys; absent means clear");
  const scopeOptions = [
    option("--global", "Global role scope"),
    option("--project <id>", "One project scope"),
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
      "Manage non-secret properties; reads return names/existence only",
      [
        leaf("list <id>", "List property names", Permission.ReadOnly, (c, { args }) =>
          c.listAccountPropertyNames(kind, args.id),
        ),
        leaf(
          "exists <id> <name>",
          "Probe without returning value; 404 stays an error",
          Permission.ReadOnly,
          (c, { args }) => c.checkAccountProperty(kind, args.id, args.name),
        ),
        leaf(
          "set <id> <name> <value>",
          "Set a non-secret property; discard server echo",
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
    return command("roles", "Inspect/add/replace explicit direct role assignments", [
      leaf("list <id>", "List direct roles", Permission.ReadOnly, (c, { args }) =>
        c.listAccountRoles(kind, args.id),
      ),
      leaf(
        "add <id> <role-id>",
        "Add a role via collection POST",
        "Admin",
        (c, { args, options }) =>
          c.addAccountRole(kind, args.id, roleInput(args, options)),
        scopeOptions,
      ),
      leaf(
        "replace <id>",
        "Replace all direct roles; not atomic, no retry; no items clears",
        "Admin",
        (c, { args, options }) =>
          c.replaceAccountRoles(kind, args.id, (options.item ?? []) as unknown[]),
        [
          {
            ...jsonOption("--item <json>", "Repeat {roleId,global:true} or {roleId,project}", true),
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
        "Grant using the named role/scope endpoint",
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
          ? "Replace direct assignments; server retains All Users membership"
          : "Replace direct parents; no groups clears",
        "Admin",
        (c, { args, options }) =>
          c.replaceAccountGroups(kind, args.id, (options.group ?? []) as string[]),
        [groupOption],
      ),
    ];
  }
  const tokens = command("tokens", "Current-user tokens only; secret values never rendered", [
    leaf("list", "List token metadata, never values", Permission.ReadOnly, (c) =>
      c.listCurrentUserTokens(),
    ),
    command(
      "create <name>",
      "Issue once and persist to this profile's OS keyring; non-atomic",
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
          option("--alias <name>", "New issued-token credential alias, never the auth token", true),
          option("--expires <timestamp>", "Explicit future TeamCity expiry"),
          option("--no-expiration", "Explicitly request a permanent token"),
          option("--same-permissions", "Explicitly inherit all current-user permissions"),
          {
            ...jsonOption(
              "--restriction <json>",
              "Repeat {permission,global:true} or {permission,project}",
              true,
            ),
            required: false,
          },
        ],
      },
    ),
    command(
      "delete <name>",
      "Revoke remote name; optionally remove matching issued alias",
      async ({ args, options }, context) =>
        (await clientFor(context)).deleteCurrentUserToken(
          args.name,
          context.secrets,
          optional(options, "alias"),
        ),
      {
        permission: "Credentials",
        options: [
          option("--alias <name>", "Require matching owned alias and remove after revocation"),
        ],
      },
    ),
    command(
      "forget",
      "Remove only a local issued-token record; does not revoke remotely",
      ({ options }, context) => forgetIssuedToken(context.secrets, text(options, "alias")),
      {
        permission: "Credentials",
        options: [option("--alias <name>", "Owned issued-token alias", true)],
      },
    ),
  ]);
  const users = command("users", "Inspect accounts and explicitly administer access", [
    ...userCommands,
    leaf(
      "list",
      "Read one bounded identity page",
      Permission.ReadOnly,
      (c, { options }) =>
        c.listAccountUsers({ limit: Number(options.limit), start: Number(options.start) }),
      pageOptions,
    ),
    leaf(
      "create <username>",
      "Create identity only; does not promise working authentication",
      "Admin",
      (c, { args, options }) =>
        c.createAccountUser(args.username, optional(options, "name")),
      [option("--name <text>", "Display name")],
    ),
    leaf(
      "update <id>",
      "Update specified identity fields; preserve omitted collections",
      "Admin",
      (c, { args, options }) =>
        c.updateAccountUser(args.id, {
          ...optionalText(options, "username"),
          ...optionalText(options, "name"),
        }),
      [option("--username <text>", "Username"), option("--name <text>", "Display name")],
    ),
    leaf("delete <id>", "Delete the remote account", "Admin", (c, { args }) =>
      c.deleteAccountUser(args.id),
    ),
    command("sessions", "Remote sessions, not local CLI authentication", [
      leaf(
        "forget-remembered <id>",
        "Clear remembered logins, not access tokens",
        "Admin",
        (c, { args }) => c.forgetRememberedSessions(args.id),
      ),
      leaf(
        "logout <id>",
        "Terminate remote sessions, not local keyring/token",
        "Admin",
        (c, { args }) => c.terminateAccountSessions(args.id),
      ),
    ]),
    command("groups", "Manage direct memberships", [
      ...memberships("users"),
      leaf(
        "show <id> <key>",
        "Read one membership; absent membership is 404",
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
    command("fields", "Non-secret identity fields only", [
      leaf("get <id> <field>", "Read id/name/username", Permission.ReadOnly, (c, { args }) =>
        c.getAccountUserField(args.id, args.field),
      ),
      leaf("set <id> <field> <value>", "Set name/username only", "Admin", (c, { args }) =>
        c.setAccountUserField(args.id, args.field, args.value),
      ),
      leaf("clear <id> <field>", "Clear name only", "Admin", (c, { args }) =>
        c.clearAccountUserField(args.id, args.field),
      ),
    ]),
  ]);
  const groups = command("groups", "Inspect and administer user groups", [
    leaf("list", "Read native unpaged group identities", Permission.ReadOnly, (c) =>
      c.listAccountGroupsAll(),
    ),
    leaf(
      "create <key>",
      "Create identity only, not combined permissions",
      "Admin",
      (c, { args, options }) =>
        c.createAccountGroup(
          args.key,
          text(options, "name"),
          optional(options, "description"),
        ),
      [option("--name <text>", "Name", true), option("--description <text>", "Description")],
    ),
    leaf("show <key>", "Read one group identity", Permission.ReadOnly, (c, { args }) =>
      c.getAccountGroup(args.key),
    ),
    leaf("delete <key>", "Delete one remote group", "Admin", (c, { args }) =>
      c.deleteAccountGroup(args.key),
    ),
    command(
      "parents",
      "Replace direct parent groups; server checks longer cycles",
      memberships("groups"),
    ),
    properties("groups"),
    roles("groups"),
  ]);
  const server = [
    leaf("api-version", "Read REST API version text", Permission.ReadOnly, (c) =>
      c.getApiVersion(),
    ),
    command("nodes", "Inspect cluster nodes without internal URLs", [
      leaf(
        "list",
        "Read nodes filtered by role/state",
        Permission.ReadOnly,
        (c, { options }) =>
          c.listServerNodes(optional(options, "role"), optional(options, "state")),
        [
          option("--role <role>", "main_node or secondary_node"),
          option("--state <state>", "online/offline/stopping/starting"),
        ],
      ),
      leaf("show <id>", "Read node identity/state", Permission.ReadOnly, (c, { args }) =>
        c.getServerNode(args.id),
      ),
      command("responsibilities", "Distinguish enabled configuration from effective state", [
        ...(["disabled", "effective", "enabled"] as const).map((kind) =>
          leaf(kind + " <id>", "Read responsibility metadata", Permission.ReadOnly, (c, { args }) =>
            c.getNodeResponsibilities(text(args, "id"), kind),
          ),
        ),
        leaf(
          "set <id> <name> <enabled>",
          "Set CAN_PROCESS_BUILD_MESSAGES true/false; returns enabled, not effective",
          "Admin",
          (c, { args }) =>
            c.setNodeResponsibility(args.id, args.name, args.enabled),
        ),
      ]),
    ]),
  ];
  return { users, groups, server };
}
