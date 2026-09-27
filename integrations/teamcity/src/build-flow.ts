import { setTimeout as delay } from "node:timers/promises";
import {
  CliError,
  command,
  durationParser,
  Permission,
  type CommandContext,
  type OptionDefinition,
} from "@eyeauras/cli-factory";
import {
  TeamCityHttpError,
  TeamCityUnknownOutcomeError,
  type TeamCityClient,
} from "./client.js";
import { pairOption, positiveInteger } from "./command-support.js";
import type { PlainProperty } from "./authoring-models.js";
import type {
  TeamCityBuild,
  TeamCityBuildSummary,
  TeamCityFailedTest,
  TeamCityProblemOccurrence,
} from "./models.js";
import { buildOutcome, type BuildOutcome } from "./outcome.js";
import type { TeamCityPage } from "./paging.js";
import { buildRecord, diagnosisRecord, followedRecord, withView } from "./presentation.js";

type ClientFor = (context: CommandContext) => Promise<TeamCityClient>;

/** A build followed after it was queued or named: its last state and, once known, its outcome. */
export interface FollowedBuild {
  accepted?: true;
  build: TeamCityBuild;
  outcome?: BuildOutcome | "timedOut" | "missing" | "interrupted";
}

export type DiagnosisSection<T> =
  | { status: "complete" | "truncated"; items: T[] }
  | { status: "unavailable"; reason: "denied" | "not-found" | "failed" };

export interface DiagnosisProblem {
  id: string;
  type: string;
  identity: string;
  description?: string;
  details?: string;
  newFailure?: boolean;
  muted?: boolean;
}

export interface DiagnosisTest {
  id: string;
  name: string;
  newFailure?: boolean;
  muted?: boolean;
}

export interface Diagnosis {
  build: TeamCityBuildSummary;
  outcome?: BuildOutcome;
  problems: DiagnosisSection<DiagnosisProblem>;
  failedTests: DiagnosisSection<DiagnosisTest>;
  /** True when a section could not be read; missing data never means "no failures". */
  partial: boolean;
}

const problemLimit = 10;
const testLimit = 20;
const defaultTimeout = 10 * 60_000;
const defaultInterval = 5_000;

const waitOptions: readonly OptionDefinition[] = [
  {
    flags: "--timeout <duration>",
    description: "Stop waiting after this long, such as 30s, 10m or 1h (default 10m); " +
      "the build keeps running",
    parse: durationParser({
      min: 1_000, max: 24 * 3_600_000,
      errorMessage: "Timeout must be a duration from 1s to 24h, such as 10m.",
    }),
  },
  {
    flags: "--interval <duration>",
    description: "Time between status reads (default 5s)",
    parse: durationParser({
      min: 1_000, max: 10 * 60_000,
      errorMessage: "Interval must be a duration from 1s to 10m, such as 5s.",
    }),
  },
];

function optionalString(values: Record<string, unknown>, key: string): string | undefined {
  return typeof values[key] === "string" ? values[key] : undefined;
}

function pause(options: Record<string, unknown>) {
  return {
    timeout: typeof options.timeout === "number" ? options.timeout : defaultTimeout,
    interval: typeof options.interval === "number" ? options.interval : defaultInterval,
  };
}

function describe(build: TeamCityBuild): string {
  if (build.state === "queued" && build.queuePosition !== undefined) {
    return `queued (position ${build.queuePosition})`;
  }
  return build.state === "finished" ? `finished: ${buildOutcome(build) ?? "unknown"}` : build.state;
}

/**
 * One client for the whole command, so queueing and waiting share one profile and credential.
 * Its requests stop at an interrupt, or at the deadline once `follow` starts it.
 */
async function commandClient(clientFor: ClientFor, context: CommandContext) {
  const stop = new AbortController();
  const signal = AbortSignal.any([context.signal, stop.signal]);
  return { client: await clientFor({ ...context, signal }), stop };
}

/**
 * Follow one build until it finishes. The deadline starts here and also bounds each read of
 * `client`. Reads only: it never cancels the build, and an interrupt or deadline only stops
 * local observation.
 */
async function follow(
  { client, stop }: Awaited<ReturnType<typeof commandClient>>,
  context: CommandContext,
  id: number,
  timing: { timeout: number; interval: number },
  shape: (build: TeamCityBuild, outcome?: FollowedBuild["outcome"]) => FollowedBuild,
  known?: TeamCityBuild,
): Promise<FollowedBuild> {
  const deadline = AbortSignal.timeout(timing.timeout);
  const expire = () => stop.abort();
  deadline.addEventListener("abort", expire, { once: true });
  try {
    return await observe(client, deadline, context, id, timing, shape, known);
  } finally {
    // An unfired timeout with a listener stays alive until it fires, which can take hours.
    deadline.removeEventListener("abort", expire);
  }
}

