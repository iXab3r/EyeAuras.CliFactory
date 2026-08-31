import {
  command,
  createCli,
  Permission,
  tokenAuth,
  type CliApplication,
  type CliRuntime,
  type CommandContext,
  type OptionDefinition,
  type Profile,
} from "@eyeauras/cli-factory";
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
import type {
  TeamCityBuildState,
  TeamCityBuildStatus,
  TeamCityTestStatus,
  TeamCityTriState,
} from "./models.js";

const pageOptions: readonly OptionDefinition[] = [
  {
    flags: "--limit <count>",
    description: "Maximum results to return (1-100)",
    defaultValue: 100,
    parse: pageLimit,
  },
  {
    flags: "--start <offset>",
    description: "Zero-based result offset",
    defaultValue: 0,
    parse: nonNegativeInteger,
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

function integer(value: string, description: string): number {
  if (!/^-?\d+$/.test(value)) {
    throw new Error(`${description} must be an integer.`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`${description} must be a safe integer.`);
  }
  return parsed;
}

function positiveInteger(value: string): number {
  const parsed = integer(value, "Expected value");
  if (parsed <= 0) {
    throw new Error("Expected a positive integer.");
  }
  return parsed;
}

function nonNegativeInteger(value: string): number {
  const parsed = integer(value, "Expected value");
  if (parsed < 0) {
    throw new Error("Expected a non-negative integer.");
  }
  return parsed;
}

function pageLimit(value: string): number {
  const parsed = integer(value, "TeamCity page limit");
  if (parsed < 1 || parsed > 100) {
    throw new Error("TeamCity page limit must be between 1 and 100.");
  }
  return parsed;
}

function oneOf<const T extends string>(
  description: string,
  values: readonly T[],
): (value: string) => T {
  return (value) => {
    if (!values.includes(value as T)) {
      throw new Error(`${description} must be one of: ${values.join(", ")}.`);
    }
    return value as T;
  };
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

const buildState = oneOf<TeamCityBuildState>("Build state", [
  "queued",
  "running",
  "finished",
  "any",
]);
const buildStatus = oneOf<TeamCityBuildStatus>("Build status", ["SUCCESS", "FAILURE", "UNKNOWN"]);
const testStatus = oneOf<TeamCityTestStatus>("Test status", [
  "unknown",
  "normal",
  "warning",
  "failure",
  "error",
  "success",
]);
const triState = oneOf<TeamCityTriState>("Agent filter", ["true", "false", "any"]);

export function createTeamCityCli(runtime?: CliRuntime): CliApplication {
  const bulk = createBulkConfigurationCommands(client, pageOptions);
  const authoring = createAuthoringCommands(client, pageOptions, bulk);
  const files = createFileCommands(client);
  const system = createSystemCommands(client, pageOptions, files.avatar);
  const triage = createTriageCommands(client, pageOptions, system.mutes);
  const admin = createAdminCommands(client, pageOptions, system.users);
  const infrastructure = createInfrastructureCommands(client, pageOptions, files.instances);
  const operators = createOperatorCommands(client, pageOptions, bulk, triage, system.pools);
  return createCli({
    name: "teamcity-cli",
    description: "AI-friendly access to TeamCity",
    version: "0.1.0",
    applicationId: "teamcity-cli",
    permissions: { categories: adminCategories },
    profile: {
      fields: [
        {
          name: "url",
          flags: "--url <url>",
          description: "TeamCity server URL",
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
        if (url !== undefined && (typeof url !== "string" || !/^https?:\/\//.test(url))) {
          throw new Error("A TeamCity profile URL must start with http:// or https://.");
        }
        if (values.guest !== undefined && typeof values.guest !== "boolean") {
          throw new Error("TeamCity guest mode must be a boolean.");
        }
      },
    },
    auth: tokenAuth({
      env: "TEAMCITY_TOKEN",
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
    commands: [
      command("server", "Inspect the TeamCity server", [
        ...admin.server,
        ...infrastructure.server,
        ...system.server,
        ...files.server,
        command(
          "status",
          "Show TeamCity version, role, and clock information",
          async (_input, context) => (await client(context)).getServerStatus(),
          { permission: Permission.ReadOnly },
        ),
      ]),
      command("projects", "Work with TeamCity projects", [
        command(
          "list",
          "List projects",
          async ({ options }, context) => {
            const parent = stringOption(options, "parent");
            return (await client(context)).listProjects({
              ...(parent === undefined ? {} : { parent }),
              ...(options.includeArchived === true ? { includeArchived: true } : {}),
              ...pageValues(options),
            });
          },
          {
            permission: Permission.ReadOnly,
            options: [
              { flags: "--parent <id>", description: "Limit projects to one parent project" },
              { flags: "--include-archived", description: "Include archived projects" },
              ...pageOptions,
            ],
          },
        ),
        command(
          "show <id>",
          "Show one project",
          async ({ args }, context) => (await client(context)).getProject(args.id),
          { permission: Permission.ReadOnly },
        ),
        ...authoring.projects,
        ...infrastructure.projects,
        ...system.projects,
        ...files.projects,
      ]),
      command("jobs", "Work with TeamCity build configurations", [
        command(
          "list",
          "List jobs",
          async ({ options }, context) => {
            const project = stringOption(options, "project");
            return (await client(context)).listJobs({
              ...(project === undefined ? {} : { project }),
              ...pageValues(options),
            });
          },
          {
            permission: Permission.ReadOnly,
            options: [
              { flags: "--project <id>", description: "Limit jobs to a TeamCity project" },
              ...pageOptions,
            ],
          },
        ),
        command(
          "show <id>",
          "Show one job",
          async ({ args }, context) => (await client(context)).getJob(args.id),
          { permission: Permission.ReadOnly },
        ),
        command(
          "status <id>",
          "Show the latest operational build status for a job",
          async ({ args }, context) => (await client(context)).getJobStatus(args.id),
          { permission: Permission.ReadOnly },
        ),
        command(
          "run <id>",
          "Queue a new build for a job",
          async ({ args, options }, context) => {
            const branch = stringOption(options, "branch");
            const comment = stringOption(options, "comment");
            return (await client(context)).runJob(args.id, {
              ...(branch === undefined ? {} : { branch }),
              ...(comment === undefined ? {} : { comment }),
            });
          },
          {
            permission: Permission.Update,
            options: [
              { flags: "--branch <name>", description: "Build a specific branch" },
              { flags: "--comment <text>", description: "Attach a queue comment" },
            ],
          },
        ),
        ...authoring.jobs,
        ...system.jobs,
        ...files.jobs,
      ]),
      command("builds", "Inspect and control TeamCity builds", [
        ...operators.builds,
        ...files.builds,
        command(
          "list",
          "List operational builds across all branches",
          async ({ options }, context) => {
            const job = stringOption(options, "job");
            const project = stringOption(options, "project");
            const state = stringOption(options, "state") as TeamCityBuildState | undefined;
            const status = stringOption(options, "status") as TeamCityBuildStatus | undefined;
            return (await client(context)).listBuilds({
              ...(job === undefined ? {} : { job }),
              ...(project === undefined ? {} : { project }),
              ...(state === undefined ? {} : { state }),
              ...(status === undefined ? {} : { status }),
              ...pageValues(options),
            });
          },
          {
            permission: Permission.ReadOnly,
            options: [
              { flags: "--job <id>", description: "Limit builds to one job" },
              { flags: "--project <id>", description: "Limit builds to one affected project" },
              {
                flags: "--state <state>",
                description: "queued, running, finished, or any",
                parse: buildState,
              },
              {
                flags: "--status <status>",
                description: "SUCCESS, FAILURE, or UNKNOWN",
                parse: buildStatus,
              },
              ...pageOptions,
            ],
          },
        ),
        command(
          "show <id>",
          "Show one build",
          async ({ args }, context) =>
            (await client(context)).getBuild(positiveInteger(args.id)),
          { permission: Permission.ReadOnly },
        ),
        command(
          "tests <id>",
          "List test occurrences for a build",
          async ({ args, options }, context) => {
            const status = stringOption(options, "status") as TeamCityTestStatus | undefined;
            return (await client(context)).listBuildTests(positiveInteger(args.id), {
              ...(status === undefined ? {} : { status }),
              ...pageValues(options),
            });
          },
          {
            permission: Permission.ReadOnly,
            options: [
              {
                flags: "--status <status>",
                description: "TeamCity test status",
                parse: testStatus,
              },
              ...pageOptions,
            ],
          },
        ),
        command(
          "problems <id>",
          "List problem occurrences for a build",
          async ({ args, options }, context) =>
            (await client(context)).listBuildProblems(
              positiveInteger(args.id),
              pageValues(options),
            ),
          { permission: Permission.ReadOnly, options: pageOptions },
        ),
        command(
          "changes <id>",
          "List source changes associated with a build",
          async ({ args, options }, context) =>
            (await client(context)).listBuildChanges(
              positiveInteger(args.id),
              pageValues(options),
            ),
          { permission: Permission.ReadOnly, options: pageOptions },
        ),
        command(
          "cancel <id>",
          "Cancel a running build",
          async ({ args, options }, context) => {
            const comment = stringOption(options, "comment");
            return (await client(context)).cancelBuild(positiveInteger(args.id), {
              ...(comment === undefined ? {} : { comment }),
            });
          },
          {
            permission: Permission.Update,
            options: [{ flags: "--comment <text>", description: "Explain the cancellation" }],
          },
        ),
      ]),
      command("queue", "Inspect and control the TeamCity build queue", [
        ...operators.queue,
        command(
          "list",
          "List queued builds",
          async ({ options }, context) => {
            const job = stringOption(options, "job");
            const project = stringOption(options, "project");
            return (await client(context)).listQueue({
              ...(job === undefined ? {} : { job }),
              ...(project === undefined ? {} : { project }),
              ...pageValues(options),
            });
          },
          {
            permission: Permission.ReadOnly,
            options: [
              { flags: "--job <id>", description: "Limit queued builds to one job" },
              { flags: "--project <id>", description: "Limit queued builds to one project" },
              ...pageOptions,
            ],
          },
        ),
        command(
          "cancel <id>",
          "Cancel a queued build",
          async ({ args, options }, context) => {
            const comment = stringOption(options, "comment");
            return (await client(context)).cancelQueuedBuild(positiveInteger(args.id), {
              ...(comment === undefined ? {} : { comment }),
            });
          },
          {
            permission: Permission.Update,
            options: [{ flags: "--comment <text>", description: "Explain the cancellation" }],
          },
        ),
      ]),
      command("agents", "Inspect TeamCity build agents", [
        ...operators.agents,
        command(
          "list",
          "List build agents",
          async ({ options }, context) => {
            const connected = stringOption(options, "connected") as TeamCityTriState | undefined;
            const enabled = stringOption(options, "enabled") as TeamCityTriState | undefined;
            const authorized = stringOption(options, "authorized") as TeamCityTriState | undefined;
            return (await client(context)).listAgents({
              ...(connected === undefined ? {} : { connected }),
              ...(enabled === undefined ? {} : { enabled }),
              ...(authorized === undefined ? {} : { authorized }),
              ...pageValues(options),
            });
          },
          {
            permission: Permission.ReadOnly,
            options: [
              {
                flags: "--connected <value>",
                description: "true, false, or any",
                parse: triState,
              },
              {
                flags: "--enabled <value>",
                description: "true, false, or any",
                parse: triState,
              },
              {
                flags: "--authorized <value>",
                description: "true, false, or any",
                parse: triState,
              },
              ...pageOptions,
            ],
          },
        ),
        command(
          "show <id>",
          "Show one build agent",
          async ({ args }, context) =>
            (await client(context)).getAgent(positiveInteger(args.id)),
          { permission: Permission.ReadOnly },
        ),
      ]),
      command("vcs", "Inspect and configure version control", [
        command("roots", "VCS root identities and configuration", [
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
    ],
    ...(runtime === undefined ? {} : { runtime }),
  });
}
