import {
  getBuildBundle, getBuildValue, getOwnedBundle, getOwnedValue, getVersionBundle, getVersionValue,
  listBuildBundles, listBuildValues, listOwnedBundles, listOwnedValues, listVersionBundles, listVersionValues,
} from "../src/bundle-values.js";
import type { Connection, PageOptions, YouTrackObject } from "../src/client.js";

export const bundleID = "fixture /?#%é";
export const elementID = "choice /?#%é";
const root = "/context/api/admin/customFieldSettings/bundles";
const bundle = encodeURIComponent(bundleID);
const element = encodeURIComponent(elementID);
const bundleFields = "id,name,isUpdateable";
const commonFields = "id,name,description,archived,ordinal";
const buildFields = `${commonFields},assembleDate`;
const ownedFields = `${commonFields},owner(id,login)`;
const versionFields = `${commonFields},released,releaseDate,startDate`;
interface BundleCase {
  argv: string[];
  path: string;
  fields: string;
  collection: boolean;
  run: (connection: Connection, options?: PageOptions) => Promise<YouTrackObject | YouTrackObject[]>;
}
export const bundleCases: BundleCase[] = [
  {
    argv: ["bundle", "build", "list"], path: `${root}/build`,
    fields: bundleFields, collection: true, run: listBuildBundles,
  },
  {
    argv: ["bundle", "build", "get", bundleID], path: `${root}/build/${bundle}`,
    fields: bundleFields, collection: false,
    run: (connection, options) => getBuildBundle(connection, bundleID, options),
  },
  {
    argv: ["bundle", "build", "value", "list", bundleID], path: `${root}/build/${bundle}/values`,
    fields: buildFields, collection: true,
    run: (connection, options) => listBuildValues(connection, bundleID, options),
  },
  {
    argv: ["bundle", "build", "value", "get", bundleID, elementID],
    path: `${root}/build/${bundle}/values/${element}`, fields: buildFields, collection: false,
    run: (connection, options) => getBuildValue(connection, bundleID, elementID, options),
  },
  {
    argv: ["bundle", "owned", "list"], path: `${root}/ownedField`,
    fields: bundleFields, collection: true, run: listOwnedBundles,
  },
  {
    argv: ["bundle", "owned", "get", bundleID], path: `${root}/ownedField/${bundle}`,
    fields: bundleFields, collection: false,
    run: (connection, options) => getOwnedBundle(connection, bundleID, options),
  },
  {
    argv: ["bundle", "owned", "value", "list", bundleID], path: `${root}/ownedField/${bundle}/values`,
    fields: ownedFields, collection: true,
    run: (connection, options) => listOwnedValues(connection, bundleID, options),
  },
  {
    argv: ["bundle", "owned", "value", "get", bundleID, elementID],
    path: `${root}/ownedField/${bundle}/values/${element}`, fields: ownedFields, collection: false,
    run: (connection, options) => getOwnedValue(connection, bundleID, elementID, options),
  },
  {
    argv: ["bundle", "version", "list"], path: `${root}/version`,
    fields: bundleFields, collection: true, run: listVersionBundles,
  },
  {
    argv: ["bundle", "version", "get", bundleID], path: `${root}/version/${bundle}`,
    fields: bundleFields, collection: false,
    run: (connection, options) => getVersionBundle(connection, bundleID, options),
  },
  {
    argv: ["bundle", "version", "value", "list", bundleID], path: `${root}/version/${bundle}/values`,
    fields: versionFields, collection: true,
    run: (connection, options) => listVersionValues(connection, bundleID, options),
  },
  {
    argv: ["bundle", "version", "value", "get", bundleID, elementID],
    path: `${root}/version/${bundle}/values/${element}`, fields: versionFields, collection: false,
    run: (connection, options) => getVersionValue(connection, bundleID, elementID, options),
  },
];
