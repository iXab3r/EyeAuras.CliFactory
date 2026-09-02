import { command } from "@eyeauras/cli-factory";
import { bodyUpdate, pagedRead, projectedRead, updateCommand } from "./cli-support.js";
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
    pagedRead("list", "List one page of issue link types", listLinkTypes),
    projectedRead("get <typeID>", "Read an issue link type", getLinkType),
  ]),
  command("tags", "Inspect existing YouTrack tags", [
    pagedRead("list", "List one page of visible tags", listTags),
    projectedRead("get <tagID>", "Read a tag by database ID", getTag),
  ]),
];

export const relationsIssueChildren = [
  command("links", "Inspect and change issue links; s is outward, t inward, no marker undirected", [
    pagedRead(
      "list <issueID>",
      "List one page of link groups without embedded issues",
      listIssueLinks,
    ),
    projectedRead(
      "get <issueID> <linkID>",
      "Read a link group using its full directional link ID",
      getIssueLink,
    ),
    pagedRead(
      "issues <issueID> <linkID>",
      "List one page of issues linked through this directional link ID",
      listLinkedIssues,
    ),
    bodyUpdate(
      "add <issueID> <linkID>",
      "Link an existing target issue with body id (database ID)",
      addIssueLink,
    ),
    updateCommand(
      "remove <issueID> <linkID> <targetIssueID>",
      "Unlink the target issue; neither issue is deleted",
      async (connection, { args }, context) =>
        removeIssueLink(
          connection,
          args.issueID,
          args.linkID,
          args.targetIssueID,
        ),
    ),
  ]),
  command("tags", "Inspect and change tags assigned to an issue", [
    pagedRead("list <issueID>", "List one page of tags assigned to an issue", listIssueTags),
    bodyUpdate("add <issueID>", "Assign an existing tag with body id (database ID)", addIssueTag),
    updateCommand(
      "remove <issueID> <tagID>",
      "Remove a tag assignment; the tag is not deleted",
      async (connection, { args }, context) =>
        removeIssueTag(connection, args.issueID, args.tagID),
    ),
  ]),
];
