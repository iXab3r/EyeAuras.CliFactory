import { command, type CommandDefinition } from "@eyeauras/cli-factory";
import { pagedRead, projectedRead } from "./cli-support.js";
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
    pagedRead("list", "List one page of build bundles without expanding values", listBuildBundles),
    projectedRead(
      "get <bundle>",
      "Show a build bundle by database ID without expanding values",
      getBuildBundle,
    ),
    command("value", "Inspect values in a build bundle", [
      pagedRead(
        "list <bundle>",
        "List one page of build values, preserving archived entries",
        listBuildValues,
      ),
      projectedRead(
        "get <bundle> <value>",
        "Show a build value and its assembly timestamp",
        getBuildValue,
      ),
    ]),
  ]),
  command("owned", "Inspect owned-field bundles and their values", [
    pagedRead(
      "list",
      "List one page of owned-field bundles without expanding values",
      listOwnedBundles,
    ),
    projectedRead(
      "get <bundle>",
      "Show an owned-field bundle by database ID without expanding values",
      getOwnedBundle,
    ),
    command("value", "Inspect values in an owned-field bundle", [
      pagedRead(
        "list <bundle>",
        "List one page of owned values, preserving archived entries",
        listOwnedValues,
      ),
      projectedRead(
        "get <bundle> <value>",
        "Show an owned value and its associated user",
        getOwnedValue,
      ),
    ]),
  ]),
  command("version", "Inspect version bundles and their values", [
    pagedRead(
      "list",
      "List one page of version bundles without expanding values",
      listVersionBundles,
    ),
    projectedRead(
      "get <bundle>",
      "Show a version bundle by database ID without expanding values",
      getVersionBundle,
    ),
    command("value", "Inspect version values; default startDate requires YouTrack 2023.1+", [
      pagedRead(
        "list <bundle>",
        "List one page of version values, preserving archived entries",
        listVersionValues,
      ),
      projectedRead(
        "get <bundle> <value>",
        "Show a version value with raw release/start dates",
        getVersionValue,
      ),
    ]),
  ]),
];
