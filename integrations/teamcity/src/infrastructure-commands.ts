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
  const confirm = option("--confirm", "Confirm the described destructive/external effect", true);
  const imageOptions = [
    option("--cloud-profile <id>", "Remote cloud profile ID, not a CLI profile", true),
    option("--image <id>", "Provider image ID within that cloud profile", true),
  ];
  const instanceOptions = [
    ...imageOptions,
    option("--instance <id>", "Provider instance ID within the image", true),
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
      "Read one bounded page without network addresses",
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
        option("--project <id>", "One project scope"),
        ...(kind === "profiles"
          ? []
          : [option("--cloud-profile <id>", "One remote cloud profile")]),
      ],
    );
  const cloud = command("cloud", "Inspect/manage remote cloud capacity; actions can incur cost", [
    command("profiles", "Remote cloud configuration profiles, not CLI connections", [
      cloudLists("profiles"),
      leaf("show <id>", "Show cloud profile metadata", Permission.ReadOnly, (c, { args }) =>
        c.getCloudProfile(args.id),
      ),
    ]),
    command("images", "Images inside explicit remote cloud profiles", [
      cloudLists("images"),
      leaf(
        "show",
        "Show one composite cloud image",
        Permission.ReadOnly,
        (c, { options }) => c.getCloudImage(image(options)),
        imageOptions,
      ),
    ]),
    command("instances", "Request lifecycle changes; ACK is not final state", [
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
        "Request a new instance from an image; may incur cost",
        Permission.Update,
        (c, { options }) => c.startCloudInstance(image(options)),
        imageOptions,
      ),
      ...(["delete", "force-stop", "stop"] as const).map((action) =>
        leaf(
          action,
          action === "stop"
            ? "Schedule stop when free"
            : "Immediately force termination, including running work",
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
      "Create an anonymous Git root; no credential-bearing URL",
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
        option("--name <text>", "Name", true),
        option("--project <id>", "Owner project", true),
        option("--url <url>", "HTTPS URL with no userinfo/query/fragment", true),
        option("--branch <ref>", "Git branch ref", true),
      ],
    ),
    leaf(
      "delete <id>",
      "Delete root configuration, not a Git repository",
      Permission.Update,
      (c, { args }) => c.deleteVcsRoot(args.id),
    ),
    leaf("instances <id>", "Read native unpaged instances", Permission.ReadOnly, (c, { args }) =>
      c.getVcsRootInstances(args.id),
    ),
    command("properties", "Full-map replacements can break attached builds", [
      leaf("list <id>", "List names only", Permission.ReadOnly, (c, { args }) =>
        c.listVcsRootPropertyNames(args.id),
      ),
      leaf(
        "replace <id>",
        "Replace all properties; omitted entries are removed",
        Permission.Update,
        (c, { args, options }) =>
          c.replaceVcsRootProperties(args.id, (options.property ?? []) as PlainProperty[]),
        [propertyOption],
      ),
      leaf(
        "clear <id>",
        "Delete every property, including connection settings",
        Permission.Update,
        (c, { args }) => c.clearVcsRootProperties(args.id),
        [confirm],
      ),
      leaf(
        "exists <id> <name>",
        "Probe and discard private value",
        Permission.ReadOnly,
        (c, { args }) => c.checkVcsRootProperty(args.id, args.name),
      ),
      leaf(
        "set <id> <name> <value>",
        "Set a non-secret property, discard echo",
        Permission.Update,
        (c, { args }) =>
          c.setVcsRootProperty(args.id, args.name, args.value),
      ),
      leaf("delete <id> <name>", "Delete one property", Permission.Update, (c, { args }) =>
        c.deleteVcsRootProperty(args.id, args.name),
      ),
    ]),
    command("fields", "Allowlisted root metadata", [
      leaf(
        "get <id> <field>",
        "Read id/name/vcsName/projectId/modificationCheckInterval",
        Permission.ReadOnly,
        (c, { args }) => c.getVcsRootField(args.id, args.field),
      ),
      leaf("set <id> <field> <value>", "Set name only", Permission.Update, (c, { args }) =>
        c.setVcsRootField(args.id, args.field, args.value),
      ),
    ]),
  ];
  const instances = command("instances", "Inspect/change VCS instance detection state", [
    ...instanceCommands,
    leaf(
      "list",
      "Read one bounded page",
      Permission.ReadOnly,
      (c, { options }) => c.listVcsInstances(page(options), optional(options, "root")),
      [...pageOptions, option("--root <id>", "One VCS root filter")],
    ),
    leaf(
      "check-changes <id>",
      "Schedule a check for exactly one instance as user requestor",
      Permission.Update,
      (c, { args }) => c.checkVcsInstanceChanges(args.id),
    ),
    leaf(
      "notify-commit <id>",
      "Notify exactly one instance; scheduled only on HTTP202",
      Permission.Update,
      (c, { args }) => c.notifyVcsCommit(args.id),
    ),
    leaf("show <id>", "Read identity/polling metadata", Permission.ReadOnly, (c, { args }) =>
      c.getVcsInstance(args.id),
    ),
    leaf("properties <id>", "Read names only", Permission.ReadOnly, (c, { args }) =>
      c.listVcsInstancePropertyNames(args.id),
    ),
    command("state", "Stored branch/revision map; not the remote Git repository", [
      leaf("show <id>", "Read branch/revision entries", Permission.ReadOnly, (c, { args }) =>
        c.getVcsRepositoryState(args.id),
      ),
      leaf(
        "replace <id>",
        "Replace all entries; absent revisions clear",
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
            description: "Repeat explicit branch/revision pairs",
          },
        ],
      ),
      leaf(
        "reset <id>",
        "Reset saved detection state, not Git branches",
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
    command("fields", "Allowlisted instance fields; currentVersion may contact VCS", [
      leaf(
        "get <id> <field>",
        "Read safe identity/revision/polling fields",
        Permission.ReadOnly,
        (c, { args }) => c.getVcsInstanceField(args.id, args.field),
      ),
      leaf(
        "set <id> <field> <value>",
        "Set commitHookMode or lastVersionInternal",
        Permission.Update,
        (c, { args }) =>
          c.setVcsInstanceField(args.id, args.field, args.value),
      ),
      leaf(
        "clear <id> <field>",
        "Clear lastVersionInternal only",
        Permission.Update,
        (c, { args }) => c.clearVcsInstanceField(args.id, args.field),
      ),
    ]),
  ]);
  const versioned = command("versioned-settings", "Project configuration synchronized with VCS", [
    leaf("affected <id>", "Read affected project identities", Permission.ReadOnly, (c, { args }) =>
      c.getVersionedAffectedProjects(args.id),
    ),
    leaf(
      "check-changes <id>",
      "Request settings check, not completion",
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
    command("config", "Full replacements with secure values always outside VCS", [
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
        "Replace typed configuration; omitted fields use documented defaults",
        Permission.Update,
        (c, { args, options }) => c.replaceVersionedConfig(args.id, options.item),
        [jsonOption("--item <json>", "Strict VersionedSettingsConfig input, never raw HTTP")],
      ),
      command("fields", "Typed config fields, not arbitrary build parameters", [
        leaf(
          "get <id> <field>",
          "Read allowlisted config field",
          Permission.ReadOnly,
          (c, { args }) => c.getVersionedConfigField(args.id, args.field),
        ),
        leaf(
          "set <id> <field> <value>",
          "Set typed enum/boolean/root; never publish secrets into VCS",
          Permission.Update,
          (c, { args }) =>
            c.setVersionedConfigField(args.id, args.field, args.value),
        ),
        leaf(
          "reset <id> <field>",
          "Attempt vcsRootId reset; server can fail after mutation; no retry",
          Permission.Update,
          (c, { args }) => c.resetVersionedConfigField(args.id, args.field),
          [confirm],
        ),
      ]),
    ]),
    command("context", "Non-secret DSL context parameters", [
      leaf(
        "list <id>",
        "Read names and presence, never values",
        Permission.ReadOnly,
        (c, { args }) => c.listVersionedContext(args.id),
      ),
      leaf(
        "replace <id>",
        "Replace complete context map; no properties clears",
        Permission.Update,
        (c, { args, options }) =>
          c.replaceVersionedContext(args.id, (options.property ?? []) as PlainProperty[]),
        [propertyOption],
      ),
    ]),
    leaf(
      "load <id>",
      "Overwrite current configuration from VCS, including affected projects",
      Permission.Update,
      (c, { args }) => c.loadVersionedSettings(args.id),
      [confirm],
    ),
    leaf(
      "status <id>",
      "Read state without diagnostic messages/files",
      Permission.ReadOnly,
      (c, { args }) => c.getVersionedStatus(args.id),
    ),
    command("tokens", "Versioned secure-value mappings, not user access tokens", [
      leaf(
        "list <id>",
        "Read mapping names only",
        Permission.ReadOnly,
        (c, { args, options }) =>
          c.listVersionedTokenNames(args.id, optional(options, "status")),
        [option("--status <status>", "used, unused or broken")],
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
              "Repeat remote mapping name and local input-secret alias",
              true,
            ),
          ],
        },
      ),
      leaf(
        "delete <id>",
        "Delete explicitly named unused mappings; keep local inputs",
        "Credentials",
        (c, { args, options }) =>
          c.deleteVersionedTokens(args.id, options.name as string[]),
        [repeatOption("--name <name>", "Repeat remote mapping names", true)],
      ),
    ]),
  ]);
  const server = [
    leaf(
      "rest-version",
      "Read REST plugin version, not local CLI version",
      Permission.ReadOnly,
      (c) => c.getRestVersion(),
    ),
  ];
  const credentials = command(
    "credentials",
    "Explicit profile-scoped inputs; values never printed",
    [
      command(
        "import <alias>",
        "Import only the explicitly named environment variable into OS keyring",
        async ({ args, options }, context) =>
          importInputSecret(context.secrets, args.alias, text(options, "env")),
        {
          permission: "Credentials",
          options: [
            option("--env <variable>", "Name of the environment variable, never its value", true),
          ],
        },
      ),
      command(
        "forget <alias>",
        "Remove only an owned input-secret; never revoke remotely",
        async ({ args }, context) => forgetInputSecret(context.secrets, args.alias),
        { permission: "Credentials" },
      ),
    ],
  );
  return { roots, instances, projects: [versioned], server, rootsCommands: [cloud, credentials] };
}
