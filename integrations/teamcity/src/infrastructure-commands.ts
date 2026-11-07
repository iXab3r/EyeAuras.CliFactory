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
  repeatOption,
  propertyOption,
  jsonOption,
} from "./command-support.js";
import type { PlainProperty } from "./authoring-models.js";
import type { CloudImageId, CloudInstanceId } from "./infrastructure-models.js";
import { importInputSecret, forgetInputSecret } from "./credential-inputs.js";

export function createInfrastructureCommands(
  clientFor: (context: CommandContext) => Promise<TeamCityClient>,
  pageOptions: readonly OptionDefinition[],
  instanceCommands: readonly CommandDefinition[],
) {
  const leaf = clientLeaf(clientFor);
  const optional = (options: Record<string, unknown>, key: string) =>
    typeof options[key] === "string" ? options[key] : undefined;
  const page = (options: Record<string, unknown>) => ({
    limit: Number(options.limit),
    start: Number(options.start),
  });
  const confirm = option("--confirm", "Confirm the operation", true);
  const imageOptions = [
    option("--cloud-profile <id>", "Select a remote cloud profile", true),
    option("--image <id>", "Select a cloud image", true),
  ];
  const instanceOptions = [
    ...imageOptions,
    option("--instance <id>", "Select a cloud instance", true),
  ];
  const image = (options: Record<string, unknown>): CloudImageId => ({
    profile: text(options, "cloudProfile"),
    image: text(options, "image"),
  });
  const instance = (options: Record<string, unknown>): CloudInstanceId => ({
    ...image(options),
    instance: text(options, "instance"),
  });
  const cloudLists = (kind: "profiles" | "images" | "instances") =>
    leaf(
      "list",
      "List cloud resources",
      Permission.ReadOnly,
      (c, { options }) =>
        c.listCloud(
          kind,
          page(options),
          optional(options, "project"),
          optional(options, "cloudProfile"),
        ),
      [
        ...pageOptions,
        option("--project <id>", "Select a project scope"),
        ...(kind === "profiles"
          ? []
          : [option("--cloud-profile <id>", "Select a remote cloud profile")]),
      ],
    );
  const cloud = command("cloud", "Manage remote cloud capacity", [
    command("profiles", "Inspect remote cloud profiles", [
      cloudLists("profiles"),
      leaf("show <id>", "Show cloud profile metadata", Permission.ReadOnly, (c, { args }) =>
        c.getCloudProfile(args.id),
      ),
    ]),
    command("images", "Inspect cloud images", [
      cloudLists("images"),
      leaf(
        "show",
        "Show one composite cloud image",
        Permission.ReadOnly,
        (c, { options }) => c.getCloudImage(image(options)),
        imageOptions,
      ),
    ]),
    command("instances", "Manage cloud instances", [
      cloudLists("instances"),
      leaf(
        "show",
        "Read instance state",
        Permission.ReadOnly,
        (c, { options }) => c.getCloudInstance(instance(options)),
        instanceOptions,
      ),
      leaf(
        "start",
        "Start a cloud instance",
        Permission.Update,
        (c, { options }) => c.startCloudInstance(image(options)),
        imageOptions,
      ),
      ...(["delete", "force-stop", "stop"] as const).map((action) =>
        leaf(
          action,
          action === "stop"
            ? "Schedule stop when free"
            : "Force instance termination",
          Permission.Update,
          (c, { options }) => c.stopCloudInstance(instance(options), action),
          [...instanceOptions, ...(action === "stop" ? [] : [confirm])],
        ),
      ),
    ]),
  ]);
  const roots = [
    leaf(
      "create <id>",
      "Create an anonymous Git root",
      Permission.Update,
      (c, { args, options }) =>
        c.createAnonymousGitRoot(
          args.id,
          text(options, "name"),
          text(options, "project"),
          text(options, "url"),
          text(options, "branch"),
        ),
      [
        option("--name <text>", "Set the name", true),
        option("--project <id>", "Select the owner project", true),
        option("--url <url>", "Set the Git repository URL", true),
        option("--branch <ref>", "Set the Git branch ref", true),
      ],
    ),
    leaf(
      "delete <id>",
      "Delete a VCS root configuration",
      Permission.Update,
      (c, { args }) => c.deleteVcsRoot(args.id),
    ),
    leaf("instances <id>", "List VCS root instances", Permission.ReadOnly, (c, { args }) =>
      c.getVcsRootInstances(args.id),
    ),
    command("properties", "Manage VCS root properties", [
      leaf("list <id>", "List property names", Permission.ReadOnly, (c, { args }) =>
        c.listVcsRootPropertyNames(args.id),
      ),
      leaf(
        "replace <id>",
        "Replace all VCS root properties",
        Permission.Update,
        (c, { args, options }) =>
          c.replaceVcsRootProperties(args.id, (options.property ?? []) as PlainProperty[]),
        [propertyOption],
      ),
      leaf(
        "clear <id>",
        "Delete all VCS root properties",
        Permission.Update,
        (c, { args }) => c.clearVcsRootProperties(args.id),
        [confirm],
      ),
      leaf(
        "exists <id> <name>",
        "Check property existence",
        Permission.ReadOnly,
        (c, { args }) => c.checkVcsRootProperty(args.id, args.name),
      ),
      leaf(
        "set <id> <name> <value>",
        "Set a VCS root property",
        Permission.Update,
        (c, { args }) =>
          c.setVcsRootProperty(args.id, args.name, args.value),
      ),
      leaf("delete <id> <name>", "Delete one property", Permission.Update, (c, { args }) =>
        c.deleteVcsRootProperty(args.id, args.name),
      ),
    ]),
    command("fields", "Read and write root fields", [
      leaf(
        "get <id> <field>",
        "Read a root field",
        Permission.ReadOnly,
        (c, { args }) => c.getVcsRootField(args.id, args.field),
      ),
      leaf("set <id> <field> <value>", "Set a root field", Permission.Update, (c, { args }) =>
        c.setVcsRootField(args.id, args.field, args.value),
      ),
    ]),
  ];
  const instances = command("instances", "Inspect/change VCS instance detection state", [
    ...instanceCommands,
    leaf(
      "list",
      "List results",
      Permission.ReadOnly,
      (c, { options }) => c.listVcsInstances(page(options), optional(options, "root")),
      [...pageOptions, option("--root <id>", "Select a VCS root")],
    ),
    leaf(
      "check-changes <id>",
      "Request a VCS change check",
      Permission.Update,
      (c, { args }) => c.checkVcsInstanceChanges(args.id),
    ),
    leaf(
      "notify-commit <id>",
      "Notify a VCS root instance",
      Permission.Update,
      (c, { args }) => c.notifyVcsCommit(args.id),
    ),
    leaf("show <id>", "Read identity/polling metadata", Permission.ReadOnly, (c, { args }) =>
      c.getVcsInstance(args.id),
    ),
    leaf("properties <id>", "List parameter names", Permission.ReadOnly, (c, { args }) =>
      c.listVcsInstancePropertyNames(args.id),
    ),
    command("state", "Manage saved branch revisions", [
      leaf("show <id>", "Read branch/revision entries", Permission.ReadOnly, (c, { args }) =>
        c.getVcsRepositoryState(args.id),
      ),
      leaf(
        "replace <id>",
        "Replace all saved branch revisions",
        Permission.Update,
        (c, { args, options }) =>
          c.replaceVcsRepositoryState(
            args.id,
            (options.revision ?? []) as PlainProperty[],
          ),
        [
          {
            ...propertyOption,
            flags: "--revision <branch=revision>",
            description: "Supply branch and revision pairs; repeat",
          },
        ],
      ),
      leaf(
        "reset <id>",
        "Reset saved detection state",
        Permission.Update,
        (c, { args }) => c.resetVcsRepositoryState(args.id),
        [confirm],
      ),
      leaf(
        "created <id>",
        "Read saved-state creation timestamp",
        Permission.ReadOnly,
        (c, { args }) => c.getVcsRepositoryStateCreated(args.id),
      ),
    ]),
    command("fields", "Read and write instance fields", [
      leaf(
        "get <id> <field>",
        "Read an instance field",
        Permission.ReadOnly,
        (c, { args }) => c.getVcsInstanceField(args.id, args.field),
      ),
      leaf(
        "set <id> <field> <value>",
        "Set a VCS instance field",
        Permission.Update,
        (c, { args }) =>
          c.setVcsInstanceField(args.id, args.field, args.value),
      ),
      leaf(
        "clear <id> <field>",
        "Clear a VCS instance field",
        Permission.Update,
        (c, { args }) => c.clearVcsInstanceField(args.id, args.field),
      ),
    ]),
  ]);
  const versioned = command("versioned-settings", "Manage versioned project settings", [
    leaf("affected <id>", "Read affected project identities", Permission.ReadOnly, (c, { args }) =>
      c.getVersionedAffectedProjects(args.id),
    ),
    leaf(
      "check-changes <id>",
      "Request a settings check",
      Permission.Update,
      (c, { args }) => c.checkVersionedSettings(args.id),
    ),
    leaf(
      "commit <id>",
      "Commit current settings to external VCS",
      Permission.Update,
      (c, { args }) => c.commitVersionedSettings(args.id),
      [confirm],
    ),
    command("config", "Manage versioned settings configuration", [
      leaf("show <id>", "Read project configuration", Permission.ReadOnly, (c, { args }) =>
        c.getVersionedConfig(args.id),
      ),
      leaf(
        "effective <id>",
        "Read inherited project/config pair",
        Permission.ReadOnly,
        (c, { args }) => c.getEffectiveVersionedConfig(args.id),
      ),
      leaf(
        "replace <id>",
        "Replace versioned settings configuration",
        Permission.Update,
        (c, { args, options }) => c.replaceVersionedConfig(args.id, options.item),
        [jsonOption("--item <json>", "Supply versioned settings configuration")],
      ),
      command("fields", "Manage versioned settings fields", [
        leaf(
          "get <id> <field>",
          "Read a configuration field",
          Permission.ReadOnly,
          (c, { args }) => c.getVersionedConfigField(args.id, args.field),
        ),
        leaf(
          "set <id> <field> <value>",
          "Set a configuration field",
          Permission.Update,
          (c, { args }) =>
            c.setVersionedConfigField(args.id, args.field, args.value),
        ),
        leaf(
          "reset <id> <field>",
          "Reset the versioned VCS root",
          Permission.Update,
          (c, { args }) => c.resetVersionedConfigField(args.id, args.field),
          [confirm],
        ),
      ]),
    ]),
    command("context", "Manage DSL context parameters", [
      leaf(
        "list <id>",
        "List DSL context parameter names",
        Permission.ReadOnly,
        (c, { args }) => c.listVersionedContext(args.id),
      ),
      leaf(
        "replace <id>",
        "Replace all DSL context parameters",
        Permission.Update,
        (c, { args, options }) =>
          c.replaceVersionedContext(args.id, (options.property ?? []) as PlainProperty[]),
        [propertyOption],
      ),
    ]),
    leaf(
      "load <id>",
      "Load current configuration from VCS",
      Permission.Update,
      (c, { args }) => c.loadVersionedSettings(args.id),
      [confirm],
    ),
    leaf(
      "status <id>",
      "Read synchronization state",
      Permission.ReadOnly,
      (c, { args }) => c.getVersionedStatus(args.id),
    ),
    command("tokens", "Manage versioned secure-value mappings", [
      leaf(
        "list <id>",
        "List secure-value mapping names",
        Permission.ReadOnly,
        (c, { args, options }) =>
          c.listVersionedTokenNames(args.id, optional(options, "status")),
        [option("--status <status>", "Filter the token status")],
      ),
      command(
        "set <id>",
        "Set mappings from this profile's input-secret aliases",
        async ({ args, options }, context) =>
          (await clientFor(context)).setVersionedTokens(
            args.id,
            options.mapping as string[],
            context.secrets,
          ),
        {
          permission: "Credentials",
          options: [
            repeatOption(
              "--mapping <remote-name=alias>",
              "Supply mapping names and input-secret aliases; repeat",
              true,
            ),
          ],
        },
      ),
      leaf(
        "delete <id>",
        "Delete unused secure-value mappings",
        "Credentials",
        (c, { args, options }) =>
          c.deleteVersionedTokens(args.id, options.name as string[]),
        [repeatOption("--name <name>", "Select remote mappings; repeat for more", true)],
      ),
    ]),
  ]);
  const server = [
    leaf(
      "rest-version",
      "Read the REST plugin version",
      Permission.ReadOnly,
      (c) => c.getRestVersion(),
    ),
  ];
  const credentials = command(
    "credentials",
    "Manage profile secret inputs",
    [
      command(
        "import <alias>",
        "Import a secret from an environment variable",
        async ({ args, options }, context) =>
          importInputSecret(context.secrets, args.alias, text(options, "env")),
        {
          permission: "Credentials",
          options: [
            option("--env <variable>", "Select the environment variable name", true),
          ],
        },
      ),
      command(
        "forget <alias>",
        "Forget a local secret input",
        async ({ args }, context) => forgetInputSecret(context.secrets, args.alias),
        { permission: "Credentials" },
      ),
    ],
  );
  return { roots, instances, projects: [versioned], server, rootsCommands: [cloud, credentials] };
}
