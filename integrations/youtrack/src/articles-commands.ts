import { command } from "@eyeauras/cli-factory";
import { articlesExtraChildren } from "./article-extras-commands.js";
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
import {
  articleRecord,
  articleTable,
  commentAdded,
  commentShown,
  commentTable,
  commentUpdated,
  createdArticle,
  exportedArticle,
  updatedArticle,
  withView,
} from "./presentation.js";

export const articlesRootCommands = [
  command("article", "Read and write knowledge-base articles", [
    ...articlesExtraChildren,
    pagedRead("list", "List articles", listArticles, articleTable),
    projectedRead("get <article>", "Show an article", getArticle, articleRecord),
    withView(exportedArticle, readCommand(
      "export <article>",
      "Save the article content as a file",
      async (connection, { args, options }, context) => exportArticle(
        connection,
        args.article,
        context.cwd,
        typeof options.output === "string" ? options.output : undefined,
      ),
      [{ flags: "--output <path>", description: "Save to a relative or absolute path (default: <idReadable>.md)" }],
    )),
    projectedBodyUpdate("create", "Create an article", createArticle, "content", createdArticle),
    projectedBodyUpdate("update <article>", "Update the summary or content", updateArticle, "content", updatedArticle),
    command("comment", "Read and write article comments", [
      pagedRead("list <article>", "List comments", listArticleComments, commentTable),
      projectedRead("get <article> <comment>", "Show a comment", getArticleComment, commentShown),
      projectedBodyUpdate("add <article>", "Add a comment", addArticleComment, "text", commentAdded("article")),
      projectedBodyUpdate(
        "update <article> <comment>",
        "Replace a comment's text",
        updateArticleComment,
        "text",
        commentUpdated("article", "comment"),
      ),
    ]),
  ], {
    examples: ["article list --page-size 20", "article get KB-A-7", "article export KB-A-7 --output onboarding.md"],
  }),
];

export const articlesProjectChildren = [
  command("article", "Inspect the project's articles", [
    pagedRead("list <project>", "List the project's articles", listProjectArticles, articleTable),
  ]),
];
