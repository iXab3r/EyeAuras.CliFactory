import { command } from "@eyeauras/cli-factory";
import { requiredText } from "./client.js";
import { attachmentDownloadCommand } from "./attachment-download-commands.js";
import { pagedRead, projectedRead, updateCommand } from "./cli-support.js";
import {
  getIssueAttachment,
  listIssueAttachments,
  uploadIssueAttachment,
} from "./issue-attachments.js";

export const attachmentsIssueChildren = [
  command("attachments", "Inspect, upload or download one selected attachment", [
    attachmentDownloadCommand,
    pagedRead(
      "list <issueID>",
      "List one page of attachment metadata without downloading files",
      listIssueAttachments,
    ),
    projectedRead(
      "get <issueID> <attachmentID>",
      "Read attachment metadata without downloading its contents",
      getIssueAttachment,
    ),
    updateCommand(
      "upload <issueID>",
      "Upload one selected regular file to an existing issue",
      async (connection, { args, options }, context) =>
        uploadIssueAttachment(
          connection,
          args.issueID,
          String(options.file),
        ),
      [
          {
            flags: "--file <path>",
            description: "Required explicit local input file; no copies or recursion",
            required: true,
            parse: (value) => requiredText(value, "file path"),
          },
        ],
    ),
  ]),
];