async function observe(
  client: TeamCityClient,
  deadline: AbortSignal,
  context: CommandContext,
  id: number,
  timing: { timeout: number; interval: number },
  shape: (build: TeamCityBuild, outcome?: FollowedBuild["outcome"]) => FollowedBuild,
  known?: TeamCityBuild,
): Promise<FollowedBuild> {
  const signal = AbortSignal.any([context.signal, deadline]);
  const resume = [["builds", "wait", String(id)]];
  let last = known;
  let reported: string | undefined;
  const stopped = (error: unknown): never => {
    if (context.signal.aborted) {
      throw new CliError(`Stopped waiting for build ${id}; it continues on the server.`, {
        code: "wait.interrupted", exitCode: 130, next: resume,
        ...(last === undefined ? {} : { result: shape(last, "interrupted") }),
      });
    }
    if (deadline.aborted) {
      throw new CliError(
        `Build ${id} did not finish in time; it continues on the server and was not canceled.`,
        { code: "wait.timeout", exitCode: 124, next: resume,
          ...(last === undefined ? {} : { result: shape(last, "timedOut") }) },
      );
    }
    if (last === undefined) throw error;
    if (error instanceof TeamCityHttpError && error.status === 404) {
      throw new CliError(`Build ${id} is no longer available on the server.`, {
        code: "build.missing", result: shape(last, "missing"),
      });
    }
    throw new CliError(`Reading build ${id} failed; it may still be running.`, {
      code: "wait.failed", next: resume, result: shape(last),
    });
  };
  for (;;) {
    let build: TeamCityBuild;
    try {
      build = await client.getBuild(id);
    } catch (error) {
      return stopped(error);
    }
    last = build;
    const state = describe(build);
    if (state !== reported) context.progress(`Build ${id}: ${state}`);
    reported = state;
    const outcome = buildOutcome(build);
    if (outcome === "succeeded") return shape(build, outcome);
    if (outcome !== undefined) {
      const message = {
        failed: `Build ${id} finished with FAILURE.`,
        canceled: `Build ${id} was canceled.`,
        unknown: `Build ${id} finished without a known result.`,
      }[outcome];
      throw new CliError(message, { code: `build.${outcome}`, result: shape(build, outcome) });
    }
    try {
      await delay(timing.interval, undefined, { signal });
    } catch (error) {
      return stopped(error);
    }
  }
}

async function section<T, R>(
  context: CommandContext,
  read: () => Promise<TeamCityPage<T>>,
  project: (item: T) => R,
): Promise<DiagnosisSection<R>> {
  try {
    const page = await read();
    // Only a confirmed end is complete: more items, or an unknown rest, is truncated.
    return { status: page.hasMore === false ? "complete" : "truncated", items: page.items.map(project) };
  } catch (error) {
    // A stop is reported as such, never with a section's partial page as the result.
    if (context.signal.aborted) throw new Error("The diagnosis was stopped.");
    const status = error instanceof TeamCityHttpError ? error.status : undefined;
    return {
      status: "unavailable",
      reason: status === 401 || status === 403 ? "denied" : status === 404 ? "not-found" : "failed",
    };
  }
}

function problem(value: TeamCityProblemOccurrence): DiagnosisProblem {
  return {
    id: value.id,
    type: value.type,
    identity: value.identity,
    ...(value.problem?.description === undefined ? {} : { description: value.problem.description }),
    ...(value.details === undefined ? {} : { details: value.details }),
    ...(value.newFailure === undefined ? {} : { newFailure: value.newFailure }),
    ...(value.currentlyMuted === undefined ? {} : { muted: value.currentlyMuted }),
  };
}

function failedTest(value: TeamCityFailedTest): DiagnosisTest {
  const muted = value.muted === true || value.currentlyMuted === true;
  return {
    id: value.id,
    name: value.name,
    ...(value.newFailure === undefined ? {} : { newFailure: value.newFailure }),
    ...(muted ? { muted } : {}),
  };
}

