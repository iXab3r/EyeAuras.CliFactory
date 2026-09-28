import { readCommand } from "./cli-support.js";
import {
  downloadArticleAttachment,
  downloadIssueAttachment,
  downloadLimit,
  downloadName,
  type DownloadOptions,
} from "./attachment-download.js";
import { savedAttachment, withView } from "./presentation.js";

const downloadOptions = [
  {
    flags: "--name <basename>",
    description: "File name (existing files are kept)",
    parse: downloadName,
  },
  {
    flags: "--max-bytes <n>",
    description: "Fail above this many bytes",
    parse: downloadLimit,
  },
];

function downloadInput(options: Record<string, unknown>, progress: (message: string) => void): DownloadOptions {
  return {
    progress,
    ...(typeof options.name === "string" ? { name: options.name } : {}),
    ...(typeof options.maxBytes === "number" ? { maxBytes: options.maxBytes } : {}),
  };
}

export const attachmentDownloadCommand = withView(savedAttachment, readCommand(
  "download <issueID> <attachmentID>",
  "Download an attachment",
  async (connection, { args, options }, context) => downloadIssueAttachment(
    connection,
    args.issueID,
    args.attachmentID,
    context.appArguments.AppDataDirectory,
    downloadInput(options, context.progress),
  ),
  downloadOptions,
));

export const articleAttachmentDownloadCommand = withView(savedAttachment, readCommand(
  "download <article> <attachment>",
  "Download an attachment",
  async (connection, { args, options }, context) => downloadArticleAttachment(
    connection,
    args.article,
    args.attachment,
    context.appArguments.AppDataDirectory,
    downloadInput(options, context.progress),
  ),
  downloadOptions,
));
