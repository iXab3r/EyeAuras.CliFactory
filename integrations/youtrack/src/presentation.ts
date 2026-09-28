import {
  listView,
  offsetFooter,
  recordView,
  tableView,
  type CommandDefinition,
  type HumanView,
  type ViewContext,
} from "@eyeauras/cli-factory";
import type { YouTrackObject } from "./client.js";

type Item = YouTrackObject;

/** Attach a view; an explicit `--fields` projection shows the generic shape instead. */
export function withView(view: HumanView, definition: CommandDefinition): CommandDefinition {
  return { ...definition, view: { ...view, when: (context) => context.input?.options.fields === undefined } };
}

// Every accessor tolerates a projection that left the field out: it simply shows nothing.
const text = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);
const count = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;
const instant = (value: unknown): Date | undefined => {
  const millis = count(value);
  return millis === undefined ? undefined : new Date(millis);
};
const day = (value: unknown): string | undefined => instant(value)?.toISOString().slice(0, 10);
const yes = (value: unknown): string | undefined => (value === true ? "yes" : undefined);
const nested = (value: unknown): Item | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Item) : undefined;
const firstLine = (value: unknown): string | undefined => text(value)?.split(/\r?\n/, 1)[0];
const lines = (value: unknown): string[] | undefined => {
  const body = text(value);
  return body === undefined || body.trim() === "" ? undefined : body.split(/\r?\n/);
};
const key = (item: Item | null | undefined): string | undefined =>
  text(item?.idReadable) ?? text(item?.id);
export const arg = (context: ViewContext, name: string): string => text(context.input?.args[name]) ?? "";
const option = (context: ViewContext, name: string): string | undefined => text(context.input?.options[name]);
const joined = (...parts: (string | undefined)[]): string | undefined => {
  const present = parts.filter((part) => part !== undefined && part !== "");
  return present.length ? present.join(" · ") : undefined;
};

/** An offset page continues with `--skip` when it came back full; `--all` already read everything. */
function pageFooter(rows: unknown, context: ViewContext): string | undefined {
  if (!Array.isArray(rows) || context.input?.options.all === true) return undefined;
  return offsetFooter("--skip", rows.length, count(context.input?.options.top), count(context.input?.options.skip));
}

const id = { header: "ID", value: (item: Item) => text(item.id) };
const login = (item: Item | undefined) => text(nested(item?.author)?.login);
const state = (issue: Item): string | undefined =>
  issue.resolved === undefined ? undefined : issue.resolved === null ? "open" : "resolved";

/** A plain ID + NAME table for reference lists such as bundles and groups. */
export function namedTable(header: string, empty: string): HumanView {
  return tableView<Item>({
    columns: [id, { header, value: (item) => text(item.name) }],
    empty,
    footer: pageFooter,
  });
}

/** A one-line confirmation built from the command's own arguments, for results without data. */
export function done(describe: (context: ViewContext) => string): HumanView {
  return recordView<unknown>({ title: (_value, context) => describe(context), fields: [] });
}

export const issueTable = tableView<Item>({
  columns: [
    { header: "ISSUE", value: key },
    { header: "SUMMARY", value: (issue) => text(issue.summary), shrink: true },
    { header: "PROJECT", value: (issue) => text(nested(issue.project)?.shortName) },
    { header: "STATE", value: state },
    { header: "UPDATED", value: (issue) => instant(issue.updated), format: "age" },
  ],
  empty: "No issues found.",
  footer: pageFooter,
});

export const issueRecord = recordView<Item>({
  title: (issue) => joined(key(issue), text(issue.summary)),
  fields: [
    {
      label: "Project",
      value: (issue) => joined(text(nested(issue.project)?.shortName), text(nested(issue.project)?.name)),
    },
    { label: "State", value: state },
    { label: "Resolved", value: (issue) => instant(issue.resolved) },
    { label: "Created", value: (issue) => instant(issue.created) },
    { label: "Updated", value: (issue) => instant(issue.updated) },
  ],
  sections: [{ title: () => "Description", lines: (issue) => lines(issue.description) }],
  next: (issue) => {
    const issueID = key(issue);
    return issueID ? [["issues", "comments", "list", issueID]] : [];
  },
});

