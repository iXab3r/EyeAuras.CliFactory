import { command } from "@eyeauras/cli-factory";
import { pagedRead, projectedBodyUpdate, projectedRead, readCommand, pageOptions, readOptions } from "./cli-support.js";
import {
  addWorkItem,
  getIssueWorkItem,
  getTimeTracking,
  getWorkItem,
  listIssueWorkItems,
  listWorkItems,
  updateWorkItem,
} from "./issue-time.js";
import { withView, workItemTable } from "./presentation.js";

export const timeRootCommands = [
  command("work-items", "Inspect work items across issues", [
    withView(workItemTable, readCommand(
      "list",
      "List work items",
      async (connection, { options }, context) => listWorkItems(connection, readOptions(options)),
      [
          ...pageOptions,
          { flags: "--query <query>", description: "Issue search query" },
        ],
    )),
    projectedRead("get <itemID>", "Show a work item", getWorkItem),
  ]),
];

export const timeIssueChildren = [
  command("time-tracking", "Inspect issue time tracking", [
    projectedRead("get <issueID>", "Show time-tracking status", getTimeTracking),
  ]),
  command("work-items", "Inspect and record time spent", [
    pagedRead("list <issueID>", "List the issue's work items", listIssueWorkItems, workItemTable),
    projectedRead("get <issueID> <itemID>", "Show a work item", getIssueWorkItem),
    projectedBodyUpdate("add <issueID>", "Add a work item", addWorkItem),
    projectedBodyUpdate("update <issueID> <itemID>", "Update a work item", updateWorkItem),
  ]),
];
