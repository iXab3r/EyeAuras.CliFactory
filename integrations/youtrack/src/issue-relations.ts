import {
  deleteObject,
  encodedID,
  fields,
  issuePath,
  mutate,
  mutationBody,
  narrative,
  page,
  readCollection,
  readObject,
  type Connection,
  type PageOptions,
  type ProjectionOptions,
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

export async function listLinkTypes(
  connection: Connection,
  options: PageOptions = {},
): Promise<YouTrackObject[]> {
  return readCollection(connection, "api/issueLinkTypes", page(options, linkTypeFields));
}

export async function getLinkType(
  connection: Connection,
  typeID: string,
  options: ProjectionOptions = {},
): Promise<YouTrackObject> {
  return readObject(connection, `api/issueLinkTypes/${encodedID(typeID, "link type ID")}`, {
    fields: fields(options, linkTypeFields),
  });
}

export async function listIssueLinks(
  connection: Connection,
  issueID: string,
  options: PageOptions = {},
): Promise<YouTrackObject[]> {
  return readCollection(connection, `${issuePath(issueID)}/links`, page(options, linkFields));
}

export async function getIssueLink(
  connection: Connection,
  issueID: string,
  linkID: string,
  options: ProjectionOptions = {},
): Promise<YouTrackObject> {
  return readObject(connection, linkPath(issueID, linkID), { fields: fields(options, linkFields) });
}

export async function listLinkedIssues(
  connection: Connection,
  issueID: string,
  linkID: string,
  options: PageOptions = {},
): Promise<YouTrackObject[]> {
  return readCollection(
    connection,
    `${linkPath(issueID, linkID)}/issues`,
    page(options, linkedIssueFields),
  );
}

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

export async function listTags(
  connection: Connection,
  options: PageOptions = {},
): Promise<YouTrackObject[]> {
  return readCollection(connection, "api/tags", page(options, tagFields));
}

export async function getTag(
  connection: Connection,
  tagID: string,
  options: ProjectionOptions = {},
): Promise<YouTrackObject> {
  return readObject(connection, `api/tags/${encodedID(tagID, "tag ID")}`, {
    fields: fields(options, tagFields),
  });
}

export async function listIssueTags(
  connection: Connection,
  issueID: string,
  options: PageOptions = {},
): Promise<YouTrackObject[]> {
  return readCollection(connection, `${issuePath(issueID)}/tags`, page(options, tagFields));
}

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
