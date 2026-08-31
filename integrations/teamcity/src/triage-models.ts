import { plainProperty } from "./authoring-models.js";
import { distinctIds } from "./bulk-configuration-models.js";
import { nestedId, positiveId, requiredText } from "./locator.js";
import { allowedField } from "./advanced-authoring-models.js";

export const evidenceBuildFields = "id,buildTypeId,number,state,status";
export const problemFields = "id,type,identity";
export const testOccurrenceFields =
  "id,name,status,duration,ignored,currentlyMuted,test(id),build(id)";
export const problemOccurrenceFields = "id,type,identity,currentlyMuted,problem(id),build(id)";
export const muteFields =
  "id,assignment(text,timestamp),scope(project(id),buildTypes(buildType(id))),target(anyProblem,tests(test(id)),problems(problem(id))),resolution(type,time)";
export const investigationFields = muteFields.replace(
  "id,assignment",
  "id,state,assignee(id),assignment",
);
export const multipleFields = "count,errorCount,operationResult(related(build(id)))";
export const labelFields = "count,vcsLabel,text,status,buildId";

export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Expected an object; payload omitted.");
  return value as Record<string, unknown>;
}
export function inputRecord(value: unknown, keys: readonly string[]) {
  const item = object(value);
  if (Object.keys(item).some((k) => !keys.includes(k))) throw new Error("Unknown input field.");
  return item;
}
export function inputText(value: unknown, name: string): string {
  if (typeof value !== "string") throw new Error(`Expected text for ${name}.`);
  return plainProperty(name, requiredText(value, name)).value;
}
export function array(value: unknown): unknown[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error("Expected an array; payload omitted.");
  return value;
}
export function inputIds(value: unknown): string[] {
  const ids = distinctIds(array(value).map((v) => inputText(v, "ID")));
  if (!ids.length) throw new Error("At least one explicit ID is required.");
  return ids;
}
export function typedItems(value: readonly unknown[]): readonly unknown[] {
  if (!value.length || value.length > 100) throw new Error("Expected 1–100 typed items.");
  return value;
}
export function safeScalars(value: unknown, keys: readonly string[]) {
  const raw = object(value);
  const result: Record<string, string | number | boolean> = {};
  for (const key of keys) {
    const field = raw[key];
    if (field === undefined) continue;
    if (
      !["string", "number", "boolean"].includes(typeof field) ||
      (typeof field === "number" &&
        (!Number.isFinite(field) || (key === "id" && !Number.isSafeInteger(field))))
    )
      throw new Error("Invalid scalar response; payload omitted.");
    result[key] = field as string | number | boolean;
  }
  return result;
}
export const safeEvidenceBuild = (value: unknown) =>
  safeScalars(value, ["id", "buildTypeId", "number", "state", "status"]);
export const safeEntity = (value: unknown, kind: "test" | "problem") =>
  safeScalars(value, kind === "test" ? ["id", "name"] : ["id", "type", "identity"]);
