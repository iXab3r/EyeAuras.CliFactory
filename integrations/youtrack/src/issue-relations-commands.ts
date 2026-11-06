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
import {
  arg,
  done,
  issueLinked,
  issueTagList,
  linkGroupList,
  linkGroupRecord,
  linkTypeRecord,
  linkTypeTable,
  linkedIssueList,
  tagAdded,
  tagRecord,
  tagTable,
  withView,
} from "./presentation.js";

export const relationsRootCommands = [
  command("link-types", "Inspect issue link types", [
    pagedRead("list", "List link types", listLinkTypes, linkTypeTable),
    projectedRead("get <typeID>", "Show a link type", getLinkType, linkTypeRecord),
  ]),
  command("tags", "Inspect tags", [
    pagedRead("list", "List visible tags", listTags, tagTable),
    projectedRead("get <tagID>", "Show a tag", getTag, tagRecord),
  ]),
];

export const relationsIssueChildren = [
  command("links", "Inspect and change issue links", [
    pagedRead("list <issueID>", "List the issue's link groups", listIssueLinks, linkGroupList),
    projectedRead("get <issueID> <linkID>", "Show a link group", getIssueLink, linkGroupRecord),
    pagedRead("issues <issueID> <linkID>", "List the issues in a link group", listLinkedIssues, linkedIssueList),
    bodyUpdate("add <issueID> <linkID>", "Link an issue by database id", addIssueLink, undefined, issueLinked),
    withView(done((context) => `Unlinked ${arg(context, "targetIssueID")} from ${arg(context, "issueID")}.`), updateCommand(
      "remove <issueID> <linkID> <targetIssueID>",
      "Unlink an issue",
      async (connection, { args }, context) =>
        removeIssueLink(
          connection,
          args.issueID,
          args.linkID,
          args.targetIssueID,
        ),
    )),
  ]),
  command("tags", "Inspect and change the issue's tags", [
    pagedRead("list <issueID>", "List the issue's tags", listIssueTags, issueTagList),
    bodyUpdate("add <issueID>", "Add a tag by database id", addIssueTag, undefined, tagAdded),
    withView(done((context) => `Removed tag ${arg(context, "tagID")} from ${arg(context, "issueID")}.`), updateCommand(
      "remove <issueID> <tagID>",
      "Remove a tag from the issue",
      async (connection, { args }, context) =>
        removeIssueTag(connection, args.issueID, args.tagID),
    )),
  ]),
];
