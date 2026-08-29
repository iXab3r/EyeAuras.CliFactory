import { inspect } from "node:util";
import type { Writable } from "node:stream";

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
  if (isRecord(value)) {
    return Object.entries(value)
      .map(([key, entry]) => `${key}: ${displayCell(entry)}`)
      .join("\n");
  }
  return inspect(value, { colors: false, depth: 6, compact: false });
}

export function writeResult(output: Writable, value: unknown, json: boolean): void {
  const rendered = json ? JSON.stringify(value ?? null) : formatHuman(value);
  if (rendered.length > 0) {
    output.write(`${rendered}\n`);
  }
}
