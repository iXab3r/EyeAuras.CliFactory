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

const confirm = option("--confirm", "Confirm clearing this collection", true);
const strings = (values: Record<string, unknown>, key: string) => (values[key] ?? []) as string[];
const number = (values: Record<string, unknown>, key: string) => Number(text(values, key));
const itemOption: OptionDefinition = {
  ...jsonOption(
    "--item <json>",
    "Repeat a configuration item",
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
        "Replace all plain parameters",
        Permission.Update,
        (c, { args, options }) =>
          c.replaceAllParameters(
            owner,
            args["owner-id"],
            (options.property ?? []) as PlainProperty[],
          ),
        [propertyOption],
      ),
      leaf(
        "clear <owner-id>",
        "Delete all own parameters",
        Permission.Update,
        (c, { args }) => c.clearParameters(owner, args["owner-id"]),
        [confirm],
      ),
      ...parts.map((part) =>
        command(
          part === "type/rawValue" ? "raw-type" : part,
          "Inspect and change parameter metadata",
          [
            leaf(
              "show <owner-id> <name>",
              "Read parameter metadata",
              Permission.ReadOnly,
              (c, { args }) =>
                c.getParameterPart(owner, args["owner-id"], args.name, part),
            ),
            leaf(
              "set <owner-id> <name> <value>",
              "Set a parameter value or type",
              Permission.Update,
              (c, { args }) =>
                c.setParameterPart(
                  owner,
                  args["owner-id"],
                  args.name,
                  part,
                  args.value,
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
      "Replace the collection",
      Permission.Update,
      (c, { args, options }) =>
        c.replaceAllSettings(kind, args["owner-id"], (options.item ?? []) as unknown[]),
      [itemOption],
    );
  }
  const templates = [
    leaf(
      "replace-all <job-id>",
      "Replace template attachments in order",
      Permission.Update,
      (c, { args, options }) =>
        c.replaceTemplates(
          args["job-id"],
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
      "Detach all templates",
      Permission.Update,
      (c, { args, options }) =>
        c.clearTemplates(args["job-id"], options.inlineSettings === true),
      [confirm, option("--inline-settings", "Copy inherited settings locally before detaching")],
    ),
  ];
  const jobs = [
    leaf(
      "builds <job-id>",
      "List native scoped builds in server order",
      Permission.ReadOnly,
      (c, { args }) => c.listJobBuilds(args["job-id"]),
    ),
  ];
  const projects = [
    command("pools", "Manage project pool assignments", [
      leaf("list <project-id>", "List assigned pools", Permission.ReadOnly, (c, { args }) =>
        c.listProjectPools(args["project-id"]),
      ),
      leaf("assign <project-id> <pool-id>", "Assign one pool", Permission.Update, (c, { args }) =>
        c.assignProjectPool(args["project-id"], number(args, "pool-id")),
      ),
      leaf(
        "replace-all <project-id>",
        "Replace all pool assignments",
        Permission.Update,
        (c, { args, options }) =>
          c.replaceProjectPools(args["project-id"], strings(options, "pool").map(Number)),
        [repeatOption("--pool <id>", "Repeat pool IDs")],
      ),
      leaf(
        "unassign <project-id> <pool-id>",
        "Remove one pool assignment",
        Permission.Update,
        (c, { args }) => c.unassignProjectPool(args["project-id"], number(args, "pool-id")),
      ),
    ]),
    leaf(
      "branches <project-id>",
      "List branches",
      Permission.ReadOnly,
      (c, { args, options }) =>
        c.listProjectBranches(args["project-id"], {
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
          c.createProjectJob(args["project-id"], args["job-id"], text(options, "name")),
        [option("--name <name>", "Set the job name", true)],
      ),
    ]),
    command(
      "order",
      "Inspect or replace custom project ordering",
      (["jobs", "projects"] as const).map((kind) =>
        command(kind, "Manage child ordering", [
          leaf(
            "show <project-id>",
            "Read custom child order",
            Permission.ReadOnly,
            (c, { args }) => c.getProjectOrder(args["project-id"], kind),
          ),
          leaf(
            "set <project-id>",
            "Replace custom child order",
            Permission.Update,
            (c, { args, options }) =>
              c.setProjectOrder(args["project-id"], kind, strings(options, "id")),
            [repeatOption("--id <id>", "Repeat IDs in order")],
          ),
        ]),
      ),
    ),
  ];
  const poolProjects = [
    leaf(
      "replace-all <pool-id>",
      "Replace all assigned projects",
      Permission.Update,
      (c, { args, options }) =>
        c.replacePoolProjects(number(args, "pool-id"), strings(options, "project")),
      [repeatOption("--project <id>", "Repeat project IDs")],
    ),
    leaf(
      "clear <pool-id>",
      "Remove all project assignments",
      Permission.Update,
      (c, { args }) => c.clearPoolProjects(number(args, "pool-id")),
      [confirm],
    ),
  ];
  const queue = [
    leaf(
      "delete-page",
      "Delete one page of queued builds",
      Permission.Update,
      (c, { options }) =>
        c.deleteQueuePage(text(options, "job"), {
          limit: Number(options.limit),
          start: Number(options.start),
        }),
      [option("--job <job-id>", "Select one job", true), ...pageOptions, confirm],
    ),
    leaf(
      "reorder",
      "Reorder selected queued builds",
      Permission.Update,
      (c, { options }) => c.reorderQueue(strings(options, "build").map(Number)),
      [repeatOption("--build <id>", "Repeat build IDs in order", true)],
    ),
    leaf(
      "delete <build-id>",
      "Delete a queued build and cancellation history",
      Permission.Update,
      (c, { args }) => c.deleteQueuedBuild(number(args, "build-id")),
    ),
    command("paused", "Change global queue pause state", [
      leaf(
        "set <status>",
        "Set queue pause status",
        Permission.Update,
        (c, { args, options }) =>
          c.setQueuePaused(booleanText(args.status) === "true", text(options, "reason")),
        [option("--reason <text>", "Set the pause reason", true)],
      ),
    ]),
    command("approval", "Inspect and approve queued builds", [
      leaf("show <build-id>", "Show minimal approval status", Permission.ReadOnly, (c, { args }) =>
        c.getQueueApproval(number(args, "build-id")),
      ),
      leaf(
        "approve <build-id>",
        "Approve one queued build",
        Permission.Update,
        (c, { args }) => c.approveQueuedBuild(number(args, "build-id")),
      ),
    ]),
  ];
  const agentTypes = command("types", "Inspect agent type identity", [
    leaf(
      "show <type-id>",
      "Show agent type identity",
      Permission.ReadOnly,
      (c, { args }) => c.getAgentType(number(args, "type-id")),
    ),
  ]);
  return { parameters, replaceAll, templates, jobs, projects, poolProjects, queue, agentTypes };
}
