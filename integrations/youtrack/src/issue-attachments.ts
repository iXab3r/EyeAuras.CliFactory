import { attachmentForm } from "./attachment-form.js";
import {
  encodedID,
  issuePath,
  readCollectionAt,
  readObjectAt,
  uploadObjectCollection,
  type Connection,
  type YouTrackObject,
} from "./client.js";

const attachmentFields = "id,name,size,mimeType";

export const listIssueAttachments = readCollectionAt(
  (issueID: string) => `${issuePath(issueID)}/attachments`,
  attachmentFields,
);
export const getIssueAttachment = readObjectAt(
  (issueID: string, attachmentID: string) =>
    `${issuePath(issueID)}/attachments/${encodedID(attachmentID, "attachment ID")}`,
  attachmentFields,
);

export async function uploadIssueAttachment(
  connection: Connection,
  issueID: string,
  filePath: string,
): Promise<YouTrackObject[] | null> {
  const path = `${issuePath(issueID)}/attachments`;
  const form = await attachmentForm(filePath);
  return uploadObjectCollection(connection, path, form, attachmentFields);
}
