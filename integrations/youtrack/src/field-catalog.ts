import { encodedID, readCollectionAt, readObjectAt } from "./client.js";

const root = "api/admin/customFieldSettings";
const customFieldFields = "id,name,fieldType(id,presentation,valueType,isMultiValue),aliases";
const fieldTypeFields = "id,presentation,valueType,isMultiValue";
const bundleFields = "id,name,isUpdateable";
const enumValueFields = "id,name,localizedName,description,archived,ordinal";
const stateValueFields = `${enumValueFields},isResolved`;
const bundlePath = (kind: "enum" | "state", bundleID: string) =>
  `${root}/bundles/${kind}/${encodedID(bundleID, "bundle ID")}`;
const valuePath = (kind: "enum" | "state", bundleID: string, valueID?: string) =>
  `${bundlePath(kind, bundleID)}/values` +
  (valueID === undefined ? "" : `/${encodedID(valueID, "value ID")}`);

export const listCustomFields = readCollectionAt(`${root}/customFields`, customFieldFields);
export const getCustomField = readObjectAt(
  (fieldID: string) => `${root}/customFields/${encodedID(fieldID, "field ID")}`,
  customFieldFields,
);
export const listFieldTypes = readCollectionAt(`${root}/types`, fieldTypeFields);
export const listEnumBundles = readCollectionAt(`${root}/bundles/enum`, bundleFields);
export const getEnumBundle = readObjectAt(
  (bundleID: string) => bundlePath("enum", bundleID),
  bundleFields,
);
export const listEnumValues = readCollectionAt(
  (bundleID: string) => valuePath("enum", bundleID),
  enumValueFields,
);
export const getEnumValue = readObjectAt(
  (bundleID: string, valueID: string) => valuePath("enum", bundleID, valueID),
  enumValueFields,
);
export const listStateBundles = readCollectionAt(`${root}/bundles/state`, bundleFields);
export const getStateBundle = readObjectAt(
  (bundleID: string) => bundlePath("state", bundleID),
  bundleFields,
);
export const listStateValues = readCollectionAt(
  (bundleID: string) => valuePath("state", bundleID),
  stateValueFields,
);
export const getStateValue = readObjectAt(
  (bundleID: string, valueID: string) => valuePath("state", bundleID, valueID),
  stateValueFields,
);
