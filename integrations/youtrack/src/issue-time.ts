import {
  encodedID,
  fields,
  issuePath,
  mutate,
  mutationBody,
  nullableText,
  page,
  readCollection,
  readObject,
  requiredText,
  type Connection,
  type IssueSearchOptions,
  type PageOptions,
  type ProjectionOptions,
  type YouTrackObject,
} from "./client.js";

const workItemFields = "id,date,duration(minutes,presentation),text,type(id,name),author(id,login),issue(id,idReadable)";

function workItemsPath(issueID: string): string {
  return `${issuePath(issueID)}/timeTracking/workItems`;
}

export async function getTimeTracking(
  connection: Connection,
  issueID: string,
  options: ProjectionOptions = {},
) {
  return readObject(connection, `${issuePath(issueID)}/timeTracking`, {
    fields: fields(options, "id,enabled"),
  });
}

export async function listIssueWorkItems(
  connection: Connection,
  issueID: string,
  options: PageOptions = {},
) {
  return readCollection(connection, workItemsPath(issueID), page(options, workItemFields));
}

export async function getIssueWorkItem(
  connection: Connection,
  issueID: string,
  itemID: string,
  options: ProjectionOptions = {},
) {
  return readObject(connection, `${workItemsPath(issueID)}/${encodedID(itemID, "work item ID")}`, {
    fields: fields(options, workItemFields),
  });
}

export async function listWorkItems(connection: Connection, options: IssueSearchOptions = {}) {
  return readCollection(connection, "api/workItems", {
    ...page(options, workItemFields),
    ...(options.query === undefined ? {} : { query: requiredText(options.query, "query") }),
  });
}

export async function getWorkItem(
  connection: Connection,
  itemID: string,
  options: ProjectionOptions = {},
) {
  return readObject(connection, `api/workItems/${encodedID(itemID, "work item ID")}`, {
    fields: fields(options, workItemFields),
  });
}

function timestamp(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new Error(`YouTrack ${name} must be a safe integer timestamp in milliseconds.`);
  }
  return value;
}

function reference(value: unknown, name: string): YouTrackObject | null {
  if (value === null) {
    return null;
  }
  const body = mutationBody(value, ["id"]);
  if (typeof body.id !== "string") {
    throw new Error(`YouTrack ${name}.id must be nonempty text.`);
  }
  return { id: requiredText(body.id, `${name}.id`) };
}

function duration(value: unknown): YouTrackObject {
  const body = mutationBody(value, ["minutes", "presentation"]);
  if (Object.keys(body).length === 0) {
    throw new Error("YouTrack duration requires minutes or presentation.");
  }
  const result: YouTrackObject = {};
  if (Object.hasOwn(body, "minutes")) {
    if (
      typeof body.minutes !== "number" ||
      !Number.isSafeInteger(body.minutes) ||
      body.minutes < 0 ||
      body.minutes > 2_147_483_647
    ) {
      throw new Error("YouTrack duration.minutes must be a nonnegative 32-bit integer.");
    }
    result.minutes = body.minutes;
  }
  if (Object.hasOwn(body, "presentation")) {
    if (typeof body.presentation !== "string") {
      throw new Error("YouTrack duration.presentation must be nonempty text.");
    }
    result.presentation = requiredText(body.presentation, "duration.presentation");
  }
  return result;
}

function workItemBody(input: unknown, creating: boolean): YouTrackObject {
  const body = mutationBody(input, ["duration", "date", "author", "type", "text", "created", "updated"]);
  if (creating && !Object.hasOwn(body, "duration")) {
    throw new Error("YouTrack work-item creation requires duration.minutes or duration.presentation.");
  }
  if (Object.keys(body).length === 0) {
    throw new Error("YouTrack work-item update requires at least one writable field.");
  }
  const result: YouTrackObject = {};
  if (Object.hasOwn(body, "duration")) {
    result.duration = duration(body.duration);
  }
  for (const name of ["date", "created", "updated"] as const) {
    if (Object.hasOwn(body, name)) {
      result[name] = name === "updated" && body[name] === null ? null : timestamp(body[name], name);
    }
  }
  for (const name of ["author", "type"] as const) {
    if (Object.hasOwn(body, name)) {
      result[name] = reference(body[name], name);
    }
  }
  if (Object.hasOwn(body, "text")) {
    result.text = nullableText(body.text, "work-item text");
  }
  return result;
}

export async function addWorkItem(
  connection: Connection,
  issueID: string,
  input: unknown,
  options: ProjectionOptions = {},
) {
  return mutate(
    connection,
    workItemsPath(issueID),
    workItemBody(input, true),
    fields(options, workItemFields),
  );
}

export async function updateWorkItem(
  connection: Connection,
  issueID: string,
  itemID: string,
  input: unknown,
  options: ProjectionOptions = {},
) {
  return mutate(
    connection,
    `${workItemsPath(issueID)}/${encodedID(itemID, "work item ID")}`,
    workItemBody(input, false),
    fields(options, workItemFields),
  );
}

