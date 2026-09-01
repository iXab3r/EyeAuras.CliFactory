import {
  encodedID,
  issuePath,
  mutationBody,
  mutate,
  narrative,
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
