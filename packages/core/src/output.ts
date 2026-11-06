import { inspect } from "node:util";
import type { Writable } from "node:stream";
import type { CommandInput } from "./types.js";
import { renderView, type HumanView } from "./view.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function displayCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

function isNested(value: unknown): value is Record<string, unknown> | unknown[] {
  return Array.isArray(value) || (isRecord(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null));
}

function indent(value: string): string {
  return value.split("\n").map((line) => `  ${line}`).join("\n");
}

function isEmpty(value: Record<string, unknown> | unknown[]): boolean {
  return Array.isArray(value) ? value.length === 0 : Object.keys(value).length === 0;
}

function inspectComplete(value: unknown): string {
  return inspect(value, { colors: false, depth: null, maxArrayLength: null, maxStringLength: null, compact: false });
}

// Only the outer result recognizes tables and selections. Nested keys are always data.
function recordFields(value: Record<string, unknown>, ancestors: Set<object>, inspectInstances = false): string {
  const recursive = isNested(value);
  return Object.entries(value).map(([key, entry]) => {
    if (!recursive || !isNested(entry)) return `${key}: ${inspectInstances && isRecord(entry) ? inspectComplete(entry) : displayCell(entry)}`;
    const rendered = nested(entry, ancestors, inspectInstances);
    return isEmpty(entry) ? `${key}: ${rendered}` : `${key}:\n${indent(rendered)}`;
  }).join("\n");
}

function nested(value: Record<string, unknown> | unknown[], ancestors: Set<object>, inspectInstances = false): string {
  if (ancestors.has(value)) throw new TypeError("Converting circular structure to human output");
  ancestors.add(value);
  try {
    if (!Array.isArray(value)) return recordFields(value, ancestors, inspectInstances) || "(empty record)";
    if (value.length === 0) return "(empty list)";
    return Array.from(value, (entry) => {
      if (!isNested(entry)) {
        const scalar = typeof entry === "string" ? entry
          : isRecord(entry) && !inspectInstances ? displayCell(entry) : inspectComplete(entry);
        return `- ${scalar}`;
      }
      const rendered = nested(entry, ancestors, inspectInstances);
      return isEmpty(entry) ? `- ${rendered}` : `-\n${indent(rendered)}`;
    }).join("\n");
  } finally {
    ancestors.delete(value);
  }
}

function table(values: readonly Record<string, unknown>[]): string {
  if (values.some((value) => isNested(value)
    && (isEmpty(value) || Object.values(value).some(isNested)))) {
    return values.map((value) => isNested(value) ? nested(value, new Set())
      : recordFields(value, new Set([value]))).join("\n\n");
  }
  const columns = [...new Set(values.flatMap((value) => Object.keys(value)))];
  if (columns.length === 0) {
    return "";
  }

  const rows = values.map((value) => columns.map((column) => displayCell(value[column])));
  const widths = columns.map((column, index) =>
    Math.max(column.length, ...rows.map((row) => row[index]?.length ?? 0)),
  );
  let content = 0;
  let padding = 0;
  for (const row of rows) {
    for (const [index, cell] of row.entries()) {
      content += cell.length;
      if (index < row.length - 1) padding += (widths[index] ?? 0) - cell.length;
    }
  }
  // Prefer lossless records when alignment adds more whitespace than actual cell content.
  if (padding > content) return values.map((value) => recordFields(value, new Set([value]))).join("\n\n");

  const formatRow = (row: readonly string[]): string =>
    row.map((cell, index) => cell.padEnd(widths[index] ?? 0)).join("  ").trimEnd();

  return [
    formatRow(columns),
    formatRow(widths.map((width) => "-".repeat(width))),
    ...rows.map(formatRow),
  ].join("\n");
}

export function formatHuman(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value) && value.length === 0) {
    return "No results.";
  }
  if (Array.isArray(value) && value.every(isRecord)) {
    return table(value);
  }
  // Names and identifiers read as a list, one per line.
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
    return value.join("\n");
  }
  // A selection prints rows, its scalar summary, then labeled nested details.
  // `null` is spelled out: an unknown value is information, unlike an empty cell.
  if (isRecord(value) && Array.isArray(value.items) && value.items.every(isRecord)) {
    const { items, ...details } = value;
    const summary = Object.entries(details)
      .filter(([, entry]) => entry !== undefined && !isNested(entry))
      .map(([key, entry]) => `${key}: ${entry === null ? "null" : displayCell(entry)}`)
      .join("  ");
    const blocks = Object.fromEntries(Object.entries(details).filter(([, entry]) => isNested(entry)));
    const rendered = recordFields(blocks, new Set([value]));
    return [formatHuman(items), ...[summary, rendered].filter(Boolean)].join("\n\n");
  }
  if (isRecord(value)) {
    return recordFields(value, new Set([value]));
  }
  // These outer arrays previously used inspect; keep that behavior for their non-plain instances.
  if (Array.isArray(value)) return value.length === 0 ? "No results." : nested(value, new Set(), true);
  return inspectComplete(value);
}

/** A terminal's usable line width; files, pipes and other streams have none. */
export function terminalWidth(output: Writable): number | undefined {
  const tty = output as Writable & { isTTY?: boolean; columns?: number };
  // Leave the last column free: some terminals wrap a line that exactly fills the width.
  return tty.isTTY === true && typeof tty.columns === "number" && tty.columns > 1
    ? tty.columns - 1
    : undefined;
}

export function writeResult(
  output: Writable,
  value: unknown,
  json: boolean,
  presentation?: {
    view: HumanView;
    cliName: string;
    profile?: string;
    defaultProfile?: string;
    input?: CommandInput;
  },
): void {
  const width = terminalWidth(output);
  const viewed = json || !presentation
    ? undefined
    : renderView(presentation.view, value, {
        cliName: presentation.cliName,
        ...(presentation.profile === undefined ? {} : { profile: presentation.profile }),
        ...(presentation.defaultProfile === undefined ? {} : { defaultProfile: presentation.defaultProfile }),
        ...(presentation.input === undefined ? {} : { input: presentation.input }),
        now: Date.now(),
        ...(width === undefined ? {} : { width }),
      });
  const rendered = json ? JSON.stringify(value ?? null) : viewed ?? formatHuman(value);
  if (rendered.length > 0) {
    output.write(`${rendered}\n`);
  }
}
