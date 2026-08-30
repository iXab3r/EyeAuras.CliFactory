import {
  encodedID,
  fields,
  page,
  readCollection,
  readObject,
  type Connection,
  type PageOptions,
  type ProjectionOptions,
  type YouTrackObject,
} from "./client.js";

export interface MemberOptions extends PageOptions {
  direct?: boolean;
}

const groupFields = "id,name,usersCount";
const userFields = "id,login,fullName";

function groupPath(groupID: string): string {
  return `api/groups/${encodedID(groupID, "group ID")}`;
}

function teamPath(projectID: string): string {
  return `api/admin/projects/${encodedID(projectID, "project ID")}/team`;
}

export async function listGroups(
  connection: Connection,
  options: PageOptions = {},
): Promise<YouTrackObject[]> {
  return readCollection(connection, "api/groups", page(options, groupFields));
}

export async function getGroup(
  connection: Connection,
  groupID: string,
  options: ProjectionOptions = {},
): Promise<YouTrackObject> {
  return readObject(connection, groupPath(groupID), { fields: fields(options, groupFields) });
}

export async function listGroupMembers(
  connection: Connection,
  groupID: string,
  options: MemberOptions = {},
): Promise<YouTrackObject[]> {
  const members = options.direct === true ? "ownUsers" : "users";
  return readCollection(connection, `${groupPath(groupID)}/${members}`, page(options, userFields));
}

export async function listSubgroups(
  connection: Connection,
  groupID: string,
  options: PageOptions = {},
): Promise<YouTrackObject[]> {
  return readCollection(connection, `${groupPath(groupID)}/subGroups`, page(options, groupFields));
}

export async function getProjectTeam(
  connection: Connection,
  projectID: string,
  options: ProjectionOptions = {},
): Promise<YouTrackObject> {
  return readObject(connection, teamPath(projectID), { fields: fields(options, groupFields) });
}

export async function listProjectTeamGroups(
  connection: Connection,
  projectID: string,
  options: PageOptions = {},
): Promise<YouTrackObject[]> {
  return readCollection(connection, `${teamPath(projectID)}/groups`, page(options, groupFields));
}

export async function listProjectTeamUsers(
  connection: Connection,
  projectID: string,
  options: MemberOptions = {},
): Promise<YouTrackObject[]> {
  const members = options.direct === true ? "ownUsers" : "users";
  return readCollection(connection, `${teamPath(projectID)}/${members}`, page(options, userFields));
}
