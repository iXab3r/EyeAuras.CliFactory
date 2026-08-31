import { attachmentForm } from "./attachment-form.js";
import {
  encodedID,
  fields,
  page,
  readCollection,
  readNullableObject,
  readObject,
  uploadObjectCollection,
  type Connection,
  type PageOptions,
  type ProjectionOptions,
  type YouTrackObject,
} from "./client.js";

const attachmentFields = "id,name,size,mimeType";
const articleListFields = "id,idReadable,summary,project(id,shortName),updated";
const articleDetailFields = `${articleListFields},content,parentArticle(id,idReadable),created`;

function articlePath(articleID: string): string {
  return `api/articles/${encodedID(articleID, "article ID")}`;
}

export async function listArticleAttachments(
  connection: Connection,
  articleID: string,
  options: PageOptions = {},
): Promise<YouTrackObject[]> {
  return readCollection(
    connection,
    `${articlePath(articleID)}/attachments`,
    page(options, attachmentFields),
  );
}

export async function getArticleAttachment(
  connection: Connection,
  articleID: string,
  attachmentID: string,
  options: ProjectionOptions = {},
): Promise<YouTrackObject> {
  return readObject(
    connection,
    `${articlePath(articleID)}/attachments/${encodedID(attachmentID, "attachment ID")}`,
    { fields: fields(options, attachmentFields) },
  );
}

export async function uploadArticleAttachment(
  connection: Connection,
  articleID: string,
  filePath: string,
  options: ProjectionOptions = {},
): Promise<YouTrackObject[] | null> {
  const path = `${articlePath(articleID)}/attachments`;
  const projection = fields(options, attachmentFields);
  const form = await attachmentForm(filePath);
  return uploadObjectCollection(connection, path, form, projection);
}

export async function listChildArticles(
  connection: Connection,
  articleID: string,
  options: PageOptions = {},
): Promise<YouTrackObject[]> {
  return readCollection(
    connection,
    `${articlePath(articleID)}/childArticles`,
    page(options, articleListFields),
  );
}

export async function getChildArticle(
  connection: Connection,
  articleID: string,
  childID: string,
  options: ProjectionOptions = {},
): Promise<YouTrackObject> {
  return readObject(
    connection,
    `${articlePath(articleID)}/childArticles/${encodedID(childID, "child article ID")}`,
    { fields: fields(options, articleDetailFields) },
  );
}

export async function getParentArticle(
  connection: Connection,
  articleID: string,
  options: ProjectionOptions = {},
): Promise<YouTrackObject | null> {
  return readNullableObject(
    connection,
    `${articlePath(articleID)}/parentArticle`,
    { fields: fields(options, articleDetailFields) },
  );
}
