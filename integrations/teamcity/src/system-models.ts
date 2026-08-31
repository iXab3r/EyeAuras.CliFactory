import {
  array,
  object,
  inputRecord,
  inputText,
  inputIds,
  safeScalars,
  teamCityTimestamp,
} from "./triage-models.js";
import { allowedField } from "./advanced-authoring-models.js";
import { pathSegment, propertiesBody } from "./authoring-models.js";
import { idPath, nestedId, joinLocator, positiveId } from "./locator.js";
import { open, lstat } from "node:fs/promises";
import { constants } from "node:fs";
import type { ScopedSecrets } from "@eyeauras/cli-factory";
import { requireInputSecret } from "./credential-inputs.js";

export const dashboardFields = "id,name,project(id)";
export const instanceFields = "id,currentState,deploymentDashboard(id)";
export const auditFields = "id,timestamp,action(id,name)";
export const healthFields = "identity,severity,healthCategory(id,name)";
export const pluginFields = "name,displayName,version,loaded,disabled";
export const roleFields = "id,name,permissions(permission(id)),included(role(id))";
export const licenseFields =
  "valid,active,expired,obsolete,expirationDate,maintenanceEndDate,type,servers,agents,unlimitedAgents,buildTypes,unlimitedBuildTypes,pipelines,unlimitedPipelines";
export const licenseSummaryFields =
  "serverLicenseType,maxAgents,unlimitedAgents,maxBuildTypes,unlimitedBuildTypes";
export const muteDeleteFields =
  "id,scope(project(id),buildTypes(buildType(id))),target(tests(test(id)),problems(problem(id))),resolution(type,time)";
export function collection(value: unknown, key: string, project: (v: unknown) => unknown) {
  const raw = object(value),
    items = array(raw[key]);
  if (items.length > 1000) throw new Error("TeamCity collection exceeded the local item bound.");
  const count = raw.count ?? items.length;
  if (!Number.isSafeInteger(count) || Number(count) < 0)
    throw new Error("Invalid collection count.");
  return { count, items: items.map(project) };
}
export const safeCategory = (v: unknown) => safeScalars(v, ["id", "name"]);
export function safeDashboard(value: unknown) {
  const v = object(value);
  return {
    ...safeScalars(v, ["id", "name"]),
    ...(v.project === undefined ? {} : { project: safeScalars(v.project, ["id"]) }),
  };
}
export function safeInstance(value: unknown) {
  const v = object(value);
  return {
    ...safeScalars(v, ["id", "currentState"]),
    ...(v.deploymentDashboard === undefined
      ? {}
      : { deploymentDashboard: safeScalars(v.deploymentDashboard, ["id"]) }),
  };
}
export function safeAudit(value: unknown) {
  const v = object(value);
  return {
    ...safeScalars(v, ["id", "timestamp"]),
    ...(v.action === undefined ? {} : { action: safeCategory(v.action) }),
  };
}
export function safeHealth(value: unknown) {
  const v = object(value);
  return {
    ...safeScalars(v, ["identity", "severity"]),
    ...(v.healthCategory === undefined ? {} : { healthCategory: safeCategory(v.healthCategory) }),
  };
}
export const safePlugin = (v: unknown) => safeScalars(v, pluginFields.split(","));
export const safeLicense = (v: unknown) => safeScalars(v, licenseFields.split(","));
export const dashboardPath = (id: string) =>
  "/app/rest/deploymentDashboards/" + idPath(id, "Dashboard ID");
export const instancePath = (dashboard: string, id: string) =>
  dashboardPath(dashboard) + "/instances/" + idPath(id, "Instance ID");
export const rolePath = (id: string) =>
  "/app/rest/roles/id:" + pathSegment(inputText(id, "Role ID"));
