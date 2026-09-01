import { command } from "@eyeauras/cli-factory";
import { pagedRead, projectedRead } from "./cli-support.js";
import {
  getGlobalTimeSettings,
  getProjectTimeSettings,
  getProjectWorkItemType,
  getWorkItemType,
  getWorkTimeSettings,
  listProjectWorkItemTypes,
  listWorkItemTypes,
} from "./time-settings.js";

export const timeSettingsRootCommands = [
  command("time-tracking", "Inspect global time-tracking conventions", [
    command("settings", "Inspect global time-tracking settings", [
      projectedRead(
        "get",
        "Read global time settings without expanding work item types",
        getGlobalTimeSettings,
      ),
    ]),
    command("work-time", "Inspect the server work schedule", [
      projectedRead(
        "get",
        "Read minutes per day, working days and server week conventions",
        getWorkTimeSettings,
      ),
    ]),
  ]),
  command("work-item-type", "Inspect available global work item types", [
    pagedRead("list", "List one page of global work item types", listWorkItemTypes),
    projectedRead("get <type>", "Read a global work item type by database ID", getWorkItemType),
  ]),
];

export const timeSettingsProjectChildren = [
  command("time-tracking", "Inspect project time-tracking settings", [
    projectedRead(
      "get <project>",
      "Read project time tracking and its estimate and spent-time fields",
      getProjectTimeSettings,
    ),
  ]),
  command("work-item-type", "Inspect work item types attached to a project", [
    pagedRead(
      "list <project>",
      "List one page of project work item types",
      listProjectWorkItemTypes,
    ),
    projectedRead(
      "get <project> <type>",
      "Read a work item type attached to the project",
      getProjectWorkItemType,
    ),
  ]),
];
