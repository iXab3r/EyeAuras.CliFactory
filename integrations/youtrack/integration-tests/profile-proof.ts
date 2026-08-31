import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

const executeFile = promisify(execFile);
const cliPath = fileURLToPath(new URL("../src/bin.js", import.meta.url));
type Invoker = (argv: readonly string[]) => Promise<string>;
type Endpoint =
  | "GET /api/users/me"
  | "GET /api/admin/projects"
  | "GET /api/issues"
  | "GET /api/issues/{issueID}"
  | "GET /api/issues/{issueID}/comments"
  | "GET /api/admin/projects/{projectID}"
  | "GET /api/admin/projects/{projectID}/customFields"
  | "GET /api/users"
  | "GET /api/issues/{issueID}/customFields"
  | "GET /api/issues/{issueID}/attachments"
  | "GET /api/issues/{issueID}/tags"
  | "GET /api/issues/{issueID}/links"
  | "GET /api/issues/{issueID}/timeTracking/workItems"
  | "GET /api/admin/customFieldSettings/customFields"
  | "GET /api/admin/customFieldSettings/bundles/user"
  | "GET /api/groups"
  | "GET /api/admin/projects/{projectID}/team"
  | "GET /api/admin/projects/{projectID}/timeTrackingSettings"
  | "GET /api/admin/timeTrackingSettings/workItemTypes"
  | "GET /api/agiles"
  | "GET /api/articles"
  | "GET /api/admin/customFieldSettings/bundles/build"
  | "GET /api/admin/customFieldSettings/bundles/ownedField"
  | "GET /api/admin/customFieldSettings/bundles/version";
interface ProofRow {
  endpoint: Endpoint;
  status: "PASS" | "FAIL" | "SKIP";
  count: number;
}
interface ProofResult {
  passed: boolean;
  rows: ProofRow[];
}

export function proofEnvironment(environment: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return Object.fromEntries(
    Object.entries(environment).filter(([name]) => name.toUpperCase() !== "YOUTRACK_TOKEN"),
  );
}

async function invokeCli(argv: readonly string[]): Promise<string> {
  const result = await executeFile(process.execPath, [cliPath, ...argv], {
    windowsHide: true,
    timeout: 30_000,
    maxBuffer: 64 * 1024,
    encoding: "utf8",
    env: proofEnvironment(process.env),
  });
  return result.stdout;
}

function hasId(value: unknown): value is { id: string } {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    "id" in value && typeof value.id === "string" && value.id.trim().length > 0 &&
    value.id.length <= 256 && !value.id.startsWith("-") && !/[\u0000-\u001f\u007f]/.test(value.id);
}

function isCollection(value: unknown): value is { id: string }[] {
  return Array.isArray(value) && value.length <= 3 && value.every(hasId);
}

