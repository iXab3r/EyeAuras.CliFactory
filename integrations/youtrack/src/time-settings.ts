import { encodedID, readCollectionAt, readObjectAt } from "./client.js";

const globalSettingsPath = "api/admin/timeTrackingSettings";
const typeFields = "id,name,autoAttached";
const workTimeFields = "id,minutesADay,workDays,firstDayOfWeek,daysAWeek";
const projectFields =
  "id,enabled,estimate(id,field(id,name)),timeSpent(id,field(id,name)),project(id,name,shortName)";
const projectSettingsPath = (project: string) =>
  `api/admin/projects/${encodedID(project, "project ID")}/timeTrackingSettings`;

export const getProjectTimeSettings = readObjectAt(projectSettingsPath, projectFields);
export const listProjectWorkItemTypes = readCollectionAt(
  (project: string) => `${projectSettingsPath(project)}/workItemTypes`,
  typeFields,
);
export const getProjectWorkItemType = readObjectAt(
  (project: string, type: string) =>
    `${projectSettingsPath(project)}/workItemTypes/${encodedID(type, "work item type ID")}`,
  typeFields,
);
export const getGlobalTimeSettings = readObjectAt(
  globalSettingsPath,
  `id,workTimeSettings(${workTimeFields})`,
);
export const listWorkItemTypes = readCollectionAt(
  `${globalSettingsPath}/workItemTypes`,
  typeFields,
);
export const getWorkItemType = readObjectAt(
  (type: string) => `${globalSettingsPath}/workItemTypes/${encodedID(type, "work item type ID")}`,
  typeFields,
);
export const getWorkTimeSettings = readObjectAt(
  `${globalSettingsPath}/workTimeSettings`,
  workTimeFields,
);
