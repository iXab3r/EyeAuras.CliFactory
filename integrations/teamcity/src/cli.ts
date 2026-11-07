import {
  command,
  createCli,
  helpLayout,
  integerParser,
  Permission,
  tokenAuth,
  type CliApplication,
  type CliDefinition,
  type CliRuntime,
  type CommandContext,
  type OptionDefinition,
  type Profile,
} from "@eyeauras/cli-factory";
import { teamCityUrl, teamCityUrlHelp } from "./server-url.js";
import { TeamCityClient } from "./client.js";
import { createAuthoringCommands } from "./authoring-commands.js";
import { createOperatorCommands } from "./operator-commands.js";
import { createBulkConfigurationCommands } from "./bulk-configuration-commands.js";
import { createTriageCommands } from "./triage-commands.js";
import { createAdminCommands } from "./admin-commands.js";
import { adminCategories } from "./admin-models.js";
import { createInfrastructureCommands } from "./infrastructure-commands.js";
import { createSystemCommands } from "./system-commands.js";
import { createFileCommands } from "./file-commands.js";
import { clientLeaf, integerValue } from "./command-support.js";
import { projectTree, jobTable, agentTable, buildRecord, buildTable, problemTable, testTable, withView } from "./presentation.js";
import { createBuildFlowCommands } from "./build-flow.js";
import type {
  TeamCityBuildState,
  TeamCityBuildStatus,
  TeamCityTestStatus,
  TeamCityTriState,
} from "./models.js";

const pageOptions: readonly OptionDefinition[] = [
  {
    flags: "--limit <count>",
    description: "Limit returned results",
    defaultValue: 100,
    parse: integerParser({
      min: 0, max: Number.MAX_SAFE_INTEGER, signed: true,
      errorMessage: "TeamCity page limit must be a nonnegative safe integer.",
    }),
  },
  {
    flags: "--start <offset>",
    description: "Skip results by offset",
    defaultValue: 0,
    parse: integerParser({
      min: 0, max: Number.MAX_SAFE_INTEGER, signed: true,
      errorMessage: "Expected a non-negative integer within the safe integer range.",
    }),
  },
];

function profileUrl(profile: Profile): string {
  const value = profile.values.url;
  if (typeof value !== "string") {
    throw new Error(`Profile '${profile.name}' has no TeamCity URL.`);
  }
  return value;
}

async function client(context: CommandContext): Promise<TeamCityClient> {
  const guest = context.profile.values.guest === true;
  return new TeamCityClient({
    baseUrl: profileUrl(context.profile),
    ...(guest ? { guest: true } : { token: await context.secrets.require("token") }),
    fetch: context.fetch,
    signal: context.signal,
  });
}

function stringOption(options: Record<string, unknown>, name: string): string | undefined {
  const value = options[name];
  return typeof value === "string" ? value : undefined;
}

function numberOption(options: Record<string, unknown>, name: string): number | undefined {
  const value = options[name];
  return typeof value === "number" ? value : undefined;
}

function pageValues(options: Record<string, unknown>): { limit?: number; start?: number } {
  const limit = numberOption(options, "limit");
  const start = numberOption(options, "start");
  return {
    ...(limit === undefined ? {} : { limit }),
    ...(start === undefined ? {} : { start }),
  };
}

export function createTeamCityCli(runtime?: CliRuntime): CliApplication {
  return createCli(teamCityDefinition(runtime));
}

