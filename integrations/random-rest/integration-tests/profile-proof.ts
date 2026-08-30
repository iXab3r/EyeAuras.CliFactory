import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { run } from "node:test";
import { spec } from "node:test/reporters";

export interface LiveCase {
  name: string;
  argv: readonly string[];
  count: number;
  min: number;
  max: number;
  unique: boolean;
}

export const liveCases: readonly LiveCase[] = [
  { name: "integers: count and signed range", argv: ["integers", "--count", "5", "--min", "-3", "--max", "3"], count: 5, min: -3, max: 3, unique: false },
  { name: "integers: repeated values in a two-value range", argv: ["integers", "--count", "3", "--min", "0", "--max", "1"], count: 3, min: 0, max: 1, unique: false },
  { name: "sequence: entire signed interval without duplicates", argv: ["sequence", "--min", "-2", "--max", "2"], count: 5, min: -2, max: 2, unique: true },
  { name: "sequence: minimal two-item interval", argv: ["sequence", "--min", "0", "--max", "1"], count: 2, min: 0, max: 1, unique: true },
];

/** Only a profile selector is user-supplied; command inventory is fixed above. */
export function parseProofProfile(argv: readonly string[], environment: NodeJS.ProcessEnv): string {
  if (["CI", "GITHUB_ACTIONS", "TF_BUILD", "BUILD_BUILDID", "JENKINS_URL", "TEAMCITY_VERSION"].some((key) => environment[key])) {
    throw new Error("Profile proof is local-only and refuses CI environments.");
  }
  const profile = argv[1];
  if (argv.length !== 2 || argv[0] !== "--profile" || !profile || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(profile)) {
    throw new Error("Usage: test:integration -- --profile <name>");
  }
  return profile;
}

type Invoke = (argv: string[]) => Promise<{ stdout: string; stderr: string }>;

/** Only return categorized diagnostics, never the subprocess error's captured output. */
function invocationFailure(error: unknown): Error {
  const stderr = typeof error === "object" && error !== null && "stderr" in error && typeof error.stderr === "string"
    ? error.stderr : "";
  const status = /RANDOM\.ORG HTTP request failed \((\d{3})\)/.exec(stderr)?.[1];
  const detail = status ? `HTTP ${status}`
    : stderr.includes("quota is exhausted") ? "quota exhausted; wait at least 10 minutes"
    : stderr.includes("request timed out") ? "request timed out"
    : stderr.includes("Check connectivity") ? "network connection failed"
    : stderr.includes("not configured") ? "profile is not configured"
    : stderr.includes("Permission 'ReadOnly' is disabled") ? "ReadOnly permission is disabled"
    : "process failed or returned an error";
  return new Error(`Packaged CLI failed: ${detail}. No further requests will be made.`);
}

export const invokePackagedCli: Invoke = async (argv) => {
  const executable = fileURLToPath(new URL("../src/bin.js", import.meta.url));
  return promisify(execFile)(process.execPath, [executable, ...argv], {
    encoding: "utf8", windowsHide: true, timeout: 255_000, maxBuffer: 65_536,
  });
};

export async function checkLiveCase(caseSpec: LiveCase, profile: string, invoke: Invoke = invokePackagedCli): Promise<void> {
  let response: { stdout: string; stderr: string };
  try {
    response = await invoke([...caseSpec.argv, "--profile", profile, "--json"]);
  } catch (error) {
    throw invocationFailure(error);
  }
  if (response.stderr !== "") throw new Error("CLI wrote unexpected diagnostics on successful execution.");
  let result: unknown;
  try { result = JSON.parse(response.stdout); }
  catch { throw new Error("CLI stdout was not a single valid JSON value."); }
  const values = result && typeof result === "object" && "values" in result ? result.values : undefined;
  if (!Array.isArray(values) || values.length !== caseSpec.count ||
      values.some((value) => !Number.isInteger(value) || value < caseSpec.min || value > caseSpec.max) ||
      (caseSpec.unique && new Set(values).size !== caseSpec.count)) {
    throw new Error("Random values failed count, range or uniqueness validation.");
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const profile = parseProofProfile(process.argv.slice(2), process.env);
    let completed = 0;
    run({
      files: [fileURLToPath(new URL("./live.test.js", import.meta.url))],
      argv: ["--profile", profile],
      concurrency: 1,
    })
      .on("test:pass", () => { completed++; })
      .on("test:fail", () => { process.exitCode = 1; })
      .on("end", () => {
        if (completed !== liveCases.length && process.exitCode !== 1) {
          process.stderr.write("Live test runner did not execute its complete fixed inventory.\n");
          process.exitCode = 1;
        }
      })
      .compose(spec).pipe(process.stdout);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : "Profile proof failed."}\n`);
    process.exitCode = 1;
  }
}
