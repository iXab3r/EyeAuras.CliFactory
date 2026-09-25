
import { readCommand } from "./cli-support.js";
import {
  downloadArticleAttachment,
  downloadIssueAttachment,
  downloadLimit,
  downloadName,
  type DownloadOptions,
} from "./attachment-download.js";

const downloadOptions = [
  {
    flags: "--name <basename>",
    description: "Optional safe filename; an existing name is never overwritten",
    parse: downloadName,
  },
  {
    flags: "--max-bytes <n>",
    description: "Optional maximum transfer size in bytes (positive safe integer)",
    parse: downloadLimit,
  },
];

function downloadInput(options: Record<string, unknown>): DownloadOptions {
  return {
    ...(typeof options.name === "string" ? { name: options.name } : {}),
    ...(typeof options.maxBytes === "number" ? { maxBytes: options.maxBytes } : {}),
  };
}

export const attachmentDownloadCommand = readCommand(
  "download <issueID> <attachmentID>",
  "Download one attachment into this profile's downloads directory without overwriting files",
  async (connection, { args, options }, context) => downloadIssueAttachment(
    connection,
    args.issueID,
    args.attachmentID,
    context.appArguments.AppDataDirectory,
    downloadInput(options),
  ),
  downloadOptions,
);

export const articleAttachmentDownloadCommand = readCommand(
  "download <article> <attachment>",
  "Download one article attachment into this profile's downloads directory without overwriting files",
  async (connection, { args, options }, context) => downloadArticleAttachment(
    connection,
    args.article,
    args.attachment,
    context.appArguments.AppDataDirectory,
    downloadInput(options),
  ),
  downloadOptions,
);