/** The declarations shared by terminal, JSON and RPC execution. */
export function teamCityDefinition(runtime?: CliRuntime): CliDefinition {
  const leaf = clientLeaf(client);
  const bulk = createBulkConfigurationCommands(client, pageOptions);
  const authoring = createAuthoringCommands(client, pageOptions, bulk);
  const files = createFileCommands(client);
  const system = createSystemCommands(client, pageOptions, files.avatar);
  const triage = createTriageCommands(client, pageOptions, system.mutes);
  const admin = createAdminCommands(client, pageOptions, system.users);
  const infrastructure = createInfrastructureCommands(client, pageOptions, files.instances);
  const operators = createOperatorCommands(client, pageOptions, bulk, triage, system.pools);
  const flow = createBuildFlowCommands(client);
  return {
    name: "teamcity-cli",
    description: "Work with TeamCity",
    examples: [
      "builds list --job Demo_Tests --branch main --limit 20",
      "builds show --job Demo_Tests --branch main --latest",
      "jobs run Demo_Tests --branch main --param env.MODE=test --wait --timeout 10m",
      "builds diagnose 101",
      "builds artifacts download 101 dist/app.zip --output app.zip",
    ],
    version: "0.7.0",
    applicationId: "teamcity-cli",
    permissions: { categories: adminCategories },
    profile: {
      fields: [
        {
          name: "url",
          flags: "--url <url>",
          description: teamCityUrlHelp,
          normalize: teamCityUrl,
          required: true,
        },
        {
          name: "guest",
          flags: "--guest",
          description: "Use TeamCity guest access without a token",
        },
        {
          name: "guest",
          flags: "--no-guest",
          description: "Use token authentication",
        },
      ],
      validate(values) {
        const url = values.url;
        if (url !== undefined) teamCityUrl(url);
        if (values.guest !== undefined && typeof values.guest !== "boolean") {
          throw new Error("TeamCity guest mode must be a boolean.");
        }
      },
    },
    auth: tokenAuth({
      env: "TEAMCITY_TOKEN",
      tokenSource: "TeamCity: My Settings & Tools > Access Tokens.",
      required: (profile) => profile.values.guest !== true,
      async validate({ profile, token, fetch, signal }) {
        return new TeamCityClient({
          baseUrl: profileUrl(profile),
          token,
          fetch,
          signal,
        }).currentUser();
      },
    }),
    commands: helpLayout([
      ["Everyday", ["builds", "jobs", "projects", "queue", "agents"]],
      ["Triage", ["changes", "investigations", "mutes", "tests", "problems"]],
    ], [
      command("server", "Inspect the TeamCity server", [
        ...admin.server,
        ...infrastructure.server,
        ...system.server,
        ...files.server,
        leaf(
          "status",
          "Show server version, role and clock",
          Permission.ReadOnly,
          (c) => c.getServerStatus(),
        ),
      ]),
      command("projects", "Work with TeamCity projects", helpLayout([["Everyday", ["list", "show"]]], [
        withView(projectTree, leaf(
          "list",
          "List projects",
          Permission.ReadOnly,
          (c, { options }) => {
            const parent = stringOption(options, "parent");
            return c.listProjects({
              ...(parent === undefined ? {} : { parent }),
              ...(options.includeArchived === true ? { includeArchived: true } : {}),
              ...pageValues(options),
            });
          },
          [
            { flags: "--parent <id>", description: "Limit projects to one parent project" },
            { flags: "--include-archived", description: "Include archived projects" },
            ...pageOptions,
          ],
        )),
        leaf(
          "show <id>",
          "Show one project",
          Permission.ReadOnly,
          (c, { args }) => c.getProject(args.id),
        ),
        ...authoring.projects,
        ...infrastructure.projects,
        ...system.projects,
        ...files.projects,
      ], "Configuration")),
      command("jobs", "Work with TeamCity build configurations", helpLayout([
        ["Everyday", ["list", "show", "run"]],
      ], [
        withView(jobTable, leaf(
          "list",
          "List jobs",
          Permission.ReadOnly,
          (c, { options }) => {
            const project = stringOption(options, "project");
            return c.listJobs({
              ...(project === undefined ? {} : { project }),
              ...pageValues(options),
            });
          },
          [
            { flags: "--project <id>", description: "Limit jobs to a TeamCity project" },
            ...pageOptions,
          ],
        )),
        leaf(
          "show <id>",
          "Show one job",
          Permission.ReadOnly,
          (c, { args }) => c.getJob(args.id),
        ),
        flow.run,
        ...authoring.jobs,
        ...system.jobs,
        ...files.jobs,
      ], "Configuration"), {
        examples: [
          "jobs list --project Demo",
          "jobs run Demo_Tests --branch main --param env.MODE=test --wait",
        ],
      }),
      command("builds", "Inspect and control TeamCity builds", helpLayout([
        ["Everyday", ["list", "show", "wait", "diagnose", "tests", "problems", "changes"]],
        ["Files", ["artifacts", "artifacts-path", "source", "icon", "aggregate-icon"]],
        ["Control", [
          "cancel", "batch", "tags", "pin", "comment", "number", "status-text", "log", "finish",
          "finish-at", "set-status", "start-agentless", "reset-finish-cache", "delete",
        ]],
      ], [
        ...operators.builds,
        ...files.builds,
        withView(buildTable, leaf(
          "list",
          "List queued, running and finished builds",
          Permission.ReadOnly,
          (c, { options }) => {
            const job = stringOption(options, "job");
            const project = stringOption(options, "project");
            const branch = stringOption(options, "branch");
            const state = stringOption(options, "state") as TeamCityBuildState | undefined;
            const status = stringOption(options, "status") as TeamCityBuildStatus | undefined;
            return c.listBuilds({
              ...(job === undefined ? {} : { job }),
              ...(project === undefined ? {} : { project }),
              ...(branch === undefined ? {} : { branch }),
              ...(state === undefined ? {} : { state }),
              ...(status === undefined ? {} : { status }),
              ...pageValues(options),
            });
          },
          [
            { flags: "--job <id>", description: "Limit builds to one job" },
            { flags: "--project <id>", description: "Limit builds to one affected project" },
            { flags: "--branch <name>", description: "Limit builds to one branch name" },
            {
              flags: "--state <state>",
              description: "Select queued, running, finished or any (default)",
            },
            {
              flags: "--status <status>",
              description: "Select SUCCESS, FAILURE or UNKNOWN",
            },
            ...pageOptions,
          ],
        )),
        flow.show,
        flow.wait,
        flow.diagnose,
        withView(testTable, leaf(
          "tests <id>",
          "List test occurrences for a build",
          Permission.ReadOnly,
          (c, { args, options }) => {
            const status = stringOption(options, "status") as TeamCityTestStatus | undefined;
            return c.listBuildTests(integerValue(args.id), {
              ...(status === undefined ? {} : { status }),
              ...pageValues(options),
            });
          },
          [
            {
              flags: "--status <status>",
              description: "Select failure, success, error, warning, normal or unknown",
            },
            ...pageOptions,
          ],
        )),
        withView(problemTable, leaf(
          "problems <id>",
          "List problem occurrences for a build",
          Permission.ReadOnly,
          (c, { args, options }) =>
            c.listBuildProblems(integerValue(args.id), pageValues(options)),
          pageOptions,
        )),
        leaf(
          "changes <id>",
          "List source changes associated with a build",
          Permission.ReadOnly,
          (c, { args, options }) =>
            c.listBuildChanges(integerValue(args.id), pageValues(options)),
          pageOptions,
        ),
        withView(buildRecord, leaf(
          "cancel <id>",
          "Cancel a running build",
          Permission.Update,
          (c, { args, options }) => {
            const comment = stringOption(options, "comment");
            return c.cancelBuild(integerValue(args.id), {
              ...(comment === undefined ? {} : { comment }),
            });
          },
          [{ flags: "--comment <text>", description: "Explain the cancellation" }],
        )),
      ], "Evidence"), {
        examples: [
          "builds list --job Demo_Tests --branch main --limit 20",
          "builds show --job Demo_Tests --branch main --latest",
          "builds wait 101 --timeout 10m",
          "builds diagnose 101",
          "builds artifacts list 101",
        ],
      }),
      command("queue", "Inspect and control the TeamCity build queue", helpLayout([
        ["Everyday", ["list", "show", "cancel"]],
      ], [
        ...operators.queue,
        withView(buildTable, leaf(
          "list",
          "List queued builds",
          Permission.ReadOnly,
          (c, { options }) => {
            const job = stringOption(options, "job");
            const project = stringOption(options, "project");
            return c.listQueue({
              ...(job === undefined ? {} : { job }),
              ...(project === undefined ? {} : { project }),
              ...pageValues(options),
            });
          },
          [
            { flags: "--job <id>", description: "Limit queued builds to one job" },
            { flags: "--project <id>", description: "Limit queued builds to one project" },
            ...pageOptions,
          ],
        )),
        withView(buildRecord, leaf(
          "cancel <id>",
          "Cancel a queued build",
          Permission.Update,
          (c, { args, options }) => {
            const comment = stringOption(options, "comment");
            return c.cancelQueuedBuild(integerValue(args.id), {
              ...(comment === undefined ? {} : { comment }),
            });
          },
          [{ flags: "--comment <text>", description: "Explain the cancellation" }],
        )),
      ], "Control")),
      command("agents", "Inspect TeamCity build agents", helpLayout([
        ["Everyday", ["list", "show"]],
      ], [
        ...operators.agents,
        withView(agentTable, leaf(
          "list",
          "List build agents",
          Permission.ReadOnly,
          (c, { options }) => {
            const connected = stringOption(options, "connected") as TeamCityTriState | undefined;
            const enabled = stringOption(options, "enabled") as TeamCityTriState | undefined;
            const authorized = stringOption(options, "authorized") as TeamCityTriState | undefined;
            return c.listAgents({
              ...(connected === undefined ? {} : { connected }),
              ...(enabled === undefined ? {} : { enabled }),
              ...(authorized === undefined ? {} : { authorized }),
              ...pageValues(options),
            });
          },
          [
            {
              flags: "--connected <value>",
              description: "Select true, false or any",
            },
            {
              flags: "--enabled <value>",
              description: "Select true, false or any",
            },
            {
              flags: "--authorized <value>",
              description: "Select true, false or any",
            },
            ...pageOptions,
          ],
        )),
        leaf(
          "show <id>",
          "Show one build agent",
          Permission.ReadOnly,
          (c, { args }) => c.getAgent(integerValue(args.id)),
        ),
      ], "Control")),
      command("vcs", "Inspect and configure version control", [
        command("roots", "Inspect VCS roots", [
          ...authoring.roots,
          ...files.roots,
          ...infrastructure.roots,
        ]),
        infrastructure.instances,
      ]),
      operators.pools,
      operators.changes,
      ...triage.roots,
      admin.users,
      admin.groups,
      ...infrastructure.rootsCommands,
      ...system.roots,
    ], "Administration"),
    ...(runtime === undefined ? {} : { runtime }),
  };
}
