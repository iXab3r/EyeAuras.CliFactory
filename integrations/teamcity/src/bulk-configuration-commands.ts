import {
  command,
  Permission,
  type CommandContext,
  type OptionDefinition,
} from "@eyeauras/cli-factory";
import type { TeamCityClient } from "./client.js";
import {
  clientLeaf,
  option,
  propertyOption,
  text,
  repeatOption,
  jsonOption,
} from "./command-support.js";
import { booleanText } from "./advanced-authoring-models.js";
import type { ParameterOwner, PlainProperty } from "./authoring-models.js";
import type { ParameterPart, SettingsCollection } from "./bulk-configuration-models.js";

const confirm = option("--confirm", "Confirm clearing this named collection", true);
const strings = (values: Record<string, unknown>, key: string) => (values[key] ?? []) as string[];
const number = (values: Record<string, unknown>, key: string) => Number(text(values, key));
const itemOption: OptionDefinition = {
  ...jsonOption(
    "--item <json>",
    "Repeat a typed, non-secret item; unknown keys are rejected",
    true,
  ),
  required: false,
};

export function createBulkConfigurationCommands(
  clientFor: (context: CommandContext) => Promise<TeamCityClient>,
  pageOptions: readonly OptionDefinition[],
) {
  const leaf = clientLeaf(clientFor);
  function parameters(owner: ParameterOwner) {
    const parts: ParameterPart[] =
      owner === "output" ? ["value"] : ["value", "type", "type/rawValue"];
    return [
      leaf(
        "replace-all <owner-id>",
        "Replace all plain parameters; no properties clears; protected metadata blocks replacement",
        Permission.Update,
        (c, { args, options }) =>
          c.replaceAllParameters(
            owner,
            text(args, "owner-id"),
            (options.property ?? []) as PlainProperty[],
          ),
        [propertyOption],
      ),
      leaf(
        "clear <owner-id>",
        "Delete all own parameters, including protected ones, without reading values",
        Permission.Update,
        (c, { args }) => c.clearParameters(owner, text(args, "owner-id")),
        [confirm],
      ),
      ...parts.map((part) =>
        command(
          part === "type/rawValue" ? "raw-type" : part,
          "Inspect safe metadata or change a plain parameter",
          [
            leaf(
              "show <owner-id> <name>",
              "Read through protected-metadata checks; no raw secret/type text",
              Permission.ReadOnly,
              (c, { args }) =>
                c.getParameterPart(owner, text(args, "owner-id"), text(args, "name"), part),
            ),
            leaf(
              "set <owner-id> <name> <value>",
              "Set a plain value or visible type name; never downgrade a password",
              Permission.Update,
              (c, { args }) =>
                c.setParameterPart(
                  owner,
                  text(args, "owner-id"),
                  text(args, "name"),
                  part,
                  text(args, "value"),
                ),
            ),
          ],
        ),
      ),
    ];
  }
  function replaceAll(kind: SettingsCollection) {
    return leaf(
      "replace-all <owner-id>",
      "Replace the entire collection; omitted items/settings are removed",
      Permission.Update,
      (c, { args, options }) =>
        c.replaceAllSettings(kind, text(args, "owner-id"), (options.item ?? []) as unknown[]),
      [itemOption],
    );
  }
  const templates = [
    leaf(
      "replace-all <job-id>",
      "Replace template attachments, preserving order; no templates clears",
      Permission.Update,
      (c, { args, options }) =>
        c.replaceTemplates(
          text(args, "job-id"),
          strings(options, "template"),
          options.optimizeSettings === true,
        ),
      [
        repeatOption("--template <id>", "Repeat template IDs in priority order"),
        option("--optimize-settings", "Remove redundant local settings"),
      ],
    ),
    leaf(
      "clear <job-id>",
      "Detach all templates, not delete them",
      Permission.Update,
      (c, { args, options }) =>
        c.clearTemplates(text(args, "job-id"), options.inlineSettings === true),
      [confirm, option("--inline-settings", "Copy inherited settings locally before detaching")],
    ),
  ];
  const jobs = [
    leaf(
      "builds <job-id>",
      "List native scoped builds in server order",
      Permission.ReadOnly,
      (c, { args }) => c.listJobBuilds(text(args, "job-id")),
    ),
  ];
  const projects = [
    command("pools", "Manage project pool assignments", [
      leaf("list <project-id>", "List assigned pools", Permission.ReadOnly, (c, { args }) =>
        c.listProjectPools(text(args, "project-id")),
      ),
      leaf("assign <project-id> <pool-id>", "Assign one pool", Permission.Update, (c, { args }) =>
        c.assignProjectPool(text(args, "project-id"), number(args, "pool-id")),
      ),
      leaf(
        "replace-all <project-id>",
        "Replace all pool assignments; no IDs clears",
        Permission.Update,
        (c, { args, options }) =>
          c.replaceProjectPools(text(args, "project-id"), strings(options, "pool").map(Number)),
        [repeatOption("--pool <id>", "Repeat pool IDs")],
      ),
      leaf(
        "unassign <project-id> <pool-id>",
        "Remove one pool assignment",
        Permission.Update,
        (c, { args }) => c.unassignProjectPool(text(args, "project-id"), number(args, "pool-id")),
      ),
    ]),
    leaf(
      "branches <project-id>",
      "List one bounded page of branches",
      Permission.ReadOnly,
      (c, { args, options }) =>
        c.listProjectBranches(text(args, "project-id"), {
          limit: Number(options.limit),
          start: Number(options.start),
        }),
      pageOptions,
    ),
    command("jobs", "Create jobs inside a project", [
      leaf(
        "create <project-id> <job-id>",
        "Create a named empty build configuration",
        Permission.Update,
        (c, { args, options }) =>
          c.createProjectJob(text(args, "project-id"), text(args, "job-id"), text(options, "name")),
        [option("--name <name>", "Job name", true)],
      ),
    ]),
    command(
      "order",
      "Inspect or replace custom project ordering",
      (["jobs", "projects"] as const).map((kind) =>
        command(kind, "Ordering of own children", [
          leaf(
            "show <project-id>",
            "Read custom order; empty means no custom order",
            Permission.ReadOnly,
            (c, { args }) => c.getProjectOrder(text(args, "project-id"), kind),
          ),
          leaf(
            "set <project-id>",
            "Replace custom order; no IDs restores default ordering",
            Permission.Update,
            (c, { args, options }) =>
              c.setProjectOrder(text(args, "project-id"), kind, strings(options, "id")),
            [repeatOption("--id <id>", "Repeat IDs in order")],
          ),
        ]),
      ),
    ),
  ];
  const poolProjects = [
    leaf(
      "replace-all <pool-id>",
      "Replace all assigned projects; no IDs clears",
      Permission.Update,
      (c, { args, options }) =>
        c.replacePoolProjects(number(args, "pool-id"), strings(options, "project")),
      [repeatOption("--project <id>", "Repeat project IDs")],
    ),
    leaf(
      "clear <pool-id>",
      "Remove all project assignments, not the projects",
      Permission.Update,
      (c, { args }) => c.clearPoolProjects(number(args, "pool-id")),
      [confirm],
    ),
  ];
  const queue = [
    leaf(
      "delete-page",
      "Delete at most one bounded page of one job's queued builds/history",
      Permission.Update,
      (c, { options }) =>
        c.deleteQueuePage(text(options, "job"), {
          limit: Number(options.limit),
          start: Number(options.start),
        }),
      [option("--job <job-id>", "Required single job scope", true), ...pageOptions, confirm],
    ),
    leaf(
      "reorder",
      "Move specified queued builds into order; not a launch",
      Permission.Update,
      (c, { options }) => c.reorderQueue(strings(options, "build").map(Number)),
      [repeatOption("--build <id>", "Repeat build IDs in order", true)],
    ),
    leaf(
      "delete <build-id>",
      "Delete one queued build and associated cancellation history",
      Permission.Update,
      (c, { args }) => c.deleteQueuedBuild(number(args, "build-id")),
    ),
    command("paused", "Change global queue pause state", [
      leaf(
        "set <status>",
        "Pause/resume with true/false and an explicit reason",
        Permission.Update,
        (c, { args, options }) =>
          c.setQueuePaused(booleanText(text(args, "status")) === "true", text(options, "reason")),
        [option("--reason <text>", "Non-secret reason", true)],
      ),
    ]),
    command("approval", "Inspect or approve one queued build as the current user", [
      leaf("show <build-id>", "Show minimal approval status", Permission.ReadOnly, (c, { args }) =>
        c.getQueueApproval(number(args, "build-id")),
      ),
      leaf(
        "approve <build-id>",
        "Approve only this build, not its whole chain",
        Permission.Update,
        (c, { args }) => c.approveQueuedBuild(number(args, "build-id")),
      ),
    ]),
  ];
  const agentTypes = command("types", "Inspect agent type identity", [
    leaf(
      "show <type-id>",
      "Show identity/cloud flag without environment or parameters",
      Permission.ReadOnly,
      (c, { args }) => c.getAgentType(number(args, "type-id")),
    ),
  ]);
  return { parameters, replaceAll, templates, jobs, projects, poolProjects, queue, agentTypes };
}
