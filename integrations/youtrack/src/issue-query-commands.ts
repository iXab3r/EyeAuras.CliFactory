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
import { commandApplied, countRecord, savedQueryTable, withView } from "./presentation.js";

const queryOptions: readonly OptionDefinition[] = [
  ...projectionOptions,
  {
    flags: "--query <query>",
    description: "YouTrack query text",
    required: true,
    parse: (value) => requiredText(value, "query"),
  },
];

const issueOption: OptionDefinition = {
  flags: "--issues <ids>",
  description: "Comma-separated issue IDs",
  parse: parseIssueSelection,
};

const assistOptions: readonly OptionDefinition[] = [
  ...queryOptions,
  {
    flags: "--caret <position>",
    description: "Caret position within the query",
    parse: (value) => {
      if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) {
        throw new Error("--caret must be a nonnegative integer.");
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
  command("commands", "Apply issue commands or get suggestions", [
    withView(commandApplied, updateCommand(
      "apply",
      "Apply a command to the selected issues",
      async (connection, { options }, context) => applyCommands(
        connection,
        String(options.query),
        options.issues as string[],
        readOptions(options),
      ),
      [...queryOptions, { ...issueOption, required: true }],
    )),
    readCommand(
      "assist",
      "Suggest command completions",
      async (connection, { options }, context) => assistCommands(connection, {
        ...assistInput(options),
        ...(options.issues === undefined ? {} : { issues: options.issues as string[] }),
      }),
      [...assistOptions, issueOption],
    ),
  ]),
  command("search", "Inspect search suggestions", [
    readCommand(
      "assist",
      "Suggest search completions",
      async (connection, { options }, context) => assistSearch(connection, assistInput(options)),
      assistOptions,
    ),
  ]),
  command("saved-queries", "Read saved searches", [
    pagedRead("list", "List saved searches", listSavedQueries, savedQueryTable),
    projectedRead("get <queryID>", "Show a saved search", getSavedQuery),
  ]),
];

export const queryIssueChildren = [
  withView(countRecord, readCommand(
    "count",
    "Count the issues a query matches",
    async (connection, { options }, context) => countIssues(
      connection,
      String(options.query),
      readOptions(options),
    ),
    queryOptions,
  )),
];