export function stateEntry(state: string, date: string, build?: string) {
  allowedField(state, ["IN_PROGRESS", "SUCCESSFUL", "FAILED", "CANCELLED", "UNKNOWN"]);
  return {
    state,
    deploymentDate: teamCityTimestamp(date),
    ...(build === undefined
      ? {}
      : { build: { id: Number(positiveId(Number(build), "Build ID")) } }),
  };
}
export function healthLocator(
  options: { project?: string; global?: boolean; category?: string },
  detail = false,
) {
  if ((options.project !== undefined) === (options.global === true))
    throw new Error("Choose exactly one project or global health scope.");
  if (detail && !options.category)
    throw new Error("Health detail requires a category; server rejects non-unique matches.");
  return joinLocator(
    options.project ? nestedId("project", options.project, "Project ID") : "global:true",
    options.category ? nestedId("healthCategory", options.category, "Category ID") : undefined,
  );
}
export function userId(id: string) {
  if (!/^[1-9]\d*$/.test(id)) throw new Error("User ID must be a positive decimal string.");
  return id;
}
export function safeRole(value: unknown) {
  const v = object(value);
  return {
    ...safeScalars(v, ["id", "name"]),
    permissions: {
      permission: array(
        v.permissions === undefined ? undefined : object(v.permissions).permission,
      ).map((x) => safeScalars(x, ["id"])),
    },
    included: {
      role: array(v.included === undefined ? undefined : object(v.included).role).map((x) =>
        safeScalars(x, ["id"]),
      ),
    },
  };
}
export function idsOrEmpty(ids: readonly string[]) {
  return ids.length ? inputIds(ids) : [];
}
export function boolean(value: unknown) {
  if (typeof value !== "boolean") throw new Error("Expected a boolean.");
  return value;
}
export function integer(value: unknown, min = 0, max = 2147483647) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max)
    throw new Error("Integer is outside the supported range.");
  return value;
}
export const globalKeys = [
  "defaultQuietPeriod",
  "defaultExecutionTimeout",
  "maxArtifactsNumber",
  "maxArtifactSize",
  "enforceDefaultVCSCheckInterval",
  "defaultVCSCheckInterval",
];
export function globalPatch(value: unknown) {
  const v = inputRecord(value, globalKeys),
    result: Record<string, number | boolean> = {};
  if (!Object.keys(v).length) throw new Error("At least one setting is required.");
  for (const [k, x] of Object.entries(v))
    result[k] =
      k === "enforceDefaultVCSCheckInterval"
        ? boolean(x)
        : integer(
            x,
            k === "defaultExecutionTimeout" ? -2147483648 : k.startsWith("maxArtifact") ? -1 : 0,
            k.startsWith("maxArtifact") ? Number.MAX_SAFE_INTEGER : 2147483647,
          );
  return result;
}
export const safeGlobal = (v: unknown) =>
  safeScalars(v, [...globalKeys, "useEncryption", "artifactsDomainIsolation"]);
