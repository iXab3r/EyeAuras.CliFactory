import {
  recordView,
  tableView,
  type CommandDefinition,
  type HumanView,
  type ViewField,
} from "@eyeauras/cli-factory";
import type { TeamCityBuild, TeamCityBuildSummary } from "./models.js";
import { buildOutcome } from "./outcome.js";
import type { TeamCityPage } from "./paging.js";
import type { Diagnosis, DiagnosisSection, FollowedBuild } from "./build-flow.js";

const timestamp = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})([+-]\d{2})(\d{2})$/;

/** Parses TeamCity's compact timestamp for presentation; anything else is simply not shown. */
export function teamCityDate(value: string | undefined): Date | undefined {
  const match = value === undefined ? null : timestamp.exec(value);
  if (!match) return undefined;
  const [, year, month, day, hour, minute, second, zoneHour, zoneMinute] = match;
  const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}${zoneHour}:${zoneMinute}`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** A running build's intermediate status is not a result, so only finished builds show one. */
function result(build: TeamCityBuild): string {
  const outcome = buildOutcome(build);
  if (outcome === undefined) return "-";
  return outcome === "canceled" ? "CANCELED" : build.status ?? "UNKNOWN";
}

function elapsed(build: TeamCityBuild): number | undefined {
  const start = teamCityDate(build.startDate)?.getTime();
  if (start === undefined) return undefined;
  const end = build.state === "finished" ? teamCityDate(build.finishDate)?.getTime() : Date.now();
  return end === undefined ? undefined : end - start;
}

function title(build: TeamCityBuild): string {
  return [
    `Build ${build.id}${build.number === undefined ? "" : ` (#${build.number})`}`,
    build.buildTypeId,
    build.branchName,
  ].filter((part) => part !== undefined).join(" · ");
}

/** The summary fields of one build, taken from any result that contains it. */
function buildFields<Value>(select: (value: Value) => TeamCityBuild): ViewField<Value>[] {
  return [
    {
      label: "State",
      value: (value) => {
        const build = select(value);
        return build.state === "running" && build.percentageComplete !== undefined
          ? `running (${build.percentageComplete}%)`
          : build.state;
      },
    },
    {
      label: "Result",
      value: (value) => (select(value).state === "finished" ? result(select(value)) : undefined),
    },
    { label: "Status", value: (value) => select(value).statusText },
    { label: "Queue position", value: (value) => select(value).queuePosition },
    { label: "Wait reason", value: (value) => select(value).waitReason },
    { label: "Duration", value: (value) => elapsed(select(value)), format: "duration" },
    { label: "Agent", value: (value) => select(value).agent?.name },
    { label: "Web", value: (value) => select(value).webUrl },
  ];
}

/** What to run next for a build in its current state. */
function nextFor(build: TeamCityBuild): string[][] {
  const id = String(build.id);
  const outcome = buildOutcome(build);
  if (outcome === undefined) return [["builds", "wait", id]];
  return [
    ...(outcome === "failed" ? [["builds", "diagnose", id]] : []),
    ["builds", "artifacts", "list", id],
  ];
}

/** Whether a selection is complete, and how to continue it. */
function completeness(page: TeamCityPage<unknown>): string {
  const more = page.hasMore === true ? "yes" : page.hasMore === false ? "no" : "unknown";
  const next = page.nextStart === null ? "" : `; continue with --start ${page.nextStart}`;
  return `Shown: ${page.count}. More results: ${more}${next}.`;
}

export const buildTable = tableView<TeamCityBuild, TeamCityPage<TeamCityBuild>>({
  rows: (page) => page.items,
  footer: completeness,
  columns: [
    { header: "BUILD", value: (build) => build.id },
    { header: "JOB", value: (build) => build.buildTypeId },
    { header: "BRANCH", value: (build) => build.branchName, shrink: true },
    { header: "STATE", value: (build) => build.state },
    { header: "RESULT", value: result },
    {
      header: "AGE",
      value: (build) => teamCityDate(build.finishDate ?? build.startDate ?? build.queuedDate),
      format: "age",
    },
  ],
  empty: "No builds found.",
});

export const buildRecord = recordView<TeamCityBuild>({
  title,
  fields: buildFields((build) => build),
  next: nextFor,
});

/** `jobs run` and `builds wait`: the build, plus its outcome once it has one. */
export const followedRecord = recordView<FollowedBuild>({
  // "Queued" only while the new build still waits; a followed build shows its state instead.
  title: (value) => (value.accepted && value.build.state === "queued"
    ? `Queued: ${title(value.build)}`
    : title(value.build)),
  fields: [
    { label: "Outcome", value: (value) => value.outcome },
    ...buildFields<FollowedBuild>((value) => value.build),
  ],
  // A build that disappeared cannot be waited for or read again.
  next: (value) => (value.outcome === "missing" ? [] : nextFor(value.build)),
});

const reasons = { denied: "access denied", "not-found": "not found", failed: "read failed" };

function sectionTitle<T>(name: string, section: DiagnosisSection<T>, total?: number): string {
  if (section.status === "unavailable") return name;
  const shown = section.items.length;
  if (section.status === "complete") return `${name} (${shown})`;
  return `${name} (first ${shown}${total === undefined ? "; more exist" : ` of ${total}`})`;
}

function sectionLines<T>(section: DiagnosisSection<T>, line: (item: T) => string): string[] {
  return section.status === "unavailable"
    ? [`unavailable: ${reasons[section.reason]}`]
    : section.items.map(line);
}

function testCounts(build: TeamCityBuildSummary): string | undefined {
  const tests = build.testOccurrences;
  if (tests?.count === undefined) return undefined;
  return [
    `${tests.count} total`,
    `${tests.passed ?? 0} passed`,
    `${tests.failed ?? 0} failed (${tests.newFailed ?? 0} new)`,
    `${tests.muted ?? 0} muted`,
    `${tests.ignored ?? 0} ignored`,
  ].join(", ");
}

export const diagnosisRecord = recordView<Diagnosis>({
  title: (diagnosis) => title(diagnosis.build),
  fields: [
    ...buildFields<Diagnosis>((diagnosis) => diagnosis.build).filter((field) =>
      ["State", "Result", "Status", "Duration", "Web"].includes(field.label)),
    { label: "Tests", value: (diagnosis) => testCounts(diagnosis.build) },
    { label: "Partial", value: (diagnosis) => (diagnosis.partial ? "yes, see unavailable sections" : undefined) },
  ],
  sections: [
    {
      title: (diagnosis) =>
        sectionTitle("Problems", diagnosis.problems, diagnosis.build.problemOccurrences?.count),
      lines: (diagnosis) =>
        sectionLines(diagnosis.problems, (problem) =>
          `${problem.newFailure ? "(new) " : ""}${problem.type}: ` +
          `${(problem.description ?? problem.details ?? problem.identity).split(/\r?\n/, 1)[0]}`),
    },
    {
      title: (diagnosis) =>
        sectionTitle("Failed tests", diagnosis.failedTests, diagnosis.build.testOccurrences?.failed),
      lines: (diagnosis) =>
        sectionLines(diagnosis.failedTests, (test) =>
          `${test.name}${test.newFailure ? " (new)" : ""}${test.muted ? " (muted)" : ""}`),
    },
  ],
  next: (diagnosis) => {
    const id = String(diagnosis.build.id);
    return [
      ...(diagnosis.problems.status === "complete" && diagnosis.problems.items.length === 0
        ? []
        : [["builds", "problems", id]]),
      ...(diagnosis.failedTests.status === "complete" && diagnosis.failedTests.items.length === 0
        ? []
        : [["builds", "tests", id, "--status", "failure"]]),
    ];
  },
});

interface RemoteFile {
  name: string;
  size?: number;
  modificationTime?: string;
}

export const fileTable = tableView<RemoteFile, { items: readonly RemoteFile[] }>({
  rows: (listing) => listing.items,
  columns: [
    { header: "NAME", value: (file) => file.name },
    { header: "SIZE", value: (file) => file.size, format: "bytes" },
    { header: "MODIFIED", value: (file) => teamCityDate(file.modificationTime), format: "age" },
  ],
  empty: "No files found.",
});

interface SavedFile {
  path: string;
  bytes: number;
  sha256: string;
  mediaType?: string;
}

export const savedFileRecord = recordView<SavedFile>({
  title: () => "Saved in the selected profile's downloads directory",
  fields: [
    { label: "Path", value: (file) => file.path },
    { label: "Size", value: (file) => `${file.bytes} bytes` },
    { label: "SHA-256", value: (file) => file.sha256 },
    { label: "Media type", value: (file) => file.mediaType },
  ],
});

export function withView(view: HumanView, definition: CommandDefinition): CommandDefinition {
  return { ...definition, view };
}

type Layout = ReadonlyArray<readonly [group: string, names: readonly string[]]>;

/** Orders a branch's children for help: each named group in turn, then the rest under `rest`. */
export function helpLayout(
  layout: Layout,
  children: readonly CommandDefinition[],
  rest = "More",
): CommandDefinition[] {
  const nameOf = (child: CommandDefinition) => child.name.split(" ", 1)[0] ?? child.name;
  const placed = new Set<CommandDefinition>();
  const ordered = layout.flatMap(([group, names]) =>
    names.map((name) => {
      const child = children.find((candidate) => nameOf(candidate) === name);
      if (!child) throw new Error(`Help group '${group}' lists missing command '${name}'.`);
      placed.add(child);
      return { ...child, group };
    }),
  );
  return [
    ...ordered,
    ...children.filter((child) => !placed.has(child)).map((child) => ({ ...child, group: rest })),
  ];
}
