import { readCommand } from "./cli-support.js";
import {
  downloadArticleAttachment,
  downloadIssueAttachment,
  downloadLimit,
  type DownloadOptions,
} from "./attachment-download.js";
import { savedAttachment, withView } from "./presentation.js";

const downloadOptions = [
  {
    flags: "--output <path>",
    description: "Output path relative to the working directory; never overwrites",
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
    ...(typeof options.output === "string" ? { output: options.output } : {}),
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
    context.cwd,
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
    context.cwd,
    downloadInput(options, context.progress),
  ),
  downloadOptions,
));
