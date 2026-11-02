import { plainProperty, safeIdentity, pathSegment, type BuildTypeIdentity } from "./authoring-models.js";
import { requiredText } from "./locator.js";

export interface AgentPoolSummary {
  id: number;
  name?: string;
}
export interface OperationComment {
  text?: string;
  timestamp?: string;
}
export interface BooleanStatus {
  status: boolean;
  comment?: OperationComment;
}
export interface AgentPolicy {
  policy: "any" | "selected";
  jobs: BuildTypeIdentity[];
}
export interface RawAgentPolicy {
  policy: AgentPolicy["policy"];
  buildTypes?: { buildType?: BuildTypeIdentity[] };
}
export interface OperationBuild {
  id: number;
  buildTypeId?: string;
  number?: string;
  state?: string;
  status?: string;
  queuePosition?: number;
}
export interface ChangeSummary {
  id: number;
  version?: string;
  date?: string;
  comment?: string;
}
export const operationBuildFields = "id,buildTypeId,number,state,status,queuePosition";
export const booleanStatusFields = "status,comment(text,timestamp)";
export const policyFields = "policy,buildTypes(buildType(id,name,projectId))";
export const changeSummaryFields = "id,version,date,comment";

export function poolNumber(id: number): number {
  if (!Number.isSafeInteger(id))
    throw new Error("Pool ID must be a safe integer.");
  return id;
}
export function safeNamed(value: AgentPoolSummary): AgentPoolSummary {
  return { id: value.id, ...(value.name === undefined ? {} : { name: value.name }) };
}
export function safeComment(value: OperationComment): OperationComment {
  return {
    ...(value.text === undefined ? {} : { text: value.text }),
    ...(value.timestamp === undefined ? {} : { timestamp: value.timestamp }),
  };
}
export function safeBooleanStatus(value: BooleanStatus): BooleanStatus {
  return {
    status: value.status,
    ...(value.comment == null ? {} : { comment: safeComment(value.comment) }),
  };
}
export function safePolicy(value: RawAgentPolicy): AgentPolicy {
  return { policy: value.policy, jobs: (value.buildTypes?.buildType ?? []).map(safeIdentity) };
}
export function safeOperationBuild(value: OperationBuild): OperationBuild {
  return {
    id: value.id,
    ...(value.buildTypeId === undefined ? {} : { buildTypeId: value.buildTypeId }),
    ...(value.number === undefined ? {} : { number: value.number }),
    ...(value.state === undefined ? {} : { state: value.state }),
    ...(value.status === undefined ? {} : { status: value.status }),
    ...(value.queuePosition === undefined ? {} : { queuePosition: value.queuePosition }),
  };
}
export function safeChange(value: ChangeSummary): ChangeSummary {
  return {
    id: value.id,
    ...(value.version === undefined ? {} : { version: value.version }),
    ...(value.date === undefined ? {} : { date: value.date }),
    ...(value.comment === undefined ? {} : { comment: value.comment }),
  };
}
export function queuePosition(value: string): string {
  return pathSegment(plainProperty("Queue position", value).value);
}
export function publicTags(tags: readonly string[], allowEmpty = false) {
  if (!allowEmpty && tags.length === 0) throw new Error("At least one tag is required.");
  const names = tags.map((tag) => plainProperty("tag", requiredText(tag, "Tag")).value);
  return { tag: names.map((name) => ({ name })) };
}
export function statistic(name: string, value: string) {
  if (typeof value !== "string") {
    throw new Error("TeamCity statistic value must be text.");
  }
  return { name: requiredText(name, "Statistic name"), value };
}
