import { attachmentForm } from "./attachment-form.js";
import {
  encodedID,
  fields,
  issuePath,
  page,
  readCollection,
  readObject,
  uploadObjectCollection,
  type Connection,
  type PageOptions,
  type ProjectionOptions,
  type YouTrackObject,
} from "./client.js";

const attachmentFields = "id,name,size,mimeType";

export async function listIssueAttachments(
  connection: Connection,
  issueID: string,
  options: PageOptions = {},
): Promise<YouTrackObject[]> {
  return readCollection(
    connection,
    `${issuePath(issueID)}/attachments`,
    page(options, attachmentFields),
  );
}

export async function getIssueAttachment(
  connection: Connection,
  issueID: string,
  attachmentID: string,
  options: ProjectionOptions = {},
): Promise<YouTrackObject> {
  return readObject(
    connection,
    `${issuePath(issueID)}/attachments/${encodedID(attachmentID, "attachment ID")}`,
    { fields: fields(options, attachmentFields) },
  );
}

export async function uploadIssueAttachment(
  connection: Connection,
  issueID: string,
  filePath: string,
): Promise<YouTrackObject[] | null> {
  const path = `${issuePath(issueID)}/attachments`;
  const form = await attachmentForm(filePath);
  return uploadObjectCollection(connection, path, form, attachmentFields);
}
