import {
  encodedID,
  fields,
  mutate,
  mutationBody,
  narrative,
  nullableText,
  readCollectionAt,
  readObjectAt,
  type Connection,
  type ProjectionOptions,
  type YouTrackObject,
} from "./client.js";

const articleListFields = "id,idReadable,summary,project(id,shortName),updated";
const articleDetailFields = `${articleListFields},content,parentArticle(id,idReadable),created`;
const articleWriteFields = "id,idReadable,summary,updated";
const articleCommentFields = "id,text,author(id,login),created,updated";

function articlePath(articleID: string): string {
  return `api/articles/${encodedID(articleID, "article ID")}`;
}

export const listArticles = readCollectionAt("api/articles", articleListFields);
export const getArticle = readObjectAt(articlePath, articleDetailFields);

export async function createArticle(
  connection: Connection,
  input: unknown,
  options: ProjectionOptions = {},
): Promise<YouTrackObject | null> {
  const body = mutationBody(input, ["project", "summary", "content"]);
  const project = mutationBody(body.project, ["id"]);
  return mutate(
    connection,
    "api/articles",
    {
      project: { id: narrative(project.id, "project.id") },
      summary: narrative(body.summary, "summary"),
      ...(Object.hasOwn(body, "content") ? { content: nullableText(body.content, "article content") } : {}),
    },
    fields(options, articleWriteFields),
  );
}

export async function updateArticle(
  connection: Connection,
  articleID: string,
  input: unknown,
  options: ProjectionOptions = {},
): Promise<YouTrackObject | null> {
  const body = mutationBody(input, ["summary", "content"]);
  if (Object.keys(body).length === 0) {
    throw new Error("YouTrack article update requires summary or content.");
  }
  return mutate(
    connection,
    articlePath(articleID),
    {
      ...(Object.hasOwn(body, "summary") ? { summary: narrative(body.summary, "summary") } : {}),
      ...(Object.hasOwn(body, "content") ? { content: nullableText(body.content, "article content") } : {}),
    },
    fields(options, articleWriteFields),
  );
}

export const listArticleComments = readCollectionAt(
  (articleID: string) => `${articlePath(articleID)}/comments`,
  articleCommentFields,
);
export const getArticleComment = readObjectAt(
  (articleID: string, commentID: string) =>
    `${articlePath(articleID)}/comments/${encodedID(commentID, "comment ID")}`,
  articleCommentFields,
);

export async function addArticleComment(
  connection: Connection,
  articleID: string,
  input: unknown,
  options: ProjectionOptions = {},
): Promise<YouTrackObject | null> {
  const body = mutationBody(input, ["text"]);
  return mutate(
    connection,
    `${articlePath(articleID)}/comments`,
    { text: narrative(body.text, "text") },
    fields(options, articleCommentFields),
  );
}

export async function updateArticleComment(
  connection: Connection,
  articleID: string,
  commentID: string,
  input: unknown,
  options: ProjectionOptions = {},
): Promise<YouTrackObject | null> {
  const body = mutationBody(input, ["text"]);
  return mutate(
    connection,
    `${articlePath(articleID)}/comments/${encodedID(commentID, "comment ID")}`,
    { text: narrative(body.text, "text") },
    fields(options, articleCommentFields),
  );
}

export const listProjectArticles = readCollectionAt(
  (projectID: string) => `api/admin/projects/${encodedID(projectID, "project ID")}/articles`,
  articleListFields,
);
