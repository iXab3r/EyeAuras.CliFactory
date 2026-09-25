import { command } from "@eyeauras/cli-factory";
import { articlesExtraChildren } from "./article-extras-commands.js";
import { downloadName } from "./attachment-download.js";
import { pagedRead, projectedBodyUpdate, projectedRead, readCommand } from "./cli-support.js";
import {
  addArticleComment,
  createArticle,
  exportArticle,
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
    pagedRead("list", "List one page of accessible articles", listArticles),
    projectedRead("get <article>", "Read article content and parent identity", getArticle),
    readCommand(
      "export <article>",
      "Save article content under this profile's downloads directory without overwriting files",
      async (connection, { args, options }, context) => exportArticle(
        connection,
        args.article,
        context.appArguments.AppDataDirectory,
        typeof options.name === "string" ? options.name : undefined,
      ),
      [{ flags: "--name <basename>", description: "Optional safe filename (default: <idReadable>.md)", parse: downloadName }],
    ),
    projectedBodyUpdate(
      "create",
      "Create an article with project.id, summary and optional content",
      createArticle,
      "content",
    ),
    projectedBodyUpdate(
      "update <article>",
      "Update summary/content; null content clears it and omitted fields stay unchanged",
      updateArticle,
      "content",
    ),
    command("comment", "Read and write article comments", [
      pagedRead("list <article>", "List one page of comments", listArticleComments),
      projectedRead("get <article> <comment>", "Read an article comment", getArticleComment),
      projectedBodyUpdate(
        "add <article>",
        "Add an article comment with nonempty text",
        addArticleComment,
        "text",
      ),
      projectedBodyUpdate(
        "update <article> <comment>",
        "Replace an article comment's text",
        updateArticleComment,
        "text",
      ),
    ]),
  ]),
];

export const articlesProjectChildren = [
  command("article", "Inspect project knowledge-base articles", [
    pagedRead("list <project>", "List one page of articles in a project", listProjectArticles),
  ]),
];
