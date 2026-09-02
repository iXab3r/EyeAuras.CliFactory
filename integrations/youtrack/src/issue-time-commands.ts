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

export const timeRootCommands = [
  command("work-items", "Inspect work items across accessible issues", [
    readCommand(
      "list",
      "List one page of work items, optionally filtered by issue search",
      async (connection, { options }, context) => listWorkItems(connection, readOptions(options)),
      [
          ...pageOptions,
          { flags: "--query <query>", description: "YouTrack issue search query" },
        ],
    ),
    projectedRead("get <itemID>", "Read a work item", getWorkItem),
  ]),
];

export const timeIssueChildren = [
  command("time-tracking", "Inspect issue time tracking", [
    projectedRead(
      "get <issueID>",
      "Read time-tracking status without expanding work items",
      getTimeTracking,
    ),
  ]),
  command("work-items", "Inspect and record time spent on an issue", [
    pagedRead("list <issueID>", "List one page of issue work items", listIssueWorkItems),
    projectedRead("get <issueID> <itemID>", "Read an issue work item", getIssueWorkItem),
    projectedBodyUpdate(
      "add <issueID>",
      "Add work time; duration.minutes or duration.presentation is required",
      addWorkItem,
    ),
    projectedBodyUpdate(
      "update <issueID> <itemID>",
      "Update supplied work-item fields; omitted fields stay unchanged",
      updateWorkItem,
    ),
  ]),
];

