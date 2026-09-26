import { inspect } from "node:util";
import type { Writable } from "node:stream";
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

function table(values: readonly Record<string, unknown>[]): string {
  const columns = [...new Set(values.flatMap((value) => Object.keys(value)))];
  if (columns.length === 0) {
    return "";
  }

  const rows = values.map((value) => columns.map((column) => displayCell(value[column])));
  const widths = columns.map((column, index) =>
    Math.max(column.length, ...rows.map((row) => row[index]?.length ?? 0)),
  );
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
  if (Array.isArray(value) && value.every(isRecord)) {
    if (value.length === 0) {
      return "No results.";
    }
    return table(value);
  }
  // A selection object: its items as a table, then its other fields on one line. `null` is
  // spelled out: an unknown value is information, unlike an empty cell.
  if (isRecord(value) && Array.isArray(value.items) && value.items.every(isRecord)) {
    const { items, ...details } = value;
    const summary = Object.entries(details)
      .filter(([, entry]) => entry !== undefined)
      .map(([key, entry]) => `${key}: ${entry === null ? "null" : displayCell(entry)}`)
      .join("  ");
    return [formatHuman(items), ...(summary ? ["", summary] : [])].join("\n");
  }
  if (isRecord(value)) {
    return Object.entries(value)
      .map(([key, entry]) => `${key}: ${displayCell(entry)}`)
      .join("\n");
  }
  return inspect(value, { colors: false, depth: null, maxArrayLength: null, maxStringLength: null, compact: false });
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
  presentation?: { view: HumanView; cliName: string; profile: string },
): void {
  const width = terminalWidth(output);
  const viewed = json || !presentation
    ? undefined
    : renderView(presentation.view, value, {
        cliName: presentation.cliName,
        profile: presentation.profile,
        now: Date.now(),
        ...(width === undefined ? {} : { width }),
      });
  const rendered = json ? JSON.stringify(value ?? null) : viewed ?? formatHuman(value);
  if (rendered.length > 0) {
    output.write(`${rendered}\n`);
  }
}
