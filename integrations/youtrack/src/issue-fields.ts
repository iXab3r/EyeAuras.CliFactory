import {
  encodedID,
  issuePath,
  mutationBody,
  mutate,
  narrative,
  nullableText,
  readCollectionAt,
  readObjectAt,
  type Connection,
  type YouTrackObject,
  type YouTrackValue,
} from "./client.js";

const projectFieldFields =
  "id,field(id,name,fieldType(id,valueType,isMultiValue)),canBeEmpty,emptyFieldText,isPublic";
const issueFieldFields =
  "id,name,$type,value(id,name,login,minutes,presentation,text),projectCustomField(id)";

function projectPath(projectID: string): string {
  return `api/admin/projects/${encodedID(projectID, "project ID")}`;
}

function fieldPath(issueID: string, fieldID: string): string {
  return `${issuePath(issueID)}/customFields/${encodedID(fieldID, "field ID")}`;
}

export const getProject = readObjectAt(projectPath, "id,name,shortName,description,archived");
export const listProjectFields = readCollectionAt(
  (projectID: string) => `${projectPath(projectID)}/customFields`,
  projectFieldFields,
);
export const getProjectField = readObjectAt(
  (projectID: string, fieldID: string) =>
    `${projectPath(projectID)}/customFields/${encodedID(fieldID, "field ID")}`,
  projectFieldFields,
);
export const listUsers = readCollectionAt("api/users", "id,login,fullName");
export const listIssueFields = readCollectionAt(
  (issueID: string) => `${issuePath(issueID)}/customFields`,
  issueFieldFields,
);
export const getIssueField = readObjectAt(fieldPath, issueFieldFields);

function reference(value: unknown, user: boolean): YouTrackObject {
  const body = mutationBody(value);
  for (const key of user ? ["id", "name", "login"] : ["id", "name"]) {
    if (Object.hasOwn(body, key)) narrative(body[key], `value.${key}`);
  }
  return body;
}

function fieldValue(type: string, value: unknown): YouTrackValue {
  const entity = /^(Single|Multi)(Enum|Build|Version|Owned|Group|User)IssueCustomField$/.exec(type);
  if (entity?.[1] === "Multi") {
    if (!Array.isArray(value)) {
      throw new Error("YouTrack multi-value field requires an array; use [] to clear it.");
    }
    return value.map((item) => reference(item, entity[2] === "User"));
  }
  if (entity || type === "StateIssueCustomField") {
    return value === null ? null : reference(value, entity?.[2] === "User");
  }
  if (![
    "SimpleIssueCustomField", "DateIssueCustomField", "PeriodIssueCustomField", "TextIssueCustomField",
  ].includes(type)) {
    return value as YouTrackValue;
  }
  if (value === null) {
    return null;
  }
  switch (type) {
    case "SimpleIssueCustomField":
      if (typeof value === "string" || (typeof value === "number" && Number.isFinite(value))) {
        return value;
      }
      throw new Error("YouTrack simple field requires text, a finite number or null.");
    case "DateIssueCustomField":
      if (typeof value === "number" && Number.isSafeInteger(value)) {
        return value;
      }
      throw new Error("YouTrack date field requires a safe integer timestamp in milliseconds or null.");
    case "PeriodIssueCustomField": {
      const body = mutationBody(value);
      const result: YouTrackObject = { ...body };
      if (Object.hasOwn(body, "minutes")) {
        if (
          typeof body.minutes !== "number" || !Number.isSafeInteger(body.minutes) ||
          body.minutes < -2_147_483_648 || body.minutes > 2_147_483_647
        ) {
          throw new Error("YouTrack period minutes must be a signed 32-bit integer.");
        }
        result.minutes = body.minutes;
      }
      if (Object.hasOwn(body, "presentation")) {
        result.presentation = narrative(body.presentation, "period presentation");
      }
      return result;
    }
    default: {
      const body = mutationBody(value);
      if (Object.hasOwn(body, "text") && body.text !== null && typeof body.text !== "string") {
        throw new Error("YouTrack text field requires text or null.");
      }
      return body;
    }
  }
}

export async function setIssueField(
  connection: Connection,
  issueID: string,
  fieldID: string,
  input: unknown,
): Promise<YouTrackObject | null> {
  const body = mutationBody(input);
  const type = narrative(body.$type, "field $type");
  let update: YouTrackObject;
  if (type === "StateMachineIssueCustomField" && Object.hasOwn(body, "event")) {
    const event = mutationBody(body.event);
    update = { ...body, $type: type, event: { ...event, id: narrative(event.id, "event.id") } };
  } else {
    update = { ...body, $type: type,
      ...(Object.hasOwn(body, "value") ? { value: fieldValue(type, body.value) } : {}) };
  }
  return mutate(connection, fieldPath(issueID, fieldID), update, issueFieldFields);
}

export const issueWriteFields = "id,idReadable,summary,updated";

/** A JSON issue body; the API resolves supplied identity selectors. */
export interface IssueWrite {
  body: YouTrackObject;
}

function textSelectors(body: Record<string, unknown>, keys: readonly string[], label: string): YouTrackObject {
  const present = keys.filter((key) => Object.hasOwn(body, key));
  return Object.fromEntries(present.map(key => [key, narrative(body[key], `${label} ${key}`)]));
}

/** Validate an issue create/update body without network access. */
export function issueWrite(input: unknown, create: boolean): IssueWrite {
  const body = mutationBody(input);
  const write: IssueWrite = { body: { ...body } };
  if (create) {
    const project = mutationBody(body.project);
    write.body.project = { ...project, ...textSelectors(project, ["id", "shortName"], "project") };
  }
  if (create || Object.hasOwn(body, "summary")) write.body.summary = nullableText(body.summary, "summary");
  if (Object.hasOwn(body, "description")) write.body.description = nullableText(body.description, "description");
  if (Object.hasOwn(body, "customFields")) {
    if (!Array.isArray(body.customFields)) {
      throw new Error("YouTrack customFields must be an array.");
    }
    const customFields: YouTrackObject[] = body.customFields.map((item: unknown) => {
      const entry = mutationBody(item);
      const type = narrative(entry.$type, "field $type");
      return { ...entry, $type: type, ...textSelectors(entry, ["id", "name"], "custom field"),
        ...(Object.hasOwn(entry, "value") ? { value: fieldValue(type, entry.value) } : {}) };
    });
    write.body.customFields = customFields;
  }
  return write;
}

/** Send native selectors without extra catalog reads or body rewriting. */
export async function issueRequest(
  connection: Connection,
  write: IssueWrite,
  issueID?: string,
): Promise<{ path: string; body: YouTrackObject }> {
  return { path: issueID === undefined ? "api/issues" : issuePath(issueID), body: write.body };
}

export async function createIssue(connection: Connection, input: unknown): Promise<YouTrackObject | null> {
  const { path, body } = await issueRequest(connection, issueWrite(input, true));
  return mutate(connection, path, body, issueWriteFields);
}

export async function updateIssue(
  connection: Connection,
  id: string,
  input: unknown,
): Promise<YouTrackObject | null> {
  const { path, body } = await issueRequest(connection, issueWrite(input, false), id);
  return mutate(connection, path, body, issueWriteFields);
}
