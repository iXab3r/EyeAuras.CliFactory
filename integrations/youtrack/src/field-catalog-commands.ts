import { command, type CommandDefinition } from "@eyeauras/cli-factory";
import { pagedRead, projectedRead } from "./cli-support.js";
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
} from "./field-catalog.js";

export const fieldCatalogRootCommands: readonly CommandDefinition[] = [
  command("field", "Inspect global custom fields and their types", [
    pagedRead("list", "List one page of global custom fields", listCustomFields),
    projectedRead("get <field>", "Show a global custom field by database ID", getCustomField),
    command("type", "Inspect custom-field types", [
      pagedRead("list", "List one page of supported field types", listFieldTypes),
    ]),
  ]),
];

export const fieldCatalogBundleChildren: readonly CommandDefinition[] = [
  command("enum", "Inspect enum bundles and their values", [
    pagedRead("list", "List one page of enum bundles without expanding values", listEnumBundles),
    projectedRead(
      "get <bundle>",
      "Show an enum bundle by database ID without expanding values",
      getEnumBundle,
    ),
    command("value", "Inspect values in an enum bundle", [
      pagedRead(
        "list <bundle>",
        "List one page of enum values, preserving archived entries",
        listEnumValues,
      ),
      projectedRead(
        "get <bundle> <value>",
        "Show an enum value by database ID",
        getEnumValue,
      ),
    ]),
  ]),
  command("state", "Inspect state bundles and their values", [
    pagedRead("list", "List one page of state bundles without expanding values", listStateBundles),
    projectedRead(
      "get <bundle>",
      "Show a state bundle by database ID without expanding values",
      getStateBundle,
    ),
    command("value", "Inspect values in a state bundle", [
      pagedRead(
        "list <bundle>",
        "List one page of state values, preserving archived entries",
        listStateValues,
      ),
      projectedRead(
        "get <bundle> <value>",
        "Show a state value and whether it resolves an issue",
        getStateValue,
      ),
    ]),
  ]),
];
