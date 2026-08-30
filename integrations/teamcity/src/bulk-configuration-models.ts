import {
  type PlainProperty,
  plainProperty,
  propertiesBody,
  stepBody,
  extensionBody,
  snapshotBody,
  pathSegment,
} from "./authoring-models.js";
import { ruleBody } from "./advanced-authoring-models.js";
import { requiredText } from "./locator.js";

export type SettingsCollection =
  | "steps"
  | "features"
  | "triggers"
  | "agent-requirements"
  | "artifact-dependencies"
  | "snapshot-dependencies"
  | "vcs-root-entries"
  | "projectFeatures";
export type ParameterPart = "value" | "type" | "type/rawValue";
export function distinctIds(values: readonly string[]): string[] {
  if (values.length > 100) throw new Error("At most 100 explicit items are supported.");
  const ids = values.map((value) => requiredText(value, "ID"));
  if (new Set(ids).size !== ids.length) throw new Error("Duplicate IDs are not allowed.");
  return ids;
}
function record(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some((k) => !keys.includes(k))
  )
    throw new Error("Item must be an object with only documented input fields.");
  return value as Record<string, unknown>;
}
function string(value: unknown, name: string): string {
  if (typeof value !== "string") throw new Error(`Missing or invalid ${name}.`);
  return requiredText(value, name);
}
function flag(item: Record<string, unknown>, name: string): boolean | undefined {
  if (item[name] === undefined) return undefined;
  if (typeof item[name] !== "boolean") throw new Error(`${name} must be a boolean.`);
  return item[name];
}
function properties(value: unknown): PlainProperty[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 100)
    throw new Error("Properties must be an array of at most 100 entries.");
  return value.map((value) => {
    const item = record(value, ["name", "value"]);
    if (typeof item.value !== "string") throw new Error("Property value must be a string.");
    return plainProperty(string(item.name, "Property name"), item.value);
  });
}
export function settingsItems(
  kind: SettingsCollection,
  ownerId: string,
  values: readonly unknown[],
): object[] {
  if (values.length > 100) throw new Error("At most 100 explicit items are supported.");
  const ids: string[] = [];
  const result = values.map((value) => {
    const keys =
      kind === "steps"
        ? ["id", "name", "type", "properties"]
        : kind === "features" || kind === "triggers"
          ? ["id", "type", "enabled", "properties"]
          : kind === "projectFeatures"
            ? ["id", "type", "properties"]
            : kind === "agent-requirements"
              ? ["type", "parameter", "value", "disabled"]
              : kind === "artifact-dependencies"
                ? ["source", "rules", "revision", "revisionValue", "branch", "clean", "disabled"]
                : kind === "snapshot-dependencies"
                  ? ["source", "properties"]
                  : ["rootId", "rules"];
    const item = record(value, keys);
    const id = item.id === undefined ? {} : { id: string(item.id, "Item ID") };
    if ("id" in id) pathSegment(id.id);
    if ("id" in id) ids.push(id.id);
    const optionalString = (key: string) => {
      if (item[key] === undefined) return {};
      if (typeof item[key] !== "string") throw new Error(`${key} must be a string.`);
      return { [key]: item[key] };
    };
    switch (kind) {
      case "steps":
        return {
          ...id,
          ...stepBody({
            name: string(item.name, "Name"),
            type: string(item.type, "Type"),
            properties: properties(item.properties),
          }),
        };
      case "features":
      case "triggers":
        return {
          ...id,
          ...extensionBody({
            type: string(item.type, "Type"),
            enabled: flag(item, "enabled") ?? false,
            properties: properties(item.properties),
          }),
        };
      case "projectFeatures":
        return {
          ...id,
          type: string(item.type, "Type"),
          properties: propertiesBody(properties(item.properties)),
        };
      case "agent-requirements":
        ids.push(string(item.parameter, "Parameter"));
        return ruleBody(ownerId, {
          kind,
          type: string(item.type, "Type"),
          parameter: string(item.parameter, "Parameter"),
          ...optionalString("value"),
          disabled: flag(item, "disabled") ?? false,
        });
      case "artifact-dependencies":
        ids.push(string(item.source, "Source"));
        return ruleBody(ownerId, {
          kind,
          source: string(item.source, "Source"),
          rules: string(item.rules, "Rules"),
          revision: string(item.revision, "Revision"),
          ...optionalString("revisionValue"),
          ...optionalString("branch"),
          clean: flag(item, "clean") ?? false,
          disabled: flag(item, "disabled") ?? false,
        });
      case "snapshot-dependencies":
        ids.push(string(item.source, "Source"));
        return snapshotBody(ownerId, {
          source: string(item.source, "Source"),
          properties: properties(item.properties),
        });
      case "vcs-root-entries":
        ids.push(string(item.rootId, "Root ID"));
        if (typeof item.rules !== "string") throw new Error("Checkout rules must be a string.");
        return {
          "vcs-root": { id: string(item.rootId, "Root ID") },
          "checkout-rules": plainProperty("rules", item.rules).value,
        };
    }
  });
  distinctIds(ids);
  return result;
}
export interface ApprovalSummary {
  status?: string;
  canBeApprovedByCurrentUser?: boolean;
  configurationValid?: boolean;
  timeoutTimestamp?: string;
}
export const approvalFields =
  "status,canBeApprovedByCurrentUser,configurationValid,timeoutTimestamp";
export function safeApproval(value: ApprovalSummary): ApprovalSummary {
  return {
    ...(value.status === undefined ? {} : { status: value.status }),
    ...(value.canBeApprovedByCurrentUser === undefined
      ? {}
      : { canBeApprovedByCurrentUser: value.canBeApprovedByCurrentUser }),
    ...(value.configurationValid === undefined
      ? {}
      : { configurationValid: value.configurationValid }),
    ...(value.timeoutTimestamp === undefined ? {} : { timeoutTimestamp: value.timeoutTimestamp }),
  };
}
