import {
  encodedID,
  fields,
  mutate,
  mutationBody,
  nullableText,
  page,
  readCollection,
  readObject,
  requiredText,
  type Connection,
  type PageOptions,
  type ProjectionOptions,
  type YouTrackObject,
} from "./client.js";

const agileFields = "id,name,currentSprint(id,name,start,finish,archived),status(valid,hasJobs)";
const sprintFields = "id,name,goal,start,finish,archived,isDefault,agile(id,name)";

function agilePath(agile: string): string {
  return `api/agiles/${encodedID(agile, "agile ID")}`;
}

export async function listAgiles(connection: Connection, options: PageOptions = {}) {
  return readCollection(connection, "api/agiles", page(options, agileFields));
}

export async function getAgile(
  connection: Connection,
  agile: string,
  options: ProjectionOptions = {},
) {
  return readObject(connection, agilePath(agile), { fields: fields(options, agileFields) });
}

export async function listSprints(
  connection: Connection,
  agile: string,
  options: PageOptions = {},
) {
  return readCollection(connection, `${agilePath(agile)}/sprints`, page(options, sprintFields));
}

export async function getSprint(
  connection: Connection,
  agile: string,
  sprint: string,
  options: ProjectionOptions = {},
) {
  return readObject(connection, `${agilePath(agile)}/sprints/${encodedID(sprint, "sprint ID")}`, {
    fields: fields(options, sprintFields),
  });
}

function sprintBody(input: unknown, creating: boolean): YouTrackObject {
  const body = mutationBody(input, [
    "name", "goal", "start", "finish", "archived", "isDefault",
    ...(creating ? ["previousSprint"] : []),
  ]);
  if (creating && !Object.hasOwn(body, "name")) {
    throw new Error("YouTrack sprint creation requires name.");
  }
  if (Object.keys(body).length === 0) {
    throw new Error("YouTrack sprint update requires at least one writable field.");
  }
  const result: YouTrackObject = {};
  if (Object.hasOwn(body, "name")) {
    if (typeof body.name !== "string") {
      throw new Error("YouTrack sprint name must be nonempty single-line text.");
    }
    result.name = requiredText(body.name, "sprint name");
  }
  if (Object.hasOwn(body, "goal")) {
    result.goal = nullableText(body.goal, "sprint goal");
  }
  for (const key of ["start", "finish"] as const) {
    if (Object.hasOwn(body, key)) {
      const value = body[key];
      if (value !== null && (typeof value !== "number" || !Number.isSafeInteger(value))) {
        throw new Error(`YouTrack sprint ${key} must be a safe integer UTC timestamp in milliseconds or null.`);
      }
      result[key] = value;
    }
  }
  for (const key of ["archived", "isDefault"] as const) {
    if (Object.hasOwn(body, key)) {
      if (typeof body[key] !== "boolean") {
        throw new Error(`YouTrack sprint ${key} must be boolean.`);
      }
      result[key] = body[key];
    }
  }
  if (Object.hasOwn(body, "previousSprint")) {
    const previous = mutationBody(body.previousSprint, ["id"]);
    if (typeof previous.id !== "string") {
      throw new Error("YouTrack previousSprint.id must be nonempty text.");
    }
    result.previousSprint = { id: requiredText(previous.id, "previousSprint.id") };
  }
  return result;
}

export async function createSprint(
  connection: Connection,
  agile: string,
  input: unknown,
  options: ProjectionOptions = {},
) {
  return mutate(
    connection,
    `${agilePath(agile)}/sprints`,
    sprintBody(input, true),
    fields(options, sprintFields),
  );
}

export async function updateSprint(
  connection: Connection,
  agile: string,
  sprint: string,
  input: unknown,
  options: ProjectionOptions = {},
) {
  return mutate(
    connection,
    `${agilePath(agile)}/sprints/${encodedID(sprint, "sprint ID")}`,
    sprintBody(input, false),
    fields(options, sprintFields),
  );
}