function writtenIssue(verb: string): HumanView {
  return recordView<Item | null>({
    title: (issue) => (issue ? joined(`${verb} ${key(issue) ?? "issue"}`, text(issue.summary)) : `${verb} the issue.`),
    fields: [{ label: "Updated", value: (issue) => instant(issue?.updated) }],
    next: (issue) => {
      const issueID = key(issue);
      return issueID ? [["issues", "get", issueID]] : [];
    },
  });
}
export const createdIssue = writtenIssue("Created");
export const updatedIssue = writtenIssue("Updated");

export const countRecord = recordView<Item>({
  title: (value, context) => {
    const matches = count(value.count);
    if (matches === undefined) return undefined;
    if (matches < 0) return "The count is still pending; run it again in a moment.";
    const query = option(context, "query");
    return `${matches} issue${matches === 1 ? "" : "s"} match${matches === 1 ? "es" : ""}${query ? ` "${query}"` : ""}.`;
  },
  fields: [],
});

export const commentTable = tableView<Item>({
  columns: [
    { header: "COMMENT", value: (comment) => text(comment.id) },
    { header: "AUTHOR", value: (comment) => login(comment) },
    { header: "AGE", value: (comment) => instant(comment.updated ?? comment.created), format: "age" },
    { header: "TEXT", value: (comment) => firstLine(comment.text), shrink: true },
  ],
  empty: "No comments.",
  footer: pageFooter,
});

function commentRecord(title: (comment: Item | null, context: ViewContext) => string | undefined): HumanView {
  return recordView<Item | null>({
    title,
    fields: [
      { label: "Author", value: (comment) => login(comment ?? undefined) },
      { label: "Created", value: (comment) => instant(comment?.created) },
      { label: "Updated", value: (comment) => instant(comment?.updated) },
    ],
    sections: [{ title: () => "Text", lines: (comment) => lines(comment?.text) }],
  });
}
export const commentShown = commentRecord((comment) => joined("Comment", text(comment?.id)));
/** `owner` names the positional argument that identifies the issue or article. */
export const commentAdded = (owner: string): HumanView =>
  commentRecord((comment, context) => `Added comment ${text(comment?.id) ?? ""} to ${arg(context, owner)}`.replace(/\s+/g, " "));
export const commentUpdated = (owner: string, comment: string): HumanView =>
  commentRecord((_value, context) => `Updated comment ${arg(context, comment)} on ${arg(context, owner)}`);

export const projectTable = tableView<Item>({
  columns: [
    id,
    { header: "KEY", value: (project) => text(project.shortName) },
    { header: "NAME", value: (project) => text(project.name), shrink: true },
  ],
  empty: "No projects.",
  footer: pageFooter,
});

export const projectRecord = recordView<Item>({
  title: (project) => joined(text(project.shortName), text(project.name)),
  fields: [
    { label: "ID", value: (project) => text(project.id) },
    { label: "Description", value: (project) => firstLine(project.description) },
    { label: "Archived", value: (project) => yes(project.archived) },
  ],
});

export const userTable = tableView<Item>({
  columns: [
    id,
    { header: "LOGIN", value: (user) => text(user.login) },
    { header: "NAME", value: (user) => text(user.fullName), shrink: true },
  ],
  empty: "No users.",
  footer: pageFooter,
});

export const userRecord = recordView<Item>({
  title: (user) => joined(text(user.login), text(user.fullName)),
  fields: [
    { label: "ID", value: (user) => text(user.id) },
    { label: "Email", value: (user) => text(user.email) },
  ],
});

export const agileTable = tableView<Item>({
  columns: [
    id,
    { header: "BOARD", value: (agile) => text(agile.name), shrink: true },
    { header: "CURRENT SPRINT", value: (agile) => text(nested(agile.currentSprint)?.name) },
  ],
  empty: "No agile boards.",
  footer: pageFooter,
});

export const agileRecord = recordView<Item>({
  title: (agile) => text(agile.name),
  fields: [
    { label: "ID", value: (agile) => text(agile.id) },
    { label: "Current sprint", value: (agile) => text(nested(agile.currentSprint)?.name) },
    { label: "Sprint start", value: (agile) => day(nested(agile.currentSprint)?.start) },
    { label: "Sprint finish", value: (agile) => day(nested(agile.currentSprint)?.finish) },
    { label: "Valid", value: (agile) => yes(nested(agile.status)?.valid) },
  ],
});

