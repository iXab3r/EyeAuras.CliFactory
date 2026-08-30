import { command, Permission } from "@eyeauras/cli-factory";
import { connection, pageOptions, projectionOptions, readOptions } from "./cli-support.js";
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
  command(
    "get <user>",
    "Read a user by database ID or login",
    async ({ args, options }, context) =>
      getUser(await connection(context), String(args.user), readOptions(options)),
    { permission: Permission.ReadOnly, options: projectionOptions },
  ),
];

export const userDirectoryBundleChildren = [
  command("user", "Inspect assignee bundles and their attached users and groups", [
    command(
      "list",
      "List one page of user bundles without expanding membership",
      async ({ options }, context) => listUserBundles(await connection(context), readOptions(options)),
      { permission: Permission.ReadOnly, options: pageOptions },
    ),
    command(
      "get <bundle>",
      "Read a user bundle without expanding membership",
      async ({ args, options }, context) =>
        getUserBundle(await connection(context), String(args.bundle), readOptions(options)),
      { permission: Permission.ReadOnly, options: projectionOptions },
    ),
    command("member", "Inspect all bundle users, including users inherited from attached groups", [
      command(
        "list <bundle>",
        "List one page of aggregated users, both direct and through groups",
        async ({ args, options }, context) =>
          listUserBundleMembers(await connection(context), String(args.bundle), readOptions(options)),
        { permission: Permission.ReadOnly, options: pageOptions },
      ),
    ]),
    command("group", "Inspect groups attached to the user bundle", [
      command(
        "list <bundle>",
        "List one page of attached groups without expanding their users",
        async ({ args, options }, context) =>
          listUserBundleGroups(await connection(context), String(args.bundle), readOptions(options)),
        { permission: Permission.ReadOnly, options: pageOptions },
      ),
      command(
        "get <bundle> <group>",
        "Read one attached group by database ID",
        async ({ args, options }, context) =>
          getUserBundleGroup(
            await connection(context),
            String(args.bundle),
            String(args.group),
            readOptions(options),
          ),
        { permission: Permission.ReadOnly, options: projectionOptions },
      ),
    ]),
    command("individual", "Inspect user accounts added directly to the bundle", [
      command(
        "list <bundle>",
        "List one page of directly added accounts, excluding group-only membership",
        async ({ args, options }, context) =>
          listUserBundleIndividuals(await connection(context), String(args.bundle), readOptions(options)),
        { permission: Permission.ReadOnly, options: pageOptions },
      ),
      command(
        "get <bundle> <user>",
        "Read one directly added account by database ID",
        async ({ args, options }, context) =>
          getUserBundleIndividual(
            await connection(context),
            String(args.bundle),
            String(args.user),
            readOptions(options),
          ),
        { permission: Permission.ReadOnly, options: projectionOptions },
      ),
    ]),
  ]),
];
