import {
  encodedID,
  issuePath,
  mutationBody,
  mutate,
  narrative,
  nullableText,
  readCollectionAt,
  readObject,
  readObjectAt,
  readPages,
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
  const body = mutationBody(value, user ? ["id", "name", "login"] : ["id", "name"]);
  if (Object.keys(body).length === 0) {
    throw new Error("YouTrack field reference requires an identity selector.");
  }
  return Object.fromEntries(Object.entries(body).map(([key, item]) => [
    key, narrative(item, `value.${key}`),
  ]));
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
    throw new Error("YouTrack field $type is not a supported concrete issue custom-field type.");
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
      const body = mutationBody(value, ["minutes", "presentation"]);
      if (Object.keys(body).length === 0) {
        throw new Error("YouTrack period value requires minutes or presentation.");
      }
      const result: YouTrackObject = {};
      if (Object.hasOwn(body, "minutes")) {
        if (
          typeof body.minutes !== "number" || !Number.isSafeInteger(body.minutes) ||
          body.minutes < 0 || body.minutes > 2_147_483_647
        ) {
          throw new Error("YouTrack period minutes must be an integer between 0 and 2147483647.");
        }
        result.minutes = body.minutes;
      }
      if (Object.hasOwn(body, "presentation")) {
        result.presentation = narrative(body.presentation, "period presentation");
      }
      return result;
    }
    default: {
      const body = mutationBody(value, ["text"]);
      if (body.text !== null && typeof body.text !== "string") {
        throw new Error("YouTrack text field requires text or null.");
      }
      return { text: body.text };
    }
  }
}

export async function setIssueField(
  connection: Connection,
  issueID: string,
  fieldID: string,
  input: unknown,
): Promise<YouTrackObject | null> {
  const body = mutationBody(input, ["$type", "value", "event"]);
  const type = narrative(body.$type, "field $type");
  let update: YouTrackObject;
  if (type === "StateMachineIssueCustomField") {
    if (Object.hasOwn(body, "value")) {
      throw new Error("YouTrack state-machine fields require event instead of value.");
    }
    const event = mutationBody(body.event, ["id"]);
    update = { $type: type, event: { id: narrative(event.id, "event.id") } };
  } else {
    if (Object.hasOwn(body, "event")) {
      throw new Error("YouTrack event is only supported for state-machine fields.");
    }
    update = { $type: type, value: fieldValue(type, body.value) };
  }
  return mutate(connection, fieldPath(issueID, fieldID), update, issueFieldFields);
}

export const issueWriteFields = "id,idReadable,summary,updated";

/** A locally validated create/update body whose name selectors are not resolved yet. */
export interface IssueWrite {
  project?: YouTrackObject;
  body: YouTrackObject;
  customFields?: YouTrackObject[];
}

function oneOf(body: Record<string, unknown>, keys: readonly string[], label: string): YouTrackObject {
  const present = keys.filter((key) => Object.hasOwn(body, key));
  if (present.length !== 1) {
    throw new Error(`YouTrack ${label} must use exactly one of ${keys.join(" or ")}.`);
  }
  const key = present[0]!;
  return { [key]: narrative(body[key], `${label} ${key}`) };
}

/** Validate an issue create/update body without network access. */
export function issueWrite(input: unknown, create: boolean): IssueWrite {
  const body = mutationBody(input, [...(create ? ["project"] : []), "summary", "description", "customFields"]);
  if (!create && !Object.keys(body).length) {
    throw new Error("YouTrack issue update requires summary, description or customFields.");
  }
  const write: IssueWrite = { body: {} };
  if (create) {
    write.project = oneOf(mutationBody(body.project, ["id", "shortName"]), ["id", "shortName"], "project");
    encodedID(String(Object.values(write.project)[0]), "project selector");
  }
  if (create || Object.hasOwn(body, "summary")) write.body.summary = narrative(body.summary, "summary");
  if (Object.hasOwn(body, "description")) write.body.description = nullableText(body.description, "description");
  if (Object.hasOwn(body, "customFields")) {
    if (!Array.isArray(body.customFields) || !body.customFields.length) {
      throw new Error("YouTrack customFields must be a nonempty array.");
    }
    const customFields: YouTrackObject[] = body.customFields.map((item: unknown) => {
      const entry = mutationBody(item, ["$type", "id", "name", "value"]);
      const type = narrative(entry.$type, "field $type");
      if (type === "StateMachineIssueCustomField") {
        throw new Error("YouTrack state-machine fields change only through issues fields set events or commands apply.");
      }
      if (!Object.hasOwn(entry, "value")) throw new Error("YouTrack custom field requires value.");
      return { $type: type, ...oneOf(entry, ["id", "name"], "custom field"), value: fieldValue(type, entry.value) };
    });
    // Identical selectors fail locally; an id and a name for one field fail after resolution.
    if (new Set(customFields.map(({ id, name }) => JSON.stringify([id, name]))).size !== customFields.length) {
      throw new Error("YouTrack customFields must not repeat a field.");
    }
    write.customFields = customFields;
  }
  return write;
}

/** Resolve name selectors with exact reads before the single write; ID-only bodies read nothing. */
export async function issueRequest(
  connection: Connection,
  write: IssueWrite,
  issueID?: string,
): Promise<{ path: string; body: YouTrackObject }> {
  const body: YouTrackObject = { ...write.body };
  let fieldsPath = issueID === undefined ? "" : `${issuePath(issueID)}/customFields`;
  if (write.project) {
    let id = write.project.id;
    const shortName = write.project.shortName;
    if (typeof shortName === "string") {
      const project = await readObject(connection, projectPath(shortName), { fields: "id,shortName" });
      if (typeof project.shortName !== "string" || project.shortName.toLowerCase() !== shortName.toLowerCase()) {
        throw new Error("YouTrack project shortName did not resolve to that project.");
      }
      id = project.id;
    }
    if (typeof id !== "string" || !id) throw new Error("YouTrack returned an invalid project identity.");
    body.project = { id };
    fieldsPath = `${projectPath(id)}/customFields`;
  }
  if (write.customFields) {
    const catalog = write.customFields.some((field) => typeof field.name === "string")
      ? await readPages(connection, fieldsPath, { fields: issueID === undefined ? "id,field(name)" : "id,name" }, {
        top: 50, skip: 0,
      })
      : [];
    const customFields = write.customFields.map(({ name, ...field }) => {
      if (typeof name !== "string") return field;
      const matches = catalog.filter((item) =>
        (typeof item.name === "string" ? item.name : (item.field as YouTrackObject | null | undefined)?.name) === name);
      const id = matches.length === 1 ? matches[0]!.id : undefined;
      if (typeof id !== "string") throw new Error("YouTrack custom field name must match exactly one field.");
      return { ...field, id };
    });
    if (new Set(customFields.map((field) => field.id)).size !== customFields.length) {
      throw new Error("YouTrack customFields must not repeat a field.");
    }
    body.customFields = customFields;
  }
  return { path: issueID === undefined ? "api/issues" : issuePath(issueID), body };
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
