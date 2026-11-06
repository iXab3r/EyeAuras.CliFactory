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
import { namedTable } from "./presentation.js";

const bundleTable = namedTable("BUNDLE", "No bundles.");
const valueTable = namedTable("VALUE", "No values.");

export const bundleValuesChildren: readonly CommandDefinition[] = [
  command("build", "Inspect build bundles", [
    pagedRead("list", "List build bundles", listBuildBundles, bundleTable),
    projectedRead("get <bundle>", "Show a build bundle", getBuildBundle),
    command("value", "Inspect build values", [
      pagedRead("list <bundle>", "List the bundle's values", listBuildValues, valueTable),
      projectedRead("get <bundle> <value>", "Show a build value", getBuildValue),
    ]),
  ]),
  command("owned", "Inspect owned-field bundles", [
    pagedRead("list", "List owned-field bundles", listOwnedBundles, bundleTable),
    projectedRead("get <bundle>", "Show an owned-field bundle", getOwnedBundle),
    command("value", "Inspect owned values", [
      pagedRead("list <bundle>", "List the bundle's values", listOwnedValues, valueTable),
      projectedRead("get <bundle> <value>", "Show an owned value", getOwnedValue),
    ]),
  ]),
  command("version", "Inspect version bundles", [
    pagedRead("list", "List version bundles", listVersionBundles, bundleTable),
    projectedRead("get <bundle>", "Show a version bundle", getVersionBundle),
    command("value", "Inspect version values", [
      pagedRead("list <bundle>", "List the bundle's values", listVersionValues, valueTable),
      projectedRead("get <bundle> <value>", "Show a version value", getVersionValue),
    ]),
  ]),
];
