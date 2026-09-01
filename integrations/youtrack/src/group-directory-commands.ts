import { command } from "@eyeauras/cli-factory";
import { pagedRead, projectedRead, readCommand, pageOptions, readOptions } from "./cli-support.js";
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
    pagedRead("list", "List one page of visible groups without expanding members", listGroups),
    projectedRead("get <group>", "Read a group by database ID without expanding members", getGroup),
    command("member", "Inspect direct or inherited group members", [
      readCommand(
        "list <group>",
        "List one page of members, including inherited users unless --direct is set",
        async (connection, { args, options }, context) =>
          listGroupMembers(connection, args.group, {
            ...readOptions(options),
            direct: options.direct === true,
          }),
        memberOptions,
      ),
    ]),
    command("subgroup", "Inspect nested groups without recursive traversal", [
      pagedRead("list <group>", "List one page of immediate subgroups", listSubgroups),
    ]),
  ]),
];

export const groupDirectoryProjectChildren = [
  command("team", "Inspect project teams (YouTrack 2026.1+)", [
    projectedRead(
      "get <project>",
      "Read team identity and member count without expanding membership",
      getProjectTeam,
    ),
    command("group", "Inspect groups added to the project team", [
      pagedRead(
        "list <project>",
        "List one page of team groups without expanding their users",
        listProjectTeamGroups,
      ),
    ]),
    command("user", "Inspect direct or inherited project-team users", [
      readCommand(
        "list <project>",
        "List one page of team users, including group members unless --direct is set",
        async (connection, { args, options }, context) =>
          listProjectTeamUsers(connection, args.project, {
            ...readOptions(options),
            direct: options.direct === true,
          }),
        memberOptions,
      ),
    ]),
  ]),
];
