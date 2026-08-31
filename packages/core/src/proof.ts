import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { assertProfileName } from "./profile-store.js";

const ciNames = new Set([
  "CI", "GITHUB_ACTIONS", "TF_BUILD", "BUILD_BUILDID", "TEAMCITY_VERSION", "JENKINS_URL", "BUILDKITE",
]);

function assertLocal(environment: NodeJS.ProcessEnv): void {
  if (Object.entries(environment).some(([name, value]) => value && ciNames.has(name.toUpperCase()))) {
    throw new Error("Profile proof is local-only and refuses CI environments.");
  }
}

/** Proof entry points accept only this selector, never commands, URLs or credentials. */
export function parseProofProfile(
  argv: readonly string[],
  environment: NodeJS.ProcessEnv = process.env,
): string {
  assertLocal(environment);
  const profile = argv[1];
  try {
    if (argv.length !== 2 || argv[0] !== "--profile" || !profile) throw new Error();
    assertProfileName(profile);
  } catch {
    throw new Error("Usage: test:integration -- --profile <name>");
  }
  return profile;
}

export interface ProofInvocation {
  argv: readonly string[];
  stdin?: string;
}

export type ProofInvoker = (invocation: ProofInvocation) => Promise<string>;

export interface ProofInvokerOptions {
  executable: URL;
  environment?: NodeJS.ProcessEnv;
  credentialEnvironment?: readonly string[];
  timeoutMs?: number;
  /** Separate byte limit for stdout and stderr, measured before UTF-8 decoding. */
  maxOutputBytes?: number;
}

/** Invoke a fixed, integration-owned inventory; this is not a user-argv passthrough. */
export function createProofInvoker(options: ProofInvokerOptions): ProofInvoker {
  const environment = options.environment ?? process.env;
  assertLocal(environment);
  const timeoutMs = options.timeoutMs ?? 30_000;
  const maxOutputBytes = options.maxOutputBytes ?? 65_536;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 2_147_483_647 ||
      !Number.isSafeInteger(maxOutputBytes) || maxOutputBytes <= 0) {
    throw new Error("Proof process limits must be positive finite integers within supported bounds.");
  }
  let executable: string;
  try {
    executable = fileURLToPath(options.executable);
  } catch {
    throw new Error("Proof executable must be a local file URL.");
  }
  const omitted = new Set(options.credentialEnvironment?.map(name => name.toUpperCase()));
  return async ({ argv, stdin }) => {
    assertLocal(environment);
    const env = Object.fromEntries(Object.entries(environment).filter(([name]) => !omitted.has(name.toUpperCase())));
    return new Promise<string>((resolve, reject) => {
      let child: ReturnType<typeof spawn>;
      try {
        child = spawn(process.execPath, [executable, ...argv], {
          stdio: ["pipe", "pipe", "pipe"], windowsHide: true, env,
        });
      } catch {
        reject(new Error("Proof CLI process could not start."));
        return;
      }
      const stdout: Buffer[] = [];
      let stdoutBytes = 0, stderrBytes = 0;
      let failure: Error | undefined;
      const fail = (message: string): void => {
        failure ??= new Error(message);
        child.kill("SIGKILL");
        child.stdin!.destroy();
        child.stdout!.destroy();
        child.stderr!.destroy();
      };
      const timer = setTimeout(() => fail("Proof CLI process timed out."), timeoutMs);
      child.once("error", () => fail("Proof CLI process could not start."));
      child.stdin!.once("error", () => fail("Proof CLI input failed."));
      child.stdout!.once("error", () => fail("Proof CLI output failed."));
      child.stderr!.once("error", () => fail("Proof CLI output failed."));
      child.stdout!.on("data", (chunk: Buffer) => {
        stdoutBytes += chunk.length;
        if (stdoutBytes > maxOutputBytes) fail("Proof CLI stdout exceeded its byte limit.");
        else stdout.push(chunk);
      });
      child.stderr!.on("data", (chunk: Buffer) => {
        stderrBytes += chunk.length;
        if (stderrBytes > maxOutputBytes) fail("Proof CLI stderr exceeded its byte limit.");
      });
      child.once("close", code => {
        clearTimeout(timer);
        if (failure) reject(failure);
        else if (code !== 0) reject(new Error("Proof CLI process exited unsuccessfully."));
        else resolve(Buffer.concat(stdout).toString("utf8"));
      });
      child.stdin!.end(stdin);
    });
  };
}
