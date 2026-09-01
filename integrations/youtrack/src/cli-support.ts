import { integerParser, jsonParser, type CommandContext, type OptionDefinition } from "@eyeauras/cli-factory";
import { youTrackUrl, type Connection, type IssueSearchOptions } from "./client.js";

export const bodyOptions: readonly OptionDefinition[] = [
  {
    flags: "--body <json>",
    description: "Required JSON object containing this command's supported fields",
    required: true,
    parse: jsonParser("YouTrack body must be valid JSON."),
  },
];

export const projectionOptions: readonly OptionDefinition[] = [
  { flags: "--fields <projection>", description: "Explicit YouTrack fields projection" },
];
export const pageOptions: readonly OptionDefinition[] = [
  ...projectionOptions,
  {
    flags: "--top <count>", description: "Maximum results (1-100)", defaultValue: 50,
    parse: integerParser({
      min: 1, max: 100, signed: false,
      errorMessage: "YouTrack top must be a decimal integer between 1 and 100.",
    }),
  },
  {
    flags: "--skip <offset>", description: "Nonnegative result offset", defaultValue: 0,
    parse: integerParser({
      min: 0, max: Number.MAX_SAFE_INTEGER, signed: false,
      errorMessage: "YouTrack skip must be a nonnegative safe decimal integer.",
    }),
  },
];

export async function connection(context: CommandContext): Promise<Connection> {
  const baseUrl = youTrackUrl(context.profile.values.url);
  return {
    baseUrl,
    token: await context.secrets.require("token"),
    fetch: context.fetch,
    signal: context.signal,
  };
}

export function readOptions(options: Record<string, unknown>): IssueSearchOptions {
  return {
    ...(typeof options.fields === "string" ? { fields: options.fields } : {}),
    ...(typeof options.top === "number" ? { top: options.top } : {}),
    ...(typeof options.skip === "number" ? { skip: options.skip } : {}),
    ...(typeof options.query === "string" ? { query: options.query } : {}),
  };
}
