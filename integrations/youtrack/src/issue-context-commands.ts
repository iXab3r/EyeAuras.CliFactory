import { command, Permission, type OptionDefinition } from "@eyeauras/cli-factory";
import {
  bodyOptions,
  connection,
  pageOptions,
  projectionOptions,
  readOptions,
} from "./cli-support.js";
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
    command(
      "page",
      "Read one server-defined cursor page, including cursor metadata",
      async ({ options }, context) =>
        getActivitiesPage(await connection(context), activityReadOptions(options)),
      { permission: Permission.ReadOnly, options: activityOptions },
    ),
  ]),
];

export const contextIssueChildren = [
  command("activity", "Inspect the issue activity stream", [
    command(
      "page <issueID>",
      "Read one server-defined cursor page, including cursor metadata",
      async ({ args, options }, context) =>
        getIssueActivitiesPage(
          await connection(context),
          args.issueID,
          activityReadOptions(options),
        ),
      { permission: Permission.ReadOnly, options: activityOptions },
    ),
  ]),
  command("sprints", "Inspect sprints that contain an issue", [
    command(
      "list <issueID>",
      "List one page of the issue's sprints",
      async ({ args, options }, context) =>
        listIssueSprints(await connection(context), args.issueID, readOptions(options)),
      { permission: Permission.ReadOnly, options: pageOptions },
    ),
  ]),
  command("vcs-changes", "Inspect linked VCS changes and pull requests", [
    command(
      "list <issueID>",
      "List one page of VCS changes and pull requests",
      async ({ args, options }, context) =>
        listVcsChanges(await connection(context), args.issueID, readOptions(options)),
      { permission: Permission.ReadOnly, options: pageOptions },
    ),
    command(
      "get <issueID> <changeID>",
      "Read a linked VCS change or pull request",
      async ({ args, options }, context) =>
        getVcsChange(
          await connection(context),
          args.issueID,
          args.changeID,
          readOptions(options),
        ),
      { permission: Permission.ReadOnly, options: projectionOptions },
    ),
  ]),
];

export const contextCommentChildren = [
  command(
    "get <issueID> <commentID>",
    "Read a specific issue comment",
    async ({ args, options }, context) =>
      getComment(
        await connection(context),
        args.issueID,
        args.commentID,
        readOptions(options),
      ),
    { permission: Permission.ReadOnly, options: projectionOptions },
  ),
  command(
    "update <issueID> <commentID>",
    "Replace comment text with a nonempty text field",
    async ({ args, options }, context) =>
      updateComment(
        await connection(context),
        args.issueID,
        args.commentID,
        options.body,
      ),
    { permission: Permission.Update, options: bodyOptions },
  ),
];
