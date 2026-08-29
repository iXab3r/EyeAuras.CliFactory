import {
  idPath,
  joinLocator,
  nestedId,
  pageDimensions,
  positiveId,
  requiredText,
} from "./locator.js";
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
  readonly #token: string;
  readonly #fetch: typeof globalThis.fetch;
  readonly #signal: AbortSignal | undefined;

  public constructor(options: TeamCityClientOptions) {
    const baseUrl = options.baseUrl.trim().replace(/\/+$/, "");
    if (!baseUrl) {
      throw new Error("TeamCity base URL cannot be empty.");
    }
    this.#baseUrl = baseUrl;
    this.#token = options.token;
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
    const response = await this.#requestJson<ProjectsResponse>(
      "GET",
      "/app/rest/projects",
      {
        locator,
        fields: `project(${projectFields})`,
      },
    );
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
      options.project
        ? nestedId("project", options.project, "TeamCity project ID")
        : undefined,
      ...pageDimensions(options),
    );
    const response = await this.#requestJson<BuildTypesResponse>(
      "GET",
      "/app/rest/buildTypes",
      {
        locator,
        fields: `buildType(${jobFields})`,
      },
    );
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
      ...(change.internalVersion === undefined
        ? {}
        : { internalVersion: change.internalVersion }),
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
        options.project
          ? nestedId("project", options.project, "TeamCity project ID")
          : undefined,
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
    return this.#cancel(
      `/app/rest/builds/id:${positiveId(id, "TeamCity build ID")}`,
      options,
    );
  }

  public cancelQueuedBuild(
    id: number,
    options: CancelBuildOptions = {},
  ): Promise<TeamCityBuild> {
    return this.#cancel(
      `/app/rest/buildQueue/id:${positiveId(id, "TeamCity queued build ID")}`,
      options,
    );
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
    method: "GET" | "POST",
    path: string,
    query: Record<string, string> = {},
    body?: unknown,
  ): Promise<T> {
    const url = new URL(`${this.#baseUrl}${path}`);
    for (const [name, value] of Object.entries(query)) {
      url.searchParams.set(name, value);
    }
    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: `Bearer ${this.#token}`,
    };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    const response = await this.#fetch(url, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      ...(this.#signal === undefined ? {} : { signal: this.#signal }),
    });
    if (!response.ok) {
      let detail = "";
      try {
        detail = (await response.text()).replace(/\s+/g, " ").trim();
        if (this.#token) {
          detail = detail.replaceAll(this.#token, "[redacted]");
        }
        detail = detail.slice(0, 300);
      } catch {
        // Preserve the HTTP status even when the error response itself cannot be read.
      }
      const suffix = detail ? `: ${detail}` : "";
      throw new TeamCityHttpError(
        response.status,
        `TeamCity request failed with HTTP ${response.status}${suffix}`,
      );
    }

    const contents = await response.text();
    try {
      return JSON.parse(contents) as T;
    } catch (error) {
      throw new Error(`TeamCity response for ${path} was not valid JSON.`, { cause: error });
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
