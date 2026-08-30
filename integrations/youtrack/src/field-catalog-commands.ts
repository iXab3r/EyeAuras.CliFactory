import { command, Permission, type CommandDefinition } from "@eyeauras/cli-factory";
import { connection, pageOptions, projectionOptions, readOptions } from "./cli-support.js";
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
    command(
      "list",
      "List one page of global custom fields",
      async ({ options }, context) => listCustomFields(await connection(context), readOptions(options)),
      { permission: Permission.ReadOnly, options: pageOptions },
    ),
    command(
      "get <field>",
      "Show a global custom field by database ID",
      async ({ args, options }, context) =>
        getCustomField(await connection(context), args.field, readOptions(options)),
      { permission: Permission.ReadOnly, options: projectionOptions },
    ),
    command("type", "Inspect custom-field types", [
      command(
        "list",
        "List one page of supported field types",
        async ({ options }, context) => listFieldTypes(await connection(context), readOptions(options)),
        { permission: Permission.ReadOnly, options: pageOptions },
      ),
    ]),
  ]),
];

export const fieldCatalogBundleChildren: readonly CommandDefinition[] = [
  command("enum", "Inspect enum bundles and their values", [
    command(
      "list",
      "List one page of enum bundles without expanding values",
      async ({ options }, context) => listEnumBundles(await connection(context), readOptions(options)),
      { permission: Permission.ReadOnly, options: pageOptions },
    ),
    command(
      "get <bundle>",
      "Show an enum bundle by database ID without expanding values",
      async ({ args, options }, context) =>
        getEnumBundle(await connection(context), args.bundle, readOptions(options)),
      { permission: Permission.ReadOnly, options: projectionOptions },
    ),
    command("value", "Inspect values in an enum bundle", [
      command(
        "list <bundle>",
        "List one page of enum values, preserving archived entries",
        async ({ args, options }, context) =>
          listEnumValues(await connection(context), args.bundle, readOptions(options)),
        { permission: Permission.ReadOnly, options: pageOptions },
      ),
      command(
        "get <bundle> <value>",
        "Show an enum value by database ID",
        async ({ args, options }, context) => getEnumValue(
          await connection(context), args.bundle, args.value, readOptions(options),
        ),
        { permission: Permission.ReadOnly, options: projectionOptions },
      ),
    ]),
  ]),
  command("state", "Inspect state bundles and their values", [
    command(
      "list",
      "List one page of state bundles without expanding values",
      async ({ options }, context) => listStateBundles(await connection(context), readOptions(options)),
      { permission: Permission.ReadOnly, options: pageOptions },
    ),
    command(
      "get <bundle>",
      "Show a state bundle by database ID without expanding values",
      async ({ args, options }, context) =>
        getStateBundle(await connection(context), args.bundle, readOptions(options)),
      { permission: Permission.ReadOnly, options: projectionOptions },
    ),
    command("value", "Inspect values in a state bundle", [
      command(
        "list <bundle>",
        "List one page of state values, preserving archived entries",
        async ({ args, options }, context) =>
          listStateValues(await connection(context), args.bundle, readOptions(options)),
        { permission: Permission.ReadOnly, options: pageOptions },
      ),
      command(
        "get <bundle> <value>",
        "Show a state value and whether it resolves an issue",
        async ({ args, options }, context) => getStateValue(
          await connection(context), args.bundle, args.value, readOptions(options),
        ),
        { permission: Permission.ReadOnly, options: projectionOptions },
      ),
    ]),
  ]),
];
