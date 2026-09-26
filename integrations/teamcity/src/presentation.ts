import {
  recordView,
  tableView,
  type CommandDefinition,
  type HumanView,
} from "@eyeauras/cli-factory";
import type { TeamCityBuild } from "./models.js";

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
  return build.state === "finished" ? build.status ?? "UNKNOWN" : "-";
}

function elapsed(build: TeamCityBuild): number | undefined {
  const start = teamCityDate(build.startDate)?.getTime();
  if (start === undefined) return undefined;
  const end = build.state === "finished" ? teamCityDate(build.finishDate)?.getTime() : Date.now();
  return end === undefined ? undefined : end - start;
}

export const buildTable = tableView<TeamCityBuild>({
  columns: [
    { header: "BUILD", value: (build) => build.id },
    { header: "JOB", value: (build) => build.buildTypeId, shrink: true },
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
  title: (build) =>
    [
      `Build ${build.id}${build.number === undefined ? "" : ` (#${build.number})`}`,
      build.buildTypeId,
      build.branchName,
    ].filter((part) => part !== undefined).join(" · "),
  fields: [
    {
      label: "State",
      value: (build) =>
        build.state === "running" && build.percentageComplete !== undefined
          ? `running (${build.percentageComplete}%)`
          : build.state,
    },
    { label: "Result", value: (build) => (build.state === "finished" ? result(build) : undefined) },
    { label: "Status", value: (build) => build.statusText },
    { label: "Queue position", value: (build) => build.queuePosition },
    { label: "Wait reason", value: (build) => build.waitReason },
    { label: "Duration", value: elapsed, format: "duration" },
    { label: "Agent", value: (build) => build.agent?.name },
    { label: "Web", value: (build) => build.webUrl },
  ],
  next: (build) => {
    if (build.state !== "finished") return [];
    const id = String(build.id);
    return [
      ...(build.status === "FAILURE"
        ? [["builds", "problems", id], ["builds", "tests", id, "--status", "failure"]]
        : []),
      ["builds", "artifacts", "list", id],
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
    { header: "NAME", value: (file) => file.name, shrink: true },
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
