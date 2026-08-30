import { command, Permission, type OptionDefinition } from "@eyeauras/cli-factory";
import { requiredText } from "./client.js";
import { connection, pageOptions, projectionOptions, readOptions } from "./cli-support.js";
import {
  applyCommands,
  assistCommands,
  assistSearch,
  countIssues,
  getSavedQuery,
  listSavedQueries,
  parseIssueSelection,
  type AssistOptions,
} from "./issue-query.js";

const queryOptions: readonly OptionDefinition[] = [
  ...projectionOptions,
  {
    flags: "--query <query>",
    description: "Required YouTrack query text",
    required: true,
    parse: (value) => requiredText(value, "query"),
  },
];

const issueOption: OptionDefinition = {
  flags: "--issues <ids>",
  description: "1–20 comma-separated explicit issue IDs, never a search query",
  parse: parseIssueSelection,
};

const assistOptions: readonly OptionDefinition[] = [
  ...queryOptions,
  {
    flags: "--caret <position>",
    description: "Caret position from zero through the query length",
    parse: (value) => {
      if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) {
        throw new Error("YouTrack caret must be a nonnegative safe integer.");
      }
      return Number(value);
    },
  },
];

function assistInput(options: Record<string, unknown>): AssistOptions {
  return {
    ...readOptions(options),
    query: String(options.query),
    ...(typeof options.caret === "number" ? { caret: options.caret } : {}),
  };
}

export const queryRootCommands = [
  command("commands", "Apply issue commands or inspect command suggestions", [
    command(
      "apply",
      "Apply a command to 1–20 explicitly selected issues",
      async ({ options }, context) => applyCommands(
        await connection(context),
        String(options.query),
        options.issues as string[],
        readOptions(options),
      ),
      {
        permission: Permission.Update,
        options: [...queryOptions, { ...issueOption, required: true }],
      },
    ),
    command(
      "assist",
      "Get command suggestions; this does not execute or guarantee a later command",
      async ({ options }, context) => assistCommands(await connection(context), {
        ...assistInput(options),
        ...(options.issues === undefined ? {} : { issues: options.issues as string[] }),
      }),
      {
        permission: Permission.ReadOnly,
        options: [...assistOptions, issueOption],
      },
    ),
  ]),
  command("search", "Inspect YouTrack search suggestions", [
    command(
      "assist",
      "Get completions for a search query",
      async ({ options }, context) => assistSearch(await connection(context), assistInput(options)),
      {
        permission: Permission.ReadOnly,
        options: assistOptions,
      },
    ),
  ]),
  command("saved-queries", "Read saved YouTrack searches", [
    command(
      "list",
      "List one page of visible saved searches",
      async ({ options }, context) => listSavedQueries(await connection(context), readOptions(options)),
      {
        permission: Permission.ReadOnly,
        options: pageOptions,
      },
    ),
    command(
      "get <queryID>",
      "Read a saved search by database ID",
      async ({ args, options }, context) => getSavedQuery(
        await connection(context),
        args.queryID,
        readOptions(options),
      ),
      {
        permission: Permission.ReadOnly,
        options: projectionOptions,
      },
    ),
  ]),
];

export const queryIssueChildren = [
  command(
    "count",
    "Count a search once; -1 means counting is pending",
    async ({ options }, context) => countIssues(
      await connection(context),
      String(options.query),
      readOptions(options),
    ),
    {
      permission: Permission.ReadOnly,
      options: queryOptions,
    },
  ),
];
