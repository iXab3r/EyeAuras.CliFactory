import { command, Permission, type OptionDefinition } from "@eyeauras/cli-factory";
import { text, optionalText, option, propertyOption, type ClientLeaf } from "./command-support.js";
import type { PlainProperty } from "./authoring-models.js";
import type { EntitySettingsKind, RuleInput, RuleKind } from "./advanced-authoring-models.js";
import type { createBulkConfigurationCommands } from "./bulk-configuration-commands.js";

export function createAdvancedAuthoringCommands(
  leaf: ClientLeaf,
  pageOptions: readonly OptionDefinition[],
  bulk: ReturnType<typeof createBulkConfigurationCommands>,
) {
  function entityFields(kind: EntitySettingsKind) {
    const arg =
      kind === "steps"
        ? "step-id"
        : kind === "features"
          ? "feature-id"
          : kind === "triggers"
            ? "trigger-id"
            : kind === "agent-requirements"
              ? "requirement-id"
              : "dependency-id";
    return command(
      "fields",
      kind === "steps" ? "Inspect/set name or disabled" : "Inspect/set disabled only",
      [
        leaf(
          `show <job-id> <${arg}> <field>`,
          "Read an allowed setting",
          Permission.ReadOnly,
          (c, { args }) =>
            c.getEntitySetting(kind, text(args, "job-id"), text(args, arg), text(args, "field")),
        ),
        leaf(
          `set <job-id> <${arg}> <field> <value>`,
          "Set a setting; disabled requires true/false",
          Permission.Update,
          (c, { args }) =>
            c.setEntitySetting(
              kind,
              text(args, "job-id"),
              text(args, arg),
              text(args, "field"),
              text(args, "value"),
            ),
        ),
      ],
    );
  }
  function pluginParameters(kind: "steps" | "features") {
    const arg = kind === "steps" ? "step-id" : "feature-id";
    return command("parameters", "Manage non-secret plugin parameters; values are redacted", [
      leaf(
        `list <job-id> <${arg}>`,
        "List redacted property metadata",
        Permission.ReadOnly,
        (c, { args }) => c.listPluginParameters(kind, text(args, "job-id"), text(args, arg)),
      ),
      leaf(
        `show <job-id> <${arg}> <name>`,
        "Check a property exists; do not expose its value",
        Permission.ReadOnly,
        (c, { args }) =>
          c.getPluginParameter(kind, text(args, "job-id"), text(args, arg), text(args, "name")),
      ),
      leaf(
        `replace <job-id> <${arg}>`,
        "Replace ALL parameters; omitted properties are removed",
        Permission.Update,
        (c, { args, options }) =>
          c.replacePluginParameters(
            kind,
            text(args, "job-id"),
            text(args, arg),
            (options.property ?? []) as PlainProperty[],
          ),
        [propertyOption],
      ),
      leaf(
        `set <job-id> <${arg}> <name> <value>`,
        "Set one non-secret property",
        Permission.Update,
        (c, { args }) =>
          c.setPluginParameter(
            kind,
            text(args, "job-id"),
            text(args, arg),
            text(args, "name"),
            text(args, "value"),
          ),
      ),
    ]);
  }
  function rules(kind: RuleKind) {
    const requirement = kind === "agent-requirements";
    const arg = requirement ? "requirement-id" : "dependency-id";
    const options = [
      option("--disabled", "Disable this rule (default: false)"),
      ...(requirement
        ? [
            option("--type <type>", "Requirement type, such as equals or exists", true),
            option("--parameter <name>", "Non-secret agent parameter name", true),
            option("--value <value>", "Requirement value"),
          ]
        : [
            option("--source <job-id>", "Upstream build configuration ID", true),
            option("--rules <rules>", "Artifact path rules", true),
            option(
              "--revision <revision-name>",
              "TeamCity revision rule, e.g. lastSuccessful",
              true,
            ),
            option("--revision-value <value>", "Revision-specific value"),
            option("--branch <branch>", "Source branch"),
            option("--clean", "Clean destination directory"),
          ]),
    ];
    const input = (values: Record<string, unknown>): RuleInput =>
      requirement
        ? {
            kind: "agent-requirements",
            type: text(values, "type"),
            parameter: text(values, "parameter"),
            ...optionalText(values, "value"),
            disabled: values.disabled === true,
          }
        : {
            kind: "artifact-dependencies",
            source: text(values, "source"),
            rules: text(values, "rules"),
            revision: text(values, "revision"),
            ...optionalText(values, "revisionValue"),
            ...optionalText(values, "branch"),
            clean: values.clean === true,
            disabled: values.disabled === true,
          };
    return command(kind, "Manage job rules without exposing property values", [
      bulk.replaceAll(kind),
      entityFields(kind),
      leaf("list <job-id>", "List rules in server order", Permission.ReadOnly, (c, { args }) =>
        c.listRules(kind, args["job-id"]),
      ),
      leaf(
        `show <job-id> <${arg}>`,
        "Show a safe rule summary",
        Permission.ReadOnly,
        (c, { args }) => c.getRule(kind, text(args, "job-id"), text(args, arg)),
      ),
      leaf(
        "create <job-id>",
        "Add a rule",
        Permission.Update,
        (c, { args, options }) => c.createRule(args["job-id"], input(options)),
        options,
      ),
      leaf(
        `replace <job-id> <${arg}>`,
        "Full replacement; omitted settings are NOT preserved",
        Permission.Update,
        (c, { args, options }) =>
          c.replaceRule(text(args, "job-id"), text(args, arg), input(options)),
        options,
      ),
      leaf(
        `delete <job-id> <${arg}>`,
        "Remove a rule, not the upstream resource",
        Permission.Update,
        (c, { args }) => c.deleteRule(kind, text(args, "job-id"), text(args, arg)),
      ),
    ]);
  }
  const featureOptions = [option("--type <type>", "Project feature type", true), propertyOption];
  const features = command("features", "Manage project features; changes are active immediately", [
    bulk.replaceAll("projectFeatures"),
    leaf("list <project-id>", "List redacted features", Permission.ReadOnly, (c, { args }) =>
      c.listProjectFeatures(args["project-id"]),
    ),
    leaf(
      "show <project-id> <feature-id>",
      "Show a redacted feature",
      Permission.ReadOnly,
      (c, { args }) => c.getProjectFeature(args["project-id"], args["feature-id"]),
    ),
    leaf(
      "create <project-id>",
      "Create a project feature",
      Permission.Update,
      (c, { args, options }) =>
        c.createProjectFeature(
          args["project-id"],
          text(options, "type"),
          (options.property ?? []) as PlainProperty[],
        ),
      featureOptions,
    ),
    leaf(
      "replace <project-id> <feature-id>",
      "Full replacement; omitted properties are removed",
      Permission.Update,
      (c, { args, options }) =>
        c.replaceProjectFeature(
          args["project-id"],
          args["feature-id"],
          text(options, "type"),
          (options.property ?? []) as PlainProperty[],
        ),
      featureOptions,
    ),
    leaf(
      "delete <project-id> <feature-id>",
      "Delete one project feature",
      Permission.Update,
      (c, { args }) => c.deleteProjectFeature(args["project-id"], args["feature-id"]),
    ),
  ]);
  const templates = command("templates", "Create templates and manage the project default", [
    leaf("list <project-id>", "List own templates", Permission.ReadOnly, (c, { args }) =>
      c.listProjectTemplates(args["project-id"]),
    ),
    leaf(
      "create <project-id> <template-id>",
      "Create an empty template",
      Permission.Update,
      (c, { args, options }) =>
        c.createProjectTemplate(
          args["project-id"],
          args["template-id"],
          text(options, "name"),
        ),
      [option("--name <name>", "Template display name", true)],
    ),
    command("default", "Manage the default template; never delete the template itself", [
      leaf(
        "show <project-id>",
        "Show the effective default template",
        Permission.ReadOnly,
        (c, { args }) => c.getDefaultTemplate(args["project-id"]),
      ),
      leaf(
        "set <project-id>",
        "Set the default template",
        Permission.Update,
        (c, { args, options }) =>
          c.setDefaultTemplate(args["project-id"], text(options, "template")),
        [option("--template <template-id>", "Existing template ID", true)],
      ),
      leaf(
        "clear <project-id>",
        "Remove the own default; inherited defaults may remain",
        Permission.Update,
        (c, { args }) => c.clearDefaultTemplate(args["project-id"]),
      ),
    ]),
  ]);
  const fields = (owner: "projects" | "jobs") => {
    const arg = owner === "projects" ? "project-id" : "job-id";
    return command(
      "fields",
      `Read id, name, description or ${owner === "projects" ? "archived" : "paused"}`,
      [
        leaf(
          `show <${arg}> <field>`,
          "Read an allowed identity setting",
          Permission.ReadOnly,
          (c, { args }) => c.getOwnerField(owner, text(args, arg), text(args, "field")),
        ),
      ],
    );
  };
  return {
    entityFields,
    pluginParameters,
    projects: [
      features,
      templates,
      fields("projects"),
      leaf(
        "parent <project-id>",
        "Show parent project identity",
        Permission.ReadOnly,
        (c, { args }) => c.getProjectParent(args["project-id"]),
      ),
    ],
    jobs: [
      rules("agent-requirements"),
      rules("artifact-dependencies"),
      fields("jobs"),
      leaf("aliases <job-id>", "List historical external IDs", Permission.ReadOnly, (c, { args }) =>
        c.listJobAliases(args["job-id"]),
      ),
      leaf(
        "branches <job-id>",
        "List one bounded page of branches",
        Permission.ReadOnly,
        (c, { args, options }) =>
          c.listJobBranches(args["job-id"], {
            limit: Number(options.limit),
            start: Number(options.start),
          }),
        pageOptions,
      ),
      leaf(
        "tags <job-id>",
        "List tags used by this job's builds",
        Permission.ReadOnly,
        (c, { args }) => c.listJobTags(args["job-id"]),
      ),
    ],
  };
}
