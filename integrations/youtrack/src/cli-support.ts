import {
  integerParser,
  jsonParser,
  targetCommands,
  type CommandContext,
  type CommandDefinition,
  type GatedTargetCommand,
  type OptionDefinition,
} from "@eyeauras/cli-factory";
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

export const {
  read: readCommand,
  update: updateCommand,
} = targetCommands(connection);

type PositionalValues<Text extends string> =
  Text extends `<${string}> ${infer Rest}` ? [string, ...PositionalValues<Rest>]
    : Text extends `<${string}>` ? [string]
      : [];
type CommandValues<Syntax extends string> =
  Syntax extends `${string} ${infer Arguments}` ? PositionalValues<Arguments> : [];

type ReadOperation<Syntax extends string> = (
  connection: Connection,
  ...arguments_: [...CommandValues<Syntax>, IssueSearchOptions]
) => unknown;

type BodyOperation<Syntax extends string> = (
  connection: Connection,
  ...arguments_: [...CommandValues<Syntax>, unknown]
) => unknown;

type ProjectedBodyOperation<Syntax extends string> = (
  connection: Connection,
  ...arguments_: [...CommandValues<Syntax>, unknown, IssueSearchOptions]
) => unknown;

function positionalNames(syntax: string): string[] {
  const tokens = syntax.split(" ").slice(1);
  const names = tokens.map((token) => /^<([A-Za-z][A-Za-z0-9_-]*)>$/.exec(token)?.[1]);
  if (names.some((name) => name === undefined)) {
    throw new Error("YouTrack operation helpers require only named positional arguments.");
  }
  return names as string[];
}

function positionalArguments(names: readonly string[], args: unknown): string[] {
  const values = args as Record<string, unknown>;
  return names.map((name) => String(values[name]));
}

type Operation = (...arguments_: never[]) => unknown;
type OperationOptions = (options: Record<string, unknown>) => unknown[];

function operationCommand<const Syntax extends string>(
  leaf: GatedTargetCommand<Connection>,
  syntax: Syntax,
  description: string,
  operation: Operation,
  options: readonly OptionDefinition[],
  operationOptions: OperationOptions,
): CommandDefinition {
  const names = positionalNames(syntax);
  return leaf(
    syntax,
    description,
    (connection, input) => Reflect.apply(operation, undefined, [
      connection,
      ...positionalArguments(names, input.args),
      ...operationOptions(input.options),
    ]),
    options,
  );
}

export function pagedRead<const Syntax extends string>(
  syntax: Syntax,
  description: string,
  operation: ReadOperation<Syntax>,
): CommandDefinition {
  return operationCommand(
    readCommand, syntax, description, operation, pageOptions,
    (options) => [readOptions(options)],
  );
}

export function projectedRead<const Syntax extends string>(
  syntax: Syntax,
  description: string,
  operation: ReadOperation<Syntax>,
): CommandDefinition {
  return operationCommand(
    readCommand, syntax, description, operation, projectionOptions,
    (options) => [readOptions(options)],
  );
}

export function bodyUpdate<const Syntax extends string>(
  syntax: Syntax,
  description: string,
  operation: BodyOperation<Syntax>,
): CommandDefinition {
  return operationCommand(
    updateCommand, syntax, description, operation, bodyOptions,
    (options) => [options.body],
  );
}

export function projectedBodyUpdate<const Syntax extends string>(
  syntax: Syntax,
  description: string,
  operation: ProjectedBodyOperation<Syntax>,
): CommandDefinition {
  return operationCommand(
    updateCommand, syntax, description, operation,
    [...bodyOptions, ...projectionOptions],
    (options) => [options.body, readOptions(options)],
  );
}

export function readOptions(options: Record<string, unknown>): IssueSearchOptions {
  return {
    ...(typeof options.fields === "string" ? { fields: options.fields } : {}),
    ...(typeof options.top === "number" ? { top: options.top } : {}),
    ...(typeof options.skip === "number" ? { skip: options.skip } : {}),
    ...(typeof options.query === "string" ? { query: options.query } : {}),
  };
}
