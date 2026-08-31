import { requiredText } from "./locator.js";

export type ParameterOwner = "projects" | "jobs" | "output";
export interface PlainProperty {
  name: string;
  value: string;
}
export interface RawProperty {
  name: string;
  value?: string;
  inherited?: boolean;
  type?: { rawValue?: string };
}
export interface StepInput {
  name: string;
  type: string;
  properties?: readonly PlainProperty[];
}
export type ExtensionKind = "triggers" | "features";
export interface ExtensionInput {
  type: string;
  enabled?: boolean;
  properties?: readonly PlainProperty[];
}
export interface SnapshotDependencyInput {
  source: string;
  properties?: readonly PlainProperty[];
}
export interface BuildTypeIdentity {
  id: string;
  name?: string;
  projectId?: string;
}
export interface RawExtension {
  id: string;
  type: string;
  disabled?: boolean;
  inherited?: boolean;
  properties?: { property?: RawProperty[] };
}
export interface RawStep extends RawExtension {
  name?: string;
}
export interface RawSnapshotDependency extends RawExtension {
  "source-buildType"?: BuildTypeIdentity;
}
export interface VcsRoot {
  id: string;
  name: string;
  vcsName?: string;
  project?: { id: string; name?: string };
}
export interface RawVcsEntry {
  "vcs-root": VcsRoot;
  "checkout-rules"?: string;
}

export const propertyFields = "name,value,inherited,type(rawValue)";
export const stepFields = `id,name,type,disabled,inherited,properties(property(${propertyFields}))`;
export const extensionFields = `id,type,disabled,inherited,properties(property(${propertyFields}))`;
export const identityFields = "id,name,projectId";
export const snapshotFields = `${extensionFields},source-buildType(${identityFields})`;
export const rootFields = "id,name,vcsName,project(id,name)";
export const entryFields = `vcs-root(${rootFields}),checkout-rules`;

const sensitiveName =
  /password|passwd|secret|token|credential|secure:|private[._-]?key|api[._-]?key|access[._-]?key|authorization|cookie/i;
