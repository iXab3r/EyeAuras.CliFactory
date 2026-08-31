import { command, Permission } from "@eyeauras/cli-factory";
import { requiredText } from "./client.js";
import { attachmentDownloadCommand } from "./attachment-download-commands.js";
import { connection, pageOptions, projectionOptions, readOptions } from "./cli-support.js";
import {
  getIssueAttachment,
  listIssueAttachments,
  uploadIssueAttachment,
} from "./issue-attachments.js";

export const attachmentsIssueChildren = [
  command("attachments", "Inspect, upload or download one selected attachment", [
    attachmentDownloadCommand,
    command(
      "list <issueID>",
      "List one page of attachment metadata without downloading files",
      async ({ args, options }, context) =>
        listIssueAttachments(
          await connection(context),
          args.issueID,
          readOptions(options),
        ),
      { permission: Permission.ReadOnly, options: pageOptions },
    ),
    command(
      "get <issueID> <attachmentID>",
      "Read attachment metadata without downloading its contents",
      async ({ args, options }, context) =>
        getIssueAttachment(
          await connection(context),
          args.issueID,
          args.attachmentID,
          readOptions(options),
        ),
      { permission: Permission.ReadOnly, options: projectionOptions },
    ),
    command(
      "upload <issueID>",
      "Upload one selected regular file to an existing issue",
      async ({ args, options }, context) =>
        uploadIssueAttachment(
          await connection(context),
          args.issueID,
          String(options.file),
        ),
      {
        permission: Permission.Update,
        options: [
          {
            flags: "--file <path>",
            description: "Required explicit local input file; no copies or recursion",
            required: true,
            parse: (value) => requiredText(value, "file path"),
          },
        ],
      },
    ),
  ]),
];
