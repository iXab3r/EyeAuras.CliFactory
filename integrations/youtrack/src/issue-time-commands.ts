import { command, Permission } from "@eyeauras/cli-factory";
import { bodyOptions, connection, pageOptions, projectionOptions, readOptions } from "./cli-support.js";
import {
  addWorkItem,
  getIssueWorkItem,
  getTimeTracking,
  getWorkItem,
  listIssueWorkItems,
  listWorkItems,
  updateWorkItem,
} from "./issue-time.js";

export const timeRootCommands = [
  command("work-items", "Inspect work items across accessible issues", [
    command(
      "list",
      "List one page of work items, optionally filtered by issue search",
      async ({ options }, context) => listWorkItems(await connection(context), readOptions(options)),
      {
        permission: Permission.ReadOnly,
        options: [
          ...pageOptions,
          { flags: "--query <query>", description: "YouTrack issue search query" },
        ],
      },
    ),
    command(
      "get <itemID>",
      "Read a work item",
      async ({ args, options }, context) =>
        getWorkItem(await connection(context), String(args.itemID), readOptions(options)),
      { permission: Permission.ReadOnly, options: projectionOptions },
    ),
  ]),
];

export const timeIssueChildren = [
  command("time-tracking", "Inspect issue time tracking", [
    command(
      "get <issueID>",
      "Read time-tracking status without expanding work items",
      async ({ args, options }, context) =>
        getTimeTracking(await connection(context), String(args.issueID), readOptions(options)),
      { permission: Permission.ReadOnly, options: projectionOptions },
    ),
  ]),
  command("work-items", "Inspect and record time spent on an issue", [
    command(
      "list <issueID>",
      "List one page of issue work items",
      async ({ args, options }, context) =>
        listIssueWorkItems(await connection(context), String(args.issueID), readOptions(options)),
      { permission: Permission.ReadOnly, options: pageOptions },
    ),
    command(
      "get <issueID> <itemID>",
      "Read an issue work item",
      async ({ args, options }, context) =>
        getIssueWorkItem(
          await connection(context),
          String(args.issueID),
          String(args.itemID),
          readOptions(options),
        ),
      { permission: Permission.ReadOnly, options: projectionOptions },
    ),
    command(
      "add <issueID>",
      "Add work time; duration.minutes or duration.presentation is required",
      async ({ args, options }, context) =>
        addWorkItem(await connection(context), String(args.issueID), options.body, readOptions(options)),
      { permission: Permission.Update, options: [...bodyOptions, ...projectionOptions] },
    ),
    command(
      "update <issueID> <itemID>",
      "Update supplied work-item fields; omitted fields stay unchanged",
      async ({ args, options }, context) =>
        updateWorkItem(
          await connection(context),
          String(args.issueID),
          String(args.itemID),
          options.body,
          readOptions(options),
        ),
      { permission: Permission.Update, options: [...bodyOptions, ...projectionOptions] },
    ),
  ]),
];

