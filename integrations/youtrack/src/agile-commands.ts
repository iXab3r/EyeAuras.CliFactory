import { command, Permission } from "@eyeauras/cli-factory";
import { bodyOptions, connection, pageOptions, projectionOptions, readOptions } from "./cli-support.js";
import { createSprint, getAgile, getSprint, listAgiles, listSprints, updateSprint } from "./agile.js";

export const agileRootCommands = [
  command("agile", "Inspect agile boards", [
    command(
      "list",
      "List one page of accessible agile boards",
      async ({ options }, context) => listAgiles(await connection(context), readOptions(options)),
      { permission: Permission.ReadOnly, options: pageOptions },
    ),
    command(
      "get <agile>",
      "Read an agile board without expanding its sprints or projects",
      async ({ args, options }, context) =>
        getAgile(await connection(context), String(args.agile), readOptions(options)),
      { permission: Permission.ReadOnly, options: projectionOptions },
    ),
  ]),
  command("sprint", "Inspect and explicitly manage sprint plans", [
    command(
      "list <agile>",
      "List one page of a board's sprints",
      async ({ args, options }, context) =>
        listSprints(await connection(context), String(args.agile), readOptions(options)),
      { permission: Permission.ReadOnly, options: pageOptions },
    ),
    command(
      "get <agile> <sprint>",
      "Read a sprint; use current for the board's current sprint",
      async ({ args, options }, context) =>
        getSprint(await connection(context), String(args.agile), String(args.sprint), readOptions(options)),
      { permission: Permission.ReadOnly, options: projectionOptions },
    ),
    command(
      "create <agile>",
      "Create with name; optional previousSprint.id moves unresolved issues from that sprint. " +
        "isDefault: true automatically adds matching new issues. Neither setting is inferred.",
      async ({ args, options }, context) =>
        createSprint(await connection(context), String(args.agile), options.body, readOptions(options)),
      { permission: Permission.Update, options: [...bodyOptions, ...projectionOptions] },
    ),
    command(
      "update <agile> <sprint>",
      "Update supplied name/goal/start/finish/archived/isDefault; use current for the current sprint. " +
        "isDefault: true automatically adds matching new issues; previousSprint is creation-only.",
      async ({ args, options }, context) =>
        updateSprint(
          await connection(context),
          String(args.agile),
          String(args.sprint),
          options.body,
          readOptions(options),
        ),
      { permission: Permission.Update, options: [...bodyOptions, ...projectionOptions] },
    ),
  ]),
];