export function safeOccurrence(value: unknown, kind: "test" | "problem") {
  const raw = object(value);
  return {
    ...safeScalars(
      raw,
      kind === "test"
        ? ["id", "name", "status", "duration", "ignored", "currentlyMuted"]
        : ["id", "type", "identity", "currentlyMuted"],
    ),
    ...(raw[kind] === undefined ? {} : { [kind]: safeScalars(raw[kind], ["id"]) }),
    ...(raw.build === undefined ? {} : { build: safeScalars(raw.build, ["id"]) }),
  };
}
export function safeAssignment(value: unknown, investigation: boolean) {
  const raw = object(value);
  const result: Record<string, unknown> = safeScalars(
    raw,
    investigation ? ["id", "state"] : ["id"],
  );
  if (investigation && raw.assignee !== undefined)
    result.assignee = safeScalars(raw.assignee, ["id"]);
  if (raw.assignment !== undefined)
    result.assignment = safeScalars(raw.assignment, ["text", "timestamp"]);
  if (raw.resolution !== undefined)
    result.resolution = safeScalars(raw.resolution, ["type", "time"]);
  if (raw.scope !== undefined) {
    const scope = object(raw.scope);
    result.scope = {
      ...(scope.project === undefined ? {} : { project: safeScalars(scope.project, ["id"]) }),
      ...(scope.buildTypes === undefined
        ? {}
        : {
            buildTypes: {
              buildType: array(object(scope.buildTypes).buildType).map((v) =>
                safeScalars(v, ["id"]),
              ),
            },
          }),
    };
  }
  if (raw.target !== undefined) {
    const target = object(raw.target);
    result.target = {
      ...safeScalars(target, ["anyProblem"]),
      ...(target.tests === undefined
        ? {}
        : { tests: { test: array(object(target.tests).test).map((v) => safeScalars(v, ["id"])) } }),
      ...(target.problems === undefined
        ? {}
        : {
            problems: {
              problem: array(object(target.problems).problem).map((v) => safeScalars(v, ["id"])),
            },
          }),
    };
  }
  return result;
}
export function safeMultiple(value: unknown) {
  const raw = object(value);
  const count = raw.count;
  const errorCount = raw.errorCount;
  if (
    typeof count !== "number" ||
    typeof errorCount !== "number" ||
    !Number.isSafeInteger(count) ||
    !Number.isSafeInteger(errorCount) ||
    count < 0 ||
    errorCount < 0 ||
    errorCount > count
  )
    throw new Error("Invalid multiple-operation counts; success is unknown.");
  return {
    count,
    errorCount,
    partialFailure: errorCount > 0,
    buildIds: array(raw.operationResult).flatMap((v) => {
      const related = object(v).related;
      const build = related === undefined ? undefined : object(related).build;
      return build === undefined ? [] : [safeScalars(build, ["id"]).id];
    }),
  };
}
export function buildUnion(ids: readonly number[]) {
  const values = distinctIds(ids.map((id) => positiveId(id, "Build ID")));
  if (!values.length) throw new Error("At least one build ID is required.");
  return values.map((id) => `item:(id:${id})`).join(",");
}
export function teamCityTimestamp(value: string): string {
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})([+-])(\d{2})(\d{2})$/.exec(value);
  if (!match) throw new Error("Expected TeamCity timestamp YYYYMMDDTHHmmss+ZZZZ.");
  const [, year, month, day, hour, minute, second, , zoneHour, zoneMinute] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() + 1 !== Number(month) ||
    date.getUTCDate() !== Number(day) ||
    Number(hour) > 23 ||
    Number(minute) > 59 ||
    Number(second) > 59 ||
    Number(zoneHour) > 23 ||
    Number(zoneMinute) > 59
  )
    throw new Error("Invalid TeamCity timestamp.");
  return value;
}
export function investigationTarget(value: unknown) {
  const input = inputRecord(value, ["kind", "jobId", "projectId", "testId", "problemId"]);
  const kind = allowedField(inputText(input.kind, "Target kind"), ["job", "test", "problem"]);
  if (kind === "job") {
    if (
      input.projectId !== undefined ||
      input.testId !== undefined ||
      input.problemId !== undefined
    )
      throw new Error("Job target cannot include a project/test/problem.");
    const id = inputText(input.jobId, "Job ID");
    return {
      locator: nestedId("buildType", id, "Job ID"),
      scope: { buildTypes: { buildType: [{ id }] } },
      target: { anyProblem: true },
    };
  }
  if (input.jobId !== undefined || input[kind === "test" ? "problemId" : "testId"] !== undefined)
    throw new Error("Exactly one investigation target is required.");
  const projectId = inputText(input.projectId, "Project ID");
  const id = inputText(input[kind + "Id"], "Target ID");
  return {
    locator: `${nestedId("assignmentProject", projectId, "Project ID")},${nestedId(kind, id, "Target ID")}`,
    scope: { project: { id: projectId } },
    target: kind === "test" ? { tests: { test: [{ id }] } } : { problems: { problem: [{ id }] } },
  };
}
export function investigationBody(value: unknown) {
  const input = inputRecord(value, ["target", "state", "assignee", "resolution", "comment"]);
  const { locator, scope, target } = investigationTarget(input.target);
  if (typeof input.assignee !== "number") throw new Error("Assignee must be a numeric user ID.");
  return {
    locator,
    body: {
      state: allowedField(inputText(input.state, "State"), ["TAKEN", "FIXED", "GIVEN_UP"]),
      assignee: { id: Number(positiveId(input.assignee, "Assignee")) },
      ...(input.comment === undefined
        ? {}
        : { assignment: { text: inputText(input.comment, "Comment") } }),
      scope,
      target,
      resolution: {
        type: allowedField(inputText(input.resolution, "Resolution"), ["manually", "whenFixed"]),
      },
    },
  };
}
export function muteBody(value: unknown) {
  const input = inputRecord(value, [
    "project",
    "jobs",
    "tests",
    "problems",
    "resolution",
    "time",
    "comment",
  ]);
  if (
    (input.project === undefined) === (input.jobs === undefined) ||
    (input.tests === undefined) === (input.problems === undefined)
  )
    throw new Error("Mute needs exactly one scope and one target kind.");
  const type = allowedField(inputText(input.resolution, "Resolution"), [
    "manually",
    "whenFixed",
    "atTime",
  ]);
  if (type !== "atTime" && input.time !== undefined)
    throw new Error("Time requires atTime resolution.");
  return {
    ...(input.comment === undefined
      ? {}
      : { assignment: { text: inputText(input.comment, "Comment") } }),
    scope:
      input.project !== undefined
        ? { project: { id: inputText(input.project, "Project ID") } }
        : { buildTypes: { buildType: inputIds(input.jobs).map((id) => ({ id })) } },
    target:
      input.tests !== undefined
        ? { tests: { test: inputIds(input.tests).map((id) => ({ id })) } }
        : { problems: { problem: inputIds(input.problems).map((id) => ({ id })) } },
    resolution: {
      type,
      ...(type === "atTime" ? { time: teamCityTimestamp(inputText(input.time, "Time")) } : {}),
    },
  };
}
