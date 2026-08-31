import {
  command,
  Permission,
  type CommandContext,
  type CommandDefinition,
  type OptionDefinition,
} from "@eyeauras/cli-factory";
import type { TeamCityClient } from "./client.js";
import { clientLeaf, text, optionalText, option, propertyOption } from "./command-support.js";
import { createAdvancedAuthoringCommands } from "./advanced-authoring-commands.js";
import type { createBulkConfigurationCommands } from "./bulk-configuration-commands.js";
import type {
  ExtensionKind,
  ParameterOwner,
  PlainProperty,
  StepInput,
} from "./authoring-models.js";

function stepInput(options: Record<string, unknown>): StepInput {
  return {
    name: text(options, "name"),
    type: text(options, "type"),
    properties: (options.property ?? []) as PlainProperty[],
  };
}

export function createAuthoringCommands(
  clientFor: (context: CommandContext) => Promise<TeamCityClient>,
  pageOptions: readonly OptionDefinition[],
  bulk: ReturnType<typeof createBulkConfigurationCommands>,
) {
  const leaf = clientLeaf(clientFor);
  const advanced = createAdvancedAuthoringCommands(leaf, pageOptions, bulk);

  const nameOption = option("--name <name>", "Non-empty display name", true);
  const descriptionOption = option("--description <text>", "Description");
  const parentOption = option("--parent <id>", "Parent project ID", true);
  const projectOption = option("--project <id>", "Project ID", true);

  function parameters(owner: ParameterOwner): CommandDefinition {
    const ownerArg = owner === "projects" ? "project-id" : "job-id";
    const valueOption = option(
      "--value <value>",
      "Plain non-secret value (never credentials)",
      true,
    );
    return command(
      owner === "output" ? "output-parameters" : "parameters",
      "Manage plain parameters; protected values are redacted",
      [
        ...bulk.parameters(owner),
        leaf(
          `list <${ownerArg}>`,
          "List parameters in server order",
          Permission.ReadOnly,
          (c, { args }) => c.listParameters(owner, text(args, ownerArg)),
        ),
        leaf(
          `show <${ownerArg}> <name>`,
          "Show parameter metadata and a safe value",
          Permission.ReadOnly,
          (c, { args }) => c.getParameter(owner, text(args, ownerArg), text(args, "name")),
        ),
        leaf(
          `create <${ownerArg}> <name>`,
          "Create a plain parameter (TeamCity POST semantics)",
          Permission.Update,
          (c, { args, options }) =>
            c.createParameter(
              owner,
              text(args, ownerArg),
              text(args, "name"),
              text(options, "value"),
            ),
          [valueOption],
        ),
        leaf(
          `set <${ownerArg}> <name>`,
          "Set a plain parameter after checking its type",
          Permission.Update,
          (c, { args, options }) =>
            c.setParameter(owner, text(args, ownerArg), text(args, "name"), text(options, "value")),
          [valueOption],
        ),
        leaf(
          `delete <${ownerArg}> <name>`,
          "Delete one named parameter",
          Permission.Update,
          (c, { args }) => c.deleteParameter(owner, text(args, ownerArg), text(args, "name")),
        ),
      ],
    );
  }

  const stepOptions = [
    nameOption,
    option("--type <runner-type>", "TeamCity runner type", true),
    propertyOption,
  ];
  const extensionOptions = [
    option("--type <type>", "TeamCity extension type", true),
    option("--enabled", "Enable the extension (disabled by default, including replace)"),
    propertyOption,
  ];
  function extensions(kind: ExtensionKind): CommandDefinition {
    const idArg = kind === "triggers" ? "trigger-id" : "feature-id";
    const input = (options: Record<string, unknown>) => ({
      type: text(options, "type"),
      enabled: options.enabled === true,
      properties: (options.property ?? []) as PlainProperty[],
    });
    return command(kind, "Manage disabled-by-default extensions; property values are redacted", [
      bulk.replaceAll(kind),
      advanced.entityFields(kind),
      ...(kind === "features" ? [advanced.pluginParameters(kind)] : []),
      leaf("list <job-id>", "List in server order", Permission.ReadOnly, (c, { args }) =>
        c.listExtensions(kind, text(args, "job-id")),
      ),
      leaf(`show <job-id> <${idArg}>`, "Show a safe summary", Permission.ReadOnly, (c, { args }) =>
        c.getExtension(kind, text(args, "job-id"), text(args, idArg)),
      ),
      leaf(
        "create <job-id>",
        "Add an extension; disabled unless --enabled",
        Permission.Update,
        (c, { args, options }) => c.createExtension(kind, text(args, "job-id"), input(options)),
        extensionOptions,
      ),
      leaf(
        `replace <job-id> <${idArg}>`,
        "Full replacement; omitted properties are NOT preserved; disabled unless --enabled",
        Permission.Update,
        (c, { args, options }) =>
          c.replaceExtension(kind, text(args, "job-id"), text(args, idArg), input(options)),
        extensionOptions,
      ),
      leaf(`delete <job-id> <${idArg}>`, "Delete one extension", Permission.Update, (c, { args }) =>
        c.deleteExtension(kind, text(args, "job-id"), text(args, idArg)),
      ),
    ]);
  }
  const snapshotOptions = [
    option("--source <upstream-job-id>", "Upstream build configuration ID", true),
    propertyOption,
  ];
  const snapshotInput = (options: Record<string, unknown>) => ({
    source: text(options, "source"),
    properties: (options.property ?? []) as PlainProperty[],
  });
  const snapshots = command(
    "snapshot-dependencies",
    "Manage upstream build dependencies; dependency ID is the upstream job ID",
    [
      bulk.replaceAll("snapshot-dependencies"),
      leaf(
        "list <job-id>",
        "List dependencies in server order",
        Permission.ReadOnly,
        (c, { args }) => c.listSnapshotDependencies(text(args, "job-id")),
      ),
      leaf(
        "show <job-id> <dependency-id>",
        "Show a dependency without property values",
        Permission.ReadOnly,
        (c, { args }) => c.getSnapshotDependency(text(args, "job-id"), text(args, "dependency-id")),
      ),
      leaf(
        "create <job-id>",
        "Add an upstream dependency",
        Permission.Update,
        (c, { args, options }) =>
          c.createSnapshotDependency(text(args, "job-id"), snapshotInput(options)),
        snapshotOptions,
      ),
      leaf(
        "replace <job-id> <dependency-id>",
        "Fully replace a dependency; omitted properties are NOT preserved",
        Permission.Update,
        (c, { args, options }) =>
          c.replaceSnapshotDependency(
            text(args, "job-id"),
            text(args, "dependency-id"),
            snapshotInput(options),
          ),
        snapshotOptions,
      ),
      leaf(
        "delete <job-id> <dependency-id>",
        "Remove a dependency, not its upstream job",
        Permission.Update,
        (c, { args }) =>
          c.deleteSnapshotDependency(text(args, "job-id"), text(args, "dependency-id")),
      ),
    ],
  );
  const templates = command("templates", "Manage attachments to existing templates", [
    ...bulk.templates,
    leaf(
      "show <job-id> <template-id>",
      "Show one attached template",
      Permission.ReadOnly,
      (c, { args }) => c.getAttachedTemplate(text(args, "job-id"), text(args, "template-id")),
    ),
    leaf(
      "list <job-id>",
      "List attached templates in priority order",
      Permission.ReadOnly,
      (c, { args }) => c.listTemplates(text(args, "job-id")),
    ),
    leaf(
      "attach <job-id>",
      "Attach a template without detaching other templates",
      Permission.Update,
      (c, { args, options }) =>
        c.attachTemplate(
          text(args, "job-id"),
          text(options, "template"),
          options.optimizeSettings === true,
        ),
      [
        option("--template <template-id>", "Existing template ID", true),
        option(
          "--optimize-settings",
          "Remove local settings duplicated by templates (default: false)",
        ),
      ],
    ),
    leaf(
      "detach <job-id> <template-id>",
      "Detach without deleting the template; inherited settings are not copied by default",
      Permission.Update,
      (c, { args, options }) =>
        c.detachTemplate(
          text(args, "job-id"),
          text(args, "template-id"),
          options.inlineSettings === true,
        ),
      [
        option(
          "--inline-settings",
          "Copy inherited settings locally when detaching (default: false)",
        ),
      ],
    ),
  ]);
  const steps = command("steps", "Manage ordered build steps", [
    bulk.replaceAll("steps"),
    advanced.entityFields("steps"),
    advanced.pluginParameters("steps"),
    leaf("list <job-id>", "List steps in execution order", Permission.ReadOnly, (c, { args }) =>
      c.listSteps(text(args, "job-id")),
    ),
    leaf(
      "show <job-id> <step-id>",
      "Show a safe step summary",
      Permission.ReadOnly,
      (c, { args }) => c.getStep(text(args, "job-id"), text(args, "step-id")),
    ),
    leaf(
      "create <job-id>",
      "Add a build step",
      Permission.Update,
      (c, { args, options }) => c.createStep(text(args, "job-id"), stepInput(options)),
      stepOptions,
    ),
    leaf(
      "replace <job-id> <step-id>",
      "Fully replace a step; omitted properties are NOT preserved",
      Permission.Update,
      (c, { args, options }) =>
        c.replaceStep(text(args, "job-id"), text(args, "step-id"), stepInput(options)),
      stepOptions,
    ),
    leaf("delete <job-id> <step-id>", "Delete one build step", Permission.Update, (c, { args }) =>
      c.deleteStep(text(args, "job-id"), text(args, "step-id")),
    ),
  ]);

  const checkoutOption = option(
    "--checkout-rules <rules>",
    "Checkout rules (an empty string clears them)",
    true,
  );
  const vcs = command("vcs", "Manage existing VCS root attachments", [
    bulk.replaceAll("vcs-root-entries"),
    leaf(
      "list <job-id>",
      "List attached roots without connection properties",
      Permission.ReadOnly,
      (c, { args }) => c.listVcsEntries(text(args, "job-id")),
    ),
    leaf(
      "show <job-id> <root-id>",
      "Show one root attachment",
      Permission.ReadOnly,
      (c, { args }) => c.getVcsEntry(text(args, "job-id"), text(args, "root-id")),
    ),
    leaf(
      "attach <job-id>",
      "Attach an existing root; does not create a root",
      Permission.Update,
      (c, { args, options }) =>
        c.attachVcsRoot(
          text(args, "job-id"),
          text(options, "root"),
          typeof options.checkoutRules === "string" ? options.checkoutRules : "",
        ),
      [
        option("--root <root-id>", "Existing root ID", true),
        { ...checkoutOption, required: false },
      ],
    ),
    leaf(
      "replace <job-id> <root-id>",
      "Replace an attachment, retaining its named root",
      Permission.Update,
      (c, { args, options }) =>
        c.replaceVcsEntry(
          text(args, "job-id"),
          text(args, "root-id"),
          text(options, "checkoutRules"),
        ),
      [checkoutOption],
    ),
    leaf(
      "detach <job-id> <root-id>",
      "Detach from this job; never delete the shared root",
      Permission.Update,
      (c, { args }) => c.detachVcsRoot(text(args, "job-id"), text(args, "root-id")),
    ),
    command("checkout-rules", "Inspect or update checkout rules", [
      leaf("show <job-id> <root-id>", "Show checkout rules", Permission.ReadOnly, (c, { args }) =>
        c.getCheckoutRules(text(args, "job-id"), text(args, "root-id")),
      ),
      leaf(
        "set <job-id> <root-id>",
        "Replace checkout rules",
        Permission.Update,
        (c, { args, options }) =>
          c.setCheckoutRules(text(args, "job-id"), text(args, "root-id"), text(options, "rules")),
        [option("--rules <rules>", "Checkout rules (an empty string clears them)", true)],
      ),
    ]),
  ]);
  const roots = [
    leaf(
      "list",
      "List a bounded page of VCS roots",
      Permission.ReadOnly,
      (c, { options }) =>
        c.listVcsRoots({
          ...optionalText(options, "project"),
          limit: Number(options.limit),
          start: Number(options.start),
        }),
      [{ ...projectOption, required: false }, ...pageOptions],
    ),
    leaf(
      "show <id>",
      "Show a root identity without connection properties",
      Permission.ReadOnly,
      (c, { args }) => c.getVcsRoot(text(args, "id")),
    ),
  ];

  const projects = [
    ...bulk.projects,
    ...advanced.projects,
    parameters("projects"),
    leaf(
      "create <id>",
      "Create a project",
      Permission.Update,
      (c, { args, options }) =>
        c.createProject(text(args, "id"), {
          name: text(options, "name"),
          ...optionalText(options, "parent"),
          ...optionalText(options, "description"),
        }),
      [nameOption, { ...parentOption, required: false }, descriptionOption],
    ),
    leaf(
      "set <id> <field> <value>",
      "Set name, description or archived (true/false)",
      Permission.Update,
      (c, { args }) =>
        c.setProjectField(text(args, "id"), text(args, "field"), text(args, "value")),
    ),
    leaf(
      "move <id>",
      "Move a project to a parent",
      Permission.Update,
      (c, { args, options }) => c.moveProject(text(args, "id"), text(options, "parent")),
      [parentOption],
    ),
    leaf(
      "delete <id>",
      "Delete a project and its server-owned contents; never the root",
      Permission.Update,
      (c, { args }) => c.deleteProject(text(args, "id")),
    ),
  ];
  const jobs = [
    ...bulk.jobs,
    ...advanced.jobs,
    parameters("output"),
    parameters("jobs"),
    steps,
    vcs,
    extensions("triggers"),
    extensions("features"),
    snapshots,
    templates,
    leaf(
      "create <id>",
      "Create a build configuration",
      Permission.Update,
      (c, { args, options }) =>
        c.createJob(text(args, "id"), {
          name: text(options, "name"),
          project: text(options, "project"),
          ...optionalText(options, "description"),
        }),
      [nameOption, projectOption, descriptionOption],
    ),
    leaf(
      "set <id> <field> <value>",
      "Set name, description or paused (true/false)",
      Permission.Update,
      (c, { args }) => c.setJobField(text(args, "id"), text(args, "field"), text(args, "value")),
    ),
    leaf(
      "move <id>",
      "Move a job to a project",
      Permission.Update,
      (c, { args, options }) => c.moveJob(text(args, "id"), text(options, "project")),
      [projectOption],
    ),
    leaf(
      "delete <id>",
      "Delete a job and server-owned configuration/history",
      Permission.Update,
      (c, { args }) => c.deleteJob(text(args, "id")),
    ),
  ];
  return { projects, jobs, roots };
}
