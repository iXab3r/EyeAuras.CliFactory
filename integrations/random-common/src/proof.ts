import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test, { run } from "node:test";
import { spec } from "node:test/reporters";

import { liveCases, type LiveCase } from "./live-cases.js";

export { liveCases, type LiveCase } from "./live-cases.js";

/** Only a profile selector is user-supplied; command inventory is fixed above. */
export function parseProofProfile(
  argv: readonly string[],
  environment: NodeJS.ProcessEnv,
): string {
  if (
    [
      "CI",
      "GITHUB_ACTIONS",
      "TF_BUILD",
      "BUILD_BUILDID",
      "JENKINS_URL",
      "TEAMCITY_VERSION",
    ].some((key) => environment[key])
  ) {
    throw new Error("Profile proof is local-only and refuses CI environments.");
  }
  const profile = argv[1];
  if (
    argv.length !== 2 ||
    argv[0] !== "--profile" ||
    !profile ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(profile)
  ) {
    throw new Error("Usage: test:integration -- --profile <name>");
  }
  return profile;
}

type Invoke = (argv: string[]) => Promise<{ stdout: string; stderr: string }>;

/** Only return categorized diagnostics, never the subprocess error's captured output. */
function invocationFailure(error: unknown): Error {
  const stderr =
    typeof error === "object" &&
    error !== null &&
    "stderr" in error &&
    typeof error.stderr === "string"
      ? error.stderr
      : "";
  const status = /RANDOM\.ORG HTTP request failed \((\d{3})\)/.exec(
    stderr,
  )?.[1];
  const detail = status
    ? `HTTP ${status}`
    : stderr.includes("quota is exhausted")
      ? "quota exhausted; wait at least 10 minutes"
      : stderr.includes("request timed out")
        ? "request timed out"
        : stderr.includes("Check connectivity")
          ? "network connection failed"
          : stderr.includes("not configured")
            ? "profile is not configured"
            : stderr.includes("Permission 'ReadOnly' is disabled")
              ? "ReadOnly permission is disabled"
              : "process failed or returned an error";
  return new Error(
    `Packaged CLI failed: ${detail}. No further requests will be made.`,
  );
}

export const invokePackagedCli =
  (executable: URL): Invoke =>
  async (argv) => {
    return promisify(execFile)(
      process.execPath,
      [fileURLToPath(executable), ...argv],
      {
        encoding: "utf8",
        windowsHide: true,
        timeout: 255_000,
        maxBuffer: 65_536,
      },
    );
  };

export async function checkLiveCase(
  caseSpec: LiveCase,
  profile: string,
  invoke: Invoke,
): Promise<void> {
  let response: { stdout: string; stderr: string };
  try {
    response = await invoke([...caseSpec.argv, "--profile", profile, "--json"]);
  } catch (error) {
    throw invocationFailure(error);
  }
  if (response.stderr !== "")
    throw new Error(
      "CLI wrote unexpected diagnostics on successful execution.",
    );
  let result: unknown;
  try {
    result = JSON.parse(response.stdout);
  } catch {
    throw new Error("CLI stdout was not a single valid JSON value.");
  }
  const values =
    result && typeof result === "object" && "values" in result
      ? result.values
      : undefined;
  if (
    !Array.isArray(values) ||
    values.length !== caseSpec.count ||
    values.some(
      (value) =>
        !Number.isInteger(value) ||
        value < caseSpec.min ||
        value > caseSpec.max,
    ) ||
    (caseSpec.unique && new Set(values).size !== caseSpec.count)
  ) {
    throw new Error(
      "Random values failed count, range or uniqueness validation.",
    );
  }
}

export function runProof(testFile: URL): void {
  try {
    const profile = parseProofProfile(process.argv.slice(2), process.env);
    let completed = 0;
    run({
      files: [fileURLToPath(testFile)],
      argv: ["--profile", profile],
      concurrency: 1,
    })
      .on("test:pass", () => {
        completed++;
      })
      .on("test:fail", () => {
        process.exitCode = 1;
      })
      .on("end", () => {
        if (completed !== liveCases.length && process.exitCode !== 1) {
          process.stderr.write(
            "Live test runner did not execute its complete fixed inventory.\n",
          );
          process.exitCode = 1;
        }
      })
      .compose(spec)
      .pipe(process.stdout);
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : "Profile proof failed."}\n`,
    );
    process.exitCode = 1;
  }
}

export function registerLiveTests(executable: URL): void {
  const profile = parseProofProfile(process.argv.slice(2), process.env);
  let failed = false;
  for (const item of liveCases)
    test(
      item.name,
      { concurrency: false, timeout: 260000 },
      async (context) => {
        if (failed) {
          context.skip(
            "Earlier live test failed; no additional requests sent.",
          );
          return;
        }
        try {
          await checkLiveCase(item, profile, invokePackagedCli(executable));
        } catch (error) {
          failed = true;
          throw error;
        }
      },
    );
}
