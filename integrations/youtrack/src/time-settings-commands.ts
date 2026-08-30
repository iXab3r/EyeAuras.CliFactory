import { command, Permission } from "@eyeauras/cli-factory";
import { connection, pageOptions, projectionOptions, readOptions } from "./cli-support.js";
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
      command(
        "get",
        "Read global time settings without expanding work item types",
        async ({ options }, context) =>
          getGlobalTimeSettings(await connection(context), readOptions(options)),
        { permission: Permission.ReadOnly, options: projectionOptions },
      ),
    ]),
    command("work-time", "Inspect the server work schedule", [
      command(
        "get",
        "Read minutes per day, working days and server week conventions",
        async ({ options }, context) =>
          getWorkTimeSettings(await connection(context), readOptions(options)),
        { permission: Permission.ReadOnly, options: projectionOptions },
      ),
    ]),
  ]),
  command("work-item-type", "Inspect available global work item types", [
    command(
      "list",
      "List one page of global work item types",
      async ({ options }, context) =>
        listWorkItemTypes(await connection(context), readOptions(options)),
      { permission: Permission.ReadOnly, options: pageOptions },
    ),
    command(
      "get <type>",
      "Read a global work item type by database ID",
      async ({ args, options }, context) =>
        getWorkItemType(await connection(context), String(args.type), readOptions(options)),
      { permission: Permission.ReadOnly, options: projectionOptions },
    ),
  ]),
];

export const timeSettingsProjectChildren = [
  command("time-tracking", "Inspect project time-tracking settings", [
    command(
      "get <project>",
      "Read project time tracking and its estimate and spent-time fields",
      async ({ args, options }, context) =>
        getProjectTimeSettings(await connection(context), String(args.project), readOptions(options)),
      { permission: Permission.ReadOnly, options: projectionOptions },
    ),
  ]),
  command("work-item-type", "Inspect work item types attached to a project", [
    command(
      "list <project>",
      "List one page of project work item types",
      async ({ args, options }, context) =>
        listProjectWorkItemTypes(await connection(context), String(args.project), readOptions(options)),
      { permission: Permission.ReadOnly, options: pageOptions },
    ),
    command(
      "get <project> <type>",
      "Read a work item type attached to the project",
      async ({ args, options }, context) => getProjectWorkItemType(
        await connection(context),
        String(args.project),
        String(args.type),
        readOptions(options),
      ),
      { permission: Permission.ReadOnly, options: projectionOptions },
    ),
  ]),
];
