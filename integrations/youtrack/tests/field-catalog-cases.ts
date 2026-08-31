import {
  getCustomField,
  getEnumBundle,
  getEnumValue,
  getStateBundle,
  getStateValue,
  listCustomFields,
  listEnumBundles,
  listEnumValues,
  listFieldTypes,
  listStateBundles,
  listStateValues,
} from "../src/field-catalog.js";
import type { Connection, PageOptions, YouTrackObject } from "../src/client.js";

export const catalogID = "fixture /?#%é";
export const valueID = "choice /?#%é";
const root = "/context/api/admin/customFieldSettings";
const encoded = encodeURIComponent(catalogID);
const value = encodeURIComponent(valueID);
const fieldFields = "id,name,fieldType(id,presentation,valueType,isMultiValue),aliases";
const valueFields = "id,name,localizedName,description,archived,ordinal";
interface CatalogCase {
  argv: string[];
  path: string;
  fields: string;
  collection: boolean;
  run: (connection: Connection, options?: PageOptions) => Promise<YouTrackObject | YouTrackObject[]>;
}
export const catalogCases: CatalogCase[] = [
  {
    argv: ["field", "list"], path: `${root}/customFields`, fields: fieldFields, collection: true,
    run: listCustomFields,
  },
  {
    argv: ["field", "get", catalogID], path: `${root}/customFields/${encoded}`,
    fields: fieldFields, collection: false,
    run: (connection, options) => getCustomField(connection, catalogID, options),
  },
  {
    argv: ["field", "type", "list"], path: `${root}/types`,
    fields: "id,presentation,valueType,isMultiValue", collection: true, run: listFieldTypes,
  },
  {
    argv: ["bundle", "enum", "list"], path: `${root}/bundles/enum`,
    fields: "id,name,isUpdateable", collection: true, run: listEnumBundles,
  },
  {
    argv: ["bundle", "enum", "get", catalogID], path: `${root}/bundles/enum/${encoded}`,
    fields: "id,name,isUpdateable", collection: false,
    run: (connection, options) => getEnumBundle(connection, catalogID, options),
  },
  {
    argv: ["bundle", "enum", "value", "list", catalogID],
    path: `${root}/bundles/enum/${encoded}/values`, fields: valueFields, collection: true,
    run: (connection, options) => listEnumValues(connection, catalogID, options),
  },
  {
    argv: ["bundle", "enum", "value", "get", catalogID, valueID],
    path: `${root}/bundles/enum/${encoded}/values/${value}`, fields: valueFields, collection: false,
    run: (connection, options) => getEnumValue(connection, catalogID, valueID, options),
  },
  {
    argv: ["bundle", "state", "list"], path: `${root}/bundles/state`,
    fields: "id,name,isUpdateable", collection: true, run: listStateBundles,
  },
  {
    argv: ["bundle", "state", "get", catalogID], path: `${root}/bundles/state/${encoded}`,
    fields: "id,name,isUpdateable", collection: false,
    run: (connection, options) => getStateBundle(connection, catalogID, options),
  },
  {
    argv: ["bundle", "state", "value", "list", catalogID],
    path: `${root}/bundles/state/${encoded}/values`, fields: `${valueFields},isResolved`, collection: true,
    run: (connection, options) => listStateValues(connection, catalogID, options),
  },
  {
    argv: ["bundle", "state", "value", "get", catalogID, valueID],
    path: `${root}/bundles/state/${encoded}/values/${value}`, fields: `${valueFields},isResolved`,
    collection: false,
    run: (connection, options) => getStateValue(connection, catalogID, valueID, options),
  },
];
