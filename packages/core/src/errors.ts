import { AsyncLocalStorage } from "node:async_hooks";

const diagnosticSecrets = new AsyncLocalStorage<Set<string>>();

/** Invocation-local values, never shared across profiles or concurrent commands. */
export function withDiagnostics<T>(run: () => T): T {
  return diagnosticSecrets.run(new Set(), run);
}

export function rememberSecret(value: string | undefined): void {
  const store = diagnosticSecrets.getStore();
  if (!value || !store) return;
  store.add(value);
  // A secure record can contain several credential values rather than one opaque token.
  if (/^[\[{]/.test(value.trim())) {
    try {
      const pending: unknown[] = [JSON.parse(value)];
      while (pending.length) {
        const item = pending.pop();
        if (typeof item === "string" && item) store.add(item);
        else if (item && typeof item === "object") pending.push(...Object.values(item));
      }
    } catch { /* An opaque secret need not be JSON. */ }
  }
}

function redact(text: string, secrets: readonly string[] = []): string {
  const values = [...(diagnosticSecrets.getStore() ?? []), ...secrets].filter(Boolean);
  for (const value of values.sort((a, b) => b.length - a.length)) {
    let encoded = value;
    try { encoded = encodeURIComponent(value); } catch { /* Ill-formed Unicode is still redacted literally. */ }
    for (const spelling of new Set([value, value.trim(), encoded, JSON.stringify(value).slice(1, -1)])) {
      if (spelling) text = text.replaceAll(spelling, "[redacted]");
    }
  }
  return text
    .replace(/https?:\/\/[^\s<>"']+/gi, raw => {
      try {
        const url = new URL(raw);
        if (url.username || url.password) { url.username = "redacted"; url.password = ""; }
        url.pathname = url.pathname.split("/").map(segment => {
          const decoded = decodeURIComponent(segment);
          return /^(?:sign|signature|token|secret|api[-_]?key)=/i.test(decoded)
            ? decoded.slice(0, decoded.indexOf("=") + 1) + "redacted" : segment;
        }).join("/");
        for (const key of new Set(url.searchParams.keys())) url.searchParams.set(key, "redacted");
        if (url.hash) url.hash = "redacted";
        return url.toString();
      } catch { return "[redacted URL]"; }
    })
    .replace(/\b((?:set-)?cookie\s*[:=]\s*)[^\r\n]*/gi, "$1[redacted]")
    .replace(/\b(Bearer|Basic)\s+[^\s,;"']+/gi, "$1 [redacted]")
    .replace(/((?:password|passwd|token|secret|api[-_]?key|authorization|cookie|signature)\s*[=:]\s*)(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s,;]+)/gi, "$1[redacted]");
}

/** Copy only diagnostic fields; never retain arbitrary payloads attached to native errors. */
export function diagnosticCause(value: unknown, secrets: readonly string[] = [], message?: string): Error {
  const seen = new WeakSet<object>();
  const copy = (source: unknown, override?: string): Error => {
    if (!(source instanceof Error)) return new Error(`A non-Error value was thrown (${typeof source}).`);
    if (seen.has(source)) return new Error("[Circular or repeated error reference]");
    seen.add(source);
    const result = source instanceof AggregateError ? new AggregateError([], "") : new Error();
    result.name = redact(source.name, secrets);
    result.message = redact(override ?? source.message, secrets);
    // Preserve source locations, replacing the entire original header (possibly multiline).
    const header = `${source.name}: ${source.message}`;
    const frames = source.stack?.startsWith(header)
      ? source.stack.slice(header.length)
      : source.stack?.split("\n").filter(line => /^\s+at /.test(line)).join("\n");
    result.stack = `${result.name}: ${result.message}${frames ? (frames.startsWith("\n") ? "" : "\n") + redact(frames, secrets) : ""}`;
    const code = (source as NodeJS.ErrnoException).code;
    if (typeof code === "string" || typeof code === "number") Object.assign(result, { code: typeof code === "string" ? redact(code, secrets) : code });
    if (source.cause !== undefined) result.cause = copy(source.cause);
    if (source instanceof AggregateError) (result as AggregateError).errors = source.errors.map(error => copy(error));
    return result;
  };
  return copy(value, message);
}

export interface CliErrorOptions {
  /** Stable machine-readable reason, for example `build.failed`. */
  code: string;
  /** Process exit status for the ordinary CLI; defaults to 1. */
  exitCode?: number;
  /** The domain result of a failed outcome, kept for every caller. */
  result?: unknown;
  /** Follow-up argv of the same CLI, without the CLI name or `--profile`. */
  next?: readonly (readonly string[])[];
  /** Original failure, retained with redacted diagnostics. */
  cause?: unknown;
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
    super(redact(message), options.cause === undefined ? undefined : { cause: diagnosticCause(options.cause) });
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

/** The machine form of any failure; `next` argv already select the same profile. */
export interface MachineError {
  code: string;
  message: string;
  exitCode: number;
  profile?: string;
  next?: string[][];
  name?: string;
  stack?: string;
  cause?: ErrorDiagnostic;
  errors?: ErrorDiagnostic[];
}

export interface ErrorDiagnostic {
  name: string;
  message: string;
  code?: string | number;
  stack?: string;
  cause?: ErrorDiagnostic;
  errors?: ErrorDiagnostic[];
}

function diagnostic(error: Error): ErrorDiagnostic {
  const code = (error as NodeJS.ErrnoException).code;
  return {
    name: error.name, message: error.message,
    ...(code === undefined ? {} : { code }),
    ...(error.stack === undefined ? {} : { stack: error.stack }),
    ...(error.cause instanceof Error ? { cause: diagnostic(error.cause) } : {}),
    ...(error instanceof AggregateError ? { errors: error.errors.map(diagnostic) } : {}),
  };
}

export function diagnosticText(error: MachineError): string {
  const lines: string[] = [];
  const append = (value: ErrorDiagnostic, label: string): void => {
    lines.push(`${label}${value.name}${value.code ? ` [${value.code}]` : ""}: ${value.message}`);
    if (value.stack) lines.push(...value.stack.split("\n").slice(1));
    if (value.cause) append(value.cause, "Caused by: ");
    for (const child of value.errors ?? []) append(child, "Related error: ");
  };
  if (error.stack) lines.push(...error.stack.split("\n").slice(1));
  if (error.cause) append(error.cause, "Caused by: ");
  for (const child of error.errors ?? []) append(child, "Related error: ");
  return lines.length ? lines.join("\n") + "\n" : "";
}

export function machineError(error: unknown): MachineError {
  const details = diagnostic(diagnosticCause(error));
  const verbose = !(error instanceof CliError) || error.cause !== undefined;
  const evidence = verbose ? {
    name: details.name, stack: details.stack,
    ...(details.cause ? { cause: details.cause } : {}),
    ...(details.errors ? { errors: details.errors } : {}),
  } : {};
  if (!(error instanceof CliError)) {
    return { code: "error", message: details.message, exitCode: 1, ...evidence,
      ...(details.code === undefined ? {} : { cause: details }),
    };
  }
  const profile = error.profile;
  return {
    code: error.code,
    message: details.message,
    exitCode: error.exitCode,
    ...(profile === undefined ? {} : { profile }),
    ...(error.next.length === 0
      ? {}
      : { next: error.next.map((argv) => (profile === undefined ? [...argv] : [...argv, "--profile", profile])) }),
    ...evidence,
  };
}
