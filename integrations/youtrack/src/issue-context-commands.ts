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
import { commentShown, commentUpdated, sprintTable } from "./presentation.js";

const activityOptions: readonly OptionDefinition[] = [
  ...projectionOptions,
  {
    flags: "--categories <categories>",
    description: "Comma-separated activity category IDs",
    required: true,
    parse: activityCategories,
  },
  {
    flags: "--cursor <cursor>",
    description: "beforeCursor or afterCursor from a previous page",
  },
  { flags: "--reverse", description: "Newest activities first" },
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
  command("activities", "Inspect activities across issues", [
    readCommand(
      "page",
      "Read one cursor page of activities",
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
      "Read one cursor page of activities",
      async (connection, { args, options }, context) =>
        getIssueActivitiesPage(
          connection,
          args.issueID,
          activityReadOptions(options),
        ),
      activityOptions,
    ),
  ]),
  command("sprints", "Inspect the sprints that contain an issue", [
    pagedRead("list <issueID>", "List the issue's sprints", listIssueSprints, sprintTable),
  ]),
  command("vcs-changes", "Inspect linked VCS changes and pull requests", [
    pagedRead("list <issueID>", "List VCS changes and pull requests", listVcsChanges),
    projectedRead(
      "get <issueID> <changeID>",
      "Show a VCS change or pull request",
      getVcsChange,
    ),
  ]),
];

export const contextCommentChildren = [
  projectedRead("get <issueID> <commentID>", "Show a comment", getComment, commentShown),
  bodyUpdate(
    "update <issueID> <commentID>",
    "Replace a comment's text",
    updateComment,
    "text",
    commentUpdated("issueID", "commentID"),
  ),
];
