import { command, type OptionDefinition } from "@eyeauras/cli-factory";
import { bodyUpdate, pagedRead, projectedRead, readCommand, projectionOptions, readOptions } from "./cli-support.js";
import {
  activityCategories,
  getActivitiesPage,
  getComment,
  getIssueActivitiesPage,
  getVcsChange,
  listIssueSprints,
  listVcsChanges,
  updateComment,
  type ActivityOptions,
} from "./issue-context.js";

const activityOptions: readonly OptionDefinition[] = [
  ...projectionOptions,
  {
    flags: "--categories <categories>",
    description: "Required comma-separated YouTrack activity category IDs",
    required: true,
    parse: activityCategories,
  },
  {
    flags: "--cursor <cursor>",
    description: "Opaque beforeCursor or afterCursor from a previous page",
  },
  { flags: "--reverse", description: "Return newest activities first" },
];

function activityReadOptions(options: Record<string, unknown>): ActivityOptions {
  return {
    ...readOptions(options),
    categories: String(options.categories),
    ...(options.reverse === undefined ? {} : { reverse: options.reverse === true }),
    ...(typeof options.cursor === "string" ? { cursor: options.cursor } : {}),
  };
}

export const contextRootCommands = [
  command("activities", "Inspect activities across accessible issues", [
    readCommand(
      "page",
      "Read one server-defined cursor page, including cursor metadata",
      async (connection, { options }, context) =>
        getActivitiesPage(connection, activityReadOptions(options)),
      activityOptions,
    ),
  ]),
];

export const contextIssueChildren = [
  command("activity", "Inspect the issue activity stream", [
    readCommand(
      "page <issueID>",
      "Read one server-defined cursor page, including cursor metadata",
      async (connection, { args, options }, context) =>
        getIssueActivitiesPage(
          connection,
          args.issueID,
          activityReadOptions(options),
        ),
      activityOptions,
    ),
  ]),
  command("sprints", "Inspect sprints that contain an issue", [
    pagedRead("list <issueID>", "List one page of the issue's sprints", listIssueSprints),
  ]),
  command("vcs-changes", "Inspect linked VCS changes and pull requests", [
    pagedRead("list <issueID>", "List one page of VCS changes and pull requests", listVcsChanges),
    projectedRead(
      "get <issueID> <changeID>",
      "Read a linked VCS change or pull request",
      getVcsChange,
    ),
  ]),
];

export const contextCommentChildren = [
  projectedRead("get <issueID> <commentID>", "Read a specific issue comment", getComment),
  bodyUpdate(
    "update <issueID> <commentID>",
    "Replace comment text with a nonempty text field",
    updateComment,
  ),
];
