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
import { issueFieldRecord, issueFieldTable, projectFieldTable, projectRecord, userTable } from "./presentation.js";

export const fieldsProjectChildren: readonly CommandDefinition[] = [
  projectedRead("get <project>", "Show a project", getProject, projectRecord),
  command("field", "Inspect project custom-field settings", [
    pagedRead("list <project>", "List the project's custom fields", listProjectFields, projectFieldTable),
    projectedRead("get <project> <field>", "Show a project custom field", getProjectField),
  ]),
];

export const fieldsUserChildren: readonly CommandDefinition[] = [
  pagedRead("list", "List users", listUsers, userTable),
];

export const fieldsIssueChildren: readonly CommandDefinition[] = [
  command("fields", "Read and set custom fields", [
    pagedRead("list <issueID>", "List the issue's custom fields", listIssueFields, issueFieldTable),
    projectedRead("get <issueID> <fieldID>", "Show a custom field", getIssueField, issueFieldRecord),
    bodyUpdate(
      "set <issueID> <fieldID>",
      "Set a field value or state event",
      setIssueField,
      undefined,
      issueFieldRecord,
    ),
  ]),
];
