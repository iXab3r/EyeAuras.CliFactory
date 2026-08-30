import { command, Permission } from "@eyeauras/cli-factory";
import {
  bodyOptions,
  connection,
  pageOptions,
  projectionOptions,
  readOptions,
} from "./cli-support.js";
import {
  addIssueLink,
  addIssueTag,
  getIssueLink,
  getLinkType,
  getTag,
  listIssueLinks,
  listIssueTags,
  listLinkedIssues,
  listLinkTypes,
  listTags,
  removeIssueLink,
  removeIssueTag,
} from "./issue-relations.js";

export const relationsRootCommands = [
  command("link-types", "Inspect YouTrack issue link types", [
    command(
      "list",
      "List one page of issue link types",
      async ({ options }, context) => listLinkTypes(await connection(context), readOptions(options)),
      { permission: Permission.ReadOnly, options: pageOptions },
    ),
    command(
      "get <typeID>",
      "Read an issue link type",
      async ({ args, options }, context) =>
        getLinkType(await connection(context), String(args.typeID), readOptions(options)),
      { permission: Permission.ReadOnly, options: projectionOptions },
    ),
  ]),
  command("tags", "Inspect existing YouTrack tags", [
    command(
      "list",
      "List one page of visible tags",
      async ({ options }, context) => listTags(await connection(context), readOptions(options)),
      { permission: Permission.ReadOnly, options: pageOptions },
    ),
    command(
      "get <tagID>",
      "Read a tag by database ID",
      async ({ args, options }, context) =>
        getTag(await connection(context), String(args.tagID), readOptions(options)),
      { permission: Permission.ReadOnly, options: projectionOptions },
    ),
  ]),
];

export const relationsIssueChildren = [
  command("links", "Inspect and change issue links; s is outward, t inward, no marker undirected", [
    command(
      "list <issueID>",
      "List one page of link groups without embedded issues",
      async ({ args, options }, context) =>
        listIssueLinks(await connection(context), String(args.issueID), readOptions(options)),
      { permission: Permission.ReadOnly, options: pageOptions },
    ),
    command(
      "get <issueID> <linkID>",
      "Read a link group using its full directional link ID",
      async ({ args, options }, context) =>
        getIssueLink(
          await connection(context),
          String(args.issueID),
          String(args.linkID),
          readOptions(options),
        ),
      { permission: Permission.ReadOnly, options: projectionOptions },
    ),
    command(
      "issues <issueID> <linkID>",
      "List one page of issues linked through this directional link ID",
      async ({ args, options }, context) =>
        listLinkedIssues(
          await connection(context),
          String(args.issueID),
          String(args.linkID),
          readOptions(options),
        ),
      { permission: Permission.ReadOnly, options: pageOptions },
    ),
    command(
      "add <issueID> <linkID>",
      "Link an existing target issue with body id (database ID)",
      async ({ args, options }, context) =>
        addIssueLink(
          await connection(context),
          String(args.issueID),
          String(args.linkID),
          options.body,
        ),
      { permission: Permission.Update, options: bodyOptions },
    ),
    command(
      "remove <issueID> <linkID> <targetIssueID>",
      "Unlink the target issue; neither issue is deleted",
      async ({ args }, context) =>
        removeIssueLink(
          await connection(context),
          String(args.issueID),
          String(args.linkID),
          String(args.targetIssueID),
        ),
      { permission: Permission.Update },
    ),
  ]),
  command("tags", "Inspect and change tags assigned to an issue", [
    command(
      "list <issueID>",
      "List one page of tags assigned to an issue",
      async ({ args, options }, context) =>
        listIssueTags(await connection(context), String(args.issueID), readOptions(options)),
      { permission: Permission.ReadOnly, options: pageOptions },
    ),
    command(
      "add <issueID>",
      "Assign an existing tag with body id (database ID)",
      async ({ args, options }, context) =>
        addIssueTag(await connection(context), String(args.issueID), options.body),
      { permission: Permission.Update, options: bodyOptions },
    ),
    command(
      "remove <issueID> <tagID>",
      "Remove a tag assignment; the tag is not deleted",
      async ({ args }, context) =>
        removeIssueTag(await connection(context), String(args.issueID), String(args.tagID)),
      { permission: Permission.Update },
    ),
  ]),
];
