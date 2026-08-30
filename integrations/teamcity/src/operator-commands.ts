import {
  command,
  Permission,
  type CommandContext,
  type CommandDefinition,
  type OptionDefinition,
} from "@eyeauras/cli-factory";
import type { TeamCityClient } from "./client.js";
import { clientLeaf, option, text, repeatOption } from "./command-support.js";
import type { createBulkConfigurationCommands } from "./bulk-configuration-commands.js";
import type { createTriageCommands } from "./triage-commands.js";
import { booleanText, allowedField } from "./advanced-authoring-models.js";
import { requiredText } from "./locator.js";

function number(args: Record<string, unknown>, key: string): number {
  return Number(requiredText(text(args, key), key));
}
function comment(options: Record<string, unknown>): string | undefined {
  return typeof options.comment === "string" ? options.comment : undefined;
}

export function createOperatorCommands(
  clientFor: (context: CommandContext) => Promise<TeamCityClient>,
  pageOptions: readonly OptionDefinition[],
  bulk: ReturnType<typeof createBulkConfigurationCommands>,
  triage: ReturnType<typeof createTriageCommands>,
  poolCommands: readonly CommandDefinition[],
) {
  const leaf = clientLeaf(clientFor);
  const paging = (options: Record<string, unknown>) => ({
    limit: Number(options.limit),
    start: Number(options.start),
  });
  const commentOption = option("--comment <text>", "Non-secret action comment");
  const pools = command("pools", "Inspect and manage agent pools", [
    ...poolCommands,
    leaf(
      "list",
      "List a bounded page of pools",
      Permission.ReadOnly,
      (c, { options }) => c.listPools(paging(options)),
      pageOptions,
    ),
    leaf("show <pool-id>", "Show pool identity", Permission.ReadOnly, (c, { args }) =>
      c.getPool(number(args, "pool-id")),
    ),
    leaf(
      "create",
      "Create a pool",
      Permission.Update,
      (c, { options }) => c.createPool(text(options, "name")),
      [option("--name <name>", "Pool name", true)],
    ),
    leaf(
      "delete <pool-id>",
      "Delete one pool; never default pool 0",
      Permission.Update,
      (c, { args }) => c.deletePool(number(args, "pool-id")),
    ),
    command("fields", "Read/set pool name", [
      leaf("show <pool-id> <field>", "Read name", Permission.ReadOnly, (c, { args }) =>
        c.getPoolField(number(args, "pool-id"), text(args, "field")),
      ),
      leaf("set <pool-id> <field> <value>", "Set name", Permission.Update, (c, { args }) =>
        c.setPoolField(number(args, "pool-id"), text(args, "field"), text(args, "value")),
      ),
    ]),
    command("agents", "Manage agents assigned to a pool", [
      leaf(
        "list <pool-id>",
        "List a bounded page of assigned agents",
        Permission.ReadOnly,
        (c, { args, options }) => c.listPoolAgents(number(args, "pool-id"), paging(options)),
        pageOptions,
      ),
      leaf(
        "assign <pool-id> <agent-id>",
        "Move an agent to this pool",
        Permission.Update,
        (c, { args }) => c.assignPoolAgent(number(args, "pool-id"), number(args, "agent-id")),
      ),
    ]),
    command("projects", "Manage pool/project membership", [
      ...bulk.poolProjects,
      leaf(
        "list <pool-id>",
        "List assigned projects in server order",
        Permission.ReadOnly,
        (c, { args }) => c.listPoolProjects(number(args, "pool-id")),
      ),
      leaf(
        "assign <pool-id> <project-id>",
        "Assign a project to the pool",
        Permission.Update,
        (c, { args }) => c.assignPoolProject(number(args, "pool-id"), text(args, "project-id")),
      ),
      leaf(
        "unassign <pool-id> <project-id>",
        "Remove membership; never delete the project",
        Permission.Update,
        (c, { args }) => c.unassignPoolProject(number(args, "pool-id"), text(args, "project-id")),
      ),
    ]),
  ]);
  function agentStatus(kind: "enabled" | "authorized") {
    return command(kind, `Manage agent ${kind} status`, [
      leaf(
        "show <agent-id>",
        "Show status and safe comment metadata",
        Permission.ReadOnly,
        (c, { args }) => c.getAgentStatus(number(args, "agent-id"), kind),
      ),
      leaf(
        "set <agent-id> <status>",
        "Set true/false; changes remote agent eligibility",
        Permission.Update,
        (c, { args, options }) =>
          c.setAgentStatus(
            number(args, "agent-id"),
            kind,
            booleanText(text(args, "status")) === "true",
            comment(options),
          ),
        [commentOption],
      ),
    ]);
  }
  const agents = [
    bulk.agentTypes,
    agentStatus("enabled"),
    agentStatus("authorized"),
    leaf(
      "delete <agent-id>",
      "Delete one inactive agent; server validates inactivity",
      Permission.Update,
      (c, { args }) => c.deleteAgent(number(args, "agent-id")),
    ),
    leaf(
      "compatible-jobs <agent-id>",
      "List compatible build configurations",
      Permission.ReadOnly,
      (c, { args }) => c.listAgentCompatibleJobs(number(args, "agent-id")),
    ),
    leaf(
      "incompatible-jobs <agent-id>",
      "List incompatible jobs without raw requirement data",
      Permission.ReadOnly,
      (c, { args }) => c.listAgentIncompatibleJobs(number(args, "agent-id")),
    ),
    command("policy", "Manage allowed build configurations", [
      leaf("show <agent-id>", "Show policy and selected jobs", Permission.ReadOnly, (c, { args }) =>
        c.getAgentPolicy(number(args, "agent-id")),
      ),
      leaf(
        "set <agent-id> <policy>",
        "Replace policy: any or selected; empty selected allows no jobs",
        Permission.Update,
        (c, { args, options }) =>
          c.setAgentPolicy(
            number(args, "agent-id"),
            text(args, "policy"),
            (options.job ?? []) as string[],
          ),
        [repeatOption("--job <job-id>", "Repeat for selected jobs; forbidden with any")],
      ),
    ]),
    command("pool", "Inspect or move pool membership", [
      leaf(
        "show <agent-id>",
        "Show pool identity, or null if absent",
        Permission.ReadOnly,
        (c, { args }) => c.getAgentPool(number(args, "agent-id")),
      ),
      leaf(
        "set <agent-id> <pool-id>",
        "Move the agent to a pool",
        Permission.Update,
        (c, { args }) => c.setAgentPool(number(args, "agent-id"), number(args, "pool-id")),
      ),
    ]),
    command("fields", "Read safe agent fields; set enabled/authorized only", [
      leaf(
        "show <agent-id> <field>",
        "Read id, name, connected, enabled or authorized",
        Permission.ReadOnly,
        (c, { args }) => c.getAgentField(number(args, "agent-id"), text(args, "field")),
      ),
      leaf(
        "set <agent-id> <field> <value>",
        "Set enabled or authorized to true/false",
        Permission.Update,
        (c, { args }) =>
          c.setAgentField(number(args, "agent-id"), text(args, "field"), text(args, "value")),
      ),
    ]),
  ];
  function tags(owner: "builds" | "queue") {
    const tagOption = repeatOption("--tag <tag>", "Repeat for each public, non-secret tag", true);
    return command("tags", "Inspect or change public tags", [
      leaf("list <build-id>", "List public tags", Permission.ReadOnly, (c, { args }) =>
        c.listTags(owner, number(args, "build-id")),
      ),
      leaf(
        "add <build-id>",
        "Add tags without removing others",
        Permission.Update,
        (c, { args, options }) =>
          c.addTags(owner, number(args, "build-id"), (options.tag ?? []) as string[]),
        [tagOption],
      ),
      ...(owner === "builds"
        ? [
            leaf(
              "replace <build-id>",
              "Replace public tags; no --tag clears all public tags",
              Permission.Update,
              (c, { args, options }) =>
                c.replaceBuildTags(number(args, "build-id"), (options.tag ?? []) as string[]),
              [{ ...tagOption, required: false }],
            ),
          ]
        : []),
    ]);
  }
  const queue = [
    ...bulk.queue,
    tags("queue"),
    leaf("show <build-id>", "Show one queued build", Permission.ReadOnly, (c, { args }) =>
      c.getQueuedBuild(number(args, "build-id")),
    ),
    leaf(
      "compatible-agents <build-id>",
      "List compatible agent identities",
      Permission.ReadOnly,
      (c, { args }) => c.listQueueCompatibleAgents(number(args, "build-id")),
    ),
    command("position", "Inspect positions or move a queued build", [
      leaf(
        "show <position>",
        "Show build at a positive position, first or last",
        Permission.ReadOnly,
        (c, { args }) => c.getQueuePosition(text(args, "position")),
      ),
      leaf(
        "set <position>",
        "Move a build to 1, first or last only",
        Permission.Update,
        (c, { args, options }) =>
          c.setQueuePosition(text(args, "position"), number(options, "build")),
        [option("--build <build-id>", "Queued build ID", true)],
      ),
    ]),
  ];
  function buildScalar(field: "number" | "statusText", group: string) {
    return command(group, "Inspect or change a running build's display metadata", [
      leaf("show <build-id>", "Read the value", Permission.ReadOnly, (c, { args }) =>
        c.getBuildScalar(number(args, "build-id"), field),
      ),
      leaf(
        "set <build-id> <value>",
        "Set the value; server requires a running build",
        Permission.Update,
        (c, { args }) => c.setBuildScalar(number(args, "build-id"), field, text(args, "value")),
      ),
    ]);
  }
  const builds = [
    ...triage.builds,
    tags("builds"),
    buildScalar("number", "number"),
    buildScalar("statusText", "status-text"),
    leaf(
      "delete <build-id>",
      "Delete one build including server-owned history/artifacts",
      Permission.Update,
      (c, { args }) => c.deleteBuild(number(args, "build-id")),
    ),
    leaf("status <build-id>", "Read build status", Permission.ReadOnly, (c, { args }) =>
      c.getBuildScalar(number(args, "build-id"), "status"),
    ),
    leaf("finish-date <build-id>", "Read finish date", Permission.ReadOnly, (c, { args }) =>
      c.getBuildScalar(number(args, "build-id"), "finishDate"),
    ),
    leaf(
      "canceled-info <build-id>",
      "Read cancellation comment, or null if absent",
      Permission.ReadOnly,
      (c, { args }) => c.getBuildCanceledInfo(number(args, "build-id")),
    ),
    command("comment", "Change a build comment", [
      leaf(
        "set <build-id>",
        "Replace the non-secret comment",
        Permission.Update,
        (c, { args, options }) =>
          c.setBuildComment(number(args, "build-id"), text(options, "text")),
        [option("--text <text>", "Comment text", true)],
      ),
      leaf("clear <build-id>", "Remove the comment", Permission.Update, (c, { args }) =>
        c.clearBuildComment(number(args, "build-id")),
      ),
    ]),
    command("pin", "Inspect or change pinned status", [
      leaf(
        "show <build-id>",
        "Show pinned status and comment",
        Permission.ReadOnly,
        (c, { args }) => c.getBuildPin(number(args, "build-id")),
      ),
      leaf(
        "set <build-id> <status>",
        "Pin/unpin with true/false",
        Permission.Update,
        (c, { args, options }) =>
          c.setBuildPin(
            number(args, "build-id"),
            booleanText(text(args, "status")) === "true",
            comment(options),
          ),
        [commentOption],
      ),
    ]),
    command("statistics", "Read statistics without losing numeric precision", [
      leaf(
        "list <build-id>",
        "List named numeric text values",
        Permission.ReadOnly,
        (c, { args }) => c.listBuildStatistics(number(args, "build-id")),
      ),
      leaf(
        "show <build-id> <name>",
        "Read one statistic as numeric text",
        Permission.ReadOnly,
        (c, { args }) => c.getBuildStatistic(number(args, "build-id"), text(args, "name")),
      ),
    ]),
    command("fields", "Read id, buildTypeId, state or branchName", [
      leaf(
        "show <build-id> <field>",
        "Read an allowed build field",
        Permission.ReadOnly,
        (c, { args }) =>
          c.getBuildScalar(
            number(args, "build-id"),
            allowedField(text(args, "field"), ["id", "buildTypeId", "state", "branchName"]),
          ),
      ),
    ]),
  ];
  const changes = command("changes", "Inspect VCS change metadata without source files", [
    ...triage.changes,
    leaf("show <change-id>", "Show a change", Permission.ReadOnly, (c, { args }) =>
      c.getChange(number(args, "change-id")),
    ),
    leaf(
      "parents <change-id>",
      "List direct parent changes in server order",
      Permission.ReadOnly,
      (c, { args }) => c.listChangeParents(number(args, "change-id")),
    ),
  ]);
  return { pools, agents, queue, builds, changes };
}
