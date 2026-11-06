import { locatorValue, idPath, requiredText } from "./locator.js";
import { plainProperty, propertiesBody, type PlainProperty } from "./authoring-models.js";
import { allowedField } from "./advanced-authoring-models.js";
import { apiInputRecord, array, inputText, object, safeScalars } from "./triage-models.js";

export type CloudKind = "profiles" | "images" | "instances";
export interface CloudImageId {
  profile: string;
  image: string;
}
export interface CloudInstanceId extends CloudImageId {
  instance: string;
}
export const cloudFields = {
  profiles: "id,name,cloudProviderId,project(id)",
  images: "id,name,profile(id),agentPoolId,operatingSystemName",
  instances: "id,name,state,startDate,image(id),agent(id)",
};
export const cloudCollection = {
  profiles: "cloudProfile",
  images: "cloudImage",
  instances: "cloudInstance",
};
export const vcsRootFields = "id,name,vcsName,project(id)";
export const vcsInstanceFields =
  "id,name,vcs-root-id,vcsName,modificationCheckInterval,commitHookMode";
export const versionedConfigKeys = [
  "synchronizationMode",
  "vcsRootId",
  "format",
  "buildSettingsMode",
  "allowUIEditing",
  "showSettingsChanges",
  "storeSecureValuesOutsideVcs",
  "portableDsl",
  "settingsPath",
  "applyChangesInDependenciesAndVcsSettings",
  "dslExecutionMode",
] as const;
export const versionedConfigFields = versionedConfigKeys.join(",");
export function cloudComposite(input: CloudImageId | CloudInstanceId) {
  const profile = "profileId:" + locatorValue(input.profile, "Cloud profile ID");
  return "instance" in input
    ? profile +
        ",imageId:" +
        locatorValue(input.image, "Cloud image ID") +
        ",id:" +
        locatorValue(input.instance, "Cloud instance ID")
    : profile + ",id:" + locatorValue(input.image, "Cloud image ID");
}
export function safeCloud(value: unknown, kind: CloudKind) {
  const raw = object(value);
  const keys =
    kind === "profiles"
      ? ["id", "name", "cloudProviderId"]
      : kind === "images"
        ? ["id", "name", "agentPoolId", "operatingSystemName"]
        : ["id", "name", "state", "startDate"];
  const nested =
    kind === "profiles" ? ["project"] : kind === "images" ? ["profile"] : ["image", "agent"];
  const result: Record<string, unknown> = safeScalars(raw, keys);
  for (const key of nested) if (raw[key] !== undefined) result[key] = safeScalars(raw[key], ["id"]);
  return result;
}
export function safeInfrastructureRoot(value: unknown) {
  const raw = object(value);
  return {
    ...safeScalars(raw, ["id", "name", "vcsName"]),
    ...(raw.project === undefined ? {} : { project: safeScalars(raw.project, ["id"]) }),
  };
}
export const safeVcsInstance = (value: unknown) =>
  safeScalars(value, [
    "id",
    "name",
    "vcs-root-id",
    "vcsName",
    "modificationCheckInterval",
    "commitHookMode",
  ]);
export const vcsRootPath = (id: string) => "/app/rest/vcs-roots/" + idPath(id, "VCS root ID");
export const vcsInstancePath = (id: string) =>
  "/app/rest/vcs-root-instances/" + idPath(id, "VCS instance ID");
export const versionedPath = (id: string) =>
  "/app/rest/projects/" + idPath(id, "Project ID") + "/versionedSettings";
export function anonymousGitRoot(
  id: string,
  name: string,
  project: string,
  url: string,
  branch: string,
) {
  return {
    id: inputText(id, "Root ID"),
    name: inputText(name, "Name"),
    vcsName: "jetbrains.git",
    project: { id: inputText(project, "Project ID") },
    properties: {
      property: [
        { name: "authMethod", value: "ANONYMOUS" },
        plainProperty("branch", requiredText(branch, "Branch")),
        plainProperty("url", url),
      ],
    },
  };
}
export function namedValues(values: readonly PlainProperty[], requireValue = false) {
  const result = propertiesBody(values).property;
  if (requireValue) for (const item of result) requiredText(item.value, "Revision");
  return result;
}
export const propertyNames = (value: unknown) =>
  array(object(value).property).map((item) => safeScalars(item, ["name"]).name);
export const repositoryEntries = (value: unknown) =>
  array(object(value).entry).map((item) => safeScalars(item, ["name", "value"]));
function versionedFormat(value: unknown): string {
  if (typeof value !== "string") throw new Error("Versioned settings format must be a string.");
  return value;
}
export function versionedField(field: string, value?: string) {
  plainProperty(field, "");
  if (value === undefined) return field;
  if (field === "synchronizationMode")
    return allowedField(value, ["useParentProjectSettings", "disabled", "enabled"]);
  if (field === "buildSettingsMode")
    return allowedField(value, ["alwaysUseCurrent", "useCurrentByDefault", "useFromVCS"]);
  if (field === "format") return versionedFormat(value);
  if (field === "vcsRootId") return inputText(value, "Root ID");
  const result = inputText(value, "Configuration value");
  if (field === "storeSecureValuesOutsideVcs" && result !== "true")
    throw new Error("Secrets must remain outside VCS.");
  return result;
}
export function versionedConfigBody(value: unknown) {
  const input = apiInputRecord(value, [...versionedConfigKeys, "importDecision"]);
  const result: Record<string, unknown> = {
    ...input,
    storeSecureValuesOutsideVcs: true,
  };
  for (const [key, field] of Object.entries(input)) {
    if (![...versionedConfigKeys, "importDecision"].includes(key)) continue;
    if (key === "format") {
      result[key] = versionedFormat(field);
      continue;
    }
    if (key === "importDecision") {
      result[key] = allowedField(inputText(field, "Import decision"), [
        "overrideInVCS",
        "importFromVCS",
      ]);
      continue;
    }
    if (key === "settingsPath") {
      result[key] = inputText(field, "Settings path");
      continue;
    }
    if (key === "dslExecutionMode") {
      result[key] = inputText(field, "DSL execution mode");
      continue;
    }
    if (
      [
        "allowUIEditing",
        "showSettingsChanges",
        "storeSecureValuesOutsideVcs",
        "portableDsl",
        "applyChangesInDependenciesAndVcsSettings",
      ].includes(key)
    ) {
      if (typeof field !== "boolean") throw new Error("Configuration flags must be booleans.");
      if (key === "storeSecureValuesOutsideVcs" && !field)
        throw new Error("Secrets must remain outside VCS.");
      result[key] = field;
    } else result[key] = versionedField(key, inputText(field, key));
  }
  return result;
}
export const safeVersionedConfig = (value: unknown) => safeScalars(value, versionedConfigKeys);
export function contextParameters(value: unknown) {
  return array(object(value).versionedSettingsContextParameter).map((item) => {
    const raw = object(item);
    return {
      ...safeScalars(raw, ["name"]),
      hasValue: raw.value !== undefined && raw.value !== null,
    };
  });
}
export function versionedStatus(value: unknown) {
  const raw = object(value);
  const missing = raw.missingContextParameters;
  if (
    missing !== undefined &&
    (!Array.isArray(missing) || missing.some((v) => typeof v !== "string"))
  )
    throw new Error("Invalid missing-parameter metadata; payload omitted.");
  return {
    ...safeScalars(raw, ["type", "timestamp", "dslOutdated"]),
    ...(missing === undefined ? {} : { missingContextParameters: missing }),
  };
}