const sprintFields = [
  { label: "ID", value: (sprint: Item | null) => text(sprint?.id) },
  { label: "Board", value: (sprint: Item | null) => text(nested(sprint?.agile)?.name) },
  { label: "Goal", value: (sprint: Item | null) => firstLine(sprint?.goal) },
  { label: "Start", value: (sprint: Item | null) => day(sprint?.start) },
  { label: "Finish", value: (sprint: Item | null) => day(sprint?.finish) },
  { label: "Archived", value: (sprint: Item | null) => yes(sprint?.archived) },
  { label: "Default", value: (sprint: Item | null) => yes(sprint?.isDefault) },
];

export const sprintTable = tableView<Item>({
  columns: [
    id,
    { header: "SPRINT", value: (sprint) => text(sprint.name), shrink: true },
    { header: "START", value: (sprint) => day(sprint.start) },
    { header: "FINISH", value: (sprint) => day(sprint.finish) },
    { header: "ARCHIVED", value: (sprint) => yes(sprint.archived) },
  ],
  empty: "No sprints.",
  footer: pageFooter,
});

export const sprintRecord = recordView<Item | null>({ title: (sprint) => text(sprint?.name), fields: sprintFields });
export const sprintWritten = (verb: string): HumanView =>
  recordView<Item | null>({
    title: (sprint) => `${verb} sprint ${text(sprint?.name) ?? ""}`.trim(),
    fields: sprintFields,
  });

export const articleTable = tableView<Item>({
  columns: [
    { header: "ARTICLE", value: key },
    { header: "SUMMARY", value: (article) => text(article.summary), shrink: true },
    { header: "PROJECT", value: (article) => text(nested(article.project)?.shortName) },
    { header: "UPDATED", value: (article) => instant(article.updated), format: "age" },
  ],
  empty: "No articles.",
  footer: pageFooter,
});

export const articleRecord = recordView<Item | null>({
  title: (article) => (article ? joined(key(article), text(article.summary)) : "No parent article."),
  fields: [
    { label: "Project", value: (article) => text(nested(article?.project)?.shortName) },
    { label: "Parent", value: (article) => key(nested(article?.parentArticle)) },
    { label: "Created", value: (article) => instant(article?.created) },
    { label: "Updated", value: (article) => instant(article?.updated) },
  ],
  sections: [{ title: () => "Content", lines: (article) => lines(article?.content) }],
});

function writtenArticle(verb: string): HumanView {
  return recordView<Item | null>({
    title: (article) => (article ? joined(`${verb} ${key(article) ?? "article"}`, text(article.summary)) : `${verb} the article.`),
    fields: [{ label: "Updated", value: (article) => instant(article?.updated) }],
    next: (article) => {
      const articleID = key(article);
      return articleID ? [["article", "get", articleID]] : [];
    },
  });
}
export const createdArticle = writtenArticle("Created");
export const updatedArticle = writtenArticle("Updated");

export const tagTable = namedTable("TAG", "No tags.");
export const tagRecord = recordView<Item>({ title: (tag) => text(tag.name), fields: [{ label: "ID", value: (tag) => text(tag.id) }] });
export const issueTagList = listView<Item>({
  line: (tag) => `${text(tag.name) ?? ""} (${text(tag.id) ?? ""})`,
  empty: "No tags.",
  footer: pageFooter,
});
export const tagAdded = recordView<Item | null>({
  title: (tag, context) => `Tagged ${arg(context, "issueID")} with ${text(tag?.name) ?? "the tag"}.`,
  fields: [],
});

export const linkTypeTable = tableView<Item>({
  columns: [
    id,
    { header: "TYPE", value: (type) => text(type.name) },
    { header: "OUTWARD", value: (type) => text(type.sourceToTarget) },
    { header: "INWARD", value: (type) => text(type.targetToSource) },
    { header: "DIRECTED", value: (type) => yes(type.directed) },
  ],
  empty: "No link types.",
  footer: pageFooter,
});

