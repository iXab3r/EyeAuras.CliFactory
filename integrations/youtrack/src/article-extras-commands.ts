import { command } from "@eyeauras/cli-factory";
import { requiredText } from "./client.js";
import { pagedRead, projectedRead, updateCommand, projectionOptions, readOptions } from "./cli-support.js";
import {
  getArticleAttachment,
  getChildArticle,
  getParentArticle,
  listArticleAttachments,
  listChildArticles,
  uploadArticleAttachment,
} from "./article-extras.js";

export const articlesExtraChildren = [
  command("attachment", "Inspect article attachment metadata and upload one file", [
    pagedRead(
      "list <article>",
      "List one page of attachment metadata without downloading files",
      listArticleAttachments,
    ),
    projectedRead(
      "get <article> <attachment>",
      "Read attachment metadata without downloading its contents",
      getArticleAttachment,
    ),
    updateCommand(
      "upload <article>",
      "Upload one selected regular file to an existing article",
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
            description: "Required explicit local input file; no copies or recursion",
            required: true,
            parse: (value) => requiredText(value, "file path"),
          },
        ],
    ),
  ]),
  command("child", "Inspect immediate child articles without recursive traversal", [
    pagedRead("list <article>", "List one page of immediate child articles", listChildArticles),
    projectedRead(
      "get <article> <child>",
      "Read the specified child of the parent article",
      getChildArticle,
    ),
  ]),
  command("parent", "Inspect an article's parent", [
    projectedRead(
      "get <article>",
      "Read the parent; preserve a successful JSON null for no parent",
      getParentArticle,
    ),
  ]),
];
