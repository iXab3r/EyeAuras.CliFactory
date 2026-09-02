import {
  deleteObject,
  encodedID,
  issuePath,
  mutate,
  mutationBody,
  narrative,
  readCollectionAt,
  readObjectAt,
  type Connection,
  type YouTrackObject,
} from "./client.js";

const linkTypeFields = "id,name,directed,sourceToTarget,targetToSource";
const linkFields = `id,direction,linkType(${linkTypeFields})`;
const linkedIssueFields = "id,idReadable,summary";
const tagFields = "id,name";

function linkPath(issueID: string, linkID: string): string {
  return `${issuePath(issueID)}/links/${encodedID(linkID, "link ID")}`;
}

function targetBody(input: unknown): YouTrackObject {
  const body = mutationBody(input, ["id"]);
  const id = narrative(body.id, "target id");
  encodedID(id, "target ID");
  return { id };
}

export const listLinkTypes = readCollectionAt("api/issueLinkTypes", linkTypeFields);
export const getLinkType = readObjectAt(
  (typeID: string) => `api/issueLinkTypes/${encodedID(typeID, "link type ID")}`,
  linkTypeFields,
);
export const listIssueLinks = readCollectionAt(
  (issueID: string) => `${issuePath(issueID)}/links`,
  linkFields,
);
export const getIssueLink = readObjectAt(linkPath, linkFields);
export const listLinkedIssues = readCollectionAt(
  (issueID: string, linkID: string) => `${linkPath(issueID, linkID)}/issues`,
  linkedIssueFields,
);

export async function addIssueLink(
  connection: Connection,
  issueID: string,
  linkID: string,
  input: unknown,
): Promise<YouTrackObject | null> {
  return mutate(connection, `${linkPath(issueID, linkID)}/issues`, targetBody(input), linkedIssueFields);
}

export async function removeIssueLink(
  connection: Connection,
  issueID: string,
  linkID: string,
  targetIssueID: string,
): Promise<YouTrackObject | null> {
  return deleteObject(
    connection,
    `${linkPath(issueID, linkID)}/issues/${encodedID(targetIssueID, "target issue ID")}`,
  );
}

export const listTags = readCollectionAt("api/tags", tagFields);
export const getTag = readObjectAt(
  (tagID: string) => `api/tags/${encodedID(tagID, "tag ID")}`,
  tagFields,
);
export const listIssueTags = readCollectionAt(
  (issueID: string) => `${issuePath(issueID)}/tags`,
  tagFields,
);

export async function addIssueTag(
  connection: Connection,
  issueID: string,
  input: unknown,
): Promise<YouTrackObject | null> {
  return mutate(connection, `${issuePath(issueID)}/tags`, targetBody(input), tagFields);
}

export async function removeIssueTag(
  connection: Connection,
  issueID: string,
  tagID: string,
): Promise<YouTrackObject | null> {
  return deleteObject(connection, `${issuePath(issueID)}/tags/${encodedID(tagID, "tag ID")}`);
}
