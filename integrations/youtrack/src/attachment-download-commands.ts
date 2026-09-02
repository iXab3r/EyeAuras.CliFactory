
import { readCommand } from "./cli-support.js";
import { downloadIssueAttachment, downloadLimit, downloadName } from "./attachment-download.js";

export const attachmentDownloadCommand = readCommand(
  "download <issueID> <attachmentID>",
  "Download one attachment into this profile's downloads directory without overwriting files",
  async (connection, { args, options }, context) => downloadIssueAttachment(
    connection,
    args.issueID,
    args.attachmentID,
    context.appArguments.AppDataDirectory,
    {
      ...(typeof options.name === "string" ? { name: options.name } : {}),
      ...(typeof options.maxBytes === "number" ? { maxBytes: options.maxBytes } : {}),
    },
  ),
  [
      {
        flags: "--name <basename>",
        description: "Optional safe filename; an existing name is never overwritten",
        parse: downloadName,
      },
      {
        flags: "--max-bytes <n>",
        description: "Maximum transfer size in bytes (1-104857600)",
        defaultValue: 25 * 1024 * 1024,
        parse: downloadLimit,
      },
    ],
);
