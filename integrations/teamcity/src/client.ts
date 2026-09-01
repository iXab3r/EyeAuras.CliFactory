import * as triage from "./triage-models.js";
import * as admin from "./admin-models.js";
import * as infrastructure from "./infrastructure-models.js";
import * as system from "./system-models.js";
import {
  requireInputSecret,
  inputSecretKey,
  preflightSecretKeys,
  persistSecretKeys,
} from "./credential-inputs.js";
import { readBoundedResponseBody, type ScopedSecrets, type IAppArguments } from "@eyeauras/cli-factory";
import * as files from "./file-models.js";
import { saveDownload, type DownloadOptions } from "./downloads.js";
import {
  idPath,
  joinLocator,
  nestedId,
  pageDimensions,
  positiveId,
  requiredText,
} from "./locator.js";
import {
  propertyFields,
  stepFields,
  rootFields,
  entryFields,
  isPlainParameter,
  plainProperty,
  safeProperty,
  stepBody,
  safeStep,
  safeRoot,
  safeEntry,
  pathSegment,
  literalIdPath,
  extensionFields,
  extensionBody,
  safeExtension,
  snapshotFields,
  snapshotBody,
  safeSnapshot,
  identityFields,
  safeIdentity,
  propertiesBody,
  type ExtensionKind,
  type ExtensionInput,
  type RawExtension,
  type SnapshotDependencyInput,
  type RawSnapshotDependency,
  type BuildTypeIdentity,
  type ParameterOwner,
  type RawProperty,
  type PlainProperty,
  type StepInput,
  type RawStep,
  type VcsRoot,
  type RawVcsEntry,
} from "./authoring-models.js";
import {
  allowedField,
  booleanText,
  ruleBody,
  type RuleInput,
  type RuleKind,
  type EntitySettingsKind,
} from "./advanced-authoring-models.js";
import {
  distinctIds,
  settingsItems,
  safeApproval,
  approvalFields,
  type ApprovalSummary,
  type ParameterPart,
  type SettingsCollection,
} from "./bulk-configuration-models.js";
import type {
  TeamCityAgent,
  TeamCityBuild,
  TeamCityBuildState,
  TeamCityBuildStatus,
  TeamCityChange,
  TeamCityClientOptions,
  TeamCityJob,
  TeamCityPageOptions,
  TeamCityProblemOccurrence,
  TeamCityProject,
  TeamCityServer,
  TeamCityTestOccurrence,
  TeamCityTestStatus,
  TeamCityTriState,
  TeamCityUser,
} from "./models.js";
import {
  poolNumber,
  safeNamed,
  safeComment,
  safeBooleanStatus,
  safePolicy,
  safeOperationBuild,
  safeChange,
  queuePosition,
  publicTags,
  statistic,
  operationBuildFields,
  booleanStatusFields,
  policyFields,
  changeSummaryFields,
  type AgentPoolSummary,
  type OperationComment,
  type BooleanStatus,
  type RawAgentPolicy,
  type OperationBuild,
  type ChangeSummary,
} from "./operator-models.js";

const userFields = "id,username,name,email";
const serverFields =
  "version,versionMajor,versionMinor,buildNumber,startTime,currentTime,role,webUrl";
const projectFields = "id,name,parentProjectId,archived,description,webUrl";
const jobFields = "id,name,projectId,projectName,paused,description,webUrl";
const buildFields =
  "id,buildTypeId,number,state,status,statusText,branchName,defaultBranch,personal," +
  "queuedDate,startDate,finishDate,percentageComplete,queuePosition,waitReason,webUrl," +
  "agent(id,name)";
const testOccurrenceFields =
  "id,name,status,duration,ignored,newFailure,muted," +
  "currentlyMuted,currentlyInvestigated,details";
const problemOccurrenceFields =
  "id,type,identity,newFailure,currentlyMuted,currentlyInvestigated,logAnchor,details," +
  "problem(id,type,identity,description)";
const changeFields =
  "id,version,internalVersion,date,commitDate,comment,webUrl,commiter(vcsUsername)";
const agentFields =
  "id,name,connected,enabled,authorized,uptodate,webUrl," +
  "build(id,buildTypeId,number,state,status)";

interface ProjectsResponse {
  project?: TeamCityProject[];
}

interface BuildTypesResponse {
  buildType?: TeamCityJob[];
}

interface BuildsResponse {
  build?: TeamCityBuild[];
}

interface TestOccurrencesResponse {
  testOccurrence?: TeamCityTestOccurrence[];
}

interface ProblemOccurrencesResponse {
  problemOccurrence?: TeamCityProblemOccurrence[];
}

interface RawTeamCityChange extends Omit<TeamCityChange, "committer"> {
  commiter?: { vcsUsername?: string };
}

interface ChangesResponse {
  change?: RawTeamCityChange[];
}

interface AgentsResponse {
  agent?: TeamCityAgent[];
}

export interface ListProjectsOptions extends TeamCityPageOptions {
  parent?: string;
  includeArchived?: boolean;
}

export interface ListJobsOptions extends TeamCityPageOptions {
  project?: string;
}

export interface ListBuildsOptions extends TeamCityPageOptions {
  job?: string;
  project?: string;
  state?: TeamCityBuildState;
  status?: TeamCityBuildStatus;
}

export interface ListBuildTestsOptions extends TeamCityPageOptions {
  status?: TeamCityTestStatus;
}

export interface ListQueueOptions extends TeamCityPageOptions {
  job?: string;
  project?: string;
}

export interface ListAgentsOptions extends TeamCityPageOptions {
  connected?: TeamCityTriState;
  enabled?: TeamCityTriState;
  authorized?: TeamCityTriState;
}

export interface RunJobOptions {
  branch?: string;
  comment?: string;
}

export interface CancelBuildOptions {
  comment?: string;
}

export interface CreateProjectOptions {
  name: string;
  parent?: string;
  description?: string;
}

export interface CreateJobOptions {
  name: string;
  project: string;
  description?: string;
}

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

function decodeJson<T>(contents: string): T {
  try {
    return JSON.parse(contents) as T;
  } catch {
    throw new Error("TeamCity response was not valid JSON.");
  }
}

function projectPath(id: string): string {
  return `/app/rest/projects/${idPath(id, "Project ID")}`;
}

function jobPath(id: string): string {
  return `/app/rest/buildTypes/${idPath(id, "Job ID")}`;
}

function extensionPath(kind: ExtensionKind, jobId: string, id: string): string {
  return `${jobPath(jobId)}/${kind}/${kind === "triggers" ? literalIdPath(id) : pathSegment(id)}`;
}

function snapshotPath(jobId: string, id: string): string {
  return `${jobPath(jobId)}/snapshot-dependencies/${literalIdPath(id)}`;
}

function parametersPath(owner: ParameterOwner, id: string): string {
  return `${owner === "projects" ? projectPath(id) : jobPath(id)}/${owner === "output" ? "output-parameters" : "parameters"}`;
}

function entityPath(kind: EntitySettingsKind, jobId: string, id: string): string {
  const segment =
    kind === "triggers"
      ? literalIdPath(id)
      : kind === "agent-requirements" || kind === "artifact-dependencies"
        ? idPath(id, "Entity ID")
        : pathSegment(id);
  return `${jobPath(jobId)}/${kind}/${segment}`;
}

function ruleFields(kind: RuleKind): string {
  return kind === "artifact-dependencies" ? snapshotFields : extensionFields;
}

function entryPath(jobId: string, rootId: string): string {
  return `${jobPath(jobId)}/vcs-root-entries/${idPath(rootId, "VCS root ID")}`;
}

function poolPath(id: number): string {
  return `/app/rest/agentPools/id:${poolNumber(id)}`;
}
function agentPath(id: number): string {
  return `/app/rest/agents/id:${positiveId(id, "Agent ID")}`;
}
function buildPath(id: number, owner: "builds" | "queue" = "builds"): string {
  return `/app/rest/${owner === "queue" ? "buildQueue" : "builds"}/id:${positiveId(id, "Build ID")}`;
}

export class TeamCityHttpError extends Error {
  public readonly status: number;

  public constructor(status: number, message: string) {
    super(message);
    this.name = "TeamCityHttpError";
    this.status = status;
  }
}

export class TeamCityClient {
  readonly #baseUrl: string;
  readonly #token: string | undefined;
  readonly #guest: boolean;
  readonly #fetch: typeof globalThis.fetch;
  readonly #signal: AbortSignal | undefined;

  public constructor(options: TeamCityClientOptions) {
    const baseUrl = options.baseUrl.trim().replace(/\/+$/, "");
    if (!baseUrl) {
      throw new Error("TeamCity base URL cannot be empty.");
    }
    const token = options.token?.trim();
    if (options.guest === true && token) {
      throw new Error("TeamCity guest access and token authentication are mutually exclusive.");
    }
    if (options.guest !== true && !token) {
      throw new Error("TeamCity token authentication requires a non-empty token.");
    }
    this.#baseUrl = baseUrl;
    this.#token = token;
    this.#guest = options.guest === true;
    this.#fetch = options.fetch ?? globalThis.fetch;
    this.#signal = options.signal;
  }