export async function runProfileProof(
  argv: readonly string[],
  environment: NodeJS.ProcessEnv = process.env,
  invoke: Invoker = invokeCli,
): Promise<ProofResult> {
  const ciNames = ["CI", "GITHUB_ACTIONS", "TF_BUILD", "TEAMCITY_VERSION", "JENKINS_URL", "BUILDKITE"];
  if (Object.entries(environment).some(([name, value]) => value && ciNames.includes(name.toUpperCase()))) {
    throw new Error("YouTrack profile proof is local-only and refuses CI.");
  }
  const profile = argv[1];
  if (argv.length !== 2 || argv[0] !== "--profile" || !profile ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(profile) ||
      profile.toLowerCase() === "profiles.json") {
    throw new Error("Usage: test:integration -- --profile <name>");
  }

  const commonArgs = ["--profile", profile, "--json"];
  const rows: ProofRow[] = [];
  async function read(
    endpoint: Endpoint,
    command: readonly string[],
    valid: (value: unknown) => boolean,
  ): Promise<unknown> {
    try {
      const value: unknown = JSON.parse(await invoke([...command, ...commonArgs]));
      if (valid(value)) {
        rows.push({ endpoint, status: "PASS", count: Array.isArray(value) ? value.length : 1 });
        return value;
      }
    } catch {
      // Child errors can contain payloads, stderr, URLs or credentials. Never render them.
    }
    rows.push({ endpoint, status: "FAIL", count: 0 });
    return undefined;
  }

  await read("GET /api/users/me", ["user", "me"], (value) =>
    hasId(value) && "login" in value && typeof value.login === "string" && value.login.trim().length > 0);
  const page = ["--top", "3", "--skip", "0", "--fields", "id"];
  const projects = await read("GET /api/admin/projects", ["project", "list", "--top", "3", "--skip", "0"],
    (value) => isCollection(value) && value.every((project) =>
      "name" in project && typeof project.name === "string" &&
      "shortName" in project && typeof project.shortName === "string"));
  const issues = await read("GET /api/issues", ["issues", "list", ...page], isCollection);
  const issueId = isCollection(issues) ? issues[0]?.id : undefined;
  if (issueId !== undefined) {
    await read("GET /api/issues/{issueID}", ["issues", "get", issueId, "--fields", "id"],
      (value) => hasId(value) && value.id === issueId);
    await read("GET /api/issues/{issueID}/comments",
      ["issues", "comments", "list", issueId, ...page], isCollection);
  } else {
    rows.push(
      { endpoint: "GET /api/issues/{issueID}", status: "SKIP", count: 0 },
      { endpoint: "GET /api/issues/{issueID}/comments", status: "SKIP", count: 0 },
    );
  }
  const projectId = isCollection(projects) ? projects[0]?.id : undefined;
  if (projectId !== undefined) {
    await read("GET /api/admin/projects/{projectID}", ["project", "get", projectId, "--fields", "id"],
      (value) => hasId(value) && value.id === projectId);
    await read("GET /api/admin/projects/{projectID}/customFields",
      ["project", "field", "list", projectId, ...page], isCollection);
  } else {
    rows.push(
      { endpoint: "GET /api/admin/projects/{projectID}", status: "SKIP", count: 0 },
      { endpoint: "GET /api/admin/projects/{projectID}/customFields", status: "SKIP", count: 0 },
    );
  }
  await read("GET /api/users", ["user", "list", ...page], isCollection);
  const issueCollections: readonly [Endpoint, string][] = [
    ["GET /api/issues/{issueID}/customFields", "fields"],
    ["GET /api/issues/{issueID}/attachments", "attachments"],
    ["GET /api/issues/{issueID}/tags", "tags"],
    ["GET /api/issues/{issueID}/links", "links"],
    ["GET /api/issues/{issueID}/timeTracking/workItems", "work-items"],
  ];
  for (const [endpoint, resource] of issueCollections) {
    if (issueId !== undefined) {
      await read(endpoint, ["issues", resource, "list", issueId, ...page], isCollection);
    } else {
      rows.push({ endpoint, status: "SKIP", count: 0 });
    }
  }
  await read("GET /api/admin/customFieldSettings/customFields", ["field", "list", ...page], isCollection);
  await read("GET /api/admin/customFieldSettings/bundles/user", ["bundle", "user", "list", ...page], isCollection);
  await read("GET /api/groups", ["group", "list", ...page], isCollection);
  if (projectId !== undefined) {
    await read("GET /api/admin/projects/{projectID}/team",
      ["project", "team", "get", projectId, "--fields", "id"], hasId);
    await read("GET /api/admin/projects/{projectID}/timeTrackingSettings",
      ["project", "time-tracking", "get", projectId, "--fields", "id"], hasId);
  } else {
    rows.push(
      { endpoint: "GET /api/admin/projects/{projectID}/team", status: "SKIP", count: 0 },
      { endpoint: "GET /api/admin/projects/{projectID}/timeTrackingSettings", status: "SKIP", count: 0 },
    );
  }
  await read("GET /api/admin/timeTrackingSettings/workItemTypes", ["work-item-type", "list", ...page], isCollection);
  await read("GET /api/agiles", ["agile", "list", ...page], isCollection);
  await read("GET /api/articles", ["article", "list", ...page], isCollection);
  await read("GET /api/admin/customFieldSettings/bundles/build", ["bundle", "build", "list", ...page], isCollection);
  await read("GET /api/admin/customFieldSettings/bundles/ownedField", ["bundle", "owned", "list", ...page], isCollection);
  await read("GET /api/admin/customFieldSettings/bundles/version", ["bundle", "version", "list", ...page], isCollection);
  // SKIP means no request: an empty or failed prerequisite supplies no usable ID.
  // A failed prerequisite remains FAIL, so dependent skips cannot make the proof pass.
  return { passed: rows.every((row) => row.status !== "FAIL"), rows };
}

export function formatProfileProof(result: ProofResult): string {
  return result.rows.map((row) => `${row.status} ${row.endpoint}: ${row.count} records\n`).join("");
}

const entryUrl = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : undefined;
if (entryUrl === import.meta.url) {
  try {
    const result = await runProfileProof(process.argv.slice(2));
    process.stdout.write(formatProfileProof(result));
    process.exitCode = result.passed ? 0 : 1;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : "Proof refused."}\n`);
    process.exitCode = 2;
  }
}
