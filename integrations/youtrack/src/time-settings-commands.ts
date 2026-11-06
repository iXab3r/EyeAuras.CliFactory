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
import { namedTable } from "./presentation.js";

const typeTable = namedTable("TYPE", "No work item types.");

export const timeSettingsRootCommands = [
  command("time-tracking", "Inspect time-tracking settings", [
    command("settings", "Inspect global time-tracking settings", [
      projectedRead("get", "Show the global time settings", getGlobalTimeSettings),
    ]),
    command("work-time", "Inspect the work schedule", [
      projectedRead("get", "Show the work schedule", getWorkTimeSettings),
    ]),
  ]),
  command("work-item-type", "Inspect work item types", [
    pagedRead("list", "List work item types", listWorkItemTypes, typeTable),
    projectedRead("get <type>", "Show a work item type", getWorkItemType),
  ]),
];

export const timeSettingsProjectChildren = [
  command("time-tracking", "Inspect project time-tracking settings", [
    projectedRead("get <project>", "Show the project's time-tracking settings", getProjectTimeSettings),
  ]),
  command("work-item-type", "Inspect the project's work item types", [
    pagedRead("list <project>", "List the project's work item types", listProjectWorkItemTypes, typeTable),
    projectedRead("get <project> <type>", "Show a project work item type", getProjectWorkItemType),
  ]),
];
