import {
  command,
  createCli,
  downloadCommands,
  integerParser,
  Permission,
  tokenAuth,
  type CliApplication,
  type CliRuntime,
} from "@eyeauras/cli-factory";
import {
  addComment,
  currentUser,
  getIssue,
  listComments,
  listIssues,
  listProjects,
  readUser,
  youTrackUrl,
} from "./client.js";
import {
  bodyUpdate,
  fileOption,
  pagedRead,
  pageOptions,
  projectedRead,
  readCommand,
  readOptions,
  readTextFile,
  updateCommand,
} from "./cli-support.js";
import { downloadLimit, downloadName } from "./attachment-download.js";
import { applyIssueBatch, manifestRows } from "./issue-batch.js";
import { createIssue, updateIssue } from "./issue-fields.js";
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

const manifestOption = fileOption("--file <path>", "Required .json or .csv manifest (UTF-8)", true);
const manifest = async (options: Record<string, unknown>) =>
  manifestRows(await readTextFile(String(options.file)), String(options.file));

export function createYouTrackCli(runtime?: CliRuntime): CliApplication {
  return createCli({
    name: "youtrack-cli",
    description: "AI-friendly access to YouTrack",
    version: "0.3.0",
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
    builtins: [downloadCommands],
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
        projectedRead(
          "me",
          "Show the authenticated user (default: ID and login)",
          readUser,
        ),
      ]),
      command("project", "Inspect YouTrack projects", [
        ...fieldsProjectChildren,
        ...timeSettingsProjectChildren,
        ...groupDirectoryProjectChildren,
        ...articlesProjectChildren,
        pagedRead("list", "List one page of projects", listProjects),
      ]),
      command("issues", "Read and update YouTrack issues", [
        ...contextIssueChildren,
        ...timeIssueChildren,
        ...relationsIssueChildren,
        ...fieldsIssueChildren,
        ...attachmentsIssueChildren,
        ...queryIssueChildren,
        bodyUpdate(
          "create",
          "Create an issue with project id/shortName, summary, optional description and typed customFields",
          createIssue,
          "description",
        ),
        bodyUpdate(
          "update <issueID>",
          "Update summary, description and/or typed customFields in one request; null or [] clears",
          updateIssue,
          "description",
        ),
        readCommand(
          "list",
          "Search issues using YouTrack query syntax; --all reads every page within --max-results",
          (client, { options }) => {
            if ((options.all === true) !== (options.maxResults !== undefined)) {
              throw new Error("YouTrack --all and --max-results must be used together.");
            }
            return listIssues(client, readOptions(options));
          },
          [
            ...pageOptions,
            { flags: "--query <query>", description: "YouTrack search query" },
            { flags: "--all", description: "Read every page (--top is the page size); requires --max-results" },
            {
              flags: "--max-results <count>", description: "Fail instead of returning more issues than this",
              parse: integerParser({
                min: 1, max: Number.MAX_SAFE_INTEGER, signed: false,
                errorMessage: "YouTrack max-results must be a positive safe decimal integer.",
              }),
            },
            {
              flags: "--max-bytes <n>", description: "Fail when this command's decoded responses exceed n bytes",
              parse: downloadLimit,
            },
          ],
        ),
        projectedRead("get <issueID>", "Show an issue by database or readable ID", getIssue),
        command("batch", "Validate or apply JSON/CSV manifests of issue creates and updates", [
          command(
            "validate",
            "Validate a manifest locally; sends no requests and never uses the token",
            async ({ options }) => {
              const rows = await manifest(options);
              const updates = rows.filter((row) => row.issue !== undefined).length;
              return { rows: rows.length, create: rows.length - updates, update: updates };
            },
            { permission: Permission.ReadOnly, options: [manifestOption] },
          ),
          updateCommand(
            "apply",
            "Apply manifest rows in order; no retries, rollback or search expansion",
            async (connection, { options }, context) => applyIssueBatch(connection, await manifest(options), {
              appDataDirectory: context.appArguments.AppDataDirectory,
              continueOnError: options.continueOnError === true,
              ...(typeof options.failedRows === "string" ? { failedRows: options.failedRows } : {}),
            }),
            [
              manifestOption,
              { flags: "--continue-on-error", description: "Continue after a failed or uncertain row (default: stop)" },
              {
                flags: "--failed-rows <name>",
                description: "Save failed and unattempted rows as a .json manifest under downloads",
                parse: downloadName,
              },
            ],
          ),
        ]),
        command("comments", "Read and add issue comments", [
          ...contextCommentChildren,
          bodyUpdate(
            "add <issueID>",
            "Add a comment with a nonempty text field",
            addComment,
            "text",
          ),
          pagedRead(
            "list <issueID>",
            "List one page of comments for an issue",
            listComments,
          ),
        ]),
      ]),
    ],
    ...(runtime === undefined ? {} : { runtime }),
  });
}
