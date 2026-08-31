import { command, Permission } from "@eyeauras/cli-factory";
import { articlesExtraChildren } from "./article-extras-commands.js";
import { bodyOptions, connection, pageOptions, projectionOptions, readOptions } from "./cli-support.js";
import {
  addArticleComment,
  createArticle,
  getArticle,
  getArticleComment,
  listArticleComments,
  listArticles,
  listProjectArticles,
  updateArticle,
  updateArticleComment,
} from "./articles.js";

export const articlesRootCommands = [
  command("article", "Read and write knowledge-base articles", [
    ...articlesExtraChildren,
    command(
      "list",
      "List one page of accessible articles",
      async ({ options }, context) =>
        listArticles(await connection(context), readOptions(options)),
      { permission: Permission.ReadOnly, options: pageOptions },
    ),
    command(
      "get <article>",
      "Read article content and parent identity",
      async ({ args, options }, context) =>
        getArticle(await connection(context), args.article, readOptions(options)),
      { permission: Permission.ReadOnly, options: projectionOptions },
    ),
    command(
      "create",
      "Create an article with project.id, summary and optional content",
      async ({ options }, context) =>
        createArticle(await connection(context), options.body, readOptions(options)),
      { permission: Permission.Update, options: [...bodyOptions, ...projectionOptions] },
    ),
    command(
      "update <article>",
      "Update summary/content; null content clears it and omitted fields stay unchanged",
      async ({ args, options }, context) =>
        updateArticle(
          await connection(context),
          args.article,
          options.body,
          readOptions(options),
        ),
      { permission: Permission.Update, options: [...bodyOptions, ...projectionOptions] },
    ),
    command("comment", "Read and write article comments", [
      command(
        "list <article>",
        "List one page of comments",
        async ({ args, options }, context) =>
          listArticleComments(await connection(context), args.article, readOptions(options)),
        { permission: Permission.ReadOnly, options: pageOptions },
      ),
      command(
        "get <article> <comment>",
        "Read an article comment",
        async ({ args, options }, context) =>
          getArticleComment(
            await connection(context),
            args.article,
            args.comment,
            readOptions(options),
          ),
        { permission: Permission.ReadOnly, options: projectionOptions },
      ),
      command(
        "add <article>",
        "Add an article comment with nonempty text",
        async ({ args, options }, context) =>
          addArticleComment(
            await connection(context),
            args.article,
            options.body,
            readOptions(options),
          ),
        { permission: Permission.Update, options: [...bodyOptions, ...projectionOptions] },
      ),
      command(
        "update <article> <comment>",
        "Replace an article comment's text",
        async ({ args, options }, context) =>
          updateArticleComment(
            await connection(context),
            args.article,
            args.comment,
            options.body,
            readOptions(options),
          ),
        { permission: Permission.Update, options: [...bodyOptions, ...projectionOptions] },
      ),
    ]),
  ]),
];

export const articlesProjectChildren = [
  command("article", "Inspect project knowledge-base articles", [
    command(
      "list <project>",
      "List one page of articles in a project",
      async ({ args, options }, context) =>
        listProjectArticles(await connection(context), args.project, readOptions(options)),
      { permission: Permission.ReadOnly, options: pageOptions },
    ),
  ]),
];