/** A link group reads as the phrase YouTrack shows for its direction, then its ID for follow-ups. */
function linkLabel(group: Item): string {
  const type = nested(group.linkType);
  const direction = text(group.direction);
  const label = direction === "OUTWARD" ? text(type?.sourceToTarget)
    : direction === "INWARD" ? text(type?.targetToSource)
      : text(type?.name);
  return `${label ?? text(type?.name) ?? "link"} (${text(group.id) ?? ""})`;
}
export const linkGroupList = listView<Item>({ line: linkLabel, empty: "No links.", footer: pageFooter });
export const linkGroupRecord = recordView<Item>({
  title: linkLabel,
  fields: [
    { label: "Direction", value: (group) => text(group.direction) },
    { label: "Type", value: (group) => text(nested(group.linkType)?.name) },
  ],
});
export const linkTypeRecord = recordView<Item>({
  title: (type) => text(type.name),
  fields: [
    { label: "ID", value: (type) => text(type.id) },
    { label: "Outward", value: (type) => text(type.sourceToTarget) },
    { label: "Inward", value: (type) => text(type.targetToSource) },
    { label: "Directed", value: (type) => yes(type.directed) },
  ],
});
export const linkedIssueList = listView<Item>({
  line: (issue) => [key(issue), text(issue.summary)].filter(Boolean).join("  "),
  empty: "No linked issues.",
  footer: pageFooter,
});
export const issueLinked = recordView<Item | null>({
  title: (issue, context) =>
    joined(`Linked ${arg(context, "issueID")} to ${key(issue) ?? "the issue"}`, text(issue?.summary)),
  fields: [],
});

export const attachmentTable = tableView<Item>({
  columns: [
    id,
    { header: "NAME", value: (attachment) => text(attachment.name) },
    { header: "SIZE", value: (attachment) => count(attachment.size), format: "bytes" },
    { header: "TYPE", value: (attachment) => text(attachment.mimeType) },
  ],
  empty: "No attachments.",
  footer: pageFooter,
});
export const attachmentRecord = recordView<Item>({
  title: (attachment) => text(attachment.name),
  fields: [
    { label: "ID", value: (attachment) => text(attachment.id) },
    { label: "Size", value: (attachment) => count(attachment.size), format: "bytes" },
    { label: "Type", value: (attachment) => text(attachment.mimeType) },
  ],
});
export const savedAttachment = recordView<Item>({
  title: (file) => `Saved ${text(file.name) ?? "the attachment"}`,
  fields: [
    { label: "Path", value: (file) => text(file.path) },
    { label: "Size", value: (file) => count(file.bytes), format: "bytes" },
    { label: "Type", value: (file) => text(file.contentType) },
  ],
  next: () => [["downloads", "list"]],
});
export const exportedArticle = recordView<Item>({
  title: (file) => `Saved ${text(file.id) ?? "the article"}`,
  fields: [
    { label: "Path", value: (file) => text(file.path) },
    { label: "Size", value: (file) => count(file.bytes), format: "bytes" },
    { label: "SHA-256", value: (file) => text(file.sha256) },
    {
      label: "Note",
      value: (file) => (file.redacted === true ? "URL placeholders replaced parts of the content; do not send it back unchanged" : undefined),
    },
  ],
  next: () => [["downloads", "list"]],
});

export const groupTable = tableView<Item>({
  columns: [
    id,
    { header: "GROUP", value: (group) => text(group.name), shrink: true },
    { header: "USERS", value: (group) => count(group.usersCount) },
  ],
  empty: "No groups.",
  footer: pageFooter,
});

export const groupRecord = recordView<Item>({
  title: (group) => text(group.name),
  fields: [
    { label: "ID", value: (group) => text(group.id) },
    { label: "Users", value: (group) => count(group.usersCount) },
    { label: "All users", value: (group) => yes(group.allUsersGroup) },
  ],
});

/** A project's custom-field settings wrap the global field under `field`. */
export const projectFieldTable = tableView<Item>({
  columns: [
    id,
    { header: "FIELD", value: (setting) => text(nested(setting.field)?.name) },
    { header: "TYPE", value: (setting) => text(nested(nested(setting.field)?.fieldType)?.id) },
    { header: "EMPTY", value: (setting) => (setting.canBeEmpty === true ? text(setting.emptyFieldText) ?? "allowed" : undefined) },
    { header: "PUBLIC", value: (setting) => yes(setting.isPublic) },
  ],
  empty: "No custom fields.",
  footer: pageFooter,
});

export const commandApplied = recordView<Item | null>({
  title: (value, context) => {
    const issues = Array.isArray(value?.issues) ? value.issues.map((issue) => key(nested(issue))).filter(Boolean) : [];
    const query = option(context, "query");
    return `Applied${query ? ` "${query}"` : " the command"} to ${issues.length ? issues.join(", ") : "the selected issues"}.`;
  },
  fields: [],
});

