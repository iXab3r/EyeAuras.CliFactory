import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createProofInvoker, parseProofProfile, type ProofInvoker } from "@eyeauras/cli-factory/proof";

const pageLimit = "3";

export interface ProofOptions {
  profile: string;
}

export interface ProofEntry {
  method: string;
  status: "passed" | "skipped" | "failed";
  detail: string;
}

export interface ProofReport {
  success: boolean;
  entries: readonly ProofEntry[];
}

export interface ProofDependencies {
  environment: NodeJS.ProcessEnv;
  invoke: ProofInvoker;
}

function objectValue(value: unknown, description: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${description} was not an object.`);
  }
  return value as Record<string, unknown>;
}

function arrayValue(value: unknown, description: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${description} was not an array.`);
  }
  return value;
}

function itemId(value: unknown): string | undefined {
  const item = objectValue(value, "List item");
  const id = item.id;
  return typeof id === "string" || typeof id === "number" ? String(id) : undefined;
}

function pageSummary(value: unknown, requireId = false): string {
  const items = arrayValue(value, "Collection response");
  if (items.length > Number(pageLimit)) {
    throw new Error("Collection response exceeded its requested limit.");
  }
  if (requireId && items.length > 0 && itemId(items[0]) === undefined) {
    throw new Error("Collection item ID is missing.");
  }
  return `${items.length} item(s)`;
}

