import { attachmentForm } from "./attachment-form.js";
import {
  encodedID,
  fields,
  readCollectionAt,
  readNullableObject,
  readObjectAt,
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

export const listArticleAttachments = readCollectionAt(
  (articleID: string) => `${articlePath(articleID)}/attachments`,
  attachmentFields,
);
export const getArticleAttachment = readObjectAt(
  (articleID: string, attachmentID: string) =>
    `${articlePath(articleID)}/attachments/${encodedID(attachmentID, "attachment ID")}`,
  attachmentFields,
);

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

export const listChildArticles = readCollectionAt(
  (articleID: string) => `${articlePath(articleID)}/childArticles`,
  articleListFields,
);
export const getChildArticle = readObjectAt(
  (articleID: string, childID: string) =>
    `${articlePath(articleID)}/childArticles/${encodedID(childID, "child article ID")}`,
  articleDetailFields,
);

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
