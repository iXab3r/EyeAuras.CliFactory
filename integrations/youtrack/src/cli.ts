import {
  command,
  createCli,
  Permission,
  tokenAuth,
  type CliApplication,
  type CliRuntime,
} from "@eyeauras/cli-factory";
import {
  addComment,
  createIssue,
  currentUser,
  getIssue,
  listComments,
  listIssues,
  listProjects,
  readUser,
  updateIssue,
  youTrackUrl,
} from "./client.js";
import { bodyOptions, connection, pageOptions, projectionOptions, readOptions } from "./cli-support.js";
import { contextRootCommands, contextIssueChildren, contextCommentChildren } from "./issue-context-commands.js";
import { timeRootCommands, timeIssueChildren } from "./issue-time-commands.js";
import { relationsRootCommands, relationsIssueChildren } from "./issue-relations-commands.js";
import { fieldsProjectChildren, fieldsUserChildren, fieldsIssueChildren } from "./issue-fields-commands.js";
import { attachmentsIssueChildren } from "./issue-attachments-commands.js";
import { queryRootCommands, queryIssueChildren } from "./issue-query-commands.js";
import { timeSettingsRootCommands, timeSettingsProjectChildren } from "./time-settings-commands.js";
import { fieldCatalogRootCommands, fieldCatalogBundleChildren } from "./field-catalog-commands.js";
import { userDirectoryUserChildren, userDirectoryBundleChildren } from "./user-directory-commands.js";
import { groupDirectoryRootCommands, groupDirectoryProjectChildren } from "./group-directory-commands.js";
import { articlesRootCommands, articlesProjectChildren } from "./articles-commands.js";
import { agileRootCommands } from "./agile-commands.js";
import { bundleValuesChildren } from "./bundle-values-commands.js";

export function createYouTrackCli(runtime?: CliRuntime): CliApplication {
  return createCli({
    name: "youtrack-cli",
    description: "AI-friendly access to YouTrack",
    version: "0.1.0",
    applicationId: "youtrack-cli",
    permissions: {},
    profile: {
      fields: [
        {
          name: "url",
          flags: "--url <url>",
          description: "YouTrack server URL including any context path, without /api",
          required: true,
        },
      ],
      validate(values) {
        if (values.url !== undefined) {
          youTrackUrl(values.url);
        }
      },
    },
    auth: tokenAuth({
      env: "YOUTRACK_TOKEN",
      validate: ({ profile, token, fetch, signal }) => currentUser({
        baseUrl: youTrackUrl(profile.values.url),
        token,
        fetch,
        signal,
      }),
    }),
    commands: [
      ...contextRootCommands,
      ...timeRootCommands,
      ...relationsRootCommands,
      ...queryRootCommands,
      ...timeSettingsRootCommands,
      ...fieldCatalogRootCommands,
      ...groupDirectoryRootCommands,
      ...articlesRootCommands,
      ...agileRootCommands,
      command("bundle", "Inspect available custom-field value bundles", [
        ...fieldCatalogBundleChildren,
        ...userDirectoryBundleChildren,
        ...bundleValuesChildren,
      ]),
      command("user", "Inspect YouTrack users", [
        ...fieldsUserChildren,
        ...userDirectoryUserChildren,
        command(
          "me",
          "Show the authenticated user (default: ID and login)",
          async ({ options }, context) => readUser(await connection(context), readOptions(options)),
          { permission: Permission.ReadOnly, options: projectionOptions },
        ),
      ]),
      command("project", "Inspect YouTrack projects", [
        ...fieldsProjectChildren,
        ...timeSettingsProjectChildren,
        ...groupDirectoryProjectChildren,
        ...articlesProjectChildren,
        command(
          "list",
          "List one page of projects",
          async ({ options }, context) => listProjects(await connection(context), readOptions(options)),
          { permission: Permission.ReadOnly, options: pageOptions },
        ),
      ]),
      command("issues", "Read and update YouTrack issues", [
        ...contextIssueChildren,
        ...timeIssueChildren,
        ...relationsIssueChildren,
        ...fieldsIssueChildren,
        ...attachmentsIssueChildren,
        ...queryIssueChildren,
        command(
          "create",
          "Create an issue with project.id, summary and optional description",
          async ({ options }, context) =>
            createIssue(await connection(context), options.body),
          { permission: Permission.Update, options: bodyOptions },
        ),
        command(
          "update <issueID>",
          "Update summary and/or description; description null clears it",
          async ({ args, options }, context) =>
            updateIssue(await connection(context), args.issueID, options.body),
          { permission: Permission.Update, options: bodyOptions },
        ),
        command(
          "list",
          "Search one page of issues using YouTrack query syntax",
          async ({ options }, context) => listIssues(await connection(context), readOptions(options)),
          {
            permission: Permission.ReadOnly,
            options: [
              ...pageOptions,
              { flags: "--query <query>", description: "YouTrack search query" },
            ],
          },
        ),
        command(
          "get <issueID>",
          "Show an issue by database or readable ID",
          async ({ args, options }, context) =>
            getIssue(await connection(context), args.issueID, readOptions(options)),
          { permission: Permission.ReadOnly, options: projectionOptions },
        ),
        command("comments", "Read and add issue comments", [
          ...contextCommentChildren,
          command(
            "add <issueID>",
            "Add a comment with a nonempty text field",
            async ({ args, options }, context) =>
              addComment(await connection(context), args.issueID, options.body),
            { permission: Permission.Update, options: bodyOptions },
          ),
          command(
            "list <issueID>",
            "List one page of comments for an issue",
            async ({ args, options }, context) =>
              listComments(await connection(context), args.issueID, readOptions(options)),
            { permission: Permission.ReadOnly, options: pageOptions },
          ),
        ]),
      ]),
    ],
    ...(runtime === undefined ? {} : { runtime }),
  });
}
