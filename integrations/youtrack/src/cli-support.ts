import { readFile, stat } from "node:fs/promises";
import {
  integerParser,
  jsonParser,
  targetCommands,
  type CommandContext,
  type CommandDefinition,
  type GatedTargetCommand,
  type OptionDefinition,
} from "@eyeauras/cli-factory";
import { requiredText, youTrackUrl, type Connection, type IssueSearchOptions } from "./client.js";

export const bodyOptions: readonly OptionDefinition[] = [
  {
    flags: "--body <json>",
    description: "Required JSON object containing this command's supported fields",
    required: true,
    parse: jsonParser("YouTrack body must be valid JSON."),
  },
];

export const fileOption = (flags: string, description: string, required = false): OptionDefinition => ({
  flags, description, required, parse: (value) => requiredText(value, "file path"),
});

/** Read one caller-selected file as strict UTF-8 (initial BOM removed); call only inside an admitted handler. */
export async function readTextFile(path: string): Promise<string> {
  let bytes: Uint8Array;
  try {
    if (!(await stat(path)).isFile()) throw new Error();
    bytes = await readFile(path);
  } catch {
    throw new Error("YouTrack input file must be a readable regular file.");
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("YouTrack input file must be valid UTF-8.");
  }
}

/** Required `--body`, plus an optional `--<field>-file` that supplies one narrative property. */
function bodyInputOptions(textField?: string): readonly OptionDefinition[] {
  return textField === undefined ? bodyOptions : [
    ...bodyOptions,
    fileOption(`--${textField}-file <path>`, `UTF-8 file supplying ${textField}; use --body '{}' when it is the only field`),
  ];
}

async function bodyInput(options: Record<string, unknown>, textField?: string): Promise<unknown> {
  const file = textField === undefined ? undefined : options[`${textField}File`];
  const body = options.body;
  if (typeof file !== "string") return body;
  if (body === null || typeof body !== "object" || Array.isArray(body)) throw new Error("YouTrack body must be a JSON object.");
  if (Object.hasOwn(body, textField!)) {
    throw new Error(`YouTrack ${textField} must come from either --body or --${textField}-file.`);
  }
  return { ...body, [textField!]: await readTextFile(file) };
}

export const projectionOptions: readonly OptionDefinition[] = [
  { flags: "--fields <projection>", description: "Explicit YouTrack fields projection" },
];
export const pageOptions: readonly OptionDefinition[] = [
  ...projectionOptions,
  {
    flags: "--top <count>", description: "Maximum results (positive safe integer)", defaultValue: 50,
    parse: integerParser({
      min: 1, max: Number.MAX_SAFE_INTEGER, signed: false,
      errorMessage: "YouTrack top must be a positive safe decimal integer.",
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
type OperationOptions = (options: Record<string, unknown>) => unknown[] | Promise<unknown[]>;

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
    async (connection, input) => Reflect.apply(operation, undefined, [
      connection,
      ...positionalArguments(names, input.args),
      ...await operationOptions(input.options),
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
  textField?: string,
): CommandDefinition {
  return operationCommand(
    updateCommand, syntax, description, operation, bodyInputOptions(textField),
    async (options) => [await bodyInput(options, textField)],
  );
}

export function projectedBodyUpdate<const Syntax extends string>(
  syntax: Syntax,
  description: string,
  operation: ProjectedBodyOperation<Syntax>,
  textField?: string,
): CommandDefinition {
  return operationCommand(
    updateCommand, syntax, description, operation,
    [...bodyInputOptions(textField), ...projectionOptions],
    async (options) => [await bodyInput(options, textField), readOptions(options)],
  );
}

export function readOptions(options: Record<string, unknown>): IssueSearchOptions {
  return {
    ...(typeof options.fields === "string" ? { fields: options.fields } : {}),
    ...(typeof options.top === "number" ? { top: options.top } : {}),
    ...(typeof options.skip === "number" ? { skip: options.skip } : {}),
    ...(typeof options.query === "string" ? { query: options.query } : {}),
    ...(typeof options.maxResults === "number" ? { maxResults: options.maxResults } : {}),
    ...(typeof options.maxBytes === "number" ? { maxBytes: options.maxBytes } : {}),
  };
}
