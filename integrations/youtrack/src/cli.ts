import {
  command,
  createCli,
  downloadCommands,
  helpLayout,
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
  youTrackUrlHelp,
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
import {
  batchApplied,
  batchValidated,
  commentAdded,
  commentTable,
  createdIssue,
  issueRecord,
  issueTable,
  projectTable,
  updatedIssue,
  userRecord,
  withView,
} from "./presentation.js";

const manifestOption = fileOption("--file <path>", ".json or .csv manifest", true);
const manifest = async (options: Record<string, unknown>) =>
  manifestRows(await readTextFile(String(options.file)), String(options.file));

/** Root help: what people run daily first, then the reference data, then Core's configuration. */
const rootLayout = [
  ["Everyday", ["issues", "project", "user", "article", "agile", "sprint"]],
  ["Reference", [
    "field", "bundle", "tags", "link-types", "work-item-type", "time-tracking", "saved-queries",
    "search", "commands", "activities", "work-items", "group",
  ]],
] as const;

const issueExamples = [
  'issues list --query "project: DEMO #Unresolved" --top 20',
  "issues get DEMO-12",
  `issues create --body '{"project":{"shortName":"DEMO"},"summary":"Login page crashes on Safari"}'`,
  `issues update DEMO-12 --body '{"summary":"Login page crashes on Safari 18"}'`,
  `issues comments add DEMO-12 --body '{"text":"Fixed in build 42"}'`,
];

export function createYouTrackCli(runtime?: CliRuntime): CliApplication {
  return createCli({
    name: "youtrack-cli",
    description: "AI-friendly access to YouTrack",
    examples: [...issueExamples.slice(0, 3), "article get KB-A-7", "project list"],
    version: "0.4.1",
    applicationId: "youtrack-cli",
    permissions: {},
    profile: {
      fields: [
        {
          name: "url",
          flags: "--url <url>",
          description: youTrackUrlHelp,
          normalize: youTrackUrl,
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
      tokenSource: "Create a permanent token in your YouTrack profile with the YouTrack service scope.",
      validate: ({ profile, token, fetch, signal }) => currentUser({
        baseUrl: youTrackUrl(profile.values.url),
        token,
        fetch,
        signal,
      }),
    }),
    builtins: [downloadCommands],
    commands: helpLayout(rootLayout, [
      ...contextRootCommands,
      ...timeRootCommands,
      ...relationsRootCommands,
      ...queryRootCommands,
      ...timeSettingsRootCommands,
      ...fieldCatalogRootCommands,
      ...groupDirectoryRootCommands,
      ...articlesRootCommands,
      ...agileRootCommands,
      command("bundle", "Inspect custom-field value bundles", [
        ...fieldCatalogBundleChildren,
        ...userDirectoryBundleChildren,
        ...bundleValuesChildren,
      ]),
      command("user", "Inspect users", [
        ...fieldsUserChildren,
        ...userDirectoryUserChildren,
        projectedRead("me", "Show the signed-in user", readUser, userRecord),
      ]),
      command("project", "Inspect projects", [
        ...fieldsProjectChildren,
        ...timeSettingsProjectChildren,
        ...groupDirectoryProjectChildren,
        ...articlesProjectChildren,
        pagedRead("list", "List projects", listProjects, projectTable),
      ]),
      command("issues", "Read and update issues", [
        ...contextIssueChildren,
        ...timeIssueChildren,
        ...relationsIssueChildren,
        ...fieldsIssueChildren,
        ...attachmentsIssueChildren,
        ...queryIssueChildren,
        bodyUpdate("create", "Create an issue", createIssue, "description", createdIssue),
        bodyUpdate(
          "update <issueID>",
          "Update the summary, description or custom fields",
          updateIssue,
          "description",
          updatedIssue,
        ),
        withView(issueTable, readCommand(
          "list",
          "Search issues",
          (client, { options }, context) => {
            if ((options.all === true) !== (options.maxResults !== undefined)) {
              throw new Error("--all and --max-results go together.");
            }
            return listIssues(client, { ...readOptions(options), progress: context.progress });
          },
          [
            ...pageOptions,
            { flags: "--query <query>", description: "YouTrack search query" },
            { flags: "--all", description: "Read every page (needs --max-results)" },
            {
              flags: "--max-results <count>", description: "Fail above this many issues",
              parse: integerParser({
                min: 1, max: Number.MAX_SAFE_INTEGER, signed: false,
                errorMessage: "--max-results must be a positive integer.",
              }),
            },
            {
              flags: "--max-bytes <n>", description: "Fail above this many response bytes",
              parse: downloadLimit,
            },
          ],
        )),
        projectedRead("get <issueID>", "Show an issue", getIssue, issueRecord),
        command("batch", "Create and update issues from a manifest", [
          withView(batchValidated, command(
            "validate",
            "Check a manifest without sending requests",
            async ({ options }) => {
              const rows = await manifest(options);
              const updates = rows.filter((row) => row.issue !== undefined).length;
              return { rows: rows.length, create: rows.length - updates, update: updates };
            },
            { permission: Permission.ReadOnly, options: [manifestOption] },
          )),
          withView(batchApplied, updateCommand(
            "apply",
            "Apply manifest rows in order",
            async (connection, { options }, context) => applyIssueBatch(connection, await manifest(options), {
              appDataDirectory: context.appArguments.AppDataDirectory,
              continueOnError: options.continueOnError === true,
              progress: context.progress,
              ...(typeof options.failedRows === "string" ? { failedRows: options.failedRows } : {}),
            }),
            [
              manifestOption,
              { flags: "--continue-on-error", description: "Keep going after a failed row" },
              {
                flags: "--failed-rows <name>",
                description: "Save failed rows as a .json manifest",
                parse: downloadName,
              },
            ],
          )),
        ]),
        command("comments", "Read and add comments", [
          ...contextCommentChildren,
          bodyUpdate("add <issueID>", "Add a comment", addComment, "text", commentAdded("issueID")),
          pagedRead("list <issueID>", "List comments", listComments, commentTable),
        ]),
      ], { examples: issueExamples }),
    ]),
    ...(runtime === undefined ? {} : { runtime }),
  });
}
