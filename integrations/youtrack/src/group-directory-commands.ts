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
import { groupRecord, groupTable, userTable, withView } from "./presentation.js";

const memberOptions = [
  ...pageOptions,
  { flags: "--direct", description: "Directly added users only" },
];

export const groupDirectoryRootCommands = [
  command("group", "Inspect user groups", [
    pagedRead("list", "List groups", listGroups, groupTable),
    projectedRead("get <group>", "Show a group", getGroup, groupRecord),
    command("member", "Inspect group members", [
      withView(userTable, readCommand(
        "list <group>",
        "List members, including inherited ones",
        async (connection, { args, options }, context) =>
          listGroupMembers(connection, args.group, {
            ...readOptions(options),
            direct: options.direct === true,
          }),
        memberOptions,
      )),
    ]),
    command("subgroup", "Inspect nested groups", [
      pagedRead("list <group>", "List the immediate subgroups", listSubgroups, groupTable),
    ]),
  ]),
];

export const groupDirectoryProjectChildren = [
  command("team", "Inspect the project team (YouTrack 2026.1+)", [
    projectedRead("get <project>", "Show the team", getProjectTeam, groupRecord),
    command("group", "Inspect the team's groups", [
      pagedRead("list <project>", "List the team's groups", listProjectTeamGroups, groupTable),
    ]),
    command("user", "Inspect the team's users", [
      withView(userTable, readCommand(
        "list <project>",
        "List team users, including group members",
        async (connection, { args, options }, context) =>
          listProjectTeamUsers(connection, args.project, {
            ...readOptions(options),
            direct: options.direct === true,
          }),
        memberOptions,
      )),
    ]),
  ]),
];
