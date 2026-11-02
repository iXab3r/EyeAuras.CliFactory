import { plainProperty } from "./authoring-models.js";
import { nestedId, integerId, requiredText } from "./locator.js";
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
// TeamCity includes an item's failure message only when `text` is requested.
export const multipleFields = "count,errorCount,operationResult(text,related(build(id)))";
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
/** Native JSON bodies can grow; additional fields still use the plain-property credential boundary. */
export function apiInputRecord(value: unknown, known: readonly string[]) {
  const item = object(value);
  if (![Object.prototype, null].includes(Object.getPrototypeOf(item))) throw new Error("Expected a JSON object.");
  const ancestors = new Set<object>();
  const validate = (key: string, value: unknown): void => {
    plainProperty(key, typeof value === "string" ? value : "");
    if (value === null || typeof value === "string" || typeof value === "boolean") return;
    if (typeof value === "number" && Number.isFinite(value)) return;
    if (typeof value !== "object" || ancestors.has(value) ||
        (!Array.isArray(value) && ![Object.prototype, null].includes(Object.getPrototypeOf(value))))
      throw new Error("Expected JSON input values.");
    ancestors.add(value);
    if (Array.isArray(value)) for (const child of value) validate("item", child);
    else for (const [name, child] of Object.entries(value)) validate(name, child);
    ancestors.delete(value);
  };
  for (const [key, field] of Object.entries(item)) if (!known.includes(key)) validate(key, field);
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
  const ids = array(value).map((v) => inputText(v, "ID"));
  if (!ids.length) throw new Error("At least one explicit ID is required.");
  return ids;
}
export function typedItems(value: readonly unknown[]): readonly unknown[] {
  if (!value.length) throw new Error("Expected at least one typed item.");
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
  // TeamCity attaches a message only to a failed item; the message itself is never exposed.
  const items = array(raw.operationResult).map((v) => {
    const result = object(v);
    const build = result.related === undefined ? undefined : object(result.related).build;
    return {
      ...(build === undefined ? {} : { buildId: safeScalars(build, ["id"]).id }),
      succeeded: result.message === undefined,
    };
  });
  if (items.length !== count || items.filter((item) => !item.succeeded).length !== errorCount)
    throw new Error("Invalid multiple-operation results; success is unknown.");
  return { count, errorCount, items };
}
export function buildUnion(ids: readonly number[]) {
  const values = ids.map((id) => integerId(id, "Build ID"));
  if (!values.length) throw new Error("At least one build ID is required.");
  return values.map((id) => `item:(id:${id})`).join(",");
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
  const input = apiInputRecord(value, ["target", "state", "assignee", "resolution", "comment"]);
  const { comment, ...native } = input;
  const { locator, scope, target } = investigationTarget(input.target);
  const assignee = input.assignee === undefined ? undefined
    : typeof input.assignee === "number" ? { id: Number(integerId(input.assignee, "Assignee")) }
    : apiInputRecord(input.assignee, []);
  return {
    locator,
    body: {
      ...native,
      ...(input.state === undefined ? {} : { state: inputText(input.state, "State") }),
      ...(assignee === undefined ? {} : { assignee }),
      ...(input.comment === undefined
        ? {}
        : { assignment: { text: inputText(input.comment, "Comment") } }),
      scope,
      target,
      ...(input.resolution === undefined ? {} : { resolution: typeof input.resolution === "string"
        ? { type: inputText(input.resolution, "Resolution") } : apiInputRecord(input.resolution, []) }),
    },
  };
}
export function muteBody(value: unknown) {
  const input = apiInputRecord(value, [
    "project",
    "jobs",
    "tests",
    "problems",
    "resolution",
    "time",
    "comment",
  ]);
  if (input.scope !== undefined || input.target !== undefined ||
      (input.resolution !== undefined && typeof input.resolution === "object")) {
    const native = apiInputRecord(value, []);
    for (const key of ["scope", "target", "resolution"]) if (native[key] !== undefined) object(native[key]);
    return native;
  }
  const { project, jobs, tests, problems, time, comment, ...native } = input;
  if (
    (input.project === undefined) === (input.jobs === undefined) ||
    (input.tests === undefined) === (input.problems === undefined)
  )
    throw new Error("Mute needs exactly one scope and one target kind.");
  const type = allowedField(inputText(input.resolution, "Resolution"), [
    "manually",
    "whenFixed",
    "atTime",
  ], true);
  if (type.toLowerCase() === "attime") inputText(input.time, "Time");
  return {
    ...native,
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
      ...(input.time === undefined ? {} : { time: inputText(input.time, "Time") }),
    },
  };
}
