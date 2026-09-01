import {
  encodedID,
  page,
  readCollection,
  readCollectionAt,
  readObjectAt,
  type Connection,
  type PageOptions,
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

export const listGroups = readCollectionAt("api/groups", groupFields);
export const getGroup = readObjectAt(groupPath, groupFields);

export async function listGroupMembers(
  connection: Connection,
  groupID: string,
  options: MemberOptions = {},
): Promise<YouTrackObject[]> {
  const members = options.direct === true ? "ownUsers" : "users";
  return readCollection(connection, `${groupPath(groupID)}/${members}`, page(options, userFields));
}

export const listSubgroups = readCollectionAt(
  (groupID: string) => `${groupPath(groupID)}/subGroups`,
  groupFields,
);
export const getProjectTeam = readObjectAt(teamPath, groupFields);
export const listProjectTeamGroups = readCollectionAt(
  (projectID: string) => `${teamPath(projectID)}/groups`,
  groupFields,
);

export async function listProjectTeamUsers(
  connection: Connection,
  projectID: string,
  options: MemberOptions = {},
): Promise<YouTrackObject[]> {
  const members = options.direct === true ? "ownUsers" : "users";
  return readCollection(connection, `${teamPath(projectID)}/${members}`, page(options, userFields));
}
