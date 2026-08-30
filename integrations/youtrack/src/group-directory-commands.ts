import { command, Permission } from "@eyeauras/cli-factory";
import { connection, pageOptions, projectionOptions, readOptions } from "./cli-support.js";
import {
  getGroup,
  getProjectTeam,
  listGroupMembers,
  listGroups,
  listProjectTeamGroups,
  listProjectTeamUsers,
  listSubgroups,
} from "./group-directory.js";

const memberOptions = [
  ...pageOptions,
  { flags: "--direct", description: "Only directly added users; exclude inherited membership" },
];

export const groupDirectoryRootCommands = [
  command("group", "Inspect user groups and membership", [
    command(
      "list",
      "List one page of visible groups without expanding members",
      async ({ options }, context) => listGroups(await connection(context), readOptions(options)),
      { permission: Permission.ReadOnly, options: pageOptions },
    ),
    command(
      "get <group>",
      "Read a group by database ID without expanding members",
      async ({ args, options }, context) =>
        getGroup(await connection(context), String(args.group), readOptions(options)),
      { permission: Permission.ReadOnly, options: projectionOptions },
    ),
    command("member", "Inspect direct or inherited group members", [
      command(
        "list <group>",
        "List one page of members, including inherited users unless --direct is set",
        async ({ args, options }, context) =>
          listGroupMembers(await connection(context), String(args.group), {
            ...readOptions(options),
            direct: options.direct === true,
          }),
        { permission: Permission.ReadOnly, options: memberOptions },
      ),
    ]),
    command("subgroup", "Inspect nested groups without recursive traversal", [
      command(
        "list <group>",
        "List one page of immediate subgroups",
        async ({ args, options }, context) =>
          listSubgroups(await connection(context), String(args.group), readOptions(options)),
        { permission: Permission.ReadOnly, options: pageOptions },
      ),
    ]),
  ]),
];

export const groupDirectoryProjectChildren = [
  command("team", "Inspect project teams (YouTrack 2026.1+)", [
    command(
      "get <project>",
      "Read team identity and member count without expanding membership",
      async ({ args, options }, context) =>
        getProjectTeam(await connection(context), String(args.project), readOptions(options)),
      { permission: Permission.ReadOnly, options: projectionOptions },
    ),
    command("group", "Inspect groups added to the project team", [
      command(
        "list <project>",
        "List one page of team groups without expanding their users",
        async ({ args, options }, context) =>
          listProjectTeamGroups(await connection(context), String(args.project), readOptions(options)),
        { permission: Permission.ReadOnly, options: pageOptions },
      ),
    ]),
    command("user", "Inspect direct or inherited project-team users", [
      command(
        "list <project>",
        "List one page of team users, including group members unless --direct is set",
        async ({ args, options }, context) =>
          listProjectTeamUsers(await connection(context), String(args.project), {
            ...readOptions(options),
            direct: options.direct === true,
          }),
        { permission: Permission.ReadOnly, options: memberOptions },
      ),
    ]),
  ]),
];
