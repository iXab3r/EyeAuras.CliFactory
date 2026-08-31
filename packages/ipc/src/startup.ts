// Private child exit codes: diagnostics cross the process boundary without raw errors.
const failures = {
  definition: [
    70,
    "CLI host could not create its application definition. Check createDefinition in the host process.",
  ],
  storage: [
    71,
    "CLI host could not access its runtime storage. Check AppData permissions and conflicting files.",
  ],
  ownership: [
    72,
    "CLI host could not acquire ownership. Check ipc-server status or stop the existing owner before retrying.",
  ],
  endpoint: [
    73,
    "CLI host could not bind or secure its IPC endpoint. Check endpoint access and conflicting processes.",
  ],
  build: [
    74,
    "CLI host could not validate its build. Run npm run build before retrying.",
  ],
} as const;

export class StartupFailure extends Error {
  readonly exitCode: number;
  constructor(phase: keyof typeof failures) {
    super(failures[phase][1]);
    this.exitCode = failures[phase][0];
  }
}

export async function startup<T>(
  phase: keyof typeof failures,
  action: () => T | Promise<T>,
): Promise<T> {
  try {
    return await action();
  } catch {
    throw new StartupFailure(phase);
  }
}

export const ownershipExitCode = failures.ownership[0];
export function startupMessage(code: number | null): string {
  return (
    Object.values(failures).find(([value]) => value === code)?.[1] ??
    "CLI host exited before becoming ready. Check the executable and its runtime dependencies."
  );
}
