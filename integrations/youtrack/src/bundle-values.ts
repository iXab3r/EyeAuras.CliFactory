import { encodedID, readCollectionAt, readObjectAt } from "./client.js";

type BundleKind = "build" | "ownedField" | "version";

const root = "api/admin/customFieldSettings/bundles";
const bundleFields = "id,name,isUpdateable";
const valueFields = "id,name,description,archived,ordinal";
const buildValueFields = `${valueFields},assembleDate`;
const ownedValueFields = `${valueFields},owner(id,login)`;
const versionValueFields = `${valueFields},released,releaseDate,startDate`;
const bundlePath = (kind: BundleKind, bundleID?: string) =>
  `${root}/${kind}` +
  (bundleID === undefined ? "" : `/${encodedID(bundleID, "bundle ID")}`);
const valuePath = (kind: BundleKind, bundleID: string, valueID?: string) =>
  `${bundlePath(kind, bundleID)}/values` +
  (valueID === undefined ? "" : `/${encodedID(valueID, "value ID")}`);

export const listBuildBundles = readCollectionAt(bundlePath("build"), bundleFields);
export const getBuildBundle = readObjectAt(
  (bundleID: string) => bundlePath("build", bundleID),
  bundleFields,
);
export const listBuildValues = readCollectionAt(
  (bundleID: string) => valuePath("build", bundleID),
  buildValueFields,
);
export const getBuildValue = readObjectAt(
  (bundleID: string, valueID: string) => valuePath("build", bundleID, valueID),
  buildValueFields,
);
export const listOwnedBundles = readCollectionAt(bundlePath("ownedField"), bundleFields);
export const getOwnedBundle = readObjectAt(
  (bundleID: string) => bundlePath("ownedField", bundleID),
  bundleFields,
);
export const listOwnedValues = readCollectionAt(
  (bundleID: string) => valuePath("ownedField", bundleID),
  ownedValueFields,
);
export const getOwnedValue = readObjectAt(
  (bundleID: string, valueID: string) => valuePath("ownedField", bundleID, valueID),
  ownedValueFields,
);
export const listVersionBundles = readCollectionAt(bundlePath("version"), bundleFields);
export const getVersionBundle = readObjectAt(
  (bundleID: string) => bundlePath("version", bundleID),
  bundleFields,
);
export const listVersionValues = readCollectionAt(
  (bundleID: string) => valuePath("version", bundleID),
  versionValueFields,
);
export const getVersionValue = readObjectAt(
  (bundleID: string, valueID: string) => valuePath("version", bundleID, valueID),
  versionValueFields,
);