function sensitiveValue(value: string): boolean {
  if (/-----BEGIN |\bBearer\s|credentialsJSON:/i.test(value)) return true;
  for (const match of value.matchAll(/https?:\/\/[^\s"'<>]+/gi)) {
    let url: URL;
    try {
      url = new URL(match[0]);
    } catch {
      continue;
    }
    if (url.username || url.password) return true;
    const keys = [...url.searchParams.keys(), ...new URLSearchParams(url.hash.slice(1)).keys()];
    if (
      keys.some(
        (key) =>
          sensitiveName.test(key) ||
          /^(?:sig|signature|x-amz-signature|x-goog-signature)$/i.test(key),
      )
    )
      return true;
  }
  return false;
}

export function parameterType(property: RawProperty): string {
  if (property.type === undefined) return "plain";
  const spec = property.type?.rawValue;
  if (typeof spec !== "string") return "unknown";
  if (/\bpassword\b|display\s*=\s*['"]?hidden\b/i.test(spec)) return "protected";
  const kind = spec.trim().split(/\s+/)[0] ?? "";
  return kind === "" ? "plain" : ["text", "select", "checkbox"].includes(kind) ? kind : "unknown";
}

export function isPlainParameter(property: RawProperty): boolean {
  return (
    typeof property.name === "string" &&
    !sensitiveName.test(property.name) &&
    !["protected", "unknown"].includes(parameterType(property))
  );
}

export function safeProperty(property: RawProperty, exposeValue = true) {
  const redacted =
    !exposeValue ||
    !isPlainParameter(property) ||
    (property.value !== undefined && sensitiveValue(property.value));
  return {
    name: property.name,
    ...(property.inherited === undefined ? {} : { inherited: property.inherited }),
    type: parameterType(property),
    redacted,
    ...(!redacted && property.value !== undefined ? { value: property.value } : {}),
  };
}

export function plainProperty(name: string, value: string): PlainProperty {
  const normalized = requiredText(name, "Property name");
  if (sensitiveName.test(normalized) || sensitiveValue(value)) {
    throw new Error("Only non-secret properties are supported; do not pass credentials on argv.");
  }
  return { name: normalized, value };
}

export function propertiesBody(input: readonly PlainProperty[] = []) {
  const properties = input.map((p) => plainProperty(p.name, p.value));
  if (new Set(properties.map((p) => p.name)).size !== properties.length) {
    throw new Error("Duplicate property keys are not allowed.");
  }
  return { property: properties };
}

export function stepBody(input: StepInput) {
  return {
    name: requiredText(input.name, "Step name"),
    type: requiredText(input.type, "Runner type"),
    properties: propertiesBody(input.properties),
  };
}

export function extensionBody(input: ExtensionInput) {
  return {
    type: requiredText(input.type, "Extension type"),
    disabled: input.enabled !== true,
    properties: propertiesBody(input.properties),
  };
}

export function snapshotBody(jobId: string, input: SnapshotDependencyInput) {
  const source = requiredText(input.source, "Source build configuration ID");
  if (source === jobId.trim()) throw new Error("A job cannot depend on itself.");
  return {
    type: "snapshot_dependency",
    "source-buildType": { id: source },
    properties: propertiesBody(input.properties),
  };
}

export function safeExtension(extension: RawExtension) {
  return {
    id: extension.id,
    type: extension.type,
    ...(extension.disabled === undefined ? {} : { disabled: extension.disabled }),
    ...(extension.inherited === undefined ? {} : { inherited: extension.inherited }),
    properties: (extension.properties?.property ?? []).map((p) => safeProperty(p, false)),
  };
}

export function safeIdentity(identity: BuildTypeIdentity): BuildTypeIdentity {
  return {
    id: identity.id,
    ...(identity.name === undefined ? {} : { name: identity.name }),
    ...(identity.projectId === undefined ? {} : { projectId: identity.projectId }),
  };
}

export function safeSnapshot(dependency: RawSnapshotDependency) {
  const source = dependency["source-buildType"];
  return {
    ...safeExtension(dependency),
    ...(source === undefined ? {} : { source: safeIdentity(source) }),
  };
}

// These endpoints parse a single-value locator, not an id: dimension.
export function literalIdPath(id: string): string {
  const value = requiredText(id, "Resource ID");
  if (!/^[A-Za-z0-9_-]+$/.test(value))
    throw new Error("Expected a literal resource ID, not a locator.");
  return value;
}

export function safeStep(step: RawStep) {
  // Plugin properties (especially script content) are not a safe output schema.
  const safeSetting = (p: RawProperty): boolean =>
    (step.type === "simpleRunner" &&
      p.name === "use.custom.script" &&
      /^(true|false)$/.test(p.value ?? "")) ||
    (p.name === "teamcity.step.mode" && /^(default|always|run_on_failure)$/.test(p.value ?? ""));
  return {
    id: step.id,
    name: step.name,
    type: step.type,
    ...(step.disabled === undefined ? {} : { disabled: step.disabled }),
    ...(step.inherited === undefined ? {} : { inherited: step.inherited }),
    properties: (step.properties?.property ?? []).map((p) => safeProperty(p, safeSetting(p))),
  };
}

export function safeRoot(root: VcsRoot): VcsRoot {
  return {
    id: root.id,
    name: root.name,
    ...(root.vcsName === undefined ? {} : { vcsName: root.vcsName }),
    ...(root.project === undefined
      ? {}
      : {
          project: {
            id: root.project.id,
            ...(root.project.name === undefined ? {} : { name: root.project.name }),
          },
        }),
  };
}

export function safeEntry(entry: RawVcsEntry) {
  return { root: safeRoot(entry["vcs-root"]), rules: entry["checkout-rules"] ?? "" };
}

export function pathSegment(value: string): string {
  const normalized = requiredText(value, "Path segment");
  // URL dot-segment normalization happens even for percent-encoded dots.
  if (normalized === "." || normalized === "..")
    throw new Error("Dot path segments are not allowed.");
  return encodeURIComponent(normalized);
}
