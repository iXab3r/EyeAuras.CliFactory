import { readFile, stat } from "node:fs/promises";
import {
  integerParser,
  jsonParser,
  targetCommands,
  type CommandContext,
  type CommandDefinition,
  type GatedTargetCommand,
  type HumanView,
  type OptionDefinition,
} from "@eyeauras/cli-factory";
import { inputFilePath, page, youTrackUrl, type Connection, type IssueSearchOptions } from "./client.js";
import { withView } from "./presentation.js";

export const bodyOptions: readonly OptionDefinition[] = [
  {
    flags: "--body <json>",
    description: "JSON request body",
    required: true,
    parse: jsonParser("The body must be valid JSON."),
  },
];

export const fileOption = (flags: string, description: string, required = false): OptionDefinition => ({
  flags, description, required, parse: inputFilePath,
});

/** Read one caller-selected file as strict UTF-8 (initial BOM removed); call only inside an admitted handler. */
export async function readTextFile(path: string): Promise<string> {
  let bytes: Uint8Array;
  try {
    if (!(await stat(path)).isFile()) throw new Error();
    bytes = await readFile(path);
  } catch {
    throw new Error("The input file must be a readable regular file.");
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("The input file must be valid UTF-8.");
  }
}

/** Required `--body`, plus an optional `--<field>-file` that supplies one narrative property. */
function bodyInputOptions(textField?: string): readonly OptionDefinition[] {
  return textField === undefined ? bodyOptions : [
    ...bodyOptions,
    fileOption(`--${textField}-file <path>`, `UTF-8 file with the ${textField}`),
  ];
}

async function bodyInput(options: Record<string, unknown>, textField?: string): Promise<unknown> {
  const file = textField === undefined ? undefined : options[`${textField}File`];
  const body = options.body;
  if (typeof file !== "string") return body;
  if (body === null || typeof body !== "object" || Array.isArray(body)) throw new Error("The body must be a JSON object.");
  if (Object.hasOwn(body, textField!)) {
    throw new Error(`Give ${textField} in --body or in --${textField}-file, not both.`);
  }
  return { ...body, [textField!]: await readTextFile(file) };
}

export const projectionOptions: readonly OptionDefinition[] = [
  { flags: "--fields <projection>", description: "YouTrack fields projection" },
];
export const pageOptions: readonly OptionDefinition[] = [
  ...projectionOptions,
  {
    flags: "--page-size <count>", description: "Requested rows per page", defaultValue: 50,
    parse: integerParser({
      min: 0, max: Number.MAX_SAFE_INTEGER, signed: false,
      errorMessage: "--page-size must be a nonnegative safe decimal integer.",
    }),
  },
  {
    flags: "--start <offset>", description: "Zero-based result offset", defaultValue: 0,
    parse: integerParser({
      min: 0, max: Number.MAX_SAFE_INTEGER, signed: false,
      errorMessage: "--start must be a nonnegative integer.",
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
  read: readTarget,
  update: updateCommand,
} = targetCommands(connection);

/** Existing local admission hook validates paging before connection/auth resolution. */
export const readCommand: GatedTargetCommand<Connection> = (syntax, description, run, options) => {
  const definition = readTarget(syntax, description, run, options);
  if (!options?.some(option => option.flags.startsWith("--page-size "))) return definition;
  return { ...definition, additionalPermissions: ({ options }) => {
    page(readOptions(options), "");
    if ((options.all === true) !== (options.maxResults !== undefined)) {
      throw new Error("--all and --max-results go together.");
    }
    if (options.all === true && options.pageSize === 0) {
      throw new Error("--page-size must be positive with --all.");
    }
    return [];
  } };
};

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
    throw new Error("Operation helpers require named positional arguments only.");
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
  view?: HumanView,
): CommandDefinition {
  const names = positionalNames(syntax);
  const definition = leaf(
    syntax,
    description,
    async (connection, input) => Reflect.apply(operation, undefined, [
      connection,
      ...positionalArguments(names, input.args),
      ...await operationOptions(input.options),
    ]),
    options,
  );
  return view === undefined ? definition : withView(view, definition);
}

export function pagedRead<const Syntax extends string>(
  syntax: Syntax,
  description: string,
  operation: ReadOperation<Syntax>,
  view?: HumanView,
): CommandDefinition {
  return operationCommand(
    readCommand, syntax, description, operation, pageOptions,
    (options) => [readOptions(options)],
    view,
  );
}

export function projectedRead<const Syntax extends string>(
  syntax: Syntax,
  description: string,
  operation: ReadOperation<Syntax>,
  view?: HumanView,
): CommandDefinition {
  return operationCommand(
    readCommand, syntax, description, operation, projectionOptions,
    (options) => [readOptions(options)],
    view,
  );
}

export function bodyUpdate<const Syntax extends string>(
  syntax: Syntax,
  description: string,
  operation: BodyOperation<Syntax>,
  textField?: string,
  view?: HumanView,
): CommandDefinition {
  return operationCommand(
    updateCommand, syntax, description, operation, bodyInputOptions(textField),
    async (options) => [await bodyInput(options, textField)],
    view,
  );
}

export function projectedBodyUpdate<const Syntax extends string>(
  syntax: Syntax,
  description: string,
  operation: ProjectedBodyOperation<Syntax>,
  textField?: string,
  view?: HumanView,
): CommandDefinition {
  return operationCommand(
    updateCommand, syntax, description, operation,
    [...bodyInputOptions(textField), ...projectionOptions],
    async (options) => [await bodyInput(options, textField), readOptions(options)],
    view,
  );
}

export function readOptions(options: Record<string, unknown>): IssueSearchOptions {
  return {
    ...(typeof options.fields === "string" ? { fields: options.fields } : {}),
    ...(typeof options.pageSize === "number" ? { pageSize: options.pageSize } : {}),
    ...(typeof options.start === "number" ? { start: options.start } : {}),
    ...(typeof options.query === "string" ? { query: options.query } : {}),
    ...(typeof options.maxResults === "number" ? { maxResults: options.maxResults } : {}),
    ...(typeof options.maxBytes === "number" ? { maxBytes: options.maxBytes } : {}),
  };
}
