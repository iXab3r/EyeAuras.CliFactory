import {
  encodedID,
  fields,
  issuePath,
  mutate,
  mutationBody,
  nullableText,
  page,
  readCollection,
  readCollectionAt,
  readObjectAt,
  requiredText,
  type Connection,
  type IssueSearchOptions,
  type ProjectionOptions,
  type YouTrackObject,
} from "./client.js";

const workItemFields = "id,date,duration(minutes,presentation),text,type(id,name),author(id,login),issue(id,idReadable)";

function workItemsPath(issueID: string): string {
  return `${issuePath(issueID)}/timeTracking/workItems`;
}

export const getTimeTracking = readObjectAt(
  (issueID: string) => `${issuePath(issueID)}/timeTracking`,
  "id,enabled",
);
export const listIssueWorkItems = readCollectionAt(workItemsPath, workItemFields);
export const getIssueWorkItem = readObjectAt(
  (issueID: string, itemID: string) =>
    `${workItemsPath(issueID)}/${encodedID(itemID, "work item ID")}`,
  workItemFields,
);

export async function listWorkItems(connection: Connection, options: IssueSearchOptions = {}) {
  return readCollection(connection, "api/workItems", {
    ...page(options, workItemFields),
    ...(options.query === undefined ? {} : { query: requiredText(options.query, "query") }),
  });
}

export const getWorkItem = readObjectAt(
  (itemID: string) => `api/workItems/${encodedID(itemID, "work item ID")}`,
  workItemFields,
);

function timestamp(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new Error(`The ${name} must be a safe integer timestamp in milliseconds.`);
  }
  return value;
}

function reference(value: unknown, name: string): YouTrackObject | null {
  if (value === null) {
    return null;
  }
  const body = mutationBody(value);
  if (typeof body.id !== "string") {
    throw new Error(`The ${name}.id must be text.`);
  }
  return { ...body, id: requiredText(body.id, `${name}.id`) };
}

function duration(value: unknown, creating: boolean): YouTrackObject {
  const body = mutationBody(value);
  if (creating && !Object.hasOwn(body, "minutes") && !Object.hasOwn(body, "presentation")) {
    throw new Error("duration requires minutes or presentation.");
  }
  const result: YouTrackObject = { ...body };
  if (Object.hasOwn(body, "minutes")) {
    if (
      typeof body.minutes !== "number" ||
      !Number.isSafeInteger(body.minutes) ||
      body.minutes < -2_147_483_648 ||
      body.minutes > 2_147_483_647
    ) {
      throw new Error("The duration.minutes must be a signed 32-bit integer.");
    }
    result.minutes = body.minutes;
  }
  if (Object.hasOwn(body, "presentation")) {
    if (typeof body.presentation !== "string") {
      throw new Error("The duration.presentation must be text.");
    }
    result.presentation = requiredText(body.presentation, "duration.presentation");
  }
  return result;
}

function workItemBody(input: unknown, creating: boolean): YouTrackObject {
  const body = mutationBody(input);
  if (creating && !Object.hasOwn(body, "duration")) {
    throw new Error("A new work item requires duration.minutes or duration.presentation.");
  }
  const result: YouTrackObject = { ...body };
  if (Object.hasOwn(body, "duration")) {
    result.duration = duration(body.duration, creating);
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
