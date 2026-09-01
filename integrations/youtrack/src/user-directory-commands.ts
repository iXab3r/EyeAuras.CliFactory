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

export const userDirectoryUserChildren = [
  projectedRead("get <user>", "Read a user by database ID or login", getUser),
];

export const userDirectoryBundleChildren = [
  command("user", "Inspect assignee bundles and their attached users and groups", [
    pagedRead("list", "List one page of user bundles without expanding membership", listUserBundles),
    projectedRead("get <bundle>", "Read a user bundle without expanding membership", getUserBundle),
    command("member", "Inspect all bundle users, including users inherited from attached groups", [
      pagedRead(
        "list <bundle>",
        "List one page of aggregated users, both direct and through groups",
        listUserBundleMembers,
      ),
    ]),
    command("group", "Inspect groups attached to the user bundle", [
      pagedRead(
        "list <bundle>",
        "List one page of attached groups without expanding their users",
        listUserBundleGroups,
      ),
      projectedRead(
        "get <bundle> <group>",
        "Read one attached group by database ID",
        getUserBundleGroup,
      ),
    ]),
    command("individual", "Inspect user accounts added directly to the bundle", [
      pagedRead(
        "list <bundle>",
        "List one page of directly added accounts, excluding group-only membership",
        listUserBundleIndividuals,
      ),
      projectedRead(
        "get <bundle> <user>",
        "Read one directly added account by database ID",
        getUserBundleIndividual,
      ),
    ]),
  ]),
];
