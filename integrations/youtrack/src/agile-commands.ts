import { command } from "@eyeauras/cli-factory";
import { pagedRead, projectedBodyUpdate, projectedRead } from "./cli-support.js";
import { createSprint, getAgile, getSprint, listAgiles, listSprints, updateSprint } from "./agile.js";
import { agileRecord, agileTable, sprintRecord, sprintTable, sprintWritten } from "./presentation.js";

export const agileRootCommands = [
  command("agile", "Inspect agile boards", [
    pagedRead("list", "List agile boards", listAgiles, agileTable),
    projectedRead("get <agile>", "Show an agile board", getAgile, agileRecord),
  ]),
  command("sprint", "Inspect and manage sprints", [
    pagedRead("list <agile>", "List a board's sprints", listSprints, sprintTable),
    projectedRead("get <agile> <sprint>", "Show a sprint (current for the current one)", getSprint, sprintRecord),
    projectedBodyUpdate("create <agile>", "Create a sprint", createSprint, undefined, sprintWritten("Created")),
    projectedBodyUpdate("update <agile> <sprint>", "Update a sprint", updateSprint, undefined, sprintWritten("Updated")),
  ]),
];
