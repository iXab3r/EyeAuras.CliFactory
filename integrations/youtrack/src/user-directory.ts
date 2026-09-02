import { encodedID, readCollectionAt, readObjectAt } from "./client.js";

const bundleRoot = "api/admin/customFieldSettings/bundles/user";
const bundleFields = "id,name,isUpdateable";
const userFields = "id,login,fullName";
const groupFields = "id,name,usersCount,allUsersGroup";
const bundlePath = (bundleID: string) =>
  `${bundleRoot}/${encodedID(bundleID, "user bundle ID")}`;

export const listUserBundles = readCollectionAt(bundleRoot, bundleFields);
export const getUserBundle = readObjectAt(bundlePath, bundleFields);
export const listUserBundleMembers = readCollectionAt(
  (bundleID: string) => `${bundlePath(bundleID)}/aggregatedUsers`,
  userFields,
);
export const listUserBundleGroups = readCollectionAt(
  (bundleID: string) => `${bundlePath(bundleID)}/groups`,
  groupFields,
);
export const getUserBundleGroup = readObjectAt(
  (bundleID: string, groupID: string) =>
    `${bundlePath(bundleID)}/groups/${encodedID(groupID, "group ID")}`,
  groupFields,
);
export const listUserBundleIndividuals = readCollectionAt(
  (bundleID: string) => `${bundlePath(bundleID)}/individuals`,
  userFields,
);
export const getUserBundleIndividual = readObjectAt(
  (bundleID: string, userID: string) =>
    `${bundlePath(bundleID)}/individuals/${encodedID(userID, "user ID")}`,
  userFields,
);
export const getUser = readObjectAt(
  (userID: string) => `api/users/${encodedID(userID, "user ID or login")}`,
  userFields,
);
