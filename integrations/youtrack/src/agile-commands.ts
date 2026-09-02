import { command } from "@eyeauras/cli-factory";
import { pagedRead, projectedBodyUpdate, projectedRead } from "./cli-support.js";
import { createSprint, getAgile, getSprint, listAgiles, listSprints, updateSprint } from "./agile.js";

export const agileRootCommands = [
  command("agile", "Inspect agile boards", [
    pagedRead("list", "List one page of accessible agile boards", listAgiles),
    projectedRead(
      "get <agile>",
      "Read an agile board without expanding its sprints or projects",
      getAgile,
    ),
  ]),
  command("sprint", "Inspect and explicitly manage sprint plans", [
    pagedRead("list <agile>", "List one page of a board's sprints", listSprints),
    projectedRead(
      "get <agile> <sprint>",
      "Read a sprint; use current for the board's current sprint",
      getSprint,
    ),
    projectedBodyUpdate(
      "create <agile>",
      "Create with name; optional previousSprint.id moves unresolved issues from that sprint. " +
        "isDefault: true automatically adds matching new issues. Neither setting is inferred.",
      createSprint,
    ),
    projectedBodyUpdate(
      "update <agile> <sprint>",
      "Update supplied name/goal/start/finish/archived/isDefault; use current for the current sprint. " +
        "isDefault: true automatically adds matching new issues; previousSprint is creation-only.",
      updateSprint,
    ),
  ]),
];