export function cleanupPatch(value: unknown) {
  const v = inputRecord(value, ["enabled", "maxCleanupDuration", "daily", "cron"]),
    result: Record<string, unknown> = {};
  if (!Object.keys(v).length || (v.daily !== undefined && v.cron !== undefined))
    throw new Error("Choose settings and at most one cleanup schedule.");
  if (v.enabled !== undefined) result.enabled = boolean(v.enabled);
  if (v.maxCleanupDuration !== undefined) result.maxCleanupDuration = integer(v.maxCleanupDuration);
  if (v.daily !== undefined) {
    const d = inputRecord(v.daily, ["hour", "minute"]);
    result.daily = { hour: integer(d.hour, 0, 23), minute: integer(d.minute, 0, 59) };
  }
  if (v.cron !== undefined) {
    const c = inputRecord(v.cron, ["minute", "hour", "day", "month", "dayWeek"]);
    result.cron = Object.fromEntries(
      ["minute", "hour", "day", "month", "dayWeek"].map((k) => {
        const x = inputText(c[k], "Cron field");
        if (x.length > 64 || !/^[\d*,/\-?LW#]+$/.test(x)) throw new Error("Invalid cron field.");
        return [k, x];
      }),
    );
  }
  return result;
}
export function safeCleanup(value: unknown) {
  const v = object(value);
  return {
    ...safeScalars(v, ["enabled", "maxCleanupDuration"]),
    ...(v.daily == null ? {} : { daily: safeScalars(v.daily, ["hour", "minute"]) }),
    ...(v.cron == null
      ? {}
      : { cron: safeScalars(v.cron, ["minute", "hour", "day", "month", "dayWeek"]) }),
  };
}
const authBooleans = [
  "allowGuest",
  "collapseLoginForm",
  "perProjectPermissions",
  "emailVerification",
];
export function safeAuth(value: unknown) {
  const v = object(value);
  return {
    ...safeScalars(v, [...authBooleans, "buildAuthenticationMode"]),
    modules: array(v.modules === undefined ? undefined : object(v.modules).module).map((x) =>
      safeScalars(x, ["name"]),
    ),
  };
}
export async function authBody(value: unknown, secrets: ScopedSecrets) {
  const v = inputRecord(value, [...authBooleans, "buildAuthenticationMode", "modules"]),
    result: Record<string, unknown> = {};
  for (const k of authBooleans) if (v[k] !== undefined) result[k] = boolean(v[k]);
  if (v.buildAuthenticationMode !== undefined)
    result.buildAuthenticationMode = allowedField(inputText(v.buildAuthenticationMode, "Mode"), [
      "strict",
      "lax",
    ]);
  const modules = array(v.modules);
  if (!modules.length || modules.length > 20)
    throw new Error("Supply a complete nonempty authentication module list.");
  const seen = new Set<string>(),
    prepared = [];
  for (const item of modules) {
    const m = inputRecord(item, ["name", "properties", "secrets"]),
      name = inputText(m.name, "Module name");
    if (seen.has(name)) throw new Error("Duplicate authentication module.");
    seen.add(name);
    const properties = propertiesBody(
      array(m.properties).map((x) => {
        const p = inputRecord(x, ["name", "value"]);
        return {
          name: inputText(p.name, "Property name"),
          value: inputText(p.value, "Property value"),
        };
      }),
    ).property;
    const used = new Set(properties.map((p) => p.name));
    for (const item of array(m.secrets)) {
      const s = inputRecord(item, ["name", "alias"]);
      // Native secure property names are allowed here; only aliases carry their values.
      if (
        typeof s.name !== "string" ||
        !s.name ||
        /[\u0000-\u001f]/.test(s.name) ||
        used.has(s.name)
      )
        throw new Error("Invalid or duplicate secure property name.");
      used.add(s.name);
      properties.push({
        name: s.name,
        value: await requireInputSecret(secrets, inputText(s.alias, "Alias")),
      });
    }
    prepared.push({ name, properties: { property: properties } });
  }
  return { ...result, modules: { module: prepared } };
}
export function safeMetric(value: unknown) {
  const v = object(value);
  return {
    ...safeScalars(v, ["name", "prometheusName"]),
    values: array(
      v.metricValues === undefined ? undefined : object(v.metricValues).metricValue,
    ).map((x) => {
      const m = object(x);
      if (typeof m.value !== "number" || !Number.isFinite(m.value))
        throw new Error("Invalid numeric metric.");
      return safeScalars(m, ["name", "value"]);
    }),
  };
}
export function safeText(value: string) {
  if (value.length > 8192 || /[\u0000-\u0008\u000b-\u001f]/.test(value))
    throw new Error("Invalid text response; payload omitted.");
  return value;
}
// Deliberately parse the attribute-only plugin projection, not a general XML document.
export function pluginXml(value: string) {
  if (value.length > 65536 || /<!|&(?!(?:amp|lt|gt|quot|apos);)/.test(value))
    throw new Error("Unsafe or unsupported plugin XML.");
  const match = value.match(
    /^\s*(?:<\?xml\s+[^?]*\?>\s*)?<plugin\b([^<>]*?)(?:\s*\/\s*>|>\s*<\/plugin>)\s*$/,
  );
  if (!match) throw new Error("Expected projected plugin XML.");
  const attrs = match[1]!,
    raw: Record<string, unknown> = {};
  let offset = 0;
  const pattern = /\s+([A-Za-z][\w.-]*)\s*=\s*(?:"([^"<]*)"|'([^'<]*)')/gy;
  while (offset < attrs.length) {
    pattern.lastIndex = offset;
    const a = pattern.exec(attrs);
    if (!a) {
      if (attrs.slice(offset).trim()) throw new Error("Malformed plugin XML.");
      break;
    }
    const key = a[1]!,
      text = a[2] ?? a[3] ?? "";
    if (Object.hasOwn(raw, key)) throw new Error("Duplicate XML attribute.");
    raw[key] = text.replace(
      /&(amp|lt|gt|quot|apos);/g,
      (_, e: string) => ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" })[e]!,
    );
    offset = pattern.lastIndex;
  }
  for (const key of ["loaded", "disabled"])
    if (raw[key] !== undefined) {
      if (raw[key] !== "true" && raw[key] !== "false") throw new Error("Invalid plugin boolean.");
      raw[key] = raw[key] === "true";
    }
  if (typeof raw.name !== "string") throw new Error("Plugin identity is missing.");
  return safePlugin(raw);
}
export async function avatarInput(path: string) {
  const stat = await lstat(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 4 * 1024 * 1024)
    throw new Error("Avatar must be a regular PNG/JPEG file up to4MiB.");
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    if (!(await file.stat()).isFile()) throw new Error("Expected regular avatar file.");
    const bytes = Buffer.alloc(4 * 1024 * 1024 + 1);
    let length = 0;
    while (length < bytes.length) {
      const { bytesRead } = await file.read(bytes, length, bytes.length - length);
      if (!bytesRead) break;
      length += bytesRead;
    }
    const data = bytes.subarray(0, length);
    if (length > 4 * 1024 * 1024) throw new Error("Avatar exceeds byte bound.");
    const png = data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const jpeg = data[0] === 255 && data[1] === 216 && data[2] === 255;
    if (!png && !jpeg) throw new Error("Avatar is not PNG/JPEG.");
    const form = new FormData();
    form.set(
      "avatar",
      new Blob([data], { type: png ? "image/png" : "image/jpeg" }),
      png ? "avatar.png" : "avatar.jpg",
    );
    return form;
  } finally {
    await file.close();
  }
}
export function fullMute(value: unknown, id: number) {
  const v = object(value);
  if (v.id !== id) throw new Error("Mute preflight identity differs from selected ID.");
  const s = object(v.scope),
    t = object(v.target),
    r = object(v.resolution);
  if (
    (s.project !== undefined) === (s.buildTypes !== undefined) ||
    (t.tests !== undefined) === (t.problems !== undefined) ||
    t.anyProblem === true
  )
    throw new Error("Unsupported mute scope/target.");
  const list = (v: unknown, key: string) =>
    inputIds(array(object(v)[key]).map((x) => inputText(object(x).id, "Target ID"))).map((id) => ({
      id,
    }));
  const scope =
    s.project !== undefined
      ? { project: { id: inputText(object(s.project).id, "Project ID") } }
      : { buildTypes: { buildType: list(s.buildTypes, "buildType") } };
  const target =
    t.tests !== undefined
      ? { tests: { test: list(t.tests, "test") } }
      : { problems: { problem: list(t.problems, "problem") } };
  const type = allowedField(inputText(r.type, "Resolution"), ["manually", "whenFixed", "atTime"]);
  return {
    id,
    scope,
    target,
    resolution: {
      type,
      ...(type === "atTime" ? { time: teamCityTimestamp(inputText(r.time, "Time")) } : {}),
    },
  };
}
