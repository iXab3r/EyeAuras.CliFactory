import { command } from "@eyeauras/cli-factory";
import { requiredText } from "./client.js";
import { attachmentDownloadCommand } from "./attachment-download-commands.js";
import { pagedRead, projectedRead, updateCommand } from "./cli-support.js";
import {
  getIssueAttachment,
  listIssueAttachments,
  uploadIssueAttachment,
} from "./issue-attachments.js";
import { attachmentRecord, attachmentTable, uploadedAttachments, withView } from "./presentation.js";

export const attachmentsIssueChildren = [
  command("attachments", "Inspect, upload or download attachments", [
    attachmentDownloadCommand,
    pagedRead("list <issueID>", "List attachments", listIssueAttachments, attachmentTable),
    projectedRead("get <issueID> <attachmentID>", "Show an attachment", getIssueAttachment, attachmentRecord),
    withView(uploadedAttachments, updateCommand(
      "upload <issueID>",
      "Upload a file to the issue",
      async (connection, { args, options }, context) =>
        uploadIssueAttachment(
          connection,
          args.issueID,
          String(options.file),
        ),
      [
          {
            flags: "--file <path>",
            description: "Local file to upload",
            required: true,
            parse: (value) => requiredText(value, "file path"),
          },
        ],
    )),
  ]),
];
