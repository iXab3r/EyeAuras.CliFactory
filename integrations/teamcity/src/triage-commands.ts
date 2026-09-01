import {
  command,
  Permission,
  type CommandContext,
  type CommandDefinition,
  type OptionDefinition,
} from "@eyeauras/cli-factory";
import type { TeamCityClient } from "./client.js";
import { clientLeaf, option, text, repeatOption, jsonOption } from "./command-support.js";
import { booleanText } from "./advanced-authoring-models.js";

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
  const batchIds = repeatOption("--build <id>", "Repeat 1–100 unique explicit build IDs", true);
  const comment = option("--comment <text>", "Non-secret comment", true);
  const message = option("--text <text>", "Non-secret plain text; no service messages", true);
  const item = jsonOption("--item <json>", "Strict typed input; see integration guide");
  const items = jsonOption("--item <json>", "Repeat 1–100 strict typed items", true);
  const target = jsonOption("--target <json>", "One typed job/test/problem target");
  const builds = [
    command("batch", "Operate on an explicit bounded set; partial failures remain visible", [
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
        "Cancel selected builds, never requeue",
        Permission.Update,
        (c, { options }) => c.cancelBuildBatch(ids(options), text(options, "comment")),
        [batchIds, comment],
      ),
      leaf(
        "delete",
        "Delete selected builds/history/artifacts",
        Permission.Update,
        (c, { options }) => c.deleteBuildBatch(ids(options)),
        [batchIds],
      ),
      command("comment", "Change selected build comments", [
        leaf(
          "set",
          "Set comments",
          Permission.Update,
          (c, { options }) => c.setBuildBatchComment(ids(options), text(options, "text")),
          [batchIds, message],
        ),
        leaf(
          "clear",
          "Remove comments",
          Permission.Update,
          (c, { options }) => c.clearBuildBatchComment(ids(options)),
          [batchIds],
        ),
      ]),
      leaf(
        "pin",
        "Pin/unpin selected builds",
        Permission.Update,
        (c, { options }) =>
          c.pinBuildBatch(ids(options), booleanText(text(options, "status")) === "true"),
        [batchIds, option("--status <boolean>", "true or false", true)],
      ),
      command(
        "tags",
        "Change selected build tags",
        (["add", "remove"] as const).map((action) =>
          leaf(
            action,
            "Change explicit public tags",
            Permission.Update,
            (c, { options }) =>
              c.tagBuildBatch(ids(options), options.tag as string[], action === "remove"),
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
      "Invalidate final-parameter cache, not durable values",
      Permission.Update,
      (c, { args }) => c.resetBuildFinishCache(num(args, "id")),
    ),
    leaf(
      "finish <id>",
      "Request finish; returned timestamp is not completion proof",
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
        "Append text; rejects TeamCity service messages",
        Permission.Update,
        (c, { args, options }) => c.appendBuildLog(num(args, "id"), text(options, "text")),
        [message],
      ),
    ]),
    command("problem-occurrences", "Inspect or report build problems", [
      leaf(
        "list <id>",
        "List native unpaged problem occurrences",
        Permission.ReadOnly,
        (c, { args }) => c.listBuildOccurrences(num(args, "id"), "problem"),
      ),
      leaf(
        "add <id>",
        "Report a build problem using plain description",
        Permission.Update,
        (c, { args, options }) => c.addBuildProblem(num(args, "id"), text(options, "text")),
        [message],
      ),
    ]),
    leaf(
      "related-issues <id>",
      "Read related issue IDs, not URLs",
      Permission.ReadOnly,
      (c, { args }) => c.getBuildRelatedIssues(num(args, "id")),
    ),
    leaf(
      "start-agentless <id>",
      "Start a queued build without an agent; not resume",
      Permission.Update,
      (c, { args, options }) => c.startAgentlessBuild(num(args, "id"), text(options, "requestor")),
      [option("--requestor <text>", "Non-secret requestor label", true)],
    ),
    leaf(
      "set-status <id> <status>",
      "Set SUCCESS/FAILURE and report failure count",
      Permission.Update,
      (c, { args, options }) =>
        c.setBuildStatus(num(args, "id"), args.status, text(options, "comment")),
      [comment],
    ),
    leaf(
      "test-occurrences <id>",
      "List native unpaged test occurrences",
      Permission.ReadOnly,
      (c, { args }) => c.listBuildOccurrences(num(args, "id"), "test"),
    ),
    command("vcs-labels", "Inspect labels or label one external VCS root", [
      leaf(
        "list <id>",
        "Read labels with individual statuses",
        Permission.ReadOnly,
        (c, { args }) => c.getBuildVcsLabels(num(args, "id")),
      ),
      leaf(
        "add <id>",
        "Create external VCS label; HTTP success can contain failed labels",
        Permission.Update,
        (c, { args, options }) =>
          c.addBuildVcsLabel(
            num(args, "id"),
            text(options, "label"),
            text(options, "rootInstance"),
          ),
        [
          option("--label <text>", "Label", true),
          option("--root-instance <id>", "One VCS root instance", true),
        ],
      ),
    ]),
    ...(["output-parameters", "resulting-properties"] as const).map((kind) =>
      command(kind, "Runtime parameter names only; no values", [
        leaf(
          "list <id>",
          "List names, not values or type specifications",
          Permission.ReadOnly,
          (c, { args }) => c.listBuildRuntimeParameterNames(num(args, "id"), kind),
        ),
        leaf(
          "exists <id> <name>",
          "Probe endpoint and discard response; 404 remains an error",
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
    leaf("issues <id>", "Read issue IDs only", Permission.ReadOnly, (c, { args }) =>
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
      "Read root instance identity, no properties",
      Permission.ReadOnly,
      (c, { args }) => c.getChangeRootInstance(num(args, "id")),
    ),
    leaf(
      "field <id> <field>",
      "Read id/version/date/personal/comment",
      Permission.ReadOnly,
      (c, { args }) => c.getChangeField(num(args, "id"), args.field),
    ),
    leaf("attributes <id>", "Read attribute names only", Permission.ReadOnly, (c, { args }) =>
      c.listChangeAttributeNames(num(args, "id")),
    ),
  ];
  const investigations = command("investigations", "Assign typed job/test/problem investigations", [
    leaf(
      "list",
      "Read a bounded page",
      Permission.ReadOnly,
      (c, { options }) => c.listInvestigations(page(options)),
      pageOptions,
    ),
    leaf(
      "create",
      "Create one typed investigation",
      Permission.Update,
      (c, { options }) => c.createInvestigation(options.item),
      [item],
    ),
    leaf(
      "create-many",
      "Create an explicit bounded batch",
      Permission.Update,
      (c, { options }) => c.createInvestigations(options.item as unknown[]),
      [items],
    ),
    leaf(
      "show",
      "Read one typed target",
      Permission.ReadOnly,
      (c, { options }) => c.getInvestigation(options.target),
      [target],
    ),
    leaf(
      "replace",
      "Server removes then creates: not atomic; never retries",
      Permission.Update,
      (c, { options }) => c.createInvestigation(options.item, true),
      [item],
    ),
    leaf(
      "delete",
      "Delete one typed target investigation",
      Permission.Update,
      (c, { options }) => c.deleteInvestigation(options.target),
      [target],
    ),
  ]);
  const mutes = command("mutes", "Mute explicit tests/problems within one scope", [
    ...muteCommands,
    leaf(
      "list",
      "Read a bounded page",
      Permission.ReadOnly,
      (c, { options }) => c.listMutes(page(options)),
      pageOptions,
    ),
    leaf(
      "create",
      "Create one typed mute",
      Permission.Update,
      (c, { options }) => c.createMute(options.item),
      [item],
    ),
    leaf(
      "create-many",
      "Create an explicit bounded batch",
      Permission.Update,
      (c, { options }) => c.createMutes(options.item as unknown[]),
      [items],
    ),
    leaf("show <id>", "Read one mute", Permission.ReadOnly, (c, { args }) =>
      c.getMute(num(args, "id")),
    ),
    leaf(
      "delete <id>",
      "Unmute with optional plain comment",
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
        "Read one bounded page",
        Permission.ReadOnly,
        (c, { options }) => c.listTriageEntities(kind, page(options)),
        pageOptions,
      ),
      leaf(
        "show <id>",
        "Read one string identity, preserving long IDs",
        Permission.ReadOnly,
        (c, { args }) => c.getTriageEntity(kind, args.id),
      ),
      leaf(
        "occurrence <id>",
        "Read one build + test/problem occurrence",
        Permission.ReadOnly,
        (c, { args, options }) =>
          c.getTriageOccurrence(kind, args.id, num(options, "build")),
        [option("--build <id>", "Build ID", true)],
      ),
    ]),
  );
  return { builds, changes, roots: [investigations, mutes, ...entities] };
}
