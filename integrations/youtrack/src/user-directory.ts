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

const bundleRoot = "api/admin/customFieldSettings/bundles/user";
const bundleFields = "id,name,isUpdateable";
const userFields = "id,login,fullName";
const groupFields = "id,name,usersCount,allUsersGroup";

function bundlePath(bundleID: string): string {
  return `${bundleRoot}/${encodedID(bundleID, "user bundle ID")}`;
}

export async function listUserBundles(
  connection: Connection,
  options: PageOptions = {},
): Promise<YouTrackObject[]> {
  return readCollection(connection, bundleRoot, page(options, bundleFields));
}

export async function getUserBundle(
  connection: Connection,
  bundleID: string,
  options: ProjectionOptions = {},
): Promise<YouTrackObject> {
  return readObject(connection, bundlePath(bundleID), { fields: fields(options, bundleFields) });
}

export async function listUserBundleMembers(
  connection: Connection,
  bundleID: string,
  options: PageOptions = {},
): Promise<YouTrackObject[]> {
  return readCollection(
    connection,
    `${bundlePath(bundleID)}/aggregatedUsers`,
    page(options, userFields),
  );
}

export async function listUserBundleGroups(
  connection: Connection,
  bundleID: string,
  options: PageOptions = {},
): Promise<YouTrackObject[]> {
  return readCollection(connection, `${bundlePath(bundleID)}/groups`, page(options, groupFields));
}

export async function getUserBundleGroup(
  connection: Connection,
  bundleID: string,
  groupID: string,
  options: ProjectionOptions = {},
): Promise<YouTrackObject> {
  return readObject(
    connection,
    `${bundlePath(bundleID)}/groups/${encodedID(groupID, "group ID")}`,
    { fields: fields(options, groupFields) },
  );
}

export async function listUserBundleIndividuals(
  connection: Connection,
  bundleID: string,
  options: PageOptions = {},
): Promise<YouTrackObject[]> {
  return readCollection(
    connection,
    `${bundlePath(bundleID)}/individuals`,
    page(options, userFields),
  );
}

export async function getUserBundleIndividual(
  connection: Connection,
  bundleID: string,
  userID: string,
  options: ProjectionOptions = {},
): Promise<YouTrackObject> {
  return readObject(
    connection,
    `${bundlePath(bundleID)}/individuals/${encodedID(userID, "user ID")}`,
    { fields: fields(options, userFields) },
  );
}

export async function getUser(
  connection: Connection,
  userID: string,
  options: ProjectionOptions = {},
): Promise<YouTrackObject> {
  return readObject(connection, `api/users/${encodedID(userID, "user ID or login")}`, {
    fields: fields(options, userFields),
  });
}
