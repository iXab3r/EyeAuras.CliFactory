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

const bundleFields = "id,name,isUpdateable";
const valueFields = "id,name,description,archived,ordinal";
const buildValueFields = `${valueFields},assembleDate`;
const ownedValueFields = `${valueFields},owner(id,login)`;
const versionValueFields = `${valueFields},released,releaseDate,startDate`;

export async function listBuildBundles(
  connection: Connection,
  options: PageOptions = {},
): Promise<YouTrackObject[]> {
  return readCollection(
    connection,
    "api/admin/customFieldSettings/bundles/build",
    page(options, bundleFields),
  );
}

export async function getBuildBundle(
  connection: Connection,
  bundleID: string,
  options: ProjectionOptions = {},
): Promise<YouTrackObject> {
  return readObject(
    connection,
    `api/admin/customFieldSettings/bundles/build/${encodedID(bundleID, "bundle ID")}`,
    { fields: fields(options, bundleFields) },
  );
}

export async function listBuildValues(
  connection: Connection,
  bundleID: string,
  options: PageOptions = {},
): Promise<YouTrackObject[]> {
  return readCollection(
    connection,
    `api/admin/customFieldSettings/bundles/build/${encodedID(bundleID, "bundle ID")}/values`,
    page(options, buildValueFields),
  );
}

export async function getBuildValue(
  connection: Connection,
  bundleID: string,
  elementID: string,
  options: ProjectionOptions = {},
): Promise<YouTrackObject> {
  return readObject(
    connection,
    `api/admin/customFieldSettings/bundles/build/${encodedID(bundleID, "bundle ID")}` +
      `/values/${encodedID(elementID, "value ID")}`,
    { fields: fields(options, buildValueFields) },
  );
}

export async function listOwnedBundles(
  connection: Connection,
  options: PageOptions = {},
): Promise<YouTrackObject[]> {
  return readCollection(
    connection,
    "api/admin/customFieldSettings/bundles/ownedField",
    page(options, bundleFields),
  );
}

export async function getOwnedBundle(
  connection: Connection,
  bundleID: string,
  options: ProjectionOptions = {},
): Promise<YouTrackObject> {
  return readObject(
    connection,
    `api/admin/customFieldSettings/bundles/ownedField/${encodedID(bundleID, "bundle ID")}`,
    { fields: fields(options, bundleFields) },
  );
}

export async function listOwnedValues(
  connection: Connection,
  bundleID: string,
  options: PageOptions = {},
): Promise<YouTrackObject[]> {
  return readCollection(
    connection,
    `api/admin/customFieldSettings/bundles/ownedField/${encodedID(bundleID, "bundle ID")}/values`,
    page(options, ownedValueFields),
  );
}

export async function getOwnedValue(
  connection: Connection,
  bundleID: string,
  elementID: string,
  options: ProjectionOptions = {},
): Promise<YouTrackObject> {
  return readObject(
    connection,
    `api/admin/customFieldSettings/bundles/ownedField/${encodedID(bundleID, "bundle ID")}` +
      `/values/${encodedID(elementID, "value ID")}`,
    { fields: fields(options, ownedValueFields) },
  );
}

export async function listVersionBundles(
  connection: Connection,
  options: PageOptions = {},
): Promise<YouTrackObject[]> {
  return readCollection(
    connection,
    "api/admin/customFieldSettings/bundles/version",
    page(options, bundleFields),
  );
}

export async function getVersionBundle(
  connection: Connection,
  bundleID: string,
  options: ProjectionOptions = {},
): Promise<YouTrackObject> {
  return readObject(
    connection,
    `api/admin/customFieldSettings/bundles/version/${encodedID(bundleID, "bundle ID")}`,
    { fields: fields(options, bundleFields) },
  );
}

export async function listVersionValues(
  connection: Connection,
  bundleID: string,
  options: PageOptions = {},
): Promise<YouTrackObject[]> {
  return readCollection(
    connection,
    `api/admin/customFieldSettings/bundles/version/${encodedID(bundleID, "bundle ID")}/values`,
    page(options, versionValueFields),
  );
}

export async function getVersionValue(
  connection: Connection,
  bundleID: string,
  elementID: string,
  options: ProjectionOptions = {},
): Promise<YouTrackObject> {
  return readObject(
    connection,
    `api/admin/customFieldSettings/bundles/version/${encodedID(bundleID, "bundle ID")}` +
      `/values/${encodedID(elementID, "value ID")}`,
    { fields: fields(options, versionValueFields) },
  );
}
