import { command } from "@eyeauras/cli-factory";
import { articlesExtraChildren } from "./article-extras-commands.js";
import { pagedRead, projectedBodyUpdate, projectedRead } from "./cli-support.js";
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
    pagedRead("list", "List one page of accessible articles", listArticles),
    projectedRead("get <article>", "Read article content and parent identity", getArticle),
    projectedBodyUpdate(
      "create",
      "Create an article with project.id, summary and optional content",
      createArticle,
    ),
    projectedBodyUpdate(
      "update <article>",
      "Update summary/content; null content clears it and omitted fields stay unchanged",
      updateArticle,
    ),
    command("comment", "Read and write article comments", [
      pagedRead("list <article>", "List one page of comments", listArticleComments),
      projectedRead("get <article> <comment>", "Read an article comment", getArticleComment),
      projectedBodyUpdate(
        "add <article>",
        "Add an article comment with nonempty text",
        addArticleComment,
      ),
      projectedBodyUpdate(
        "update <article> <comment>",
        "Replace an article comment's text",
        updateArticleComment,
      ),
    ]),
  ]),
];

export const articlesProjectChildren = [
  command("article", "Inspect project knowledge-base articles", [
    pagedRead("list <project>", "List one page of articles in a project", listProjectArticles),
  ]),
];
