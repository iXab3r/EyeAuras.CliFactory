import { command } from "@eyeauras/cli-factory";
import { pagedRead, projectedRead } from "./cli-support.js";
import {
  getUser,
  getUserBundle,
  getUserBundleGroup,
  getUserBundleIndividual,
  listUserBundleGroups,
  listUserBundleIndividuals,
  listUserBundleMembers,
  listUserBundles,
} from "./user-directory.js";
import { groupRecord, groupTable, namedTable, userRecord, userTable } from "./presentation.js";

const bundleTable = namedTable("BUNDLE", "No user bundles.");

export const userDirectoryUserChildren = [
  projectedRead("get <user>", "Show a user by ID or login", getUser, userRecord),
];

export const userDirectoryBundleChildren = [
  command("user", "Inspect assignee bundles", [
    pagedRead("list", "List user bundles", listUserBundles, bundleTable),
    projectedRead("get <bundle>", "Show a user bundle", getUserBundle),
    command("member", "Inspect all bundle users, including group members", [
      pagedRead("list <bundle>", "List all bundle users", listUserBundleMembers, userTable),
    ]),
    command("group", "Inspect the bundle's groups", [
      pagedRead("list <bundle>", "List the bundle's groups", listUserBundleGroups, groupTable),
      projectedRead("get <bundle> <group>", "Show a bundle group", getUserBundleGroup, groupRecord),
    ]),
    command("individual", "Inspect users added directly to the bundle", [
      pagedRead("list <bundle>", "List directly added users", listUserBundleIndividuals, userTable),
      projectedRead("get <bundle> <user>", "Show a directly added user", getUserBundleIndividual, userRecord),
    ]),
  ]),
];
