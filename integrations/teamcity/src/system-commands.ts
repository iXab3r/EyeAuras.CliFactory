import {
  command,
  Permission,
  type CommandContext,
  type CommandDefinition,
  type OptionDefinition,
} from "@eyeauras/cli-factory";
import type { TeamCityClient } from "./client.js";
import { clientLeaf, option, text, repeatOption, jsonOption } from "./command-support.js";
export function createSystemCommands(
  clientFor: (c: CommandContext) => Promise<TeamCityClient>,
  pageOptions: readonly OptionDefinition[],
  avatarCommands: readonly CommandDefinition[],
) {
  const leaf = clientLeaf(clientFor),
    R = Permission.ReadOnly,
    U = Permission.Update;
  const optional = (o: Record<string, unknown>, k: string) =>
    typeof o[k] === "string" ? o[k] : undefined;
  const page = (o: Record<string, unknown>) => ({ limit: Number(o.limit), start: Number(o.start) });
  const confirm = option("--confirm", "Confirm destructive/replacement operation", true);
  const item = jsonOption("--item <json>", "Strict typed fields; no raw HTTP or credential values");
  const project = option("--project <id>", "One project scope");
  const stateOptions = [
    option("--state <state>", "IN_PROGRESS/SUCCESSFUL/FAILED/CANCELLED/UNKNOWN", true),
    option("--date <timestamp>", "TeamCity YYYYMMDDTHHmmss+ZZZZ timestamp", true),
    option("--build <id>", "Related build ID"),
  ];
  const healthOptions = [project, option("--global", "Server-wide health scope")];
  const healthScope = (o: Record<string, unknown>) => ({
    ...(optional(o, "project") ? { project: text(o, "project") } : {}),
    ...(o.global === true ? { global: true } : {}),
  });
  const deployments = command(
    "deployments",
    "Deployment dashboards and explicit instance history",
    [
      leaf(
        "list",
        "Read one dashboard page",
        R,
        (c, { options }) => c.listDashboards(page(options), optional(options, "project")),
        [...pageOptions, project],
      ),
      leaf(
        "create <id>",
        "Create a dashboard",
        U,
        (c, { args, options }) =>
          c.createDashboard(text(args, "id"), text(options, "name"), text(options, "project")),
        [option("--name <text>", "Name", true), { ...project, required: true }],
      ),
      leaf("show <id>", "Read one dashboard", R, (c, { args }) => c.getDashboard(text(args, "id"))),
      leaf(
        "delete <id>",
        "Delete dashboard",
        U,
        (c, { args }) => c.deleteDashboard(text(args, "id")),
        [confirm],
      ),
      command("instances", "One parent dashboard; no implicit traversal", [
        leaf(
          "list <dashboard>",
          "Read one instance page",
          R,
          (c, { args, options }) =>
            c.listDeploymentInstances(text(args, "dashboard"), page(options)),
          pageOptions,
        ),
        leaf(
          "upsert <dashboard> <id>",
          "Add/update instance with submitted history",
          U,
          (c, { args, options }) =>
            c.upsertDeploymentInstance(
              text(args, "dashboard"),
              text(args, "id"),
              text(options, "state"),
              text(options, "date"),
              optional(options, "build"),
            ),
          [...stateOptions, confirm],
        ),
        leaf("show <dashboard> <id>", "Read one instance", R, (c, { args }) =>
          c.getDeploymentInstance(text(args, "dashboard"), text(args, "id")),
        ),
        leaf(
          "append-state <dashboard> <id>",
          "Append one history entry",
          U,
          (c, { args, options }) =>
            c.appendDeploymentState(
              text(args, "dashboard"),
              text(args, "id"),
              text(options, "state"),
              text(options, "date"),
              optional(options, "build"),
            ),
          stateOptions,
        ),
        leaf(
          "delete <dashboard> <id>",
          "Remove selected instance",
          U,
          (c, { args }) => c.deleteDeploymentInstance(text(args, "dashboard"), text(args, "id")),
          [confirm],
        ),
      ]),
    ],
  );
  const roles = command("roles", "Server role definitions, distinct from role assignments", [
    leaf("list", "Read role definitions", R, (c) => c.listRoleDefinitions()),
    leaf(
      "create",
      "Create role; server generates its ID",
      "Admin",
      (c, { options }) =>
        c.createRoleDefinition(
          text(options, "name"),
          (options.permission ?? []) as string[],
          (options.include ?? []) as string[],
        ),
      [
        option("--name <text>", "Role name", true),
        repeatOption("--permission <id>", "Repeat permission IDs"),
        repeatOption("--include <id>", "Repeat included role IDs"),
      ],
    ),
    leaf("show <id>", "Read role definition", R, (c, { args }) =>
      c.getRoleDefinition(text(args, "id")),
    ),
    leaf(
      "delete <id>",
      "Delete role definition",
      "Admin",
      (c, { args }) => c.deleteRoleDefinition(text(args, "id")),
      [confirm],
    ),
    ...(["included", "permissions"] as const).map((kind) =>
      command(
        kind,
        "Edit selected role relation",
        (["add", "remove"] as const).map((action) =>
          leaf(`${action} <id> <child>`, `${action} one ${kind} entry`, "Admin", (c, { args }) =>
            c.editRoleDefinition(text(args, "id"), kind, text(args, "child"), action === "remove"),
          ),
        ),
      ),
    ),
  ]);
  const server = [
    leaf("rest-info", "Read relative REST landing metadata", R, (c) => c.getRestInfo()),
    leaf("rest-plugin", "Read XML-only REST plugin metadata", R, (c) => c.getRestPlugin()),
    command("authentication", "Replacing modules can lock out users", [
      leaf("show", "Read booleans and module names only", R, (c) => c.getAuthenticationSettings()),
      command(
        "replace",
        "Replace COMPLETE module list; no hidden GET/merge; possible lockout",
        async ({ options }, context) =>
          (await clientFor(context)).replaceAuthenticationSettings(options.item, context.secrets),
        { permission: "Admin", options: [item, confirm] },
      ),
    ]),
    command("backup", "Backup may contain all server data; no automatic download", [
      leaf("status", "Current progress; Idle does not prove last success", R, (c) =>
        c.getBackupStatus(),
      ),
      leaf(
        "start <name>",
        "Schedule config/database backup with timestamp, no logs/personal/running/supplementary data",
        "Admin",
        (c, { args }) => c.startBackup(text(args, "name")),
        [confirm],
      ),
    ]),
    command("cleanup", "Configure future cleanup, not immediate execution", [
      leaf("show", "Read cleanup schedule", R, (c) => c.getCleanup()),
      leaf(
        "configure",
        "Typed partial schedule/settings update",
        "Admin",
        (c, { options }) => c.configureCleanup(options.item),
        [item],
      ),
    ]),
    command("settings", "Safe numeric/boolean global settings; no encryption-key changes", [
      leaf("show", "Read safe settings", R, (c) => c.getGlobalSettings()),
      leaf(
        "set",
        "Typed partial update; omitted fields preserved",
        "Admin",
        (c, { options }) => c.setGlobalSettings(options.item),
        [item],
      ),
    ]),
    command("licenses", "License metadata; keys only from current-profile input-secret aliases", [
      leaf("summary", "Read licensed capacities", R, (c) => c.getLicenseSummary()),
      leaf("list", "Read metadata without key bytes", R, (c) => c.listLicenses()),
      command(
        "add",
        "Add key from alias",
        async ({ options }, context) =>
          (await clientFor(context)).addLicense(text(options, "secret"), context.secrets),
        {
          permission: "Admin",
          options: [option("--secret <alias>", "Input-secret alias, not key value", true)],
        },
      ),
      command(
        "show <alias>",
        "Inspect alias-referenced license",
        async ({ args }, context) =>
          (await clientFor(context)).getLicense(text(args, "alias"), context.secrets),
        { permission: R },
      ),
      command(
        "delete <alias>",
        "Remove remote license; retain local alias",
        async ({ args }, context) =>
          (await clientFor(context)).deleteLicense(text(args, "alias"), context.secrets),
        { permission: "Admin", options: [confirm] },
      ),
    ]),
    leaf("metrics", "Read numeric metric series without tag dimensions", R, (c) => c.getMetrics()),
    leaf("plugins", "Read plugin metadata without server paths/properties", R, (c) =>
      c.getPlugins(),
    ),
    leaf(
      "field <field>",
      "Read allowlisted version/clock/role field; never superuser token",
      R,
      (c, { args }) => c.getServerField(text(args, "field")),
    ),
  ];
  const projects = [
    leaf("default-value-sets <id>", "Read named value-set types, not values", R, (c, { args }) =>
      c.getDefaultValueSets(text(args, "id")),
    ),
    command("deployments", "Dashboards within the explicit parent project", [
      leaf("list <id>", "Read native project dashboard list", R, (c, { args }) =>
        c.listProjectDashboards(text(args, "id")),
      ),
      leaf("show <project> <id>", "Read one child dashboard", R, (c, { args }) =>
        c.getProjectDashboard(text(args, "project"), text(args, "id")),
      ),
    ]),
  ];
  const jobs = [
    leaf("investigations <id>", "Read scoped investigations", R, (c, { args }) =>
      c.getJobInvestigations(text(args, "id")),
    ),
    leaf("vcs-instances <id>", "Read attached VCS instances", R, (c, { args }) =>
      c.getJobVcsInstances(text(args, "id")),
    ),
  ];
  const users = [
    command("avatar", "Explicit bounded image upload/download", [
      ...avatarCommands,
      leaf(
        "replace <id>",
        "Upload selected regular PNG/JPEG up to4MiB",
        U,
        (c, { args, options }) => c.replaceAvatar(text(args, "id"), text(options, "file")),
        [option("--file <path>", "Explicit local image path", true)],
      ),
      leaf("delete <id>", "Remove avatar", U, (c, { args }) => c.deleteAvatar(text(args, "id"))),
    ]),
  ];
  const pools = [
    command("tokens", "One-time agent-registration credentials, never printed", [
      command(
        "create <id>",
        "Mint and store each token under an unused profile input-secret alias",
        async ({ args, options }, context) =>
          (await clientFor(context)).createPoolTokens(
            text(args, "id"),
            Number(options.ttl),
            options.storeAs as string[],
            context.secrets,
          ),
        {
          permission: "Credentials",
          options: [
            option("--ttl <seconds>", "Explicit1–86400-second TTL", true),
            repeatOption(
              "--store-as <alias>",
              "One new alias per requested token, at most50",
              true,
            ),
          ],
        },
      ),
    ]),
  ];
  const mutes = [
    leaf(
      "delete-many",
      "Native bulk action after exact-ID preflights; postcondition not verified",
      U,
      (c, { options }) => c.deleteMutes(options.id as string[]),
      [repeatOption("--id <id>", "Repeat1–50 explicit mute IDs", true), confirm],
    ),
  ];
  const roots = [
    deployments,
    roles,
    command("audit", "Metadata only, without comments/users/related payloads", [
      leaf(
        "list",
        "Read one page",
        R,
        (c, { options }) => c.listAudit(page(options), optional(options, "project")),
        [...pageOptions, project],
      ),
      leaf("show <id>", "Read one audit event", R, (c, { args }) => c.getAudit(text(args, "id"))),
    ]),
    command("health", "Typed scope and category, no invented identity locator", [
      leaf(
        "list",
        "Read one explicit health scope",
        R,
        (c, { options }) => c.listHealth(healthScope(options), page(options)),
        [...healthOptions, ...pageOptions],
      ),
      leaf(
        "show",
        "Read unique scoped category match; ambiguity is an error",
        R,
        (c, { options }) =>
          c.getHealth({ ...healthScope(options), category: text(options, "category") }),
        [...healthOptions, option("--category <id>", "Health category", true)],
      ),
      command("categories", "Discover native health categories", [
        leaf("list", "Read category metadata", R, (c) => c.listHealthCategories()),
        leaf("show <id>", "Read one category", R, (c, { args }) =>
          c.getHealthCategory(text(args, "id")),
        ),
      ]),
    ]),
  ];
  return { server, projects, jobs, users, pools, mutes, roots };
}
