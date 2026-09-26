export interface CliErrorOptions {
  /** Stable machine-readable reason, for example `build.failed`. */
  code: string;
  /** Process exit status for the ordinary CLI; defaults to 1. */
  exitCode?: number;
  /** The domain result of a failed outcome, kept for every caller. */
  result?: unknown;
  /** Follow-up argv of the same CLI, without the CLI name or `--profile`. */
  next?: readonly (readonly string[])[];
}

/** A command failure with a stable code; a failed outcome keeps its domain result. */
export class CliError extends Error {
  public readonly code: string;
  public readonly exitCode: number;
  public readonly result: unknown;
  public readonly next: readonly (readonly string[])[];
  /** The selected profile, recorded by Core for machine-readable follow-up commands. */
  public profile: string | undefined;

  public constructor(message: string, options: CliErrorOptions) {
    super(message);
    this.name = "CliError";
    if (!/^[a-z][A-Za-z0-9.-]*$/.test(options.code)) {
      throw new Error("CliError code must be a dotted lowercase-first identifier.");
    }
    const exitCode = options.exitCode ?? 1;
    if (!Number.isInteger(exitCode) || exitCode < 1 || exitCode > 255) {
      throw new Error("CliError exit code must be an integer from 1 to 255.");
    }
    this.code = options.code;
    this.exitCode = exitCode;
    this.result = options.result;
    this.next = options.next ?? [];
    this.profile = undefined;
  }
}
