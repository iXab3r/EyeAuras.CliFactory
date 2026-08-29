export interface TeamCityClientOptions {
  baseUrl: string;
  token?: string;
  guest?: boolean;
  fetch?: typeof globalThis.fetch;
  signal?: AbortSignal;
}

export interface TeamCityUser {
  id: number;
  username: string;
  name?: string;
  email?: string;
}

export interface TeamCityServer {
  version: string;
  versionMajor: number;
  versionMinor: number;
  buildNumber: string;
  startTime: string;
  currentTime: string;
  role: string;
  webUrl: string;
}

export interface TeamCityProject {
  id: string;
  name: string;
  parentProjectId?: string;
  archived: boolean;
  description?: string;
  webUrl?: string;
}

export interface TeamCityJob {
  id: string;
  name: string;
  projectId: string;
  projectName: string;
  paused: boolean;
  description?: string;
  webUrl?: string;
}

export interface TeamCityBuildAgent {
  id: number;
  name: string;
}

export interface TeamCityBuild {
  id: number;
  buildTypeId?: string;
  number?: string;
  state: string;
  status?: string;
  statusText?: string;
  branchName?: string;
  defaultBranch?: boolean;
  personal?: boolean;
  queuedDate?: string;
  startDate?: string;
  finishDate?: string;
  percentageComplete?: number;
  queuePosition?: number;
  waitReason?: string;
  webUrl?: string;
  agent?: TeamCityBuildAgent;
}

export interface TeamCityPageOptions {
  limit?: number;
  start?: number;
}

export type TeamCityBuildState = "queued" | "running" | "finished" | "any";
export type TeamCityBuildStatus = "SUCCESS" | "FAILURE" | "UNKNOWN";
export type TeamCityTestStatus =
  | "unknown"
  | "normal"
  | "warning"
  | "failure"
  | "error"
  | "success";
export type TeamCityTriState = "true" | "false" | "any";

export interface TeamCityTestOccurrence {
  id: string;
  name: string;
  status: string;
  duration?: number;
  ignored?: boolean;
  newFailure?: boolean;
  muted?: boolean;
  currentlyMuted?: boolean;
  currentlyInvestigated?: boolean;
  details?: string;
}

export interface TeamCityProblem {
  id: string;
  type: string;
  identity: string;
  description?: string;
}

export interface TeamCityProblemOccurrence {
  id: string;
  type: string;
  identity: string;
  newFailure?: boolean;
  currentlyMuted?: boolean;
  currentlyInvestigated?: boolean;
  logAnchor?: string;
  details?: string;
  problem?: TeamCityProblem;
}

export interface TeamCityChange {
  id: number;
  version: string;
  internalVersion?: string;
  date: string;
  commitDate?: string;
  comment?: string;
  webUrl?: string;
  committer?: string;
}

export interface TeamCityAgent {
  id: number;
  name: string;
  connected: boolean;
  enabled: boolean;
  authorized: boolean;
  uptodate?: boolean;
  webUrl?: string;
  build?: TeamCityBuild;
}