export const fieldTable = tableView<Item>({
  columns: [
    id,
    { header: "FIELD", value: (field) => text(field.name) },
    { header: "TYPE", value: (field) => text(nested(field.fieldType)?.presentation) ?? text(nested(field.fieldType)?.id) },
    { header: "MULTI", value: (field) => yes(nested(field.fieldType)?.isMultiValue) },
  ],
  empty: "No custom fields.",
  footer: pageFooter,
});

/** An issue field value as YouTrack would show it: names, logins, periods or plain text. */
function fieldValue(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (Array.isArray(value)) return value.map(fieldValue).filter(Boolean).join(", ");
  const item = nested(value);
  if (item) return text(item.name) ?? text(item.login) ?? text(item.presentation) ?? firstLine(item.text);
  return String(value);
}
export const issueFieldTable = tableView<Item>({
  columns: [
    { header: "FIELD", value: (field) => text(field.name) },
    { header: "VALUE", value: (field) => fieldValue(field.value), shrink: true },
    id,
  ],
  empty: "No fields.",
  footer: pageFooter,
});
export const issueFieldRecord = recordView<Item | null>({
  title: (field, context) => (field
    ? joined(text(field.name) ?? arg(context, "fieldID"), fieldValue(field.value) ?? "empty")
    : `Set ${arg(context, "fieldID")} on ${arg(context, "issueID")}.`),
  fields: [{ label: "ID", value: (field) => text(field?.id) }],
});

export const workItemTable = tableView<Item>({
  columns: [
    id,
    { header: "DATE", value: (item) => day(item.date) },
    { header: "SPENT", value: (item) => text(nested(item.duration)?.presentation) },
    { header: "AUTHOR", value: (item) => login(item) },
    { header: "TYPE", value: (item) => text(nested(item.type)?.name) },
    { header: "ISSUE", value: (item) => key(nested(item.issue)) },
    { header: "TEXT", value: (item) => firstLine(item.text), shrink: true },
  ],
  empty: "No work items.",
  footer: pageFooter,
});

export const savedQueryTable = tableView<Item>({
  columns: [
    id,
    { header: "NAME", value: (query) => text(query.name) },
    { header: "OWNER", value: (query) => text(nested(query.owner)?.login) },
    { header: "QUERY", value: (query) => text(query.query), shrink: true },
  ],
  empty: "No saved searches.",
  footer: pageFooter,
});

export const batchValidated = recordView<Item>({
  title: (value) =>
    `The manifest is valid: ${count(value.rows) ?? 0} rows (${count(value.create) ?? 0} create, ${count(value.update) ?? 0} update).`,
  fields: [],
});

function batchRows(value: Item): Item[] {
  return Array.isArray(value.rows) ? value.rows.map((row) => nested(row) ?? {}) : [];
}
export const batchApplied = recordView<Item>({
  title: (value) => `Batch ${text(value.status) ?? "finished"}: ${count(value.completed) ?? 0} of ${batchRows(value).length} rows completed.`,
  fields: [
    { label: "Failed", value: (value) => count(value.failed) || undefined },
    { label: "Uncertain", value: (value) => count(value.uncertain) || undefined },
    { label: "Unattempted", value: (value) => count(value.unattempted) || undefined },
    { label: "Failed rows saved", value: (value) => text(nested(value.failedRows)?.path) },
    { label: "Failed rows not saved", value: (value) => text(nested(value.failedRows)?.error) },
  ],
  sections: [{
    title: () => "Rows",
    lines: (value) => batchRows(value).map((row) => [
      `${count(row.row) ?? "?"}`,
      text(row.status) ?? "",
      key(nested(row.result)) ?? text(row.error) ?? "",
    ].filter(Boolean).join("  ")),
  }],
  next: (value) => (text(nested(value.failedRows)?.path) ? [["downloads", "list"]] : []),
});

export const uploadedAttachments = tableView<Item, Item[] | null>({
  rows: (value) => value ?? [],
  columns: [
    id,
    { header: "NAME", value: (attachment) => text(attachment.name) },
    { header: "SIZE", value: (attachment) => count(attachment.size), format: "bytes" },
  ],
  empty: "Uploaded.",
});
