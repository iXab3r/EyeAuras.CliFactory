import { stringList, withView } from "./presentation.js";
import {
  CliError,
  command,
  Permission,
  type CommandContext,
  type CommandDefinition,
  type OptionDefinition,
} from "@eyeauras/cli-factory";
import type { TeamCityClient } from "./client.js";
import { clientLeaf, option, text, repeatOption, jsonOption } from "./command-support.js";
import { booleanText } from "./advanced-authoring-models.js";

/** A batch that partly failed keeps every item's result and exits non-zero. */
async function partial<T extends { count: number; errorCount: number }>(result: Promise<T>): Promise<T> {
  const value = await result;
  if (value.errorCount > 0) {
    throw new CliError(`${value.errorCount} of ${value.count} builds failed; see items.`, {
      code: "batch.partial", result: value,
    });
  }
  return value;
}

async function statusPartial<T extends { errorCount: number }>(result: Promise<T>): Promise<T> {
  const value = await result;
  if (value.errorCount > 0) {
    throw new CliError("The status changed with errors; see errorCount.", {
      code: "build.statusPartial", result: value,
    });
  }
  return value;
}

/** HTTP success can still contain failed labels. */
async function labelsPartial<T extends { status?: unknown }>(result: Promise<T[]>): Promise<T[]> {
  const labels = await result;
  if (labels.some((label) => label.status === "FAILED")) {
    throw new CliError("Some VCS labels failed; see their status.", {
      code: "labels.partial", result: labels,
    });
  }
  return labels;
}

