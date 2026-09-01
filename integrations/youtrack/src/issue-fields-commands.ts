import { command, type CommandDefinition } from "@eyeauras/cli-factory";
import { bodyUpdate, pagedRead, projectedRead } from "./cli-support.js";
import {
  getProject,
  getProjectField,
  listProjectFields,
  listUsers,
  getIssueField,
  listIssueFields,
  setIssueField,
} from "./issue-fields.js";

export const fieldsProjectChildren: readonly CommandDefinition[] = [
  projectedRead("get <project>", "Show a project by database ID or short name", getProject),
  command("field", "Inspect project custom-field settings and types", [
    pagedRead("list <project>", "List one page of project custom fields", listProjectFields),
    projectedRead("get <project> <field>", "Show project custom-field settings", getProjectField),
  ]),
];

export const fieldsUserChildren: readonly CommandDefinition[] = [
  pagedRead("list", "List one page of YouTrack users", listUsers),
];

export const fieldsIssueChildren: readonly CommandDefinition[] = [
  command("fields", "Read and set typed issue custom fields", [
    pagedRead("list <issueID>", "List one page of issue custom fields", listIssueFields),
    projectedRead(
      "get <issueID> <fieldID>",
      "Show a field; request possibleEvents explicitly for state-machine transitions",
      getIssueField,
    ),
    bodyUpdate(
      "set <issueID> <fieldID>",
      "Set $type and value, or a state-machine event.id",
      setIssueField,
    ),
  ]),
];
