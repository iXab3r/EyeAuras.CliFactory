import { command, Permission, type CommandDefinition } from "@eyeauras/cli-factory";
import { bodyOptions, connection, pageOptions, projectionOptions, readOptions } from "./cli-support.js";
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
  command(
    "get <project>",
    "Show a project by database ID or short name",
    async ({ args, options }, context) =>
      getProject(await connection(context), args.project, readOptions(options)),
    { permission: Permission.ReadOnly, options: projectionOptions },
  ),
  command("field", "Inspect project custom-field settings and types", [
    command(
      "list <project>",
      "List one page of project custom fields",
      async ({ args, options }, context) =>
        listProjectFields(await connection(context), args.project, readOptions(options)),
      { permission: Permission.ReadOnly, options: pageOptions },
    ),
    command(
      "get <project> <field>",
      "Show project custom-field settings",
      async ({ args, options }, context) => getProjectField(
        await connection(context), args.project, args.field, readOptions(options),
      ),
      { permission: Permission.ReadOnly, options: projectionOptions },
    ),
  ]),
];

export const fieldsUserChildren: readonly CommandDefinition[] = [
  command(
    "list",
    "List one page of YouTrack users",
    async ({ options }, context) => listUsers(await connection(context), readOptions(options)),
    { permission: Permission.ReadOnly, options: pageOptions },
  ),
];

export const fieldsIssueChildren: readonly CommandDefinition[] = [
  command("fields", "Read and set typed issue custom fields", [
    command(
      "list <issueID>",
      "List one page of issue custom fields",
      async ({ args, options }, context) =>
        listIssueFields(await connection(context), args.issueID, readOptions(options)),
      { permission: Permission.ReadOnly, options: pageOptions },
    ),
    command(
      "get <issueID> <fieldID>",
      "Show a field; request possibleEvents explicitly for state-machine transitions",
      async ({ args, options }, context) => getIssueField(
        await connection(context), args.issueID, args.fieldID, readOptions(options),
      ),
      { permission: Permission.ReadOnly, options: projectionOptions },
    ),
    command(
      "set <issueID> <fieldID>",
      "Set $type and value, or a state-machine event.id",
      async ({ args, options }, context) => setIssueField(
        await connection(context), args.issueID, args.fieldID, options.body,
      ),
      { permission: Permission.Update, options: bodyOptions },
    ),
  ]),
];