export function createTriageCommands(
  clientFor: (context: CommandContext) => Promise<TeamCityClient>,
  pageOptions: readonly OptionDefinition[],
  muteCommands: readonly CommandDefinition[],
) {
  const leaf = clientLeaf(clientFor);
  const num = (values: Record<string, unknown>, key: string) => Number(text(values, key));
  const page = (options: Record<string, unknown>) => ({
    limit: Number(options.limit),
    start: Number(options.start),
  });
  const ids = (options: Record<string, unknown>) => ((options.build ?? []) as string[]).map(Number);
  const batchIds = repeatOption("--build <id>", "Repeat build IDs", true);
  const comment = option("--comment <text>", "Attach a comment", true);
  const message = option("--text <text>", "Supply build log text", true);
  const item = jsonOption("--item <json>", "Supply an input object");
  const items = jsonOption("--item <json>", "Supply an item; repeat for more", true);
  const target = jsonOption("--target <json>", "Select a job, test or problem target");
  const builds = [
    command("batch", "Operate on selected builds", [
      leaf(
        "status",
        "Read aggregate status",
        Permission.ReadOnly,
        (c, { options }) => c.getBuildBatchStatus(ids(options)),
        [batchIds],
      ),
      leaf(
        "show",
        "Read selected builds",
        Permission.ReadOnly,
        (c, { options }) => c.getBuildBatch(ids(options)),
        [batchIds],
      ),
      leaf(
        "cancel",
        "Cancel selected builds",
        Permission.Update,
        (c, { options }) => partial(c.cancelBuildBatch(ids(options), text(options, "comment"))),
        [batchIds, comment],
      ),
      leaf(
        "delete",
        "Delete selected builds and history",
        Permission.Update,
        (c, { options }) => partial(c.deleteBuildBatch(ids(options))),
        [batchIds],
      ),
      command("comment", "Change selected build comments", [
        leaf(
          "set",
          "Set comments",
          Permission.Update,
          (c, { options }) => partial(c.setBuildBatchComment(ids(options), text(options, "text"))),
          [batchIds, message],
        ),
        leaf(
          "clear",
          "Remove comments",
          Permission.Update,
          (c, { options }) => partial(c.clearBuildBatchComment(ids(options))),
          [batchIds],
        ),
      ]),
      leaf(
        "pin",
        "Pin/unpin selected builds",
        Permission.Update,
        (c, { options }) =>
          partial(c.pinBuildBatch(ids(options), booleanText(text(options, "status")) === "true")),
        [batchIds, option("--status <boolean>", "Set true or false", true)],
      ),
      command(
        "tags",
        "Change selected build tags",
        (["add", "remove"] as const).map((action) =>
          leaf(
            action,
            "Change public tags",
            Permission.Update,
            (c, { options }) =>
              partial(c.tagBuildBatch(ids(options), options.tag as string[], action === "remove")),
            [batchIds, repeatOption("--tag <name>", "Repeat public tags", true)],
          ),
        ),
      ),
    ]),
    leaf(
      "artifact-changes <id>",
      "Inspect changed artifact dependency builds",
      Permission.ReadOnly,
      (c, { args }) => c.getArtifactDependencyChanges(num(args, "id")),
    ),
    leaf(
      "reset-finish-cache <id>",
      "Reset the final-parameter cache",
      Permission.Update,
      (c, { args }) => c.resetBuildFinishCache(num(args, "id")),
    ),
    leaf(
      "finish <id>",
      "Request build completion",
      Permission.Update,
      (c, { args }) => c.finishBuild(num(args, "id")),
    ),
    leaf(
      "finish-at <id> <timestamp>",
      "Set finish time on a running build",
      Permission.Update,
      (c, { args }) => c.finishBuild(num(args, "id"), args.timestamp),
    ),
    command("log", "Append plain build log text", [
      leaf(
        "append <id>",
        "Append build log text",
        Permission.Update,
        (c, { args, options }) => c.appendBuildLog(num(args, "id"), text(options, "text")),
        [message],
      ),
    ]),
    command("problem-occurrences", "Inspect or report build problems", [
      leaf(
        "list <id>",
        "List problem occurrences",
        Permission.ReadOnly,
        (c, { args }) => c.listBuildOccurrences(num(args, "id"), "problem"),
      ),
      leaf(
        "add <id>",
        "Report a build problem",
        Permission.Update,
        (c, { args, options }) => c.addBuildProblem(num(args, "id"), text(options, "text")),
        [message],
      ),
    ]),
    leaf(
      "related-issues <id>",
      "Read related issue IDs",
      Permission.ReadOnly,
      (c, { args }) => c.getBuildRelatedIssues(num(args, "id")),
    ),
    leaf(
      "start-agentless <id>",
      "Start an agentless build",
      Permission.Update,
      (c, { args, options }) => c.startAgentlessBuild(num(args, "id"), text(options, "requestor")),
      [option("--requestor <text>", "Set the requestor label", true)],
    ),
    leaf(
      "set-status <id> <status>",
      "Set SUCCESS or FAILURE",
      Permission.Update,
      (c, { args, options }) =>
        statusPartial(c.setBuildStatus(num(args, "id"), args.status, text(options, "comment"))),
      [comment],
    ),
    leaf(
      "test-occurrences <id>",
      "List test occurrences",
      Permission.ReadOnly,
      (c, { args }) => c.listBuildOccurrences(num(args, "id"), "test"),
    ),
    command("vcs-labels", "Inspect and create VCS labels", [
      leaf(
        "list <id>",
        "Read labels with individual statuses",
        Permission.ReadOnly,
        (c, { args }) => c.getBuildVcsLabels(num(args, "id")),
      ),
      leaf(
        "add <id>",
        "Create a VCS label",
        Permission.Update,
        (c, { args, options }) =>
          labelsPartial(c.addBuildVcsLabel(
            num(args, "id"),
            text(options, "label"),
            text(options, "rootInstance"),
          )),
        [
          option("--label <text>", "Set the label", true),
          option("--root-instance <id>", "Select a VCS root instance", true),
        ],
      ),
    ]),
    ...(["output-parameters", "resulting-properties"] as const).map((kind) =>
      command(kind, "Inspect runtime parameter names", [
        withView(stringList, leaf(
          "list <id>",
          "List parameter names",
          Permission.ReadOnly,
          (c, { args }) => c.listBuildRuntimeParameterNames(num(args, "id"), kind),
        )),
        leaf(
          "exists <id> <name>",
          "Check parameter existence",
          Permission.ReadOnly,
          (c, { args }) => c.checkBuildRuntimeParameter(num(args, "id"), kind, args.name),
        ),
      ]),
    ),
  ];
  const changes = [
    leaf("duplicates <id>", "Read duplicate change metadata", Permission.ReadOnly, (c, { args }) =>
      c.getChangeDuplicates(num(args, "id")),
    ),
    leaf("first-builds <id>", "Read first containing builds", Permission.ReadOnly, (c, { args }) =>
      c.getChangeFirstBuilds(num(args, "id")),
    ),
    leaf("issues <id>", "Read issue IDs", Permission.ReadOnly, (c, { args }) =>
      c.getChangeIssues(num(args, "id")),
    ),
    leaf(
      "parent-revisions <id>",
      "Read parent revision strings",
      Permission.ReadOnly,
      (c, { args }) => c.getChangeParentRevisions(num(args, "id")),
    ),
    leaf(
      "root-instance <id>",
      "Read root instance identity",
      Permission.ReadOnly,
      (c, { args }) => c.getChangeRootInstance(num(args, "id")),
    ),
    leaf(
      "field <id> <field>",
      "Read id/version/date/personal/comment",
      Permission.ReadOnly,
      (c, { args }) => c.getChangeField(num(args, "id"), args.field),
    ),
    withView(stringList, leaf("attributes <id>", "Read attribute names only", Permission.ReadOnly, (c, { args }) =>
      c.listChangeAttributeNames(num(args, "id")),
    )),
  ];
  const investigations = command("investigations", "Assign job, test or problem investigations", [
    leaf(
      "list",
      "List results",
      Permission.ReadOnly,
      (c, { options }) => c.listInvestigations(page(options)),
      pageOptions,
    ),
    leaf(
      "create",
      "Create an investigation",
      Permission.Update,
      (c, { options }) => c.createInvestigation(options.item),
      [item],
    ),
    leaf(
      "create-many",
      "Create selected items",
      Permission.Update,
      (c, { options }) => c.createInvestigations(options.item as unknown[]),
      [items],
    ),
    leaf(
      "show",
      "Read one investigation target",
      Permission.ReadOnly,
      (c, { options }) => c.getInvestigation(options.target),
      [target],
    ),
    leaf(
      "replace",
      "Replace an investigation",
      Permission.Update,
      (c, { options }) => c.createInvestigation(options.item, true),
      [item],
    ),
    leaf(
      "delete",
      "Delete an investigation",
      Permission.Update,
      (c, { options }) => c.deleteInvestigation(options.target),
      [target],
    ),
  ]);
  const mutes = command("mutes", "Mute tests or problems within a scope", [
    ...muteCommands,
    leaf(
      "list",
      "List results",
      Permission.ReadOnly,
      (c, { options }) => c.listMutes(page(options)),
      pageOptions,
    ),
    leaf(
      "create",
      "Create a mute",
      Permission.Update,
      (c, { options }) => c.createMute(options.item),
      [item],
    ),
    leaf(
      "create-many",
      "Create selected items",
      Permission.Update,
      (c, { options }) => c.createMutes(options.item as unknown[]),
      [items],
    ),
    leaf("show <id>", "Read one mute", Permission.ReadOnly, (c, { args }) =>
      c.getMute(num(args, "id")),
    ),
    leaf(
      "delete <id>",
      "Unmute with an optional comment",
      Permission.Update,
      (c, { args, options }) =>
        c.deleteMute(
          num(args, "id"),
          typeof options.comment === "string" ? options.comment : undefined,
        ),
      [{ ...comment, required: false }],
    ),
  ]);
  const entities = (["test", "problem"] as const).map((kind) =>
    command(kind + "s", "Inspect identities and build occurrences", [
      leaf(
        "list",
        "List results",
        Permission.ReadOnly,
        (c, { options }) => c.listTriageEntities(kind, page(options)),
        pageOptions,
      ),
      leaf(
        "show <id>",
        "Read one identity",
        Permission.ReadOnly,
        (c, { args }) => c.getTriageEntity(kind, args.id),
      ),
      leaf(
        "occurrence <id>",
        "Read one build + test/problem occurrence",
        Permission.ReadOnly,
        (c, { args, options }) =>
          c.getTriageOccurrence(kind, args.id, num(options, "build")),
        [option("--build <id>", "Select a build", true)],
      ),
    ]),
  );
  return { builds, changes, roots: [investigations, mutes, ...entities] };
}