  public currentUser(): Promise<TeamCityUser> {
    return this.#requestJson<TeamCityUser>("GET", "/app/rest/users/current", {
      fields: userFields,
    });
  }

  public getServerStatus(): Promise<TeamCityServer> {
    return this.#requestJson<TeamCityServer>("GET", "/app/rest/server", {
      fields: serverFields,
    });
  }

  public async listProjects(options: ListProjectsOptions = {}): Promise<TeamCityProject[]> {
    const locator = joinLocator(
      options.parent
        ? nestedId("project", options.parent, "TeamCity parent project ID")
        : undefined,
      options.includeArchived === true ? undefined : "archived:false",
      ...pageDimensions(options),
    );
    const response = await this.#requestJson<ProjectsResponse>("GET", "/app/rest/projects", {
      locator,
      fields: `project(${projectFields})`,
    });
    return response.project ?? [];
  }

  public getProject(id: string): Promise<TeamCityProject> {
    return this.#requestJson<TeamCityProject>(
      "GET",
      `/app/rest/projects/${idPath(id, "TeamCity project ID")}`,
      { fields: projectFields },
    );
  }

  public async listJobs(options: ListJobsOptions = {}): Promise<TeamCityJob[]> {
    const locator = joinLocator(
      "templateFlag:false",
      options.project ? nestedId("project", options.project, "TeamCity project ID") : undefined,
      ...pageDimensions(options),
    );
    const response = await this.#requestJson<BuildTypesResponse>("GET", "/app/rest/buildTypes", {
      locator,
      fields: `buildType(${jobFields})`,
    });
    return response.buildType ?? [];
  }

  public getJob(id: string): Promise<TeamCityJob> {
    return this.#requestJson<TeamCityJob>(
      "GET",
      `/app/rest/buildTypes/${idPath(id, "TeamCity job ID")}`,
      { fields: jobFields },
    );
  }

  public async getJobStatus(id: string): Promise<{
    jobId: string;
    latestBuild: TeamCityBuild | null;
  }> {
    const response = await this.#requestJson<BuildsResponse>("GET", "/app/rest/builds", {
      locator: joinLocator(
        nestedId("buildType", id, "TeamCity job ID"),
        "defaultFilter:false",
        "branch:default:any",
        "count:1",
      ),
      fields: `build(${buildFields})`,
    });
    return { jobId: id, latestBuild: response.build?.[0] ?? null };
  }

  public async listBuilds(options: ListBuildsOptions = {}): Promise<TeamCityBuild[]> {
    const response = await this.#requestJson<BuildsResponse>("GET", "/app/rest/builds", {
      locator: joinLocator(
        "defaultFilter:false",
        "branch:default:any",
        options.job ? nestedId("buildType", options.job, "TeamCity job ID") : undefined,
        options.project
          ? nestedId("affectedProject", options.project, "TeamCity project ID")
          : undefined,
        options.state ? `state:${options.state}` : undefined,
        options.status ? `status:${options.status}` : undefined,
        ...pageDimensions(options),
      ),
      fields: `build(${buildFields})`,
    });
    return response.build ?? [];
  }

  public getBuild(id: number): Promise<TeamCityBuild> {
    return this.#requestJson<TeamCityBuild>(
      "GET",
      `/app/rest/builds/id:${positiveId(id, "TeamCity build ID")}`,
      { fields: buildFields },
    );
  }

  public async listBuildTests(
    id: number,
    options: ListBuildTestsOptions = {},
  ): Promise<TeamCityTestOccurrence[]> {
    const response = await this.#requestJson<TestOccurrencesResponse>(
      "GET",
      "/app/rest/testOccurrences",
      {
        locator: joinLocator(
          `build:(id:${positiveId(id, "TeamCity build ID")})`,
          options.status ? `status:${options.status}` : undefined,
          ...pageDimensions(options),
        ),
        fields: `testOccurrence(${testOccurrenceFields})`,
      },
    );
    return response.testOccurrence ?? [];
  }

  public async listBuildProblems(
    id: number,
    options: TeamCityPageOptions = {},
  ): Promise<TeamCityProblemOccurrence[]> {
    const response = await this.#requestJson<ProblemOccurrencesResponse>(
      "GET",
      "/app/rest/problemOccurrences",
      {
        locator: joinLocator(
          `build:(id:${positiveId(id, "TeamCity build ID")})`,
          ...pageDimensions(options),
        ),
        fields: `problemOccurrence(${problemOccurrenceFields})`,
      },
    );
    return response.problemOccurrence ?? [];
  }

  public async listBuildChanges(
    id: number,
    options: TeamCityPageOptions = {},
  ): Promise<TeamCityChange[]> {
    const response = await this.#requestJson<ChangesResponse>("GET", "/app/rest/changes", {
      locator: joinLocator(
        `build:(id:${positiveId(id, "TeamCity build ID")})`,
        ...pageDimensions(options),
      ),
      fields: `change(${changeFields})`,
    });
    return (response.change ?? []).map((change) => ({
      id: change.id,
      version: change.version,
      date: change.date,
      ...(change.internalVersion === undefined ? {} : { internalVersion: change.internalVersion }),
      ...(change.commitDate === undefined ? {} : { commitDate: change.commitDate }),
      ...(change.comment === undefined ? {} : { comment: change.comment }),
      ...(change.webUrl === undefined ? {} : { webUrl: change.webUrl }),
      ...(change.commiter?.vcsUsername === undefined
        ? {}
        : { committer: change.commiter.vcsUsername }),
    }));
  }

  public async listQueue(options: ListQueueOptions = {}): Promise<TeamCityBuild[]> {
    const response = await this.#requestJson<BuildsResponse>("GET", "/app/rest/buildQueue", {
      locator: joinLocator(
        options.job ? nestedId("buildType", options.job, "TeamCity job ID") : undefined,
        options.project ? nestedId("project", options.project, "TeamCity project ID") : undefined,
        ...pageDimensions(options),
      ),
      fields: `build(${buildFields})`,
    });
    return response.build ?? [];
  }

  public async listAgents(options: ListAgentsOptions = {}): Promise<TeamCityAgent[]> {
    const response = await this.#requestJson<AgentsResponse>("GET", "/app/rest/agents", {
      locator: joinLocator(
        `connected:${options.connected ?? "any"}`,
        `enabled:${options.enabled ?? "any"}`,
        `authorized:${options.authorized ?? "any"}`,
        ...pageDimensions(options),
      ),
      fields: `agent(${agentFields})`,
    });
    return response.agent ?? [];
  }

  public getAgent(id: number): Promise<TeamCityAgent> {
    return this.#requestJson<TeamCityAgent>(
      "GET",
      `/app/rest/agents/id:${positiveId(id, "TeamCity agent ID")}`,
      { fields: agentFields },
    );
  }

  public runJob(id: string, options: RunJobOptions = {}): Promise<TeamCityBuild> {
    const jobId = requiredText(id, "TeamCity job ID");
    return this.#requestJson<TeamCityBuild>(
      "POST",
      "/app/rest/buildQueue",
      { fields: buildFields },
      {
        buildType: { id: jobId },
        ...(options.branch === undefined
          ? {}
          : { branchName: requiredText(options.branch, "TeamCity branch name") }),
        ...(options.comment === undefined
          ? {}
          : { comment: { text: requiredText(options.comment, "Build comment") } }),
      },
    );
  }

  public cancelBuild(id: number, options: CancelBuildOptions = {}): Promise<TeamCityBuild> {
    return this.#cancel(`/app/rest/builds/id:${positiveId(id, "TeamCity build ID")}`, options);
  }

  public cancelQueuedBuild(id: number, options: CancelBuildOptions = {}): Promise<TeamCityBuild> {
    return this.#cancel(
      `/app/rest/buildQueue/id:${positiveId(id, "TeamCity queued build ID")}`,
      options,
    );
  }

  public createProject(id: string, options: CreateProjectOptions): Promise<TeamCityProject> {
    return this.#requestJson(
      "POST",
      "/app/rest/projects",
      { fields: projectFields },
      {
        id: requiredText(id, "Project ID"),
        name: requiredText(options.name, "Project name"),
        parentProject: { id: requiredText(options.parent ?? "_Root", "Parent project ID") },
        ...(options.description === undefined ? {} : { description: options.description }),
      },
    );
  }

  public createJob(id: string, options: CreateJobOptions): Promise<TeamCityJob> {
    return this.#requestJson(
      "POST",
      "/app/rest/buildTypes",
      { fields: jobFields },
      {
        id: requiredText(id, "Job ID"),
        name: requiredText(options.name, "Job name"),
        project: { id: requiredText(options.project, "Project ID") },
        ...(options.description === undefined ? {} : { description: options.description }),
      },
    );
  }

  public setProjectField(id: string, field: string, value: string) {
    return this.#setField(projectPath(id), id, field, value, "archived");
  }

  public setJobField(id: string, field: string, value: string) {
    return this.#setField(jobPath(id), id, field, value, "paused");
  }

  async #setField(path: string, id: string, field: string, value: string, booleanField: string) {
    if (!["name", "description", booleanField].includes(field)) {
      throw new Error(`Allowed fields: name, description, ${booleanField}.`);
    }
    if (field === booleanField && value !== "true" && value !== "false") {
      throw new Error(`${booleanField} must be true or false.`);
    }
    if (field === "name") value = requiredText(value, "Name");
    await this.#request("PUT", `${path}/${field}`, {}, value, "text/plain");
    return { id: id.trim(), field, value };
  }

  public async moveProject(id: string, parent: string) {
    const parentProjectId = requiredText(parent, "Parent project ID");
    await this.#request("PUT", `${projectPath(id)}/parentProject`, {}, { id: parentProjectId });
    return { id: id.trim(), parentProjectId, moved: true };
  }

  public async moveJob(id: string, project: string) {
    const projectId = requiredText(project, "Project ID");
    await this.#request("POST", `${jobPath(id)}/move`, { targetProjectId: projectId });
    return { id: id.trim(), projectId, moved: true };
  }

  public async deleteProject(id: string) {
    if (id.trim() === "_Root") throw new Error("Cannot delete the root project.");
    await this.#request("DELETE", projectPath(id));
    return { id: id.trim(), deleted: true };
  }

  public async deleteJob(id: string) {
    await this.#request("DELETE", jobPath(id));
    return { id: id.trim(), deleted: true };
  }

  public async listParameters(owner: ParameterOwner, id: string) {
    const result = await this.#requestJson<{ property?: RawProperty[] }>(
      "GET",
      parametersPath(owner, id),
      { fields: `property(${propertyFields})` },
    );
    return (result.property ?? []).map((p) => safeProperty(p));
  }

  public async getParameter(owner: ParameterOwner, id: string, name: string) {
    return safeProperty(
      await this.#requestJson<RawProperty>(
        "GET",
        `${parametersPath(owner, id)}/${pathSegment(name)}`,
        { fields: propertyFields },
      ),
    );
  }

  public createParameter(owner: ParameterOwner, id: string, name: string, value: string) {
    return this.#writeParameter("POST", owner, id, name, value);
  }

  public setParameter(owner: ParameterOwner, id: string, name: string, value: string) {
    return this.#writeParameter("PUT", owner, id, name, value);
  }

  async #writeParameter(
    method: "POST" | "PUT",
    owner: ParameterOwner,
    id: string,
    name: string,
    value: string,
  ) {
    const body = plainProperty(name, value);
    const collection = parametersPath(owner, id);
    const path = `${collection}/${pathSegment(body.name)}`;
    try {
      const existing = await this.#requestJson<RawProperty>("GET", path, {
        fields: "name,inherited,type(rawValue)",
      });
      if (existing.name !== body.name || !isPlainParameter(existing)) {
        throw new Error("Protected or unknown parameter types cannot be changed.");
      }
    } catch (error) {
      if (!(method === "POST" && error instanceof TeamCityHttpError && error.status === 404))
        throw error;
    }
    return safeProperty(
      await this.#requestJson<RawProperty>(
        method,
        method === "POST" ? collection : path,
        { fields: propertyFields },
        body,
      ),
    );
  }

  public async deleteParameter(owner: ParameterOwner, id: string, name: string) {
    await this.#request("DELETE", `${parametersPath(owner, id)}/${pathSegment(name)}`);
    return { owner, id: id.trim(), name: name.trim(), deleted: true };
  }

  public async listSteps(jobId: string) {
    const result = await this.#requestJson<{ step?: RawStep[] }>("GET", `${jobPath(jobId)}/steps`, {
      fields: `step(${stepFields})`,
    });
    return (result.step ?? []).map(safeStep);
  }

  public async getStep(jobId: string, id: string) {
    return safeStep(
      await this.#requestJson<RawStep>("GET", `${jobPath(jobId)}/steps/${pathSegment(id)}`, {
        fields: stepFields,
      }),
    );
  }

  public async createStep(jobId: string, input: StepInput) {
    return safeStep(
      await this.#requestJson<RawStep>(
        "POST",
        `${jobPath(jobId)}/steps`,
        { fields: stepFields },
        stepBody(input),
      ),
    );
  }

  public async replaceStep(jobId: string, id: string, input: StepInput) {
    return safeStep(
      await this.#requestJson<RawStep>(
        "PUT",
        `${jobPath(jobId)}/steps/${pathSegment(id)}`,
        { fields: stepFields },
        stepBody(input),
      ),
    );
  }

  public async deleteStep(jobId: string, id: string) {
    await this.#request("DELETE", `${jobPath(jobId)}/steps/${pathSegment(id)}`);
    return { jobId: jobId.trim(), id: id.trim(), deleted: true };
  }

  public async listExtensions(kind: ExtensionKind, jobId: string) {
    const key = kind === "triggers" ? "trigger" : "feature";
    const result = await this.#requestJson<{ trigger?: RawExtension[]; feature?: RawExtension[] }>(
      "GET",
      `${jobPath(jobId)}/${kind}`,
      { fields: `${key}(${extensionFields})` },
    );
    return (result[key] ?? []).map(safeExtension);
  }

  public async getExtension(kind: ExtensionKind, jobId: string, id: string) {
    return safeExtension(
      await this.#requestJson<RawExtension>("GET", extensionPath(kind, jobId, id), {
        fields: extensionFields,
      }),
    );
  }

  public async createExtension(kind: ExtensionKind, jobId: string, input: ExtensionInput) {
    return safeExtension(
      await this.#requestJson<RawExtension>(
        "POST",
        `${jobPath(jobId)}/${kind}`,
        { fields: extensionFields },
        extensionBody(input),
      ),
    );
  }

  public async replaceExtension(
    kind: ExtensionKind,
    jobId: string,
    id: string,
    input: ExtensionInput,
  ) {
    return safeExtension(
      await this.#requestJson<RawExtension>(
        "PUT",
        extensionPath(kind, jobId, id),
        { fields: extensionFields },
        extensionBody(input),
      ),
    );
  }

  public async deleteExtension(kind: ExtensionKind, jobId: string, id: string) {
    await this.#request("DELETE", extensionPath(kind, jobId, id));
    return { jobId: jobId.trim(), id: id.trim(), deleted: true };
  }

  public async listSnapshotDependencies(jobId: string) {
    const result = await this.#requestJson<{ "snapshot-dependency"?: RawSnapshotDependency[] }>(
      "GET",
      `${jobPath(jobId)}/snapshot-dependencies`,
      { fields: `snapshot-dependency(${snapshotFields})` },
    );
    return (result["snapshot-dependency"] ?? []).map(safeSnapshot);
  }

  public async getSnapshotDependency(jobId: string, id: string) {
    return safeSnapshot(
      await this.#requestJson<RawSnapshotDependency>("GET", snapshotPath(jobId, id), {
        fields: snapshotFields,
      }),
    );
  }

  public async createSnapshotDependency(jobId: string, input: SnapshotDependencyInput) {
    return safeSnapshot(
      await this.#requestJson<RawSnapshotDependency>(
        "POST",
        `${jobPath(jobId)}/snapshot-dependencies`,
        { fields: snapshotFields },
        snapshotBody(jobId, input),
      ),
    );
  }

  public async replaceSnapshotDependency(
    jobId: string,
    id: string,
    input: SnapshotDependencyInput,
  ) {
    return safeSnapshot(
      await this.#requestJson<RawSnapshotDependency>(
        "PUT",
        snapshotPath(jobId, id),
        { fields: snapshotFields },
        snapshotBody(jobId, input),
      ),
    );
  }

  public async deleteSnapshotDependency(jobId: string, id: string) {
    await this.#request("DELETE", snapshotPath(jobId, id));
    return { jobId: jobId.trim(), id: id.trim(), deleted: true };
  }

  public async listTemplates(jobId: string) {
    const result = await this.#requestJson<{ buildType?: BuildTypeIdentity[] }>(
      "GET",
      `${jobPath(jobId)}/templates`,
      { fields: `buildType(${identityFields})` },
    );
    return (result.buildType ?? []).map(safeIdentity);
  }

  public async attachTemplate(jobId: string, templateId: string, optimizeSettings = false) {
    return safeIdentity(
      await this.#requestJson<BuildTypeIdentity>(
        "POST",
        `${jobPath(jobId)}/templates`,
        { fields: identityFields, optimizeSettings: String(optimizeSettings) },
        { id: requiredText(templateId, "Template ID") },
      ),
    );
  }

  public async detachTemplate(jobId: string, templateId: string, inlineSettings = false) {
    await this.#request(
      "DELETE",
      `${jobPath(jobId)}/templates/${idPath(templateId, "Template ID")}`,
      {
        inlineSettings: String(inlineSettings),
      },
    );
    return { jobId: jobId.trim(), templateId: templateId.trim(), detached: true, inlineSettings };
  }

  public async listRules(kind: RuleKind, jobId: string) {
    const key = kind === "agent-requirements" ? "agent-requirement" : "artifact-dependency";
    const result = await this.#requestJson<Record<string, RawSnapshotDependency[]>>(
      "GET",
      `${jobPath(jobId)}/${kind}`,
      { fields: `${key}(${ruleFields(kind)})` },
    );
    return (result[key] ?? []).map(safeSnapshot);
  }

  public async getRule(kind: RuleKind, jobId: string, id: string) {
    return safeSnapshot(
      await this.#requestJson<RawSnapshotDependency>("GET", entityPath(kind, jobId, id), {
        fields: ruleFields(kind),
      }),
    );
  }

  public async createRule(jobId: string, input: RuleInput) {
    return safeSnapshot(
      await this.#requestJson<RawSnapshotDependency>(
        "POST",
        `${jobPath(jobId)}/${input.kind}`,
        { fields: ruleFields(input.kind) },
        ruleBody(jobId, input),
      ),
    );
  }

  public async replaceRule(jobId: string, id: string, input: RuleInput) {
    return safeSnapshot(
      await this.#requestJson<RawSnapshotDependency>(
        "PUT",
        entityPath(input.kind, jobId, id),
        { fields: ruleFields(input.kind) },
        ruleBody(jobId, input),
      ),
    );
  }

  public async deleteRule(kind: RuleKind, jobId: string, id: string) {
    await this.#request("DELETE", entityPath(kind, jobId, id));
    return { ownerId: jobId.trim(), id: id.trim(), deleted: true };
  }

  public async getEntitySetting(
    kind: EntitySettingsKind,
    jobId: string,
    id: string,
    field: string,
  ) {
    allowedField(field, kind === "steps" ? ["name", "disabled"] : ["disabled"]);
    const value = await this.#request(
      "GET",
      `${entityPath(kind, jobId, id)}/${field}`,
      {},
      undefined,
      "text/plain",
    );
    return { jobId: jobId.trim(), id: id.trim(), field, value };
  }

  public async setEntitySetting(
    kind: EntitySettingsKind,
    jobId: string,
    id: string,
    field: string,
    value: string,
  ) {
    allowedField(field, kind === "steps" ? ["name", "disabled"] : ["disabled"]);
    if (field === "disabled") booleanText(value);
    else requiredText(value, "Step name");
    const result = await this.#request(
      "PUT",
      `${entityPath(kind, jobId, id)}/${field}`,
      {},
      value,
      "text/plain",
    );
    return { jobId: jobId.trim(), id: id.trim(), field, value: result };
  }

  public async listPluginParameters(kind: "steps" | "features", jobId: string, id: string) {
    const result = await this.#requestJson<{ property?: RawProperty[] }>(
      "GET",
      `${entityPath(kind, jobId, id)}/parameters`,
      { fields: `property(${propertyFields})` },
    );
    return (result.property ?? []).map((p) => safeProperty(p, false));
  }

  public async replacePluginParameters(
    kind: "steps" | "features",
    jobId: string,
    id: string,
    properties: readonly PlainProperty[],
  ) {
    const result = await this.#requestJson<{ property?: RawProperty[] }>(
      "PUT",
      `${entityPath(kind, jobId, id)}/parameters`,
      { fields: `property(${propertyFields})` },
      propertiesBody(properties),
    );
    return (result.property ?? []).map((p) => safeProperty(p, false));
  }

  public async getPluginParameter(
    kind: "steps" | "features",
    jobId: string,
    id: string,
    name: string,
  ) {
    await this.#request(
      "GET",
      `${entityPath(kind, jobId, id)}/parameters/${pathSegment(name)}`,
      {},
      undefined,
      "text/plain",
    );
    return safeProperty({ name: name.trim() }, false);
  }

  public async setPluginParameter(
    kind: "steps" | "features",
    jobId: string,
    id: string,
    name: string,
    value: string,
  ) {
    const property = plainProperty(name, value);
    await this.#request(
      "PUT",
      `${entityPath(kind, jobId, id)}/parameters/${pathSegment(property.name)}`,
      {},
      value,
      "text/plain",
    );
    return safeProperty({ name: property.name }, false);
  }

  public async listProjectFeatures(projectId: string) {
    const result = await this.#requestJson<{ projectFeature?: RawExtension[] }>(
      "GET",
      `${projectPath(projectId)}/projectFeatures`,
      { fields: `projectFeature(${extensionFields})` },
    );
    return (result.projectFeature ?? []).map(safeExtension);
  }

  public async getProjectFeature(projectId: string, id: string) {
    return safeExtension(
      await this.#requestJson<RawExtension>(
        "GET",
        `${projectPath(projectId)}/projectFeatures/${idPath(id, "Feature ID")}`,
        { fields: extensionFields },
      ),
    );
  }

  public async createProjectFeature(
    projectId: string,
    type: string,
    properties: readonly PlainProperty[],
  ) {
    return safeExtension(
      await this.#requestJson<RawExtension>(
        "POST",
        `${projectPath(projectId)}/projectFeatures`,
        { fields: extensionFields },
        { type: requiredText(type, "Feature type"), properties: propertiesBody(properties) },
      ),
    );
  }

  public async replaceProjectFeature(
    projectId: string,
    id: string,
    type: string,
    properties: readonly PlainProperty[],
  ) {
    return safeExtension(
      await this.#requestJson<RawExtension>(
        "PUT",
        `${projectPath(projectId)}/projectFeatures/${idPath(id, "Feature ID")}`,
        { fields: extensionFields },
        { type: requiredText(type, "Feature type"), properties: propertiesBody(properties) },
      ),
    );
  }

  public async deleteProjectFeature(projectId: string, id: string) {
    await this.#request(
      "DELETE",
      `${projectPath(projectId)}/projectFeatures/${idPath(id, "Feature ID")}`,
    );
    return { ownerId: projectId.trim(), id: id.trim(), deleted: true };
  }

  public async listProjectTemplates(projectId: string) {
    const result = await this.#requestJson<{ buildType?: BuildTypeIdentity[] }>(
      "GET",
      `${projectPath(projectId)}/templates`,
      { fields: `buildType(${identityFields})` },
    );
    return (result.buildType ?? []).map(safeIdentity);
  }

  public async createProjectTemplate(projectId: string, id: string, name: string) {
    return safeIdentity(
      await this.#requestJson<BuildTypeIdentity>(
        "POST",
        `${projectPath(projectId)}/templates`,
        { fields: identityFields },
        { id: requiredText(id, "Template ID"), name: requiredText(name, "Template name") },
      ),
    );
  }

  public async getDefaultTemplate(projectId: string) {
    return safeIdentity(
      await this.#requestJson<BuildTypeIdentity>(
        "GET",
        `${projectPath(projectId)}/defaultTemplate`,
        { fields: identityFields },
      ),
    );
  }

  public async setDefaultTemplate(projectId: string, id: string) {
    return safeIdentity(
      await this.#requestJson<BuildTypeIdentity>(
        "PUT",
        `${projectPath(projectId)}/defaultTemplate`,
        { fields: identityFields },
        { id: requiredText(id, "Template ID") },
      ),
    );
  }

  public async clearDefaultTemplate(projectId: string) {
    await this.#request("DELETE", `${projectPath(projectId)}/defaultTemplate`);
    return { projectId: projectId.trim(), cleared: true };
  }

  public async getAttachedTemplate(jobId: string, id: string) {
    return safeIdentity(
      await this.#requestJson<BuildTypeIdentity>(
        "GET",
        `${jobPath(jobId)}/templates/${idPath(id, "Template ID")}`,
        { fields: identityFields },
      ),
    );
  }

  public async getProjectParent(projectId: string) {
    const result = await this.#requestJson<BuildTypeIdentity>(
      "GET",
      `${projectPath(projectId)}/parentProject`,
      { fields: "id,name" },
    );
    return { id: result.id, ...(result.name === undefined ? {} : { name: result.name }) };
  }

  public async getOwnerField(owner: "projects" | "jobs", id: string, field: string) {
    allowedField(field, [
      "id",
      "name",
      "description",
      owner === "projects" ? "archived" : "paused",
    ]);
    const value = await this.#request(
      "GET",
      `${owner === "projects" ? projectPath(id) : jobPath(id)}/${field}`,
      {},
      undefined,
      "text/plain",
    );
    return { id: id.trim(), field, value };
  }

  public async listJobAliases(jobId: string) {
    const result = await this.#requestJson<{ item?: string[] }>("GET", `${jobPath(jobId)}/aliases`);
    return result.item ?? [];
  }

  public async listJobBranches(jobId: string, options: TeamCityPageOptions = {}) {
    const result = await this.#requestJson<{
      branch?: { name: string; default?: boolean; active?: boolean }[];
    }>("GET", `${jobPath(jobId)}/branches`, {
      locator: joinLocator(...pageDimensions(options)),
      fields: "branch(name,default,active)",
    });
    return (result.branch ?? []).map(({ name, default: isDefault, active }) => ({
      name,
      ...(isDefault === undefined ? {} : { default: isDefault }),
      ...(active === undefined ? {} : { active }),
    }));
  }

  public async listJobTags(jobId: string) {
    const result = await this.#requestJson<{ tag?: { name: string }[] }>(
      "GET",
      `${jobPath(jobId)}/buildTags`,
      { field: "tag(name)" },
    );
    return (result.tag ?? []).map((tag) => tag.name);
  }

  public async listVcsRoots(options: TeamCityPageOptions & { project?: string } = {}) {
    const result = await this.#requestJson<{ "vcs-root"?: VcsRoot[] }>(
      "GET",
      "/app/rest/vcs-roots",
      {
        locator: joinLocator(
          options.project === undefined
            ? undefined
            : nestedId("project", options.project, "Project ID"),
          ...pageDimensions(options),
        ),
        fields: `vcs-root(${rootFields})`,
      },
    );
    return (result["vcs-root"] ?? []).map(safeRoot);
  }

  public async getVcsRoot(id: string) {
    return safeRoot(
      await this.#requestJson<VcsRoot>("GET", `/app/rest/vcs-roots/${idPath(id, "VCS root ID")}`, {
        fields: rootFields,
      }),
    );
  }

  public async listVcsEntries(jobId: string) {
    const result = await this.#requestJson<{ "vcs-root-entry"?: RawVcsEntry[] }>(
      "GET",
      `${jobPath(jobId)}/vcs-root-entries`,
      { fields: `vcs-root-entry(${entryFields})` },
    );
    return (result["vcs-root-entry"] ?? []).map(safeEntry);
  }

  public async getVcsEntry(jobId: string, rootId: string) {
    return safeEntry(
      await this.#requestJson<RawVcsEntry>("GET", entryPath(jobId, rootId), {
        fields: entryFields,
      }),
    );
  }

  public async attachVcsRoot(jobId: string, rootId: string, rules = "") {
    return safeEntry(
      await this.#requestJson<RawVcsEntry>(
        "POST",
        `${jobPath(jobId)}/vcs-root-entries`,
        { fields: entryFields },
        { "vcs-root": { id: requiredText(rootId, "VCS root ID") }, "checkout-rules": rules },
      ),
    );
  }

  public async replaceVcsEntry(jobId: string, rootId: string, rules: string) {
    return safeEntry(
      await this.#requestJson<RawVcsEntry>(
        "PUT",
        entryPath(jobId, rootId),
        { fields: entryFields },
        { "vcs-root": { id: rootId.trim() }, "checkout-rules": rules },
      ),
    );
  }

  public async detachVcsRoot(jobId: string, rootId: string) {
    await this.#request("DELETE", entryPath(jobId, rootId));
    return { jobId: jobId.trim(), rootId: rootId.trim(), detached: true };
  }

  public async getCheckoutRules(jobId: string, rootId: string) {
    const rules = await this.#request(
      "GET",
      `${entryPath(jobId, rootId)}/checkout-rules`,
      {},
      undefined,
      "text/plain",
    );
    return { jobId: jobId.trim(), rootId: rootId.trim(), rules };
  }

  public async setCheckoutRules(jobId: string, rootId: string, rules: string) {
    await this.#request(
      "PUT",
      `${entryPath(jobId, rootId)}/checkout-rules`,
      {},
      rules,
      "text/plain",
    );
    return { jobId: jobId.trim(), rootId: rootId.trim(), rules };
  }

  public async listPools(options: TeamCityPageOptions = {}) {
    const result = await this.#requestJson<{ agentPool?: AgentPoolSummary[] }>(
      "GET",
      "/app/rest/agentPools",
      { locator: joinLocator(...pageDimensions(options)), fields: "agentPool(id,name)" },
    );
    return (result.agentPool ?? []).map(safeNamed);
  }

  public async createPool(name: string) {
    return safeNamed(
      await this.#requestJson<AgentPoolSummary>(
        "POST",
        "/app/rest/agentPools",
        {},
        { name: requiredText(name, "Pool name") },
      ),
    );
  }

  public async getPool(id: number) {
    return safeNamed(
      await this.#requestJson<AgentPoolSummary>("GET", poolPath(id), { fields: "id,name" }),
    );
  }

  public async deletePool(id: number) {
    if (id === 0) throw new Error("The default pool cannot be deleted.");
    await this.#request("DELETE", poolPath(id));
    return { poolId: id, deleted: true };
  }

  public async getPoolField(id: number, field: string) {
    allowedField(field, ["name"]);
    const value = await this.#request(
      "GET",
      `${poolPath(id)}/${field}`,
      {},
      undefined,
      "text/plain",
    );
    return { poolId: id, field, value };
  }

  public async setPoolField(id: number, field: string, value: string) {
    allowedField(field, ["name"]);
    requiredText(value, "Pool name");
    const result = await this.#request("PUT", `${poolPath(id)}/${field}`, {}, value, "text/plain");
    return { poolId: id, field, value: result };
  }

  public async listPoolAgents(id: number, options: TeamCityPageOptions = {}) {
    const result = await this.#requestJson<{ agent?: AgentPoolSummary[] }>(
      "GET",
      `${poolPath(id)}/agents`,
      { locator: joinLocator(...pageDimensions(options)), fields: "agent(id,name)" },
    );
    return (result.agent ?? []).map(safeNamed);
  }

  public async assignPoolAgent(poolId: number, id: number) {
    positiveId(id, "Agent ID");
    return safeNamed(
      await this.#requestJson<AgentPoolSummary>(
        "POST",
        `${poolPath(poolId)}/agents`,
        { fields: "id,name" },
        { id },
      ),
    );
  }

  public async listPoolProjects(poolId: number) {
    const result = await this.#requestJson<{ project?: BuildTypeIdentity[] }>(
      "GET",
      `${poolPath(poolId)}/projects`,
      { fields: "project(id,name)" },
    );
    return (result.project ?? []).map(safeIdentity);
  }

  public async assignPoolProject(poolId: number, id: string) {
    return safeIdentity(
      await this.#requestJson<BuildTypeIdentity>(
        "POST",
        `${poolPath(poolId)}/projects`,
        {},
        { id: requiredText(id, "Project ID") },
      ),
    );
  }

  public async unassignPoolProject(poolId: number, projectId: string) {
    await this.#request(
      "DELETE",
      `${poolPath(poolId)}/projects/${idPath(projectId, "Project ID")}`,
    );
    return { poolId, projectId: projectId.trim(), unassigned: true };
  }

  public async deleteAgent(id: number) {
    await this.#request("DELETE", agentPath(id));
    return { agentId: id, deleted: true };
  }

  public async getAgentStatus(id: number, kind: "enabled" | "authorized") {
    return safeBooleanStatus(
      await this.#requestJson<BooleanStatus>("GET", `${agentPath(id)}/${kind}Info`, {
        fields: booleanStatusFields,
      }),
    );
  }

  public async setAgentStatus(
    id: number,
    kind: "enabled" | "authorized",
    status: boolean,
    comment?: string,
  ) {
    return safeBooleanStatus(
      await this.#requestJson<BooleanStatus>(
        "PUT",
        `${agentPath(id)}/${kind}Info`,
        { fields: booleanStatusFields },
        this.#statusBody(status, comment),
      ),
    );
  }

  public async getAgentPolicy(id: number) {
    return safePolicy(
      await this.#requestJson<RawAgentPolicy>("GET", `${agentPath(id)}/compatibilityPolicy`, {
        fields: policyFields,
      }),
    );
  }

  public async setAgentPolicy(id: number, policy: string, jobs: readonly string[]) {
    if (policy !== "any" && policy !== "selected")
      throw new Error("Policy must be any or selected.");
    if (policy === "any" && jobs.length)
      throw new Error("Policy any cannot include selected jobs.");
    const ids = jobs.map((job) => requiredText(job, "Job ID"));
    if (new Set(ids).size !== ids.length) throw new Error("Duplicate jobs are not allowed.");
    return safePolicy(
      await this.#requestJson<RawAgentPolicy>(
        "PUT",
        `${agentPath(id)}/compatibilityPolicy`,
        { fields: policyFields },
        { policy, buildTypes: { buildType: ids.map((id) => ({ id })) } },
      ),
    );
  }

  public async listAgentCompatibleJobs(id: number) {
    const result = await this.#requestJson<{ buildType?: BuildTypeIdentity[] }>(
      "GET",
      `${agentPath(id)}/compatibleBuildTypes`,
      { fields: `buildType(${identityFields})` },
    );
    return (result.buildType ?? []).map(safeIdentity);
  }

  public async listAgentIncompatibleJobs(id: number) {
    const result = await this.#requestJson<{
      compatibility?: { compatible: boolean; buildType: BuildTypeIdentity }[];
    }>("GET", `${agentPath(id)}/incompatibleBuildTypes`, {
      fields: `compatibility(compatible,buildType(${identityFields}))`,
    });
    return (result.compatibility ?? []).map((entry) => ({
      compatible: entry.compatible,
      buildType: safeIdentity(entry.buildType),
    }));
  }

  public async getAgentPool(id: number) {
    const result = await this.#optionalJson<AgentPoolSummary>(`${agentPath(id)}/pool`, "id,name");
    return result === null ? null : safeNamed(result);
  }

  public async setAgentPool(id: number, poolId: number) {
    return safeNamed(
      await this.#requestJson<AgentPoolSummary>(
        "PUT",
        `${agentPath(id)}/pool`,
        { fields: "id,name" },
        { id: poolNumber(poolId) },
      ),
    );
  }

  public async getAgentField(id: number, field: string) {
    allowedField(field, ["id", "name", "connected", "enabled", "authorized"]);
    const value = await this.#request(
      "GET",
      `${agentPath(id)}/${field}`,
      {},
      undefined,
      "text/plain",
    );
    return { agentId: id, field, value };
  }

  public async setAgentField(id: number, field: string, value: string) {
    allowedField(field, ["enabled", "authorized"]);
    booleanText(value);
    const result = await this.#request("PUT", `${agentPath(id)}/${field}`, {}, value, "text/plain");
    return { agentId: id, field, value: result };
  }

  public async getQueuedBuild(id: number) {
    return safeOperationBuild(
      await this.#requestJson<OperationBuild>("GET", buildPath(id, "queue"), {
        fields: operationBuildFields,
      }),
    );
  }

  public async listQueueCompatibleAgents(id: number) {
    const result = await this.#requestJson<{ agent?: AgentPoolSummary[] }>(
      "GET",
      `${buildPath(id, "queue")}/compatibleAgents`,
      { fields: "agent(id,name)" },
    );
    return (result.agent ?? []).map(safeNamed);
  }

  public async getQueuePosition(position: string) {
    return safeOperationBuild(
      await this.#requestJson<OperationBuild>(
        "GET",
        `/app/rest/buildQueue/order/${queuePosition(position)}`,
        { fields: operationBuildFields },
      ),
    );
  }

  public async setQueuePosition(position: string, id: number) {
    positiveId(id, "Build ID");
    return safeOperationBuild(
      await this.#requestJson<OperationBuild>(
        "PUT",
        `/app/rest/buildQueue/order/${queuePosition(position, true)}`,
        { fields: operationBuildFields },
        { id },
      ),
    );
  }

  public async deleteBuild(id: number) {
    await this.#request("DELETE", buildPath(id));
    return { buildId: id, deleted: true };
  }

  public async setBuildComment(id: number, text: string) {
    plainProperty("comment", text);
    await this.#request("PUT", `${buildPath(id)}/comment`, {}, text, "text/plain");
    return { buildId: id, commentUpdated: true };
  }

  public async clearBuildComment(id: number) {
    await this.#request("DELETE", `${buildPath(id)}/comment`);
    return { buildId: id, commentCleared: true };
  }

  public async getBuildScalar(id: number, field: string) {
    allowedField(field, [
      "number",
      "statusText",
      "status",
      "finishDate",
      "id",
      "buildTypeId",
      "state",
      "branchName",
    ]);
    const value = await this.#request(
      "GET",
      `${buildPath(id)}/${field}`,
      {},
      undefined,
      "text/plain",
    );
    return { buildId: id, field, value };
  }

  public async setBuildScalar(id: number, field: string, value: string) {
    allowedField(field, ["number", "statusText"]);
    plainProperty(field, requiredText(value, "Value"));
    const result = await this.#request("PUT", `${buildPath(id)}/${field}`, {}, value, "text/plain");
    return { buildId: id, field, value: result };
  }

  public async getBuildPin(id: number) {
    return safeBooleanStatus(
      await this.#requestJson<BooleanStatus>("GET", `${buildPath(id)}/pinInfo`, {
        fields: booleanStatusFields,
      }),
    );
  }

  public async setBuildPin(id: number, status: boolean, comment?: string) {
    return safeBooleanStatus(
      await this.#requestJson<BooleanStatus>(
        "PUT",
        `${buildPath(id)}/pinInfo`,
        { fields: booleanStatusFields },
        this.#statusBody(status, comment),
      ),
    );
  }

  public async listTags(owner: "builds" | "queue", id: number) {
    const result = await this.#requestJson<{ tag?: { name: string }[] }>(
      "GET",
      `${buildPath(id, owner)}/tags`,
      { fields: "tag(name)" },
    );
    return (result.tag ?? []).map((tag) => tag.name);
  }

  public async addTags(owner: "builds" | "queue", id: number, tags: readonly string[]) {
    const body = publicTags(tags);
    await this.#request("POST", `${buildPath(id, owner)}/tags`, {}, body);
    return { buildId: id, tags: body.tag.map((tag) => tag.name), added: true };
  }

  public async replaceBuildTags(id: number, tags: readonly string[]) {
    const result = await this.#requestJson<{ tag?: { name: string }[] }>(
      "PUT",
      `${buildPath(id)}/tags`,
      { fields: "tag(name)" },
      publicTags(tags, true),
    );
    return (result.tag ?? []).map((tag) => tag.name);
  }

  public async listBuildStatistics(id: number) {
    const result = await this.#requestJson<{ property?: { name: string; value: string }[] }>(
      "GET",
      `${buildPath(id)}/statistics`,
      { fields: "property(name,value)" },
    );
    return (result.property ?? []).map((p) => statistic(p.name, p.value));
  }

  public async getBuildStatistic(id: number, name: string) {
    const value = await this.#request(
      "GET",
      `${buildPath(id)}/statistics/${pathSegment(name)}`,
      {},
      undefined,
      "text/plain",
    );
    return statistic(name.trim(), value);
  }

  public async getBuildCanceledInfo(id: number) {
    const result = await this.#optionalJson<OperationComment>(
      `${buildPath(id)}/canceledInfo`,
      "text,timestamp",
    );
    return result === null ? null : safeComment(result);
  }

  public async getChange(id: number) {
    return safeChange(
      await this.#requestJson<ChangeSummary>(
        "GET",
        `/app/rest/changes/id:${positiveId(id, "Change ID")}`,
        { fields: changeSummaryFields },
      ),
    );
  }

  public async listChangeParents(id: number) {
    const result = await this.#requestJson<{ change?: ChangeSummary[] }>(
      "GET",
      `/app/rest/changes/id:${positiveId(id, "Change ID")}/parentChanges`,
      { fields: `change(${changeSummaryFields})` },
    );
    return (result.change ?? []).map(safeChange);
  }

  public async replaceAllParameters(
    owner: ParameterOwner,
    id: string,
    properties: readonly PlainProperty[],
  ) {
    const body = propertiesBody(properties);
    const path = parametersPath(owner, id);
    const current = await this.#requestJson<{ property?: RawProperty[] }>("GET", path, {
      fields: "property(name,inherited,type(rawValue))",
    });
    if ((current.property ?? []).some((p) => !isPlainParameter(p)))
      throw new Error("Protected parameter metadata cannot be replaced with plain parameters.");
    const result = await this.#requestJson<{ property?: RawProperty[] }>(
      "PUT",
      path,
      { fields: `property(${propertyFields})` },
      body,
    );
    return (result.property ?? []).map((p) => safeProperty(p));
  }

  public async clearParameters(owner: ParameterOwner, id: string) {
    await this.#request("DELETE", parametersPath(owner, id));
    return { ownerId: id.trim(), cleared: true };
  }

  public getParameterPart(owner: ParameterOwner, id: string, name: string, part: ParameterPart) {
    return this.#parameterPart("GET", owner, id, name, part);
  }

  public setParameterPart(
    owner: ParameterOwner,
    id: string,
    name: string,
    part: ParameterPart,
    value: string,
  ) {
    plainProperty(name, value);
    if (part !== "value") allowedField(value, ["text", "select", "checkbox"]);
    return this.#parameterPart("PUT", owner, id, name, part, value);
  }

  async #parameterPart(
    method: "GET" | "PUT",
    owner: ParameterOwner,
    id: string,
    name: string,
    part: ParameterPart,
    value?: string,
  ) {
    const path = `${parametersPath(owner, id)}/${pathSegment(name)}`;
    const metadata = await this.#requestJson<RawProperty>("GET", path, {
      fields: "name,inherited,type(rawValue)",
    });
    if (!isPlainParameter(metadata)) {
      if (method === "PUT")
        throw new Error("Protected parameter metadata cannot be changed with plain input.");
      return safeProperty(metadata, false);
    }
    if (part === "value") {
      const response = await this.#request(method, `${path}/value`, {}, value, "text/plain");
      return safeProperty({
        name: name.trim(),
        ...(metadata.type === undefined ? {} : { type: metadata.type }),
        value: response,
      });
    }
    const type =
      part === "type"
        ? await this.#requestJson<{ rawValue?: string }>(
            method,
            `${path}/type`,
            {},
            value === undefined ? undefined : { rawValue: value },
          )
        : {
            rawValue: await this.#request(method, `${path}/type/rawValue`, {}, value, "text/plain"),
          };
    const result = safeProperty({ name: name.trim(), type });
    return { name: result.name, type: result.type, redacted: result.redacted };
  }

  public async replaceAllSettings(kind: SettingsCollection, id: string, input: readonly unknown[]) {
    const items = settingsItems(kind, id, input);
    const path = `${kind === "projectFeatures" ? projectPath(id) : jobPath(id)}/${kind}`;
    if (kind === "vcs-root-entries") {
      const result = await this.#requestJson<{ "vcs-root-entry"?: RawVcsEntry[] }>(
        "PUT",
        path,
        { fields: `vcs-root-entry(${entryFields})` },
        { "vcs-root-entry": items },
      );
      return (result["vcs-root-entry"] ?? []).map(safeEntry);
    }
    const collectionKey = {
      steps: "step",
      features: "feature",
      triggers: "trigger",
      projectFeatures: "projectFeature",
      "agent-requirements": "agent-requirement",
      "artifact-dependencies": "artifact-dependency",
      "snapshot-dependencies": "snapshot-dependency",
    }[kind];
    const dependency = kind === "artifact-dependencies" || kind === "snapshot-dependencies";
    const fields = kind === "steps" ? stepFields : dependency ? snapshotFields : extensionFields;
    const result = await this.#requestJson<Record<string, RawStep[]>>(
      "PUT",
      path,
      { fields: `${collectionKey}(${fields})` },
      { [collectionKey]: items },
    );
    return (result[collectionKey] ?? []).map((item) =>
      kind === "steps" ? safeStep(item) : dependency ? safeSnapshot(item) : safeExtension(item),
    );
  }

  public async replaceTemplates(jobId: string, ids: readonly string[], optimizeSettings = false) {
    const body = { buildType: distinctIds(ids).map((id) => ({ id })) };
    const result = await this.#requestJson<{ buildType?: BuildTypeIdentity[] }>(
      "PUT",
      `${jobPath(jobId)}/templates`,
      { fields: `buildType(${identityFields})`, optimizeSettings: String(optimizeSettings) },
      body,
    );
    return (result.buildType ?? []).map(safeIdentity);
  }

  public async clearTemplates(jobId: string, inlineSettings = false) {
    await this.#request("DELETE", `${jobPath(jobId)}/templates`, {
      inlineSettings: String(inlineSettings),
    });
    return { jobId: jobId.trim(), cleared: true };
  }

  public async listJobBuilds(jobId: string) {
    const result = await this.#requestJson<{ build?: OperationBuild[] }>(
      "GET",
      `${jobPath(jobId)}/builds`,
      { fields: `build(${operationBuildFields})` },
    );
    return (result.build ?? []).map(safeOperationBuild);
  }

  public async listProjectPools(projectId: string) {
    const result = await this.#requestJson<{ agentPool?: AgentPoolSummary[] }>(
      "GET",
      `${projectPath(projectId)}/agentPools`,
      { fields: "agentPool(id,name)" },
    );
    return (result.agentPool ?? []).map(safeNamed);
  }

  public async assignProjectPool(projectId: string, id: number) {
    return safeNamed(
      await this.#requestJson<AgentPoolSummary>(
        "POST",
        `${projectPath(projectId)}/agentPools`,
        { fields: "id,name" },
        { id: poolNumber(id) },
      ),
    );
  }

  public async replaceProjectPools(projectId: string, ids: readonly number[]) {
    const body = {
      agentPool: distinctIds(ids.map((id) => String(poolNumber(id)))).map((id) => ({
        id: Number(id),
      })),
    };
    const result = await this.#requestJson<{ agentPool?: AgentPoolSummary[] }>(
      "PUT",
      `${projectPath(projectId)}/agentPools`,
      { fields: "agentPool(id,name)" },
      body,
    );
    return (result.agentPool ?? []).map(safeNamed);
  }

  public async unassignProjectPool(projectId: string, poolId: number) {
    await this.#request("DELETE", `${projectPath(projectId)}/agentPools/id:${poolNumber(poolId)}`);
    return { projectId: projectId.trim(), poolId, unassigned: true };
  }

  public async listProjectBranches(projectId: string, options: TeamCityPageOptions = {}) {
    const result = await this.#requestJson<{ branch?: { name: string; default?: boolean }[] }>(
      "GET",
      `${projectPath(projectId)}/branches`,
      { locator: joinLocator(...pageDimensions(options)), fields: "branch(name,default)" },
    );
    return (result.branch ?? []).map((b) => ({
      name: b.name,
      ...(b.default === undefined ? {} : { default: b.default }),
    }));
  }

  public async createProjectJob(projectId: string, id: string, name: string) {
    return safeIdentity(
      await this.#requestJson<BuildTypeIdentity>(
        "POST",
        `${projectPath(projectId)}/buildTypes`,
        { fields: identityFields },
        { id: requiredText(id, "Job ID"), name: requiredText(name, "Job name") },
      ),
    );
  }

  public getProjectOrder(projectId: string, kind: "jobs" | "projects") {
    return this.#projectOrder("GET", projectId, kind);
  }

  public setProjectOrder(projectId: string, kind: "jobs" | "projects", ids: readonly string[]) {
    return this.#projectOrder("PUT", projectId, kind, distinctIds(ids));
  }

  async #projectOrder(
    method: "GET" | "PUT",
    projectId: string,
    kind: "jobs" | "projects",
    ids?: readonly string[],
  ) {
    const key = kind === "jobs" ? "buildType" : "project";
    const result = await this.#requestJson<Record<string, BuildTypeIdentity[]>>(
      method,
      `${projectPath(projectId)}/order/${kind === "jobs" ? "buildTypes" : "projects"}`,
      { field: `${key}(id,name${kind === "jobs" ? ",projectId" : ""})` },
      ids === undefined ? undefined : { [key]: ids.map((id) => ({ id })) },
    );
    return (result[key] ?? []).map(safeIdentity);
  }

  public async replacePoolProjects(poolId: number, ids: readonly string[]) {
    const body = { project: distinctIds(ids).map((id) => ({ id })) };
    const result = await this.#requestJson<{ project?: BuildTypeIdentity[] }>(
      "PUT",
      `${poolPath(poolId)}/projects`,
      { fields: "project(id,name)" },
      body,
    );
    return (result.project ?? []).map(safeIdentity);
  }

  public async clearPoolProjects(poolId: number) {
    await this.#request("DELETE", `${poolPath(poolId)}/projects`);
    return { poolId, cleared: true };
  }

  public async deleteQueuePage(jobId: string, options: TeamCityPageOptions = {}) {
    await this.#request("DELETE", "/app/rest/buildQueue", {
      locator: joinLocator(nestedId("buildType", jobId, "Job ID"), ...pageDimensions(options)),
    });
    return { jobId: jobId.trim(), pageDeleted: true };
  }

  public async reorderQueue(ids: readonly number[]) {
    if (!ids.length) throw new Error("At least one build ID is required.");
    const body = {
      build: distinctIds(ids.map((id) => positiveId(id, "Build ID"))).map((id) => ({
        id: Number(id),
      })),
    };
    const result = await this.#requestJson<{ build?: OperationBuild[] }>(
      "PUT",
      "/app/rest/buildQueue/order",
      { fields: `build(${operationBuildFields})` },
      body,
    );
    return (result.build ?? []).map(safeOperationBuild);
  }

  public async setQueuePaused(paused: boolean, reason: string) {
    if (typeof paused !== "boolean") throw new Error("Paused must be a boolean.");
    await this.#request(
      "PUT",
      "/app/rest/buildQueue/pausedState",
      {},
      { paused, reason: plainProperty("reason", requiredText(reason, "Reason")).value },
    );
    return { paused, updated: true };
  }

  public async getQueueApproval(id: number) {
    return safeApproval(
      await this.#requestJson<ApprovalSummary>("GET", `${buildPath(id, "queue")}/approvalInfo`, {
        fields: approvalFields,
      }),
    );
  }

  public async approveQueuedBuild(id: number) {
    return safeApproval(
      await this.#requestJson<ApprovalSummary>("POST", `${buildPath(id, "queue")}/approve`, {
        fields: approvalFields,
        approveAll: "false",
      }),
    );
  }

  public async deleteQueuedBuild(id: number) {
    await this.#request("DELETE", buildPath(id, "queue"));
    return { buildId: id, deleted: true };
  }

  public async getAgentType(id: number) {
    const value = await this.#requestJson<AgentPoolSummary & { isCloud?: boolean }>(
      "GET",
      `/app/rest/agentTypes/id:${positiveId(id, "Agent type ID")}`,
      { fields: "id,name,isCloud" },
    );
    return {
      ...safeNamed(value),
      ...(value.isCloud === undefined ? {} : { isCloud: value.isCloud }),
    };
  }

  public async getBuildBatchStatus(ids: readonly number[]) {
    const status = await this.#request(
      "GET",
      `/app/rest/builds/aggregated/${triage.buildUnion(ids)}/status`,
      {},
      undefined,
      "text/plain",
    );
    return { status };
  }

  public async getBuildBatch(ids: readonly number[]) {
    const value = await this.#requestJson<{ build?: unknown[] }>(
      "GET",
      `/app/rest/builds/multiple/${triage.buildUnion(ids)}`,
      { fields: `count,nextHref,build(${triage.evidenceBuildFields})` },
    );
    return (value.build ?? []).map(triage.safeEvidenceBuild);
  }

  public async cancelBuildBatch(ids: readonly number[], comment: string) {
    return this.#buildBatch("POST", ids, "", {
      comment: triage.inputText(comment, "Comment"),
      readdIntoQueue: false,
    });
  }

  public async deleteBuildBatch(ids: readonly number[]) {
    return this.#buildBatch("DELETE", ids, "");
  }

  public async setBuildBatchComment(ids: readonly number[], comment: string) {
    return this.#buildBatch(
      "PUT",
      ids,
      "/comment",
      triage.inputText(comment, "Comment"),
      "text/plain",
    );
  }

  public async clearBuildBatchComment(ids: readonly number[]) {
    return this.#buildBatch("DELETE", ids, "/comment");
  }

  public async pinBuildBatch(ids: readonly number[], status: boolean) {
    return this.#buildBatch("PUT", ids, "/pinInfo", this.#statusBody(status));
  }

  public async tagBuildBatch(ids: readonly number[], tags: readonly string[], remove = false) {
    if (tags.length > 100) throw new Error("At most 100 tags are supported.");
    return this.#buildBatch(remove ? "DELETE" : "POST", ids, "/tags", publicTags(tags));
  }

  async #buildBatch(
    method: HttpMethod,
    ids: readonly number[],
    suffix: string,
    body?: unknown,
    mediaType = "application/json",
  ) {
    const contents = await this.#request(
      method,
      `/app/rest/builds/multiple/${triage.buildUnion(ids)}${suffix}`,
      { fields: triage.multipleFields },
      body,
      mediaType,
      { accept: "application/json" },
    );
    return triage.safeMultiple(decodeJson(contents));
  }

  public async getArtifactDependencyChanges(id: number) {
    const value = await this.#requestJson<{ buildChange?: unknown[] }>(
      "GET",
      `${buildPath(id)}/artifactDependencyChanges`,
      {
        fields: `count,buildChange(nextBuild(${triage.evidenceBuildFields}),prevBuild(${triage.evidenceBuildFields}))`,
      },
    );
    return (value.buildChange ?? []).map((item) => {
      const change = triage.object(item);
      return {
        ...(change.nextBuild === undefined
          ? {}
          : { nextBuild: triage.safeEvidenceBuild(change.nextBuild) }),
        ...(change.prevBuild === undefined
          ? {}
          : { prevBuild: triage.safeEvidenceBuild(change.prevBuild) }),
      };
    });
  }

  public async resetBuildFinishCache(id: number) {
    await this.#request("DELETE", `${buildPath(id)}/caches/finishProperties`);
    return { buildId: id, cacheReset: true };
  }

  public async finishBuild(id: number, timestamp?: string) {
    const body = timestamp === undefined ? undefined : triage.teamCityTimestamp(timestamp);
    const acceptedFinishTime = await this.#request(
      "PUT",
      `${buildPath(id)}/${timestamp === undefined ? "finish" : "finishDate"}`,
      {},
      body,
      "text/plain",
    );
    return { buildId: id, acceptedFinishTime };
  }

  public async appendBuildLog(id: number, message: string) {
    const body = triage.inputText(message, "Log message");
    if (/##teamcity\[/i.test(body))
      throw new Error("Plain log append does not accept service messages.");
    await this.#request("POST", `${buildPath(id)}/log`, {}, body, "text/plain");
    return { buildId: id, appended: true };
  }

  public async listBuildOccurrences(id: number, kind: "test" | "problem") {
    const key = kind + "Occurrence";
    const fields = kind === "test" ? triage.testOccurrenceFields : triage.problemOccurrenceFields;
    const value = await this.#requestJson<Record<string, unknown>>(
      "GET",
      `${buildPath(id)}/${key}s`,
      { fields: `count,${key}(${fields})` },
    );
    return triage.array(value[key]).map((item) => triage.safeOccurrence(item, kind));
  }

  public async addBuildProblem(id: number, description: string) {
    const body = triage.inputText(description, "Description");
    return triage.safeOccurrence(
      await this.#textJson(
        "POST",
        `${buildPath(id)}/problemOccurrences`,
        { fields: triage.problemOccurrenceFields },
        body,
      ),
      "problem",
    );
  }

  public async getBuildRelatedIssues(id: number) {
    const value = await this.#requestJson<{ issueUsage?: unknown[] }>(
      "GET",
      `${buildPath(id)}/relatedIssues`,
      { fields: "count,issueUsage(issue(id))" },
    );
    return (value.issueUsage ?? []).flatMap((item) => {
      const issue = triage.object(item).issue;
      return issue === undefined ? [] : [triage.safeScalars(issue, ["id"])];
    });
  }

  public async startAgentlessBuild(id: number, requestor: string) {
    return triage.safeEvidenceBuild(
      await this.#textJson(
        "PUT",
        `${buildPath(id)}/runningData`,
        { fields: triage.evidenceBuildFields },
        triage.inputText(requestor, "Requestor"),
      ),
    );
  }

  public async setBuildStatus(id: number, status: string, comment: string) {
    const body = {
      status: allowedField(status, ["SUCCESS", "FAILURE"]),
      comment: triage.inputText(comment, "Comment"),
    };
    const value = await this.#requestJson<{ build?: unknown; errors?: { item?: unknown[] } }>(
      "POST",
      `${buildPath(id)}/status`,
      { fields: `build(${triage.evidenceBuildFields}),errors(item)` },
      body,
    );
    const errorCount = triage.array(value.errors?.item).length;
    if (value.build === undefined && errorCount === 0)
      throw new Error("Missing build status result; success is unknown.");
    return {
      ...(value.build === undefined ? {} : { build: triage.safeEvidenceBuild(value.build) }),
      errorCount,
      partialFailure: errorCount > 0,
    };
  }

  public async getBuildVcsLabels(id: number) {
    return this.#vcsLabels(
      await this.#requestJson("GET", `${buildPath(id)}/vcsLabels`, { fields: triage.labelFields }),
    );
  }

  public async addBuildVcsLabel(id: number, label: string, rootInstance: string) {
    return this.#vcsLabels(
      await this.#textJson(
        "POST",
        `${buildPath(id)}/vcsLabels`,
        { fields: triage.labelFields, locator: idPath(rootInstance, "Root instance ID") },
        triage.inputText(label, "Label"),
      ),
    );
  }

  #vcsLabels(value: unknown) {
    return triage
      .array(triage.object(value).vcsLabel)
      .map((item) => triage.safeScalars(item, ["text", "status", "buildId"]));
  }

  async #textJson(method: HttpMethod, path: string, query: Record<string, string>, body: string) {
    return decodeJson(
      await this.#request(method, path, query, body, "text/plain", { accept: "application/json" }),
    );
  }

  public async getChangeDuplicates(id: number) {
    const value = await this.#requestJson<{ change?: ChangeSummary[] }>(
      "GET",
      `/app/rest/changes/id:${positiveId(id, "Change ID")}/duplicates`,
      { fields: `change(${changeSummaryFields})` },
    );
    return (value.change ?? []).map(safeChange);
  }

  public async getChangeFirstBuilds(id: number) {
    const value = await this.#requestJson<{ build?: unknown[] }>(
      "GET",
      `/app/rest/changes/id:${positiveId(id, "Change ID")}/firstBuilds`,
      { fields: `build(${triage.evidenceBuildFields})` },
    );
    return (value.build ?? []).map(triage.safeEvidenceBuild);
  }

  public async getChangeIssues(id: number) {
    const value = await this.#requestJson<{ issue?: unknown[] }>(
      "GET",
      `/app/rest/changes/id:${positiveId(id, "Change ID")}/issues`,
    );
    return (value.issue ?? []).map((item) => triage.safeScalars(item, ["id"]));
  }

  public async getChangeParentRevisions(id: number) {
    const value = await this.#requestJson<{ item?: unknown[] }>(
      "GET",
      `/app/rest/changes/id:${positiveId(id, "Change ID")}/parentRevisions`,
    );
    return (value.item ?? []).map((item) => {
      if (typeof item !== "string") throw new Error("Invalid revision response; payload omitted.");
      return item;
    });
  }

  public async getChangeRootInstance(id: number) {
    return triage.safeScalars(
      await this.#requestJson(
        "GET",
        `/app/rest/changes/id:${positiveId(id, "Change ID")}/vcsRootInstance`,
        { fields: "id,name,vcs-root-id" },
      ),
      ["id", "name", "vcs-root-id"],
    );
  }

  public async getChangeField(id: number, field: string) {
    allowedField(field, ["id", "version", "date", "personal", "comment"]);
    const value = await this.#request(
      "GET",
      `/app/rest/changes/id:${positiveId(id, "Change ID")}/${field}`,
      {},
      undefined,
      "text/plain",
    );
    return { changeId: id, field, value };
  }

  public async listInvestigations(page: TeamCityPageOptions = {}) {
    const value = await this.#requestJson<{ investigation?: unknown[] }>(
      "GET",
      "/app/rest/investigations",
      {
        locator: joinLocator(...pageDimensions(page)),
        fields: `count,nextHref,investigation(${triage.investigationFields})`,
      },
    );
    return (value.investigation ?? []).map((item) => triage.safeAssignment(item, true));
  }

  public async createInvestigation(input: unknown, replace = false) {
    const { locator, body } = triage.investigationBody(input);
    return triage.safeAssignment(
      await this.#requestJson(
        replace ? "PUT" : "POST",
        "/app/rest/investigations" + (replace ? "/" + locator : ""),
        { fields: triage.investigationFields },
        body,
      ),
      true,
    );
  }

  public async createInvestigations(inputs: readonly unknown[]) {
    const items = triage.typedItems(inputs).map(triage.investigationBody);
    distinctIds(items.map((item) => item.locator));
    const body = { investigation: items.map((item) => item.body) };
    const value = await this.#requestJson<{ investigation?: unknown[] }>(
      "POST",
      "/app/rest/investigations/multiple",
      { fields: `count,investigation(${triage.investigationFields})` },
      body,
    );
    return (value.investigation ?? []).map((item) => triage.safeAssignment(item, true));
  }

  public async getInvestigation(target: unknown) {
    const { locator } = triage.investigationTarget(target);
    return triage.safeAssignment(
      await this.#requestJson("GET", "/app/rest/investigations/" + locator, {
        fields: triage.investigationFields,
      }),
      true,
    );
  }

  public async deleteInvestigation(target: unknown) {
    await this.#request(
      "DELETE",
      "/app/rest/investigations/" + triage.investigationTarget(target).locator,
    );
    return { deleted: true };
  }

  public async listMutes(page: TeamCityPageOptions = {}) {
    const value = await this.#requestJson<{ mute?: unknown[] }>("GET", "/app/rest/mutes", {
      locator: joinLocator(...pageDimensions(page)),
      fields: `count,nextHref,mute(${triage.muteFields})`,
    });
    return (value.mute ?? []).map((item) => triage.safeAssignment(item, false));
  }

  public async createMute(input: unknown) {
    return triage.safeAssignment(
      await this.#requestJson(
        "POST",
        "/app/rest/mutes",
        { fields: triage.muteFields },
        triage.muteBody(input),
      ),
      false,
    );
  }

  public async createMutes(inputs: readonly unknown[]) {
    const body = { mute: triage.typedItems(inputs).map(triage.muteBody) };
    const value = await this.#requestJson<{ mute?: unknown[] }>(
      "POST",
      "/app/rest/mutes/multiple",
      { fields: `count,mute(${triage.muteFields})` },
      body,
    );
    return (value.mute ?? []).map((item) => triage.safeAssignment(item, false));
  }

  public async getMute(id: number) {
    return triage.safeAssignment(
      await this.#requestJson("GET", `/app/rest/mutes/id:${positiveId(id, "Mute ID")}`, {
        fields: triage.muteFields,
      }),
      false,
    );
  }

  public async deleteMute(id: number, comment?: string) {
    const body = comment === undefined ? undefined : triage.inputText(comment, "Comment");
    await this.#request(
      "DELETE",
      `/app/rest/mutes/id:${positiveId(id, "Mute ID")}`,
      {},
      body,
      "text/plain",
    );
    return { muteId: id, deleted: true };
  }

  public async listTriageEntities(kind: "test" | "problem", page: TeamCityPageOptions = {}) {
    const fields = kind === "test" ? "id,name" : triage.problemFields;
    const value = await this.#requestJson<Record<string, unknown>>("GET", `/app/rest/${kind}s`, {
      locator: joinLocator(...pageDimensions(page)),
      fields: `count,nextHref,${kind}(${fields})`,
    });
    return triage.array(value[kind]).map((item) => triage.safeEntity(item, kind));
  }

  public async getTriageEntity(kind: "test" | "problem", id: string) {
    const fields = kind === "test" ? "id,name" : triage.problemFields;
    return triage.safeEntity(
      await this.#requestJson("GET", `/app/rest/${kind}s/${idPath(id, "ID")}`, { fields }),
      kind,
    );
  }

  public async getTriageOccurrence(kind: "test" | "problem", id: string, buildId: number) {
    const locator = joinLocator(
      nestedId("build", positiveId(buildId, "Build ID"), "Build ID"),
      nestedId(kind, id, "Target ID"),
    );
    const fields = kind === "test" ? triage.testOccurrenceFields : triage.problemOccurrenceFields;
    return triage.safeOccurrence(
      await this.#requestJson("GET", `/app/rest/${kind}Occurrences/${locator}`, { fields }),
      kind,
    );
  }

  public async listBuildRuntimeParameterNames(
    id: number,
    kind: "output-parameters" | "resulting-properties",
  ) {
    const value = await this.#requestJson<{ property?: unknown[] }>(
      "GET",
      `${buildPath(id)}/${kind}`,
      { fields: "count,property(name)" },
    );
    return (value.property ?? []).map((item) => triage.safeScalars(item, ["name"]).name);
  }

  public async checkBuildRuntimeParameter(
    id: number,
    kind: "output-parameters" | "resulting-properties",
    name: string,
  ) {
    await this.#request(
      "GET",
      `${buildPath(id)}/${kind}/${pathSegment(name)}`,
      {},
      undefined,
      "text/plain",
      { discard: true },
    );
    return { name, exists: true };
  }

  public async listChangeAttributeNames(id: number) {
    const value = await this.#requestJson<{ entry?: unknown[] }>(
      "GET",
      `/app/rest/changes/id:${positiveId(id, "Change ID")}/attributes`,
      { fields: "count,entry(name)" },
    );
    return (value.entry ?? []).map((item) => triage.safeScalars(item, ["name"]).name);
  }

  public async listAccountUsers(page: TeamCityPageOptions = {}) {
    const value = await this.#requestJson<{ user?: unknown[] }>("GET", "/app/rest/users", {
      locator: joinLocator(...pageDimensions(page)),
      fields: `count,user(${admin.accountUserFields})`,
    });
    return (value.user ?? []).map(admin.safeAccountUser);
  }

  public async createAccountUser(username: string, name?: string) {
    const body = {
      username: triage.inputText(username, "Username"),
      ...(name === undefined ? {} : { name: triage.inputText(name, "Name") }),
    };
    return admin.safeAccountUser(
      await this.#requestJson("POST", "/app/rest/users", { fields: admin.accountUserFields }, body),
    );
  }

  public async updateAccountUser(id: string, input: { username?: string; name?: string }) {
    triage.inputRecord(input, ["username", "name"]);
    const body = {
      ...(input.username === undefined
        ? {}
        : { username: triage.inputText(input.username, "Username") }),
      ...(input.name === undefined ? {} : { name: triage.inputText(input.name, "Name") }),
    };
    if (!Object.keys(body).length) throw new Error("At least one identity field is required.");
    return admin.safeAccountUser(
      await this.#requestJson(
        "PUT",
        admin.accountPath("users", id),
        { fields: admin.accountUserFields },
        body,
      ),
    );
  }

  public async deleteAccountUser(id: string) {
    await this.#request("DELETE", admin.accountPath("users", id));
    return { userId: id, deleted: true };
  }

  public async forgetRememberedSessions(id: string) {
    await this.#request(
      "DELETE",
      admin.accountPath("users", id) + "/debug/rememberMe",
      {},
      undefined,
      "text/plain",
    );
    return { userId: id, rememberedLoginsCleared: true };
  }

  public async terminateAccountSessions(id: string) {
    await this.#request("POST", admin.accountPath("users", id) + "/logout");
    return { userId: id, sessionsTerminated: true };
  }

  public async listAccountGroups(kind: admin.AccountKind, id: string) {
    const suffix = kind === "users" ? "/groups" : "/parent-groups";
    const value = await this.#requestJson<{ group?: unknown[] }>(
      "GET",
      admin.accountPath(kind, id) + suffix,
      { fields: `count,group(${admin.groupFields})` },
    );
    return (value.group ?? []).map(admin.safeGroup);
  }

  public async replaceAccountGroups(kind: admin.AccountKind, id: string, keys: readonly string[]) {
    const body = admin.groupKeys(keys);
    if (kind === "groups" && body.group.some((group) => group.key === id))
      throw new Error("A group cannot be its own parent.");
    const value = await this.#requestJson<{ group?: unknown[] }>(
      "PUT",
      admin.accountPath(kind, id) + (kind === "users" ? "/groups" : "/parent-groups"),
      { fields: `count,group(${admin.groupFields})` },
      body,
    );
    return (value.group ?? []).map(admin.safeGroup);
  }

  public async getAccountUserGroup(id: string, key: string) {
    const suffix = "/" + admin.groupLocator(key);
    return admin.safeGroup(
      await this.#requestJson("GET", admin.accountPath("users", id) + "/groups" + suffix, {
        fields: admin.groupFields,
      }),
    );
  }

  public async removeAccountUserGroup(id: string, key: string) {
    const suffix = "/" + admin.groupLocator(key);
    await this.#request("DELETE", admin.accountPath("users", id) + "/groups" + suffix);
    return { userId: id, group: key, removed: true };
  }

  public async listAccountPermissions(id: string, project?: string) {
    const value = await this.#requestJson<{ permissionAssignment?: unknown[] }>(
      "GET",
      admin.accountPath("users", id) + "/permissions",
      {
        ...(project === undefined ? {} : { locator: nestedId("project", project, "Project ID") }),
        fields: "count,permissionAssignment(permission(id),project(id),isGlobalScope)",
      },
    );
    return (value.permissionAssignment ?? []).map((item) => {
      const raw = triage.object(item);
      return {
        ...triage.safeScalars(raw, ["isGlobalScope"]),
        ...(raw.permission === undefined
          ? {}
          : { permission: triage.safeScalars(raw.permission, ["id"]) }),
        ...(raw.project === undefined ? {} : { project: triage.safeScalars(raw.project, ["id"]) }),
      };
    });
  }

  public async listAccountPropertyNames(kind: admin.AccountKind, id: string) {
    const value = await this.#requestJson<{ property?: unknown[] }>(
      "GET",
      admin.accountPath(kind, id) + "/properties",
      { fields: "count,property(name)" },
    );
    return (value.property ?? []).map((item) => triage.safeScalars(item, ["name"]).name);
  }

  public async checkAccountProperty(kind: admin.AccountKind, id: string, name: string) {
    await this.#request(
      "GET",
      admin.accountPath(kind, id) + "/properties/" + pathSegment(name),
      {},
      undefined,
      "text/plain",
      { discard: true },
    );
    return { name, exists: true };
  }

  public async setAccountProperty(
    kind: admin.AccountKind,
    id: string,
    name: string,
    value: string,
  ) {
    const property = plainProperty(name, value);
    await this.#request(
      "PUT",
      admin.accountPath(kind, id) + "/properties/" + pathSegment(property.name),
      {},
      property.value,
      "text/plain",
      { discard: true },
    );
    return { name: property.name, updated: true };
  }

  public async deleteAccountProperty(kind: admin.AccountKind, id: string, name: string) {
    await this.#request("DELETE", admin.accountPath(kind, id) + "/properties/" + pathSegment(name));
    return { name, deleted: true };
  }

  public async listAccountRoles(kind: admin.AccountKind, id: string) {
    const value = await this.#requestJson<{ role?: unknown[] }>(
      "GET",
      admin.accountPath(kind, id) + "/roles",
    );
    return (value.role ?? []).map(admin.safeRole);
  }

  public async addAccountRole(kind: admin.AccountKind, id: string, input: admin.RoleInput) {
    return admin.safeRole(
      await this.#requestJson(
        "POST",
        admin.accountPath(kind, id) + "/roles",
        {},
        admin.roleBody(input),
      ),
    );
  }

  public async replaceAccountRoles(
    kind: admin.AccountKind,
    id: string,
    inputs: readonly unknown[],
  ) {
    const value = await this.#requestJson<{ role?: unknown[] }>(
      "PUT",
      admin.accountPath(kind, id) + "/roles",
      {},
      admin.roleBodies(inputs),
    );
    return (value.role ?? []).map(admin.safeRole);
  }

  public async getAccountRole(kind: admin.AccountKind, id: string, input: admin.RoleInput) {
    return admin.safeRole(
      await this.#requestJson(
        "GET",
        admin.accountPath(kind, id) + "/roles" + admin.roleSuffix(input).suffix,
      ),
    );
  }

  public async grantAccountRole(kind: admin.AccountKind, id: string, input: admin.RoleInput) {
    return admin.safeRole(
      await this.#requestJson(
        kind === "users" ? "PUT" : "POST",
        admin.accountPath(kind, id) + "/roles" + admin.roleSuffix(input).suffix,
      ),
    );
  }

  public async revokeAccountRole(kind: admin.AccountKind, id: string, input: admin.RoleInput) {
    const { role, suffix } = admin.roleSuffix(input);
    await this.#request("DELETE", admin.accountPath(kind, id) + "/roles" + suffix);
    return { ...role, revoked: true };
  }

  public async listCurrentUserTokens() {
    const value = await this.#requestJson<{ token?: unknown[] }>(
      "GET",
      "/app/rest/users/current/tokens",
      { fields: `count,token(${admin.tokenFields})` },
    );
    return (value.token ?? []).map(admin.safeToken);
  }

  public async createCurrentUserToken(input: admin.TokenCreationOptions, secrets: ScopedSecrets) {
    const body = admin.tokenBody(input);
    const key = admin.issuedTokenKey(input.alias);
    if ((await admin.readIssuedToken(secrets, input.alias)) !== undefined)
      throw new Error("Issued-token alias already exists; no HTTP was attempted.");
    const raw = triage.object(
      await this.#requestJson(
        "POST",
        "/app/rest/users/current/tokens",
        { fields: admin.tokenFields + ",value" },
        body,
      ),
    );
    if (raw.name !== body.name || typeof raw.value !== "string" || !raw.value.trim())
      throw new Error(
        "Token may have been created, but its one-time result was invalid; inspect/revoke the named remote token.",
      );
    const metadata = admin.safeToken(raw);
    try {
      await secrets.set(key, JSON.stringify({ name: body.name, value: raw.value }));
    } catch {
      throw new Error(
        "Remote token was created but secure persistence failed; revoke the named remote token. No retry was made.",
      );
    }
    return { ...metadata, alias: input.alias, stored: true };
  }

  public async deleteCurrentUserToken(name: string, secrets: ScopedSecrets, alias?: string) {
    const tokenName = requiredText(name, "Token name");
    if (alias !== undefined) {
      const contents = await admin.readIssuedToken(secrets, alias);
      if (contents === undefined || admin.issuedTokenName(contents) !== tokenName)
        throw new Error(
          "Issued-token alias does not match the named remote token; no HTTP was attempted.",
        );
    }
    await this.#request("DELETE", "/app/rest/users/current/tokens/" + pathSegment(tokenName));
    if (alias !== undefined) {
      try {
        await secrets.delete(admin.issuedTokenKey(alias));
      } catch {
        throw new Error(
          "Remote token was revoked but local secure-record cleanup failed; forget the alias explicitly.",
        );
      }
    }
    return { name: tokenName, revoked: true };
  }

  public async getAccountUserField(id: string, field: string) {
    allowedField(field, ["id", "name", "username"]);
    const value = await this.#request(
      "GET",
      admin.accountPath("users", id) + "/" + field,
      {},
      undefined,
      "text/plain",
    );
    return { userId: id, field, value };
  }

  public async setAccountUserField(id: string, field: string, value: string) {
    allowedField(field, ["name", "username"]);
    await this.#request(
      "PUT",
      admin.accountPath("users", id) + "/" + field,
      {},
      triage.inputText(value, field),
      "text/plain",
      { discard: true },
    );
    return { userId: id, field, updated: true };
  }

  public async clearAccountUserField(id: string, field: string) {
    allowedField(field, ["name"]);
    await this.#request("DELETE", admin.accountPath("users", id) + "/" + field);
    return { userId: id, field, cleared: true };
  }

  public async listAccountGroupsAll() {
    const value = await this.#requestJson<{ group?: unknown[] }>("GET", "/app/rest/userGroups", {
      fields: `count,group(${admin.groupFields})`,
    });
    return (value.group ?? []).map(admin.safeGroup);
  }

  public async createAccountGroup(key: string, name: string, description?: string) {
    const body = {
      key: triage.inputText(key, "Group key"),
      name: triage.inputText(name, "Name"),
      ...(description === undefined
        ? {}
        : { description: triage.inputText(description, "Description") }),
    };
    return admin.safeGroup(
      await this.#requestJson("POST", "/app/rest/userGroups", { fields: admin.groupFields }, body),
    );
  }

  public async getAccountGroup(key: string) {
    return admin.safeGroup(
      await this.#requestJson("GET", admin.accountPath("groups", key), {
        fields: admin.groupFields,
      }),
    );
  }

  public async deleteAccountGroup(key: string) {
    await this.#request("DELETE", admin.accountPath("groups", key));
    return { group: key, deleted: true };
  }

  public async listServerNodes(role?: string, state?: string) {
    const locator = joinLocator(
      role === undefined
        ? undefined
        : "role:" + allowedField(role, ["main_node", "secondary_node"]),
      state === undefined
        ? undefined
        : "state:" + allowedField(state, ["online", "offline", "stopping", "starting"]),
    );
    const value = await this.#requestJson<{ node?: unknown[] }>("GET", "/app/rest/server/nodes", {
      ...(locator ? { locator } : {}),
      fields: `count,node(${admin.nodeFields})`,
    });
    return (value.node ?? []).map(admin.safeNode);
  }

  public async getServerNode(id: string) {
    return admin.safeNode(
      await this.#requestJson("GET", "/app/rest/server/nodes/" + idPath(id, "Node ID"), {
        fields: admin.nodeFields,
      }),
    );
  }

  public async getNodeResponsibilities(id: string, kind: "enabled" | "disabled" | "effective") {
    return admin.responsibilities(
      await this.#requestJson(
        "GET",
        "/app/rest/server/nodes/" + idPath(id, "Node ID") + "/" + kind + "Responsibilities",
        { fields: admin.responsibilityFields },
      ),
    );
  }

  public async setNodeResponsibility(id: string, name: string, enabled: string) {
    allowedField(name, ["CAN_PROCESS_BUILD_MESSAGES"]);
    return admin.responsibilities(
      await this.#textJson(
        "PUT",
        "/app/rest/server/nodes/" + idPath(id, "Node ID") + "/enabledResponsibilities/" + name,
        {},
        booleanText(enabled),
      ),
    );
  }

  public async getApiVersion() {
    return {
      version: await this.#request("GET", "/app/rest/apiVersion", {}, undefined, "text/plain"),
    };
  }

  public async listCloud(
    kind: infrastructure.CloudKind,
    page: TeamCityPageOptions = {},
    project?: string,
    profile?: string,
  ) {
    if (kind === "profiles" && profile !== undefined)
      throw new Error("Profile filter is for images/instances only.");
    const key = infrastructure.cloudCollection[kind];
    const value = await this.#requestJson<Record<string, unknown>>(
      "GET",
      "/app/rest/cloud/" + kind,
      {
        locator: joinLocator(
          project === undefined ? undefined : nestedId("project", project, "Project ID"),
          profile === undefined ? undefined : nestedId("profile", profile, "Cloud profile ID"),
          ...pageDimensions(page),
        ),
        fields: `count,nextHref,${key}(${infrastructure.cloudFields[kind]})`,
      },
    );
    return triage.array(value[key]).map((item) => infrastructure.safeCloud(item, kind));
  }

  public async getCloudProfile(id: string) {
    return infrastructure.safeCloud(
      await this.#requestJson("GET", "/app/rest/cloud/profiles/" + idPath(id, "Cloud profile ID"), {
        fields: infrastructure.cloudFields.profiles,
      }),
      "profiles",
    );
  }

  public async getCloudImage(input: infrastructure.CloudImageId) {
    return infrastructure.safeCloud(
      await this.#requestJson(
        "GET",
        "/app/rest/cloud/images/" + idPath(infrastructure.cloudComposite(input), "Image ID"),
        { fields: infrastructure.cloudFields.images },
      ),
      "images",
    );
  }

  public async getCloudInstance(input: infrastructure.CloudInstanceId) {
    return infrastructure.safeCloud(
      await this.#requestJson(
        "GET",
        "/app/rest/cloud/instances/" + idPath(infrastructure.cloudComposite(input), "Instance ID"),
        { fields: infrastructure.cloudFields.instances },
      ),
      "instances",
    );
  }

  public async startCloudInstance(input: infrastructure.CloudImageId) {
    const imageId = infrastructure.cloudComposite(input);
    await this.#request("POST", "/app/rest/cloud/instances", {}, { image: { id: imageId } });
    return { imageId, startRequested: true };
  }

  public async stopCloudInstance(
    input: infrastructure.CloudInstanceId,
    action: "delete" | "force-stop" | "stop",
  ) {
    const instanceId = infrastructure.cloudComposite(input);
    const suffix =
      action === "delete" ? "" : action === "stop" ? "/actions/stop" : "/actions/forceStop";
    await this.#request(
      action === "delete" ? "DELETE" : "POST",
      "/app/rest/cloud/instances/" + idPath(instanceId, "Instance ID") + suffix,
    );
    return {
      instanceId,
      ...(action === "stop" ? { stopWhenFreeRequested: true } : { forcedStopRequested: true }),
    };
  }

  public async createAnonymousGitRoot(
    id: string,
    name: string,
    project: string,
    url: string,
    branch: string,
  ) {
    const body = infrastructure.anonymousGitRoot(id, name, project, url, branch);
    return infrastructure.safeInfrastructureRoot(
      await this.#requestJson(
        "POST",
        "/app/rest/vcs-roots",
        { fields: infrastructure.vcsRootFields },
        body,
      ),
    );
  }

  public async deleteVcsRoot(id: string) {
    await this.#request("DELETE", infrastructure.vcsRootPath(id));
    return { rootId: id, deleted: true };
  }

  public async getVcsRootInstances(id: string) {
    const value = await this.#requestJson<Record<string, unknown>>(
      "GET",
      infrastructure.vcsRootPath(id) + "/instances",
      { fields: `count,vcs-root-instance(${infrastructure.vcsInstanceFields})` },
    );
    return triage.array(value["vcs-root-instance"]).map(infrastructure.safeVcsInstance);
  }

  public async listVcsRootPropertyNames(id: string) {
    return infrastructure.propertyNames(
      await this.#requestJson("GET", infrastructure.vcsRootPath(id) + "/properties", {
        fields: "count,property(name)",
      }),
    );
  }

  public async replaceVcsRootProperties(id: string, properties: readonly PlainProperty[]) {
    const body = { property: infrastructure.namedValues(properties) };
    return infrastructure.propertyNames(
      await this.#requestJson(
        "PUT",
        infrastructure.vcsRootPath(id) + "/properties",
        { fields: "count,property(name)" },
        body,
      ),
    );
  }

  public async clearVcsRootProperties(id: string) {
    await this.#request("DELETE", infrastructure.vcsRootPath(id) + "/properties");
    return { rootId: id, cleared: true };
  }

  public async checkVcsRootProperty(id: string, name: string) {
    await this.#request(
      "GET",
      infrastructure.vcsRootPath(id) + "/properties/" + pathSegment(name),
      {},
      undefined,
      "text/plain",
      { discard: true },
    );
    return { name, exists: true };
  }

  public async setVcsRootProperty(id: string, name: string, value: string) {
    const property = plainProperty(name, value);
    await this.#request(
      "PUT",
      infrastructure.vcsRootPath(id) + "/properties/" + pathSegment(property.name),
      {},
      property.value,
      "text/plain",
      { discard: true },
    );
    return { name: property.name, updated: true };
  }

  public async deleteVcsRootProperty(id: string, name: string) {
    await this.#request(
      "DELETE",
      infrastructure.vcsRootPath(id) + "/properties/" + pathSegment(name),
    );
    return { name, deleted: true };
  }

  public async getVcsRootField(id: string, field: string) {
    allowedField(field, ["id", "name", "vcsName", "projectId", "modificationCheckInterval"]);
    const value = await this.#request(
      "GET",
      infrastructure.vcsRootPath(id) + "/" + field,
      {},
      undefined,
      "text/plain",
    );
    return { rootId: id, field, value };
  }

  public async setVcsRootField(id: string, field: string, value: string) {
    allowedField(field, ["name"]);
    await this.#request(
      "PUT",
      infrastructure.vcsRootPath(id) + "/" + field,
      {},
      triage.inputText(value, "Name"),
      "text/plain",
      { discard: true },
    );
    return { rootId: id, field, updated: true };
  }

  public async listVcsInstances(page: TeamCityPageOptions = {}, root?: string) {
    const value = await this.#requestJson<Record<string, unknown>>(
      "GET",
      "/app/rest/vcs-root-instances",
      {
        locator: joinLocator(
          root === undefined ? undefined : nestedId("vcsRoot", root, "Root ID"),
          ...pageDimensions(page),
        ),
        fields: `count,nextHref,vcs-root-instance(${infrastructure.vcsInstanceFields})`,
      },
    );
    return triage.array(value["vcs-root-instance"]).map(infrastructure.safeVcsInstance);
  }

  public async checkVcsInstanceChanges(id: string) {
    const value = await this.#requestJson<Record<string, unknown>>(
      "POST",
      "/app/rest/vcs-root-instances/checkingForChangesQueue",
      {
        locator: idPath(id, "Instance ID"),
        requestor: "user",
        fields: `count,nextHref,vcs-root-instance(${infrastructure.vcsInstanceFields})`,
      },
    );
    return triage.array(value["vcs-root-instance"]).map(infrastructure.safeVcsInstance);
  }

  public async notifyVcsCommit(id: string) {
    await this.#request(
      "POST",
      "/app/rest/vcs-root-instances/commitHookNotification",
      { locator: idPath(id, "Instance ID"), okOnNothingFound: "false" },
      undefined,
      "text/plain",
      { discard: true, expectedStatus: 202 },
    );
    return { instanceId: id, scheduled: true };
  }

  public async getVcsInstance(id: string) {
    return infrastructure.safeVcsInstance(
      await this.#requestJson("GET", infrastructure.vcsInstancePath(id), {
        fields: infrastructure.vcsInstanceFields,
      }),
    );
  }

  public async listVcsInstancePropertyNames(id: string) {
    return infrastructure.propertyNames(
      await this.#requestJson("GET", infrastructure.vcsInstancePath(id) + "/properties", {
        fields: "count,property(name)",
      }),
    );
  }

  public async getVcsRepositoryState(id: string) {
    return infrastructure.repositoryEntries(
      await this.#requestJson("GET", infrastructure.vcsInstancePath(id) + "/repositoryState", {
        fields: "count,entry(name,value)",
      }),
    );
  }

  public async replaceVcsRepositoryState(id: string, revisions: readonly PlainProperty[]) {
    const body = { entry: infrastructure.namedValues(revisions, true) };
    return infrastructure.repositoryEntries(
      await this.#requestJson(
        "PUT",
        infrastructure.vcsInstancePath(id) + "/repositoryState",
        { fields: "count,entry(name,value)" },
        body,
      ),
    );
  }

  public async resetVcsRepositoryState(id: string) {
    await this.#request("DELETE", infrastructure.vcsInstancePath(id) + "/repositoryState");
    return { instanceId: id, stateReset: true };
  }

  public async getVcsRepositoryStateCreated(id: string) {
    const creationDate = await this.#request(
      "GET",
      infrastructure.vcsInstancePath(id) + "/repositoryState/creationDate",
      {},
      undefined,
      "text/plain",
    );
    return { instanceId: id, creationDate };
  }

  public async getVcsInstanceField(id: string, field: string) {
    allowedField(field, [
      "id",
      "name",
      "vcsName",
      "projectId",
      "lastVersion",
      "lastVersionInternal",
      "currentVersion",
      "currentVersionInternal",
      "commitHookMode",
    ]);
    const value = await this.#request(
      "GET",
      infrastructure.vcsInstancePath(id) + "/" + field,
      {},
      undefined,
      "text/plain",
    );
    return { instanceId: id, field, value };
  }

  public async setVcsInstanceField(id: string, field: string, value: string) {
    allowedField(field, ["commitHookMode", "lastVersionInternal"]);
    const body =
      field === "commitHookMode" ? booleanText(value) : plainProperty("revision", value).value;
    await this.#request(
      "PUT",
      infrastructure.vcsInstancePath(id) + "/" + field,
      {},
      body,
      "text/plain",
      { discard: true },
    );
    return { instanceId: id, field, updated: true };
  }

  public async clearVcsInstanceField(id: string, field: string) {
    allowedField(field, ["lastVersionInternal"]);
    await this.#request("DELETE", infrastructure.vcsInstancePath(id) + "/" + field);
    return { instanceId: id, field, cleared: true };
  }

  public async getVersionedAffectedProjects(id: string) {
    const value = await this.#requestJson<{ project?: unknown[] }>(
      "GET",
      infrastructure.versionedPath(id) + "/affectedProjects",
      { fields: "count,project(id,name)" },
    );
    return (value.project ?? []).map((item) => triage.safeScalars(item, ["id", "name"]));
  }

  public async checkVersionedSettings(id: string) {
    await this.#request("POST", infrastructure.versionedPath(id) + "/checkForChanges");
    return { projectId: id, checkRequested: true };
  }

  public async commitVersionedSettings(id: string) {
    await this.#request("POST", infrastructure.versionedPath(id) + "/commitCurrentSettings");
    return { projectId: id, commitRequested: true };
  }

  public async getVersionedConfig(id: string) {
    return infrastructure.safeVersionedConfig(
      await this.#requestJson("GET", infrastructure.versionedPath(id) + "/config", {
        fields: infrastructure.versionedConfigFields,
      }),
    );
  }

  public async replaceVersionedConfig(id: string, input: unknown) {
    const body = infrastructure.versionedConfigBody(input);
    return infrastructure.safeVersionedConfig(
      await this.#requestJson(
        "PUT",
        infrastructure.versionedPath(id) + "/config",
        { fields: infrastructure.versionedConfigFields },
        body,
      ),
    );
  }

  public async getEffectiveVersionedConfig(id: string) {
    const value = await this.#requestJson<{ project?: unknown; config?: unknown }>(
      "GET",
      infrastructure.versionedPath(id) + "/config/effective",
      { fields: `project(id),config(${infrastructure.versionedConfigFields})` },
    );
    return {
      ...(value.project === undefined
        ? {}
        : { project: triage.safeScalars(value.project, ["id"]) }),
      ...(value.config === undefined
        ? {}
        : { config: infrastructure.safeVersionedConfig(value.config) }),
    };
  }

  public async getVersionedConfigField(id: string, field: string) {
    infrastructure.versionedField(field);
    const value = await this.#request(
      "GET",
      infrastructure.versionedPath(id) + "/config/parameters/" + field,
      {},
      undefined,
      "text/plain",
    );
    return { projectId: id, field, value };
  }

  public async setVersionedConfigField(id: string, field: string, value: string) {
    const body = infrastructure.versionedField(field, value);
    await this.#request(
      "PUT",
      infrastructure.versionedPath(id) + "/config/parameters/" + field,
      {},
      body,
      "text/plain",
      { discard: true },
    );
    return { projectId: id, field, updated: true };
  }

  public async resetVersionedConfigField(id: string, field: string) {
    allowedField(field, ["vcsRootId"]);
    await this.#request("DELETE", infrastructure.versionedPath(id) + "/config/parameters/" + field);
    return { projectId: id, field, resetRequested: true };
  }

  public async listVersionedContext(id: string) {
    return infrastructure.contextParameters(
      await this.#requestJson("GET", infrastructure.versionedPath(id) + "/contextParameters"),
    );
  }

  public async replaceVersionedContext(id: string, properties: readonly PlainProperty[]) {
    const body = { versionedSettingsContextParameter: infrastructure.namedValues(properties) };
    return infrastructure.contextParameters(
      await this.#requestJson(
        "PUT",
        infrastructure.versionedPath(id) + "/contextParameters",
        {},
        body,
      ),
    );
  }

  public async loadVersionedSettings(id: string) {
    const value = await this.#requestJson<{ project?: unknown[] }>(
      "POST",
      infrastructure.versionedPath(id) + "/loadSettings",
      { fields: "count,project(id,name)" },
    );
    return (value.project ?? []).map((item) => triage.safeScalars(item, ["id", "name"]));
  }

  public async getVersionedStatus(id: string) {
    return infrastructure.versionedStatus(
      await this.#requestJson("GET", infrastructure.versionedPath(id) + "/status", {
        fields: "type,timestamp,dslOutdated,missingContextParameters",
      }),
    );
  }

  public async listVersionedTokenNames(id: string, status?: string) {
    const value = await this.#requestJson<{ versionedSettingsToken?: unknown[] }>(
      "GET",
      infrastructure.versionedPath(id) + "/tokens",
      status === undefined ? {} : { status: allowedField(status, ["used", "unused", "broken"]) },
    );
    return (value.versionedSettingsToken ?? []).map(
      (item) => triage.safeScalars(item, ["name"]).name,
    );
  }

  public async setVersionedTokens(id: string, mappings: readonly string[], secrets: ScopedSecrets) {
    triage.typedItems(mappings);
    const entries = mappings.map((mapping) => {
      const split = mapping.indexOf("=");
      if (split < 1) throw new Error("Mapping requires remote-name=local-alias.");
      return {
        name: requiredText(mapping.slice(0, split), "Mapping name"),
        alias: admin.credentialAlias(mapping.slice(split + 1)),
      };
    });
    distinctIds(entries.map((item) => item.name));
    const versionedSettingsToken = [];
    for (const item of entries)
      versionedSettingsToken.push({
        name: item.name,
        value: await requireInputSecret(secrets, item.alias),
      });
    await this.#request(
      "POST",
      infrastructure.versionedPath(id) + "/tokens",
      {},
      { versionedSettingsToken },
      "application/json",
      { discard: true },
    );
    return { names: entries.map((item) => item.name), updated: true };
  }

  public async deleteVersionedTokens(id: string, names: readonly string[]) {
    triage.typedItems(names);
    const checked = distinctIds(names);
    await this.#request(
      "DELETE",
      infrastructure.versionedPath(id) + "/tokens",
      {},
      { versionedSettingsToken: checked.map((name) => ({ name })) },
      "application/json",
      { discard: true },
    );
    return { names: checked, deleted: true };
  }

  public async getRestVersion() {
    return {
      version: await this.#request("GET", "/app/rest/version", {}, undefined, "text/plain"),
    };
  }

  #statusBody(status: boolean, comment?: string) {
    if (typeof status !== "boolean") throw new Error("Status must be a boolean.");
    return {
      status,
      ...(comment === undefined
        ? {}
        : { comment: { text: plainProperty("comment", comment).value } }),
    };
  }

  async #optionalJson<T>(path: string, fields: string): Promise<T | null> {
    const contents = await this.#request("GET", path, { fields });
    return contents.trim() === "" ? null : decodeJson<T | null>(contents);
  }

  #cancel(path: string, options: CancelBuildOptions): Promise<TeamCityBuild> {
    return this.#requestJson<TeamCityBuild>(
      "POST",
      path,
      { fields: buildFields },
      {
        ...(options.comment === undefined
          ? {}
          : { comment: requiredText(options.comment, "Cancellation comment") }),
        readdIntoQueue: false,
      },
    );
  }

  async #requestJson<T>(
    method: HttpMethod,
    path: string,
    query: Record<string, string> = {},
    body?: unknown,
  ): Promise<T> {
    const contents = await this.#request(method, path, query, body);
    return decodeJson<T>(contents);
  }

  public async getRestInfo() {
    const value = await this.#request("GET", "/app/rest", {}, undefined, "text/plain");
    const path = value.match(
      /(?:^|[\s'"(])(\/(?:[A-Za-z0-9._-]+\/)*app\/rest)(?:\/server)?(?=$|[\s'"),.])/,
    );
    if (!path) throw new Error("REST landing response does not identify a relative API path.");
    return { restPath: path[1] };
  }
  public async createPoolTokens(
    id: string,
    ttl: number,
    aliases: readonly string[],
    secrets: ScopedSecrets,
  ) {
    const poolId = poolNumber(Number(id));
    system.integer(ttl, 1, 86400);
    const keys = aliases.map(inputSecretKey);
    await preflightSecretKeys(secrets, keys);
    const result = triage.object(
      await this.#requestJson(
        "POST",
        `/app/rest/agentPools/id:${poolId}/authorizationTokens`,
        {},
        { timeToLiveSeconds: ttl, count: aliases.length },
      ),
    );
    await persistSecretKeys(secrets, keys, triage.array(result.item) as string[]);
    return {
      poolId,
      aliases: [...aliases],
      count: aliases.length,
      timeToLiveSeconds: ttl,
      stored: true,
    };
  }
  public async listAudit(page: TeamCityPageOptions, project?: string) {
    return system.collection(
      await this.#requestJson("GET", "/app/rest/audit", {
        locator: joinLocator(
          project ? nestedId("affectedProject", project, "Project ID") : undefined,
          ...pageDimensions(page),
        ),
        fields: `count,auditEvent(${system.auditFields})`,
      }),
      "auditEvent",
      system.safeAudit,
    );
  }
  public async getAudit(id: string) {
    return system.safeAudit(
      await this.#requestJson("GET", "/app/rest/audit/" + idPath(id, "Audit ID"), {
        fields: system.auditFields,
      }),
    );
  }
  public async replaceAvatar(id: string, path: string) {
    const userId = system.userId(id),
      body = await system.avatarInput(path);
    await this.#request("PUT", "/app/rest/avatars/id:" + userId, {}, body, "application/json", {
      discard: true,
    });
    return { userId, replaced: true };
  }
  public async deleteAvatar(id: string) {
    const userId = system.userId(id);
    await this.#request("DELETE", "/app/rest/avatars/id:" + userId);
    return { userId, deleted: true };
  }
  public async getJobInvestigations(id: string) {
    return system.collection(
      await this.#requestJson(
        "GET",
        "/app/rest/buildTypes/" + idPath(id, "ID") + "/investigations",
        { fields: `count,investigation(${triage.investigationFields})` },
      ),
      "investigation",
      (v) => triage.safeAssignment(v, true),
    );
  }
  public async getJobVcsInstances(id: string) {
    return system.collection(
      await this.#requestJson(
        "GET",
        "/app/rest/buildTypes/" + idPath(id, "ID") + "/vcsRootInstances",
        { fields: `count,vcs-root-instance(${infrastructure.vcsInstanceFields})` },
      ),
      "vcs-root-instance",
      infrastructure.safeVcsInstance,
    );
  }
  public async listDashboards(page: TeamCityPageOptions, project?: string) {
    return system.collection(
      await this.#requestJson("GET", "/app/rest/deploymentDashboards", {
        locator: joinLocator(
          project ? nestedId("project", project, "Project ID") : undefined,
          ...pageDimensions(page),
        ),
        fields: `count,deploymentDashboard(${system.dashboardFields})`,
      }),
      "deploymentDashboard",
      system.safeDashboard,
    );
  }
  public async createDashboard(id: string, name: string, project: string) {
    return system.safeDashboard(
      await this.#requestJson(
        "POST",
        "/app/rest/deploymentDashboards",
        {},
        {
          id: triage.inputText(id, "Dashboard ID"),
          name: triage.inputText(name, "Name"),
          project: { id: triage.inputText(project, "Project ID") },
        },
      ),
    );
  }
  public async getDashboard(id: string) {
    return system.safeDashboard(
      await this.#requestJson("GET", system.dashboardPath(id), { fields: system.dashboardFields }),
    );
  }
  public async deleteDashboard(id: string) {
    await this.#request("DELETE", system.dashboardPath(id));
    return { id, deleted: true };
  }
  public async listDeploymentInstances(id: string, page: TeamCityPageOptions) {
    return system.collection(
      await this.#requestJson("GET", system.dashboardPath(id) + "/instances", {
        locator: joinLocator(...pageDimensions(page)),
        fields: `count,deploymentInstance(${system.instanceFields})`,
      }),
      "deploymentInstance",
      system.safeInstance,
    );
  }
  public async upsertDeploymentInstance(
    dashboard: string,
    id: string,
    state: string,
    date: string,
    build?: string,
  ) {
    const entry = system.stateEntry(state, date, build);
    return system.safeInstance(
      await this.#requestJson(
        "POST",
        system.dashboardPath(dashboard) + "/instances",
        {},
        {
          id: triage.inputText(id, "Instance ID"),
          attributes: {},
          deploymentStateEntries: { deploymentStateEntry: [entry] },
        },
      ),
    );
  }
  public async getDeploymentInstance(dashboard: string, id: string) {
    return system.safeInstance(
      await this.#requestJson("GET", system.instancePath(dashboard, id), {
        fields: system.instanceFields,
      }),
    );
  }
  public async appendDeploymentState(
    dashboard: string,
    id: string,
    state: string,
    date: string,
    build?: string,
  ) {
    return system.safeInstance(
      await this.#requestJson(
        "POST",
        system.instancePath(dashboard, id),
        {},
        system.stateEntry(state, date, build),
      ),
    );
  }
  public async deleteDeploymentInstance(dashboard: string, id: string) {
    await this.#request("DELETE", system.instancePath(dashboard, id));
    return { dashboardId: dashboard, instanceId: id, deleted: true };
  }
  public async listHealth(
    options: { project?: string; global?: boolean },
    page: TeamCityPageOptions,
  ) {
    return system.collection(
      await this.#requestJson("GET", "/app/rest/health", {
        locator: joinLocator(system.healthLocator(options), ...pageDimensions(page)),
        fields: `count,healthItem(${system.healthFields})`,
      }),
      "healthItem",
      system.safeHealth,
    );
  }
  public async getHealth(options: { project?: string; global?: boolean; category?: string }) {
    return system.safeHealth(
      await this.#requestJson("GET", "/app/rest/health/" + system.healthLocator(options, true), {
        fields: system.healthFields,
      }),
    );
  }
  public async listHealthCategories() {
    return system.collection(
      await this.#requestJson("GET", "/app/rest/health/category", {
        fields: "count,healthCategory(id,name)",
      }),
      "healthCategory",
      system.safeCategory,
    );
  }
  public async getHealthCategory(id: string) {
    return system.safeCategory(
      await this.#requestJson("GET", "/app/rest/health/category/" + idPath(id, "ID"), {
        fields: "id,name",
      }),
    );
  }
  public async getRestPlugin() {
    return system.pluginXml(
      await this.#request(
        "GET",
        "/app/rest/info",
        { fields: system.pluginFields },
        undefined,
        "application/xml",
        { requireMedia: "application/xml" },
      ),
    );
  }
  public async deleteMutes(ids: readonly string[]) {
    const selected = triage
      .inputIds(ids)
      .map((id) => system.integer(Number(positiveId(Number(id), "Mute ID")), 1));
    if (selected.length > 50) throw new Error("At most50 mutes per operation.");
    const mute = [];
    for (const id of selected)
      mute.push(
        system.fullMute(
          await this.#requestJson("GET", `/app/rest/mutes/id:${id}`, {
            fields: system.muteDeleteFields,
          }),
          id,
        ),
      );
    await this.#request("DELETE", "/app/rest/mutes/multiple", {}, { mute }, "application/json", {
      discard: true,
    });
    return { requestedIds: selected, serverAcknowledged: true, postconditionVerified: false };
  }
  public async getDefaultValueSets(id: string) {
    return system.collection(
      await this.#requestJson(
        "GET",
        "/app/rest/projects/" + idPath(id, "ID") + "/defaultValueSets",
        { fields: "count,valueSet(name,displayName)" },
      ),
      "valueSet",
      (v) => triage.safeScalars(v, ["name", "displayName"]),
    );
  }
  public async listProjectDashboards(id: string) {
    return system.collection(
      await this.#requestJson(
        "GET",
        "/app/rest/projects/" + idPath(id, "ID") + "/deploymentDashboards",
        { fields: `count,deploymentDashboard(${system.dashboardFields})` },
      ),
      "deploymentDashboard",
      system.safeDashboard,
    );
  }
  public async getProjectDashboard(project: string, id: string) {
    return system.safeDashboard(
      await this.#requestJson(
        "GET",
        "/app/rest/projects/" +
          idPath(project, "Project ID") +
          "/deploymentDashboards/" +
          idPath(id, "ID"),
        { fields: system.dashboardFields },
      ),
    );
  }
  public async listRoleDefinitions() {
    return system.collection(
      await this.#requestJson("GET", "/app/rest/roles", {
        fields: `count,role(${system.roleFields})`,
      }),
      "role",
      system.safeRole,
    );
  }
  public async createRoleDefinition(
    name: string,
    permissions: readonly string[],
    included: readonly string[],
  ) {
    return system.safeRole(
      await this.#requestJson(
        "POST",
        "/app/rest/roles",
        { fields: system.roleFields },
        {
          name: triage.inputText(name, "Name"),
          permissions: { permission: system.idsOrEmpty(permissions).map((id) => ({ id })) },
          included: { role: system.idsOrEmpty(included).map((id) => ({ id })) },
        },
      ),
    );
  }
  public async getRoleDefinition(id: string) {
    return system.safeRole(
      await this.#requestJson("GET", system.rolePath(id), { fields: system.roleFields }),
    );
  }
  public async deleteRoleDefinition(id: string) {
    await this.#request("DELETE", system.rolePath(id));
    return { id, deleted: true };
  }
  public async editRoleDefinition(
    id: string,
    kind: "included" | "permissions",
    child: string,
    remove: boolean,
  ) {
    if (kind === "included" && id === child) throw new Error("A role cannot include itself.");
    return system.safeRole(
      await this.#requestJson(
        remove ? "DELETE" : "PUT",
        system.rolePath(id) + "/" + kind + "/" + pathSegment(triage.inputText(child, "Child ID")),
        { fields: system.roleFields },
      ),
    );
  }
  public async getAuthenticationSettings() {
    return system.safeAuth(await this.#requestJson("GET", "/app/rest/server/authSettings"));
  }
  public async replaceAuthenticationSettings(value: unknown, secrets: ScopedSecrets) {
    const body = await system.authBody(value, secrets);
    return system.safeAuth(
      await this.#requestJson("PUT", "/app/rest/server/authSettings", {}, body),
    );
  }
  public async getBackupStatus() {
    return {
      progress: system.safeText(
        await this.#request("GET", "/app/rest/server/backup", {}, undefined, "text/plain"),
      ),
      completionVerified: false,
    };
  }
  public async startBackup(name: string) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,100}$/.test(name))
      throw new Error("Expected a server-relative backup basename.");
    const fileName = await this.#request(
      "POST",
      "/app/rest/server/backup",
      {
        fileName: name,
        addTimestamp: "true",
        includeConfigs: "true",
        includeDatabase: "true",
        includeBuildLogs: "false",
        includePersonalChanges: "false",
        includeRunningBuilds: "false",
        includeSupplimentaryData: "false",
      },
      undefined,
      "text/plain",
    );
    return { fileName: system.safeText(fileName), scheduled: true, completionVerified: false };
  }
  public async getCleanup() {
    return system.safeCleanup(await this.#requestJson("GET", "/app/rest/server/cleanup"));
  }
  public async configureCleanup(value: unknown) {
    return system.safeCleanup(
      await this.#requestJson("PUT", "/app/rest/server/cleanup", {}, system.cleanupPatch(value)),
    );
  }
  public async getGlobalSettings() {
    return system.safeGlobal(await this.#requestJson("GET", "/app/rest/server/globalSettings"));
  }
  public async setGlobalSettings(value: unknown) {
    return system.safeGlobal(
      await this.#requestJson(
        "PUT",
        "/app/rest/server/globalSettings",
        {},
        system.globalPatch(value),
      ),
    );
  }
  public async getLicenseSummary() {
    return triage.safeScalars(
      await this.#requestJson("GET", "/app/rest/server/licensingData", {
        fields: system.licenseSummaryFields,
      }),
      system.licenseSummaryFields.split(","),
    );
  }
  public async listLicenses() {
    return system.collection(
      await this.#requestJson("GET", "/app/rest/server/licensingData/licenseKeys", {
        fields: `count,licenseKey(${system.licenseFields})`,
      }),
      "licenseKey",
      system.safeLicense,
    );
  }
  public async addLicense(alias: string, secrets: ScopedSecrets) {
    const value = await requireInputSecret(secrets, alias);
    return system.collection(
      await this.#textJson(
        "POST",
        "/app/rest/server/licensingData/licenseKeys",
        { fields: `count,licenseKey(${system.licenseFields})` },
        value,
      ),
      "licenseKey",
      system.safeLicense,
    );
  }
  public async getLicense(alias: string, secrets: ScopedSecrets) {
    const value = await requireInputSecret(secrets, alias);
    return system.safeLicense(
      await this.#requestJson(
        "GET",
        "/app/rest/server/licensingData/licenseKeys/" + pathSegment(value),
        { fields: system.licenseFields },
      ),
    );
  }
  public async deleteLicense(alias: string, secrets: ScopedSecrets) {
    const value = await requireInputSecret(secrets, alias);
    await this.#request(
      "DELETE",
      "/app/rest/server/licensingData/licenseKeys/" + pathSegment(value),
    );
    return { alias, deleted: true };
  }
  public async getMetrics() {
    return system.collection(
      await this.#requestJson("GET", "/app/rest/server/metrics", {
        fields: "count,metric(name,prometheusName,metricValues(metricValue(name,value)))",
      }),
      "metric",
      system.safeMetric,
    );
  }
  public async getPlugins() {
    return system.collection(
      await this.#requestJson("GET", "/app/rest/server/plugins", {
        fields: `count,plugin(${system.pluginFields})`,
      }),
      "plugin",
      system.safePlugin,
    );
  }
  public async getServerField(field: string) {
    allowedField(field, [
      "version",
      "versionMajor",
      "versionMinor",
      "buildNumber",
      "startTime",
      "currentTime",
      "role",
    ]);
    return {
      field,
      value: system.safeText(
        await this.#request("GET", "/app/rest/server/" + field, {}, undefined, "text/plain"),
      ),
    };
  }

  public async listFiles(
    kind: files.FileTree,
    id: string,
    path: string | undefined,
    count: number,
  ) {
    const suffix = path === undefined ? "" : "/" + files.remotePath(path);
    return files.safeFiles(
      await this.#requestJson("GET", files.treePath(kind, id) + suffix, {
        ...files.fileQuery(kind),
        locator: files.fileLocator(count),
        fields: `count,file(${files.fileFields})`,
      }),
    );
  }
  public async getFileMetadata(kind: files.FileTree, id: string, path: string) {
    return files.safeFile(
      await this.#requestJson(
        "GET",
        files.treePath(kind, id) + "/metadata/" + files.remotePath(path),
        { ...files.fileQuery(kind), fields: files.fileFields },
      ),
    );
  }
  public async downloadFile(
    kind: files.FileTree,
    id: string,
    path: string,
    archive: boolean,
    count: number,
    app: IAppArguments,
    options: DownloadOptions,
  ) {
    const requestPath =
      files.treePath(kind, id) + (archive ? "/archived/" : "/files/") + files.remotePath(path);
    const query = {
      ...files.fileQuery(kind),
      ...(archive ? { locator: files.fileLocator(count) } : {}),
    };
    return this.#download(requestPath, query, app, options, archive ? "zip" : "bytes");
  }
  public async downloadAvatar(
    id: string,
    size: number,
    hash: string | undefined,
    app: IAppArguments,
    options: DownloadOptions,
  ) {
    system.userId(id);
    system.integer(size, 2, 300);
    if (hash !== undefined && !/^[A-Za-z0-9_-]{1,128}$/.test(hash))
      throw new Error("Invalid avatar hash.");
    return this.#download(
      `/app/rest/avatars/id:${id}/${size}/avatar${hash === undefined ? "" : "." + hash}.png`,
      {},
      app,
      options,
      "png",
    );
  }
  public async downloadStatusIcon(
    id: string,
    aggregate: boolean,
    count: number,
    app: IAppArguments,
    options: DownloadOptions,
  ) {
    const locator = aggregate
      ? joinLocator(nestedId("buildType", id, "Job ID"), `count:${system.integer(count, 1, 100)}`)
      : "id:" + positiveId(Number(id), "Build ID");
    return this.#download(
      "/app/rest/builds/" + (aggregate ? "aggregated/" : "") + locator + "/statusIcon.svg",
      {},
      app,
      options,
      "svg",
    );
  }
  public async downloadSource(
    id: string,
    path: string,
    app: IAppArguments,
    options: DownloadOptions,
  ) {
    return this.#download(
      "/app/rest/builds/id:" +
        positiveId(Number(id), "Build ID") +
        "/sources/files/" +
        files.remotePath(path),
      {},
      app,
      options,
      "bytes",
    );
  }
  public async getSettingsPath(kind: "projects" | "jobs" | "roots", id: string) {
    const resource = kind === "jobs" ? "buildTypes" : kind === "roots" ? "vcs-roots" : "projects";
    return files.serverPath(
      await this.#request(
        "GET",
        "/app/rest/" + resource + "/" + idPath(id, "Owner ID") + "/settingsFile",
        {},
        undefined,
        "text/plain",
      ),
    );
  }
  public async getArtifactsPath(id: string) {
    return files.serverPath(
      await this.#request(
        "GET",
        "/app/rest/builds/id:" + positiveId(Number(id), "Build ID") + "/artifactsDirectory",
        {},
        undefined,
        "text/plain",
      ),
    );
  }
  public async createSecureReference(
    project: string,
    inputAlias: string,
    outputAlias: string,
    secrets: ScopedSecrets,
  ) {
    const path = "/app/rest/projects/" + idPath(project, "Project ID") + "/secure/tokens",
      key = files.referenceKey(outputAlias);
    await preflightSecretKeys(secrets, [key]);
    const value = await requireInputSecret(secrets, inputAlias);
    const reference = await this.#request("POST", path, {}, value, "text/plain");
    files.sensitiveSegment(reference);
    await persistSecretKeys(secrets, [key], [reference]);
    return { projectId: project, referenceAlias: outputAlias, stored: true };
  }
  public async resolveSecureReference(
    project: string,
    referenceAlias: string,
    outputAlias: string,
    secrets: ScopedSecrets,
  ) {
    const path = "/app/rest/projects/" + idPath(project, "Project ID") + "/secure/values/",
      key = inputSecretKey(outputAlias),
      referenceKey = files.referenceKey(referenceAlias);
    await preflightSecretKeys(secrets, [key]);
    let reference: string;
    try {
      reference = await secrets.require(referenceKey);
    } catch {
      throw new Error("Required secure reference is unavailable.");
    }
    const value = await this.#request(
      "GET",
      path + files.sensitiveSegment(reference),
      {},
      undefined,
      "text/plain",
    );
    await persistSecretKeys(secrets, [key], [value]);
    return { alias: outputAlias, stored: true };
  }
  public async resolveBuildParameter(
    id: string,
    name: string,
    alias: string,
    secrets: ScopedSecrets,
  ) {
    const buildId = positiveId(Number(id), "Build ID");
    if (!/^[A-Za-z0-9_.:-]{1,128}$/.test(name))
      throw new Error("Expected one parameter name, not an expression/value.");
    const expression = "%" + name + "%",
      key = inputSecretKey(alias);
    await preflightSecretKeys(secrets, [key]);
    const value = await this.#request(
      "GET",
      `/app/rest/builds/id:${buildId}/resolved/` + encodeURIComponent(expression),
      {},
      undefined,
      "text/plain",
    );
    if (value === expression)
      throw new Error("Build parameter remained unresolved; no value stored.");
    await persistSecretKeys(secrets, [key], [value]);
    return { alias, stored: true };
  }
  async #download(
    path: string,
    query: Record<string, string>,
    app: IAppArguments,
    options: DownloadOptions,
    format: files.DownloadFormat,
  ) {
    const accept = format === "png" ? "image/png" : format === "svg" ? "image/svg+xml" : "*/*";
    return saveDownload(
      app,
      options,
      format,
      () => this.#response("GET", path, query, undefined, accept),
      this.#signal,
    );
  }
  async #response(
    method: HttpMethod,
    path: string,
    query: Record<string, string> = {},
    body?: unknown,
    mediaType = "application/json",
    accept = mediaType,
  ): Promise<Response> {
    const requestPath = this.#guest
      ? path.replace(/^\/app\/rest(?=\/|$)/, "/guestAuth/app/rest")
      : path;
    const url = new URL(`${this.#baseUrl}${requestPath}`);
    for (const [name, value] of Object.entries(query)) {
      url.searchParams.set(name, value);
    }
    const headers: Record<string, string> = { Accept: accept };
    if (this.#token) {
      headers.Authorization = `Bearer ${this.#token}`;
    }
    if (body !== undefined && !(body instanceof FormData)) {
      headers["Content-Type"] = mediaType;
    }
    let response: Response;
    try {
      response = await this.#fetch(url, {
        method,
        headers,
        ...(body === undefined
          ? {}
          : {
              body:
                body instanceof FormData
                  ? body
                  : mediaType === "text/plain"
                    ? String(body)
                    : JSON.stringify(body),
            }),
        redirect: "error",
        ...(this.#signal === undefined ? {} : { signal: this.#signal }),
      });
    } catch {
      throw new Error("TeamCity network request failed; remote outcome is unknown.");
    }
    return response;
  }
  async #request(
    method: HttpMethod,
    path: string,
    query: Record<string, string> = {},
    body?: unknown,
    mediaType = "application/json",
    responseOptions: {
      accept?: string;
      discard?: boolean;
      expectedStatus?: number;
      requireMedia?: string;
    } = {},
  ): Promise<string> {
    const response = await this.#response(
      method,
      path,
      query,
      body,
      mediaType,
      responseOptions.accept,
    );
    if (!response.ok) {
      // Server diagnostics can echo submitted properties or credentials unrelated to our token.
      void response.body?.cancel().catch(() => undefined);
      throw new TeamCityHttpError(
        response.status,
        `TeamCity request failed with HTTP ${response.status}.`,
      );
    }
    if (
      responseOptions.expectedStatus !== undefined &&
      response.status !== responseOptions.expectedStatus
    ) {
      void response.body?.cancel().catch(() => undefined);
      throw new Error("TeamCity returned an unexpected success status; remote outcome is unknown.");
    }
    if (responseOptions.discard) {
      // Bounded drain works with intercepted/tee streams too; cancel the remainder without
      // waiting for a different tee consumer. Never decode, retain or expose these bytes.
      const reader = response.body?.getReader();
      if (reader) {
        let bytes = 0;
        try {
          while (bytes < 65536) {
            const chunk = await reader.read();
            if (chunk.done) break;
            bytes += chunk.value.byteLength;
          }
        } catch {
          throw new Error("TeamCity response stream failed; remote outcome is unknown.");
        } finally {
          void reader.cancel().catch(() => undefined);
          reader.releaseLock();
        }
      }
      return "";
    }
    if (
      responseOptions.requireMedia &&
      response.headers.get("Content-Type")?.split(";")[0]?.trim() !== responseOptions.requireMedia
    ) {
      void response.body?.cancel().catch(() => undefined);
      throw new Error("Unexpected TeamCity response media type.");
    }
    try {
      const bytes = await readBoundedResponseBody(response, {
        maxBytes: 2 * 1024 * 1024,
        signal: this.#signal,
      });
      return Buffer.from(bytes).toString("utf8");
    } catch {
      throw new Error(
        "TeamCity response stream failed or exceeded2MiB; remote outcome is unknown.",
      );
    }
  }
}

export type {
  TeamCityAgent,
  TeamCityBuild,
  TeamCityBuildState,
  TeamCityBuildStatus,
  TeamCityChange,
  TeamCityClientOptions,
  TeamCityJob,
  TeamCityPageOptions,
  TeamCityProblemOccurrence,
  TeamCityProject,
  TeamCityServer,
  TeamCityTestOccurrence,
  TeamCityTestStatus,
  TeamCityTriState,
  TeamCityUser,
} from "./models.js";
