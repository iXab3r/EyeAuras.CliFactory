import {
  command,
  createCli,
  Permission,
  tokenAuth,
  type CliApplication,
  type CliRuntime,
  type CommandContext,
  type Profile,
} from "@eyeauras/cli-factory";
import { TeamCityClient } from "./client.js";

const defaultUrl = "https://teamcity.example.com";

function profileUrl(profile: Profile): string {
  const value = profile.values.url;
  if (typeof value !== "string") {
    throw new Error(`Profile '${profile.name}' has no TeamCity URL.`);
  }
  return value;
}

async function client(context: CommandContext): Promise<TeamCityClient> {
  return new TeamCityClient({
    baseUrl: profileUrl(context.profile),
    token: await context.secrets.require("token"),
    fetch: context.fetch,
    signal: context.signal,
  });
}

function positiveInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error("Expected a positive integer.");
  }
  return parsed;
}

export function createTeamCityCli(runtime?: CliRuntime): CliApplication {
  return createCli({
    name: "teamcity-cli",
    description: "AI-friendly access to TeamCity",
    version: "0.1.0",
    applicationId: "teamcity-cli",
    permissions: {},
    profile: {
      defaults: { url: defaultUrl },
      fields: [{ name: "url", flags: "--url <url>", description: "TeamCity server URL" }],
      validate(values) {
        const url = values.url;
        if (typeof url !== "string" || !/^https?:\/\//.test(url)) {
          throw new Error("A TeamCity profile URL must start with http:// or https://.");
        }
      },
    },
    auth: tokenAuth({
      env: "TEAMCITY_TOKEN",
      async validate({ profile, token, fetch, signal }) {
        return new TeamCityClient({ baseUrl: profileUrl(profile), token, fetch, signal }).currentUser();
      },
    }),
    commands: [
      command("jobs", "Work with TeamCity build configurations", [
        command(
          "list",
          "List jobs",
          async ({ options }, context) =>
            (await client(context)).listJobs({
              ...(typeof options.project === "string" ? { project: options.project } : {}),
              ...(typeof options.limit === "number" ? { limit: options.limit } : {}),
            }),
          {
            permission: Permission.ReadOnly,
            options: [
              { flags: "--project <id>", description: "Limit jobs to a TeamCity project" },
              {
                flags: "--limit <count>",
                description: "Maximum number of jobs",
                defaultValue: 100,
                parse: (value) => positiveInteger(value),
              },
            ],
          },
        ),
        command(
          "show <id>",
          "Show one job",
          async ({ args }, context) => (await client(context)).getJob(String(args.id)),
          { permission: Permission.ReadOnly },
        ),
        command(
          "status <id>",
          "Show the latest build status for a job",
          async ({ args }, context) => (await client(context)).getJobStatus(String(args.id)),
          { permission: Permission.ReadOnly },
        ),
      ]),
    ],
    ...(runtime === undefined ? {} : { runtime }),
  });
}
