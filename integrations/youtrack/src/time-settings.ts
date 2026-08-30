import {
  encodedID,
  fields,
  page,
  readCollection,
  readObject,
  type Connection,
  type PageOptions,
  type ProjectionOptions,
} from "./client.js";

const globalSettingsPath = "api/admin/timeTrackingSettings";
const typeFields = "id,name,autoAttached";
const workTimeFields = "id,minutesADay,workDays,firstDayOfWeek,daysAWeek";

function projectSettingsPath(project: string): string {
  return `api/admin/projects/${encodedID(project, "project ID")}/timeTrackingSettings`;
}

export async function getProjectTimeSettings(
  connection: Connection,
  project: string,
  options: ProjectionOptions = {},
) {
  return readObject(connection, projectSettingsPath(project), {
    fields: fields(options,
      "id,enabled,estimate(id,field(id,name)),timeSpent(id,field(id,name)),project(id,name,shortName)"),
  });
}

export async function listProjectWorkItemTypes(
  connection: Connection,
  project: string,
  options: PageOptions = {},
) {
  return readCollection(
    connection,
    `${projectSettingsPath(project)}/workItemTypes`,
    page(options, typeFields),
  );
}

export async function getProjectWorkItemType(
  connection: Connection,
  project: string,
  type: string,
  options: ProjectionOptions = {},
) {
  return readObject(
    connection,
    `${projectSettingsPath(project)}/workItemTypes/${encodedID(type, "work item type ID")}`,
    { fields: fields(options, typeFields) },
  );
}

export async function getGlobalTimeSettings(connection: Connection, options: ProjectionOptions = {}) {
  return readObject(connection, globalSettingsPath, {
    fields: fields(options, `id,workTimeSettings(${workTimeFields})`),
  });
}

export async function listWorkItemTypes(connection: Connection, options: PageOptions = {}) {
  return readCollection(connection, `${globalSettingsPath}/workItemTypes`, page(options, typeFields));
}

export async function getWorkItemType(
  connection: Connection,
  type: string,
  options: ProjectionOptions = {},
) {
  return readObject(
    connection,
    `${globalSettingsPath}/workItemTypes/${encodedID(type, "work item type ID")}`,
    { fields: fields(options, typeFields) },
  );
}

export async function getWorkTimeSettings(connection: Connection, options: ProjectionOptions = {}) {
  return readObject(connection, `${globalSettingsPath}/workTimeSettings`, {
    fields: fields(options, workTimeFields),
  });
}
