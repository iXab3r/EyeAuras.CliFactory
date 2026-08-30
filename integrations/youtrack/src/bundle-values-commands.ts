import { command, Permission, type CommandDefinition } from "@eyeauras/cli-factory";
import { connection, pageOptions, projectionOptions, readOptions } from "./cli-support.js";
import {
  getBuildBundle,
  getBuildValue,
  getOwnedBundle,
  getOwnedValue,
  getVersionBundle,
  getVersionValue,
  listBuildBundles,
  listBuildValues,
  listOwnedBundles,
  listOwnedValues,
  listVersionBundles,
  listVersionValues,
} from "./bundle-values.js";

export const bundleValuesChildren: readonly CommandDefinition[] = [
  command("build", "Inspect build bundles and their values", [
    command(
      "list",
      "List one page of build bundles without expanding values",
      async ({ options }, context) => listBuildBundles(await connection(context), readOptions(options)),
      { permission: Permission.ReadOnly, options: pageOptions },
    ),
    command(
      "get <bundle>",
      "Show a build bundle by database ID without expanding values",
      async ({ args, options }, context) =>
        getBuildBundle(await connection(context), args.bundle, readOptions(options)),
      { permission: Permission.ReadOnly, options: projectionOptions },
    ),
    command("value", "Inspect values in a build bundle", [
      command(
        "list <bundle>",
        "List one page of build values, preserving archived entries",
        async ({ args, options }, context) =>
          listBuildValues(await connection(context), args.bundle, readOptions(options)),
        { permission: Permission.ReadOnly, options: pageOptions },
      ),
      command(
        "get <bundle> <value>",
        "Show a build value and its assembly timestamp",
        async ({ args, options }, context) => getBuildValue(
          await connection(context), args.bundle, args.value, readOptions(options),
        ),
        { permission: Permission.ReadOnly, options: projectionOptions },
      ),
    ]),
  ]),
  command("owned", "Inspect owned-field bundles and their values", [
    command(
      "list",
      "List one page of owned-field bundles without expanding values",
      async ({ options }, context) => listOwnedBundles(await connection(context), readOptions(options)),
      { permission: Permission.ReadOnly, options: pageOptions },
    ),
    command(
      "get <bundle>",
      "Show an owned-field bundle by database ID without expanding values",
      async ({ args, options }, context) =>
        getOwnedBundle(await connection(context), args.bundle, readOptions(options)),
      { permission: Permission.ReadOnly, options: projectionOptions },
    ),
    command("value", "Inspect values in an owned-field bundle", [
      command(
        "list <bundle>",
        "List one page of owned values, preserving archived entries",
        async ({ args, options }, context) =>
          listOwnedValues(await connection(context), args.bundle, readOptions(options)),
        { permission: Permission.ReadOnly, options: pageOptions },
      ),
      command(
        "get <bundle> <value>",
        "Show an owned value and its associated user",
        async ({ args, options }, context) => getOwnedValue(
          await connection(context), args.bundle, args.value, readOptions(options),
        ),
        { permission: Permission.ReadOnly, options: projectionOptions },
      ),
    ]),
  ]),
  command("version", "Inspect version bundles and their values", [
    command(
      "list",
      "List one page of version bundles without expanding values",
      async ({ options }, context) => listVersionBundles(await connection(context), readOptions(options)),
      { permission: Permission.ReadOnly, options: pageOptions },
    ),
    command(
      "get <bundle>",
      "Show a version bundle by database ID without expanding values",
      async ({ args, options }, context) =>
        getVersionBundle(await connection(context), args.bundle, readOptions(options)),
      { permission: Permission.ReadOnly, options: projectionOptions },
    ),
    command("value", "Inspect version values; default startDate requires YouTrack 2023.1+", [
      command(
        "list <bundle>",
        "List one page of version values, preserving archived entries",
        async ({ args, options }, context) =>
          listVersionValues(await connection(context), args.bundle, readOptions(options)),
        { permission: Permission.ReadOnly, options: pageOptions },
      ),
      command(
        "get <bundle> <value>",
        "Show a version value with raw release/start dates",
        async ({ args, options }, context) => getVersionValue(
          await connection(context), args.bundle, args.value, readOptions(options),
        ),
        { permission: Permission.ReadOnly, options: projectionOptions },
      ),
    ]),
  ]),
];