export async function runProfileProof(
  options: ProofOptions,
  dependencies: ProofDependencies,
): Promise<ProofReport> {
  parseProofProfile(["--profile", options.profile], dependencies.environment);
  const entries: ProofEntry[] = [];

  const executeJson = async (
    method: string,
    argv: readonly string[],
    inspect: (value: unknown) => string,
  ): Promise<unknown | undefined> => {
    try {
      const stdout = await dependencies.invoke({
        argv: [...argv, "--profile", options.profile, "--json"],
      });
      const value: unknown = JSON.parse(stdout);
      entries.push({ method, status: "passed", detail: inspect(value) });
      return value;
    } catch {
      entries.push({ method, status: "failed", detail: "CLI failed or returned an invalid response" });
      return undefined;
    }
  };

  const skip = (method: string, detail: string): void => {
    entries.push({ method, status: "skipped", detail });
  };

  await executeJson("permissions list", ["permissions", "list"], (value) => {
    const permissions = arrayValue(value, "Permissions response").map((item) =>
      objectValue(item, "Permission"),
    );
    const readOnly = permissions.find((item) => item.name === "ReadOnly");
    if (readOnly?.enabled !== true) {
      throw new Error("ReadOnly permission is disabled.");
    }
    return "ReadOnly enabled";
  });
  await executeJson("auth status", ["auth", "status"], (value) => {
    if (objectValue(value, "Authentication response").authenticated !== true) {
      throw new Error("Profile is not authenticated.");
    }
    return "authenticated";
  });
  await executeJson("server status", ["server", "status"], (value) => {
    if (typeof objectValue(value, "Server response").version !== "string") {
      throw new Error("Server version is missing.");
    }
    return "response parsed";
  });

  const projects = await executeJson(
    "projects list",
    ["projects", "list", "--limit", pageLimit],
    (value) => pageSummary(value, true),
  );
  const projectItems = projects === undefined ? undefined : arrayValue(projects, "Projects response");
  const projectId = projectItems?.[0] === undefined ? undefined : itemId(projectItems[0]);
  if (projectId) {
    await executeJson("projects show", ["projects", "show", projectId], (value) => {
      objectValue(value, "Project response");
      return "response parsed";
    });
  } else {
    skip("projects show", projectItems === undefined ? "source list failed" : "source list empty");
  }

  const jobs = await executeJson(
    "jobs list",
    ["jobs", "list", "--limit", pageLimit],
    (value) => pageSummary(value, true),
  );
  const jobItems = jobs === undefined ? undefined : arrayValue(jobs, "Jobs response");
  const jobId = jobItems?.[0] === undefined ? undefined : itemId(jobItems[0]);
  if (jobId) {
    await executeJson("jobs show", ["jobs", "show", jobId], (value) => {
      objectValue(value, "Job response");
      return "response parsed";
    });
    await executeJson("jobs status", ["jobs", "status", jobId], (value) => {
      objectValue(value, "Job status response");
      return "response parsed";
    });
  } else {
    const reason = jobItems === undefined ? "source list failed" : "source list empty";
    skip("jobs show", reason);
    skip("jobs status", reason);
  }

  const builds = await executeJson(
    "builds list",
    ["builds", "list", "--limit", pageLimit],
    (value) => pageSummary(value, true),
  );
  const buildItems = builds === undefined ? undefined : arrayValue(builds, "Builds response");
  const buildId = buildItems?.[0] === undefined ? undefined : itemId(buildItems[0]);
  if (buildId) {
    await executeJson("builds show", ["builds", "show", buildId], (value) => {
      objectValue(value, "Build response");
      return "response parsed";
    });
    for (const diagnostic of ["tests", "problems", "changes"] as const) {
      await executeJson(
        `builds ${diagnostic}`,
        ["builds", diagnostic, buildId, "--limit", pageLimit],
        (value) => pageSummary(value),
      );
    }
  } else {
    const reason = buildItems === undefined ? "source list failed" : "source list empty";
    for (const method of ["builds show", "builds tests", "builds problems", "builds changes"]) {
      skip(method, reason);
    }
  }

  await executeJson(
    "queue list",
    ["queue", "list", "--limit", pageLimit],
    (value) => pageSummary(value),
  );

  const agents = await executeJson(
    "agents list",
    ["agents", "list", "--limit", pageLimit],
    (value) => pageSummary(value, true),
  );
  const agentItems = agents === undefined ? undefined : arrayValue(agents, "Agents response");
  const agentId = agentItems?.[0] === undefined ? undefined : itemId(agentItems[0]);
  if (agentId) {
    await executeJson("agents show", ["agents", "show", agentId], (value) => {
      objectValue(value, "Agent response");
      return "response parsed";
    });
  } else {
    skip("agents show", agentItems === undefined ? "source list failed" : "source list empty");
  }

  const roots = await executeJson(
    "vcs roots list", ["vcs", "roots", "list", "--limit", pageLimit],
    (value) => pageSummary(value, true),
  );
  const rootItems = roots === undefined ? undefined : arrayValue(roots, "VCS roots response");
  const rootId = rootItems?.[0] === undefined ? undefined : itemId(rootItems[0]);
  if (rootId) {
    await executeJson("vcs roots show", ["vcs", "roots", "show", rootId], (value) => {
      objectValue(value, "VCS root response");
      return "response parsed";
    });
  } else {
    skip("vcs roots show", rootItems === undefined ? "source list failed" : "source list empty");
  }

  const rpcInput = [
    {
      jsonrpc: "2.0",
      id: 1,
      method: "cli.execute",
      params: { argv: ["server", "status", "--profile", options.profile] },
    },
    {
      jsonrpc: "2.0",
      id: 2,
      method: "cli.execute",
      params: { argv: ["queue", "list", "--limit", "1", "--profile", options.profile] },
    },
  ]
    .map((frame) => JSON.stringify(frame))
    .join("\n");
  try {
    const stdout = await dependencies.invoke({
      argv: ["--json-rpc"],
      stdin: `${rpcInput}\n`,
    });
    const frames = stdout
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => objectValue(JSON.parse(line) as unknown, "JSON-RPC frame"));
    if (
      frames.length !== 2 ||
      frames[0]?.id !== 1 ||
      frames[1]?.id !== 2 ||
      frames.some((frame) => frame.jsonrpc !== "2.0" || "error" in frame || !("result" in frame))
    ) {
      throw new Error("Unexpected JSON-RPC response.");
    }
    if (
      typeof objectValue(frames[0]!.result, "JSON-RPC server response").version !== "string" ||
      arrayValue(frames[1]!.result, "JSON-RPC queue response").length > 1
    ) {
      throw new Error("Unexpected JSON-RPC result shape.");
    }
    entries.push({ method: "JSON-RPC session", status: "passed", detail: "2 responses" });
  } catch {
    entries.push({ method: "JSON-RPC session", status: "failed", detail: "invalid response" });
  }

  return {
    success: entries.length === 19 && entries.some((entry) => entry.status === "passed") &&
      entries.every((entry) => entry.status !== "failed"),
    entries,
  };
}

export function formatProofReport(report: ProofReport): string {
  const labels = { passed: "PASS", skipped: "SKIP", failed: "FAIL" } as const;
  const lines = report.entries.map(
    (entry) => `${labels[entry.status]} ${entry.method} — ${entry.detail}`,
  );
  const passed = report.entries.filter((entry) => entry.status === "passed").length;
  const skipped = report.entries.filter((entry) => entry.status === "skipped").length;
  const failed = report.entries.filter((entry) => entry.status === "failed").length;
  lines.push(`Summary: ${passed} passed, ${skipped} skipped, ${failed} failed`);
  return `${lines.join("\n")}\n`;
}

async function main(): Promise<void> {
  try {
    const profile = parseProofProfile(process.argv.slice(2));
    const report = await runProfileProof({ profile }, {
      environment: process.env,
      invoke: createProofInvoker({
        executable: new URL("../src/bin.js", import.meta.url),
        credentialEnvironment: ["TEAMCITY_TOKEN"],
      }),
    });
    process.stdout.write(formatProofReport(report));
    if (!report.success) {
      process.exitCode = 1;
    }
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : "Integration proof failed."}\n`);
    process.exitCode = 2;
  }
}

const entryUrl = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : undefined;
if (entryUrl === import.meta.url) {
  await main();
}
