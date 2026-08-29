export interface TeamCityClientOptions {
  baseUrl: string;
  token: string;
  fetch?: typeof globalThis.fetch;
  signal?: AbortSignal;
}

export interface TeamCityUser {
  id: number;
  username: string;
  name?: string;
  email?: string;
}

export interface TeamCityJob {
  id: string;
  name: string;
  projectId: string;
  projectName: string;
  paused: boolean;
  webUrl?: string;
}

export interface TeamCityBuild {
  id: number;
  number: string;
  status: string;
  state: string;
  branchName?: string;
  webUrl?: string;
  startDate?: string;
  finishDate?: string;
}

interface BuildTypesResponse {
  buildType?: TeamCityJob[];
}

interface BuildsResponse {
  build?: TeamCityBuild[];
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
    this.#baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.#token = options.token;
    this.#fetch = options.fetch ?? globalThis.fetch;
    this.#signal = options.signal;
  }

  public currentUser(): Promise<TeamCityUser> {
    return this.#get<TeamCityUser>("/app/rest/users/current", {
      fields: "id,username,name,email",
    });
  }

  public async listJobs(options: { project?: string; limit?: number } = {}): Promise<TeamCityJob[]> {
    const locator = [
      options.project ? `project:(id:${options.project})` : undefined,
      `count:${options.limit ?? 100}`,
    ]
      .filter(Boolean)
      .join(",");
    const response = await this.#get<BuildTypesResponse>("/app/rest/buildTypes", {
      locator,
      fields: "count,buildType(id,name,projectId,projectName,paused,webUrl)",
    });
    return response.buildType ?? [];
  }

  public getJob(id: string): Promise<TeamCityJob> {
    return this.#get<TeamCityJob>(`/app/rest/buildTypes/id:${encodeURIComponent(id)}`, {
      fields: "id,name,projectId,projectName,paused,webUrl",
    });
  }

  public async getJobStatus(id: string): Promise<{
    jobId: string;
    latestBuild: TeamCityBuild | null;
  }> {
    const response = await this.#get<BuildsResponse>("/app/rest/builds", {
      locator: `buildType:(id:${id}),count:1`,
      fields:
        "count,build(id,number,status,state,branchName,webUrl,startDate,finishDate)",
    });
    return { jobId: id, latestBuild: response.build?.[0] ?? null };
  }

  async #get<T>(path: string, query: Record<string, string>): Promise<T> {
    const url = new URL(`${this.#baseUrl}${path}`);
    for (const [name, value] of Object.entries(query)) {
      url.searchParams.set(name, value);
    }
    const response = await this.#fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${this.#token}`,
      },
      ...(this.#signal === undefined ? {} : { signal: this.#signal }),
    });
    if (!response.ok) {
      const detail = (await response.text()).trim().slice(0, 300);
      const suffix = detail ? `: ${detail}` : "";
      throw new TeamCityHttpError(
        response.status,
        `TeamCity request failed with HTTP ${response.status}${suffix}`,
      );
    }
    return (await response.json()) as T;
  }
}
