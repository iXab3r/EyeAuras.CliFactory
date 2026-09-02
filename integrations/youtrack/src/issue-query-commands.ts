import { command, type OptionDefinition } from "@eyeauras/cli-factory";
import { requiredText } from "./client.js";
import { pagedRead, projectedRead, readCommand, updateCommand, projectionOptions, readOptions } from "./cli-support.js";
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
    updateCommand(
      "apply",
      "Apply a command to 1–20 explicitly selected issues",
      async (connection, { options }, context) => applyCommands(
        connection,
        String(options.query),
        options.issues as string[],
        readOptions(options),
      ),
      [...queryOptions, { ...issueOption, required: true }],
    ),
    readCommand(
      "assist",
      "Get command suggestions; this does not execute or guarantee a later command",
      async (connection, { options }, context) => assistCommands(connection, {
        ...assistInput(options),
        ...(options.issues === undefined ? {} : { issues: options.issues as string[] }),
      }),
      [...assistOptions, issueOption],
    ),
  ]),
  command("search", "Inspect YouTrack search suggestions", [
    readCommand(
      "assist",
      "Get completions for a search query",
      async (connection, { options }, context) => assistSearch(connection, assistInput(options)),
      assistOptions,
    ),
  ]),
  command("saved-queries", "Read saved YouTrack searches", [
    pagedRead("list", "List one page of visible saved searches", listSavedQueries),
    projectedRead("get <queryID>", "Read a saved search by database ID", getSavedQuery),
  ]),
];

export const queryIssueChildren = [
  readCommand(
    "count",
    "Count a search once; -1 means counting is pending",
    async (connection, { options }, context) => countIssues(
      connection,
      String(options.query),
      readOptions(options),
    ),
    queryOptions,
  ),
];