export function createBuildFlowCommands(clientFor: ClientFor) {
  const show = withView(buildRecord, command(
    "show [build-id]",
    "Show one build by ID, or the latest finished build of a job with --job and --latest",
    async ({ args, options }, context) => {
      const id = optionalString(args, "build-id");
      const job = optionalString(options, "job");
      const branch = optionalString(options, "branch");
      if (options.latest !== true) {
        if (job !== undefined || branch !== undefined)
          throw new Error("--job and --branch select a build only together with --latest.");
        if (id === undefined) throw new Error("Specify a build ID, or --job <id> --latest.");
        return (await clientFor(context)).getBuild(positiveInteger(id));
      }
      if (id !== undefined) throw new Error("Use either a build ID or --latest, not both.");
      if (job === undefined) throw new Error("--latest requires --job <id>.");
      const build = await (await clientFor(context)).getLatestFinishedBuild(job, branch);
      if (build === undefined) throw new Error("No finished build matches this job and branch.");
      context.progress(
        `Latest finished build on ${branch === undefined ? "all branches" : "the selected branch"}: ${build.id}`,
      );
      return build;
    },
    {
      permission: Permission.ReadOnly,
      options: [
        { flags: "--job <id>", description: "With --latest: the job whose builds to search" },
        {
          flags: "--branch <name>",
          description: "With --latest: one branch; all branches when omitted",
        },
        {
          flags: "--latest",
          description: "Select the newest finished, non-personal build of --job, whatever its result",
        },
      ],
    },
  ));

  const wait = withView(followedRecord, command(
    "wait <build-id>",
    "Wait for a build to finish; exits 1 unless it succeeded and 124 when time runs out",
    async ({ args, options }, context) => {
      const id = positiveInteger(args["build-id"]);
      return follow(await commandClient(clientFor, context), context, id, pause(options),
        (build, outcome) => ({ build, ...(outcome === undefined ? {} : { outcome }) }));
    },
    { permission: Permission.ReadOnly, options: waitOptions },
  ));

  const diagnose = withView(diagnosisRecord, command(
    "diagnose <build-id>",
    `Summarize a build: state, up to ${problemLimit} problems and ${testLimit} failed tests; no logs`,
    async ({ args }, context) => {
      const id = positiveInteger(args["build-id"]);
      const client = await clientFor(context);
      const build = await client.getBuildSummary(id);
      const [problems, failedTests] = await Promise.all([
        section(context, () => client.listBuildProblems(id, { limit: problemLimit }), problem),
        section(context, () => client.listFailedTests(id, testLimit), failedTest),
      ]);
      const outcome = buildOutcome(build);
      const diagnosis: Diagnosis = {
        build,
        ...(outcome === undefined ? {} : { outcome }),
        problems,
        failedTests,
        partial: problems.status === "unavailable" || failedTests.status === "unavailable",
      };
      if (diagnosis.partial) {
        throw new CliError("Some diagnostics could not be read; the summary is partial.", {
          code: "diagnose.partial", result: diagnosis,
        });
      }
      return diagnosis;
    },
    { permission: Permission.ReadOnly },
  ));

  const run = withView(followedRecord, command(
    "run <job-id>",
    "Queue one build; --wait follows it to its result",
    async ({ args, options }, context) => {
      const job = args["job-id"];
      const properties = (options.param ?? []) as PlainProperty[];
      if (options.wait !== true && (options.timeout !== undefined || options.interval !== undefined))
        throw new Error("--timeout and --interval apply only with --wait.");
      const branch = optionalString(options, "branch");
      const comment = optionalString(options, "comment");
      const session = await commandClient(clientFor, context);
      let queued: TeamCityBuild;
      try {
        queued = await session.client.runJob(job, {
          ...(branch === undefined ? {} : { branch }),
          ...(comment === undefined ? {} : { comment }),
          properties,
        });
      } catch (error) {
        if (!(error instanceof TeamCityUnknownOutcomeError)) throw error;
        // Never queue again automatically: the first request may already have been accepted.
        // An accepted build can leave the queue within seconds, so the check covers every state.
        // The job-wide check stays even with a branch, which a person's view may have to omit.
        const check = ["builds", "list", "--job", job];
        throw new CliError(
          "The queue request's outcome is unknown; check for a new build before running it again.",
          {
            code: "run.unknownOutcome",
            next: [
              ...(branch === undefined ? [] : [[...check, "--branch", branch, "--state", "any"]]),
              [...check, "--state", "any"],
            ],
          },
        );
      }
      if (options.wait !== true) return { accepted: true, build: queued };
      return follow(session, context, queued.id, pause(options), (build, outcome) => ({
        accepted: true, build, ...(outcome === undefined ? {} : { outcome }),
      }), queued);
    },
    {
      permission: Permission.Update,
      options: [
        {
          flags: "--branch <name>",
          description: "Branch to build; the job's default branch when omitted",
        },
        { flags: "--comment <text>", description: "Attach a queue comment" },
        pairOption(
          "--param",
          "One-off parameter for this build only, such as env.MODE=test; repeat; never secrets",
        ),
        { flags: "--wait", description: "Wait for the result; exits 1 unless it succeeded" },
        ...waitOptions,
      ],
    },
  ));

  return { show, wait, diagnose, run };
}
