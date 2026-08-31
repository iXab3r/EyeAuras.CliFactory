import { command, Permission } from "@eyeauras/cli-factory";
import { requiredText } from "./client.js";
import { connection, pageOptions, projectionOptions, readOptions } from "./cli-support.js";
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
    command(
      "list <article>",
      "List one page of attachment metadata without downloading files",
      async ({ args, options }, context) =>
        listArticleAttachments(await connection(context), args.article, readOptions(options)),
      { permission: Permission.ReadOnly, options: pageOptions },
    ),
    command(
      "get <article> <attachment>",
      "Read attachment metadata without downloading its contents",
      async ({ args, options }, context) =>
        getArticleAttachment(
          await connection(context),
          args.article,
          args.attachment,
          readOptions(options),
        ),
      { permission: Permission.ReadOnly, options: projectionOptions },
    ),
    command(
      "upload <article>",
      "Upload one selected regular file to an existing article",
      async ({ args, options }, context) =>
        uploadArticleAttachment(
          await connection(context),
          args.article,
          String(options.file),
          readOptions(options),
        ),
      {
        permission: Permission.Update,
        options: [
          ...projectionOptions,
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
  command("child", "Inspect immediate child articles without recursive traversal", [
    command(
      "list <article>",
      "List one page of immediate child articles",
      async ({ args, options }, context) =>
        listChildArticles(await connection(context), args.article, readOptions(options)),
      { permission: Permission.ReadOnly, options: pageOptions },
    ),
    command(
      "get <article> <child>",
      "Read the specified child of the parent article",
      async ({ args, options }, context) =>
        getChildArticle(
          await connection(context),
          args.article,
          args.child,
          readOptions(options),
        ),
      { permission: Permission.ReadOnly, options: projectionOptions },
    ),
  ]),
  command("parent", "Inspect an article's parent", [
    command(
      "get <article>",
      "Read the parent; preserve a successful JSON null for no parent",
      async ({ args, options }, context) =>
        getParentArticle(await connection(context), args.article, readOptions(options)),
      { permission: Permission.ReadOnly, options: projectionOptions },
    ),
  ]),
];
