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

const customFieldFields = "id,name,fieldType(id,presentation,valueType,isMultiValue),aliases";
const fieldTypeFields = "id,presentation,valueType,isMultiValue";
const bundleFields = "id,name,isUpdateable";
const enumValueFields = "id,name,localizedName,description,archived,ordinal";
const stateValueFields = `${enumValueFields},isResolved`;

export async function listCustomFields(
  connection: Connection,
  options: PageOptions = {},
): Promise<YouTrackObject[]> {
  return readCollection(
    connection,
    "api/admin/customFieldSettings/customFields",
    page(options, customFieldFields),
  );
}

export async function getCustomField(
  connection: Connection,
  fieldID: string,
  options: ProjectionOptions = {},
): Promise<YouTrackObject> {
  return readObject(
    connection,
    `api/admin/customFieldSettings/customFields/${encodedID(fieldID, "field ID")}`,
    { fields: fields(options, customFieldFields) },
  );
}

export async function listFieldTypes(
  connection: Connection,
  options: PageOptions = {},
): Promise<YouTrackObject[]> {
  return readCollection(
    connection,
    "api/admin/customFieldSettings/types",
    page(options, fieldTypeFields),
  );
}

export async function listEnumBundles(
  connection: Connection,
  options: PageOptions = {},
): Promise<YouTrackObject[]> {
  return readCollection(
    connection,
    "api/admin/customFieldSettings/bundles/enum",
    page(options, bundleFields),
  );
}

export async function getEnumBundle(
  connection: Connection,
  bundleID: string,
  options: ProjectionOptions = {},
): Promise<YouTrackObject> {
  return readObject(
    connection,
    `api/admin/customFieldSettings/bundles/enum/${encodedID(bundleID, "bundle ID")}`,
    { fields: fields(options, bundleFields) },
  );
}

export async function listEnumValues(
  connection: Connection,
  bundleID: string,
  options: PageOptions = {},
): Promise<YouTrackObject[]> {
  return readCollection(
    connection,
    `api/admin/customFieldSettings/bundles/enum/${encodedID(bundleID, "bundle ID")}/values`,
    page(options, enumValueFields),
  );
}

export async function getEnumValue(
  connection: Connection,
  bundleID: string,
  elementID: string,
  options: ProjectionOptions = {},
): Promise<YouTrackObject> {
  return readObject(
    connection,
    `api/admin/customFieldSettings/bundles/enum/${encodedID(bundleID, "bundle ID")}` +
      `/values/${encodedID(elementID, "value ID")}`,
    { fields: fields(options, enumValueFields) },
  );
}

export async function listStateBundles(
  connection: Connection,
  options: PageOptions = {},
): Promise<YouTrackObject[]> {
  return readCollection(
    connection,
    "api/admin/customFieldSettings/bundles/state",
    page(options, bundleFields),
  );
}

export async function getStateBundle(
  connection: Connection,
  bundleID: string,
  options: ProjectionOptions = {},
): Promise<YouTrackObject> {
  return readObject(
    connection,
    `api/admin/customFieldSettings/bundles/state/${encodedID(bundleID, "bundle ID")}`,
    { fields: fields(options, bundleFields) },
  );
}

export async function listStateValues(
  connection: Connection,
  bundleID: string,
  options: PageOptions = {},
): Promise<YouTrackObject[]> {
  return readCollection(
    connection,
    `api/admin/customFieldSettings/bundles/state/${encodedID(bundleID, "bundle ID")}/values`,
    page(options, stateValueFields),
  );
}

export async function getStateValue(
  connection: Connection,
  bundleID: string,
  elementID: string,
  options: ProjectionOptions = {},
): Promise<YouTrackObject> {
  return readObject(
    connection,
    `api/admin/customFieldSettings/bundles/state/${encodedID(bundleID, "bundle ID")}` +
      `/values/${encodedID(elementID, "value ID")}`,
    { fields: fields(options, stateValueFields) },
  );
}
