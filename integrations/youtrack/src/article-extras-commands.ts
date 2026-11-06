import { command } from "@eyeauras/cli-factory";
import { inputFilePath } from "./client.js";
import { articleAttachmentDownloadCommand } from "./attachment-download-commands.js";
import { pagedRead, projectedRead, updateCommand, projectionOptions, readOptions } from "./cli-support.js";
import {
  getArticleAttachment,
  getChildArticle,
  getParentArticle,
  listArticleAttachments,
  listChildArticles,
  uploadArticleAttachment,
} from "./article-extras.js";
import { articleRecord, articleTable, attachmentRecord, attachmentTable, uploadedAttachments, withView } from "./presentation.js";

export const articlesExtraChildren = [
  command("attachment", "Inspect, upload or download article attachments", [
    articleAttachmentDownloadCommand,
    pagedRead("list <article>", "List attachments", listArticleAttachments, attachmentTable),
    projectedRead("get <article> <attachment>", "Show an attachment", getArticleAttachment, attachmentRecord),
    withView(uploadedAttachments, updateCommand(
      "upload <article>",
      "Upload a file to the article",
      async (connection, { args, options }, context) =>
        uploadArticleAttachment(
          connection,
          args.article,
          String(options.file),
          readOptions(options),
        ),
      [
          ...projectionOptions,
          {
            flags: "--file <path>",
            description: "Local file to upload",
            required: true,
            parse: inputFilePath,
          },
        ],
    )),
  ]),
  command("child", "Inspect an article's child articles", [
    pagedRead("list <article>", "List the immediate child articles", listChildArticles, articleTable),
    projectedRead("get <article> <child>", "Show a child article", getChildArticle, articleRecord),
  ]),
  command("parent", "Inspect an article's parent", [
    projectedRead("get <article>", "Show the parent article", getParentArticle, articleRecord),
  ]),
];
