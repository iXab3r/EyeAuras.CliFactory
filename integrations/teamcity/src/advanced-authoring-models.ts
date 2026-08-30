import { plainProperty, propertiesBody } from "./authoring-models.js";
import { requiredText } from "./locator.js";

export type RuleKind = "agent-requirements" | "artifact-dependencies";
export type EntitySettingsKind = RuleKind | "steps" | "features" | "triggers";
export type RuleInput =
  | {
      kind: "agent-requirements";
      type: string;
      parameter: string;
      value?: string;
      disabled?: boolean;
    }
  | {
      kind: "artifact-dependencies";
      source: string;
      rules: string;
      revision: string;
      revisionValue?: string;
      branch?: string;
      clean?: boolean;
      disabled?: boolean;
    };
export function booleanText(value: string): string {
  if (value !== "true" && value !== "false") throw new Error("Expected true or false.");
  return value;
}
export function allowedField(field: string, allowed: readonly string[]): string {
  if (!allowed.includes(field)) throw new Error(`Supported fields: ${allowed.join(", ")}.`);
  return field;
}
export function ruleBody(jobId: string, input: RuleInput) {
  if (input.kind === "agent-requirements") {
    const parameter = plainProperty(input.parameter, input.value ?? "");
    return {
      type: requiredText(input.type, "Requirement type"),
      disabled: input.disabled === true,
      properties: propertiesBody([
        { name: "property-name", value: parameter.name },
        ...(input.value === undefined ? [] : [{ name: "property-value", value: input.value }]),
      ]),
    };
  }
  const source = requiredText(input.source, "Source job ID");
  if (source === jobId.trim()) throw new Error("A job cannot depend on itself.");
  return {
    type: "artifact_dependency",
    disabled: input.disabled === true,
    "source-buildType": { id: source },
    properties: propertiesBody([
      { name: "pathRules", value: requiredText(input.rules, "Artifact rules") },
      { name: "revisionName", value: requiredText(input.revision, "Revision rule") },
      ...(input.revisionValue === undefined
        ? []
        : [{ name: "revisionValue", value: input.revisionValue }]),
      ...(input.branch === undefined ? [] : [{ name: "revisionBranch", value: input.branch }]),
      { name: "cleanDestinationDirectory", value: String(input.clean === true) },
    ]),
  };
}
