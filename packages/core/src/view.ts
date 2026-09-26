/** A value Core can format for a human view. Dates must be valid `Date` instances. */
export type ViewValue = string | number | boolean | Date | null | undefined;

/**
 * `text` prints the value. `age` prints the time since a `Date`, `duration` a number of
 * milliseconds and `bytes` a byte count in binary units.
 */
export type ViewFormat = "text" | "age" | "duration" | "bytes";

export interface ViewColumn<Row> {
  header: string;
  value: (row: Row) => ViewValue;
  format?: ViewFormat;
  /** Secondary text that may be shortened to fit a terminal. Never set it for identifiers. */
  shrink?: boolean;
}

export interface ViewField<Value> {
  label: string;
  value: (value: Value) => ViewValue;
  format?: ViewFormat;
}

export interface TableViewSpec<Row, Value> {
  /** Selects the rows; an array result is used directly when omitted. */
  rows?: (value: Value) => readonly Row[];
  columns: readonly ViewColumn<Row>[];
  /** Printed instead of an empty table. */
  empty?: string;
}

/** A titled list after a record's fields: one line per item; `undefined` omits the section. */
export interface ViewSection<Value> {
  title: (value: Value) => string;
  lines: (value: Value) => readonly string[] | undefined;
}

export interface RecordViewSpec<Value> {
  title?: (value: Value) => string | undefined;
  fields: readonly ViewField<Value>[];
  sections?: readonly ViewSection<Value>[];
  /**
   * Follow-up commands of this CLI as argv without the CLI name. Core adds the CLI name and the
   * selected profile, and omits an action containing anything other than plain safe tokens.
   */
  next?: (value: Value) => readonly (readonly string[])[];
}

/** Declarative human presentation of a command result. JSON and JSON-RPC never use it. */
export type HumanView =
  | ({ kind: "table" } & TableViewSpec<unknown, unknown>)
  | ({ kind: "record" } & RecordViewSpec<unknown>);

export interface ViewContext {
  /** Maximum line width, or undefined when output is not a terminal. */
  width?: number;
  /** Milliseconds since the epoch, used by `age`. */
  now: number;
  cliName: string;
  profile: string;
}

export function tableView<Row, Value = readonly Row[]>(spec: TableViewSpec<Row, Value>): HumanView {
  return { kind: "table", ...(spec as TableViewSpec<unknown, unknown>) };
}

export function recordView<Value>(spec: RecordViewSpec<Value>): HumanView {
  return { kind: "record", ...(spec as RecordViewSpec<unknown>) };
}

const ellipsis = "…";
const safeToken = /^[A-Za-z0-9._:/@+=-]+$/;

function bytes(value: number): string {
  if (value < 1024) return `${value} B`;
  let current = value;
  let unit = "B";
  for (const next of ["KiB", "MiB", "GiB", "TiB"]) {
    if (current < 1024) break;
    current /= 1024;
    unit = next;
  }
  return `${current.toFixed(1)} ${unit}`;
}

function age(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 48 * 3600) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

function duration(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const two = (value: number) => String(value).padStart(2, "0");
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${two(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${two(Math.floor(seconds / 60) % 60)}m`;
}

export function formatViewValue(value: ViewValue, format: ViewFormat = "text", now = Date.now()): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    return format === "age" ? age(now - value.getTime()) : value.toISOString();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    if (format === "duration") return duration(value);
    if (format === "bytes" && value >= 0) return bytes(value);
  }
  return String(value);
}

function truncate(text: string, width: number): string {
  return text.length <= width ? text : text.slice(0, Math.max(0, width - 1)) + ellipsis;
}

/** Shrinks only `shrink` columns, widest first, down to their header width (at least 6). */
function fitWidths(widths: number[], columns: readonly ViewColumn<unknown>[], limit?: number): number[] {
  if (limit === undefined) return widths;
  const result = [...widths];
  let excess = result.reduce((sum, width) => sum + width, 0) + 2 * (result.length - 1) - limit;
  const minimum = (index: number) => Math.max(columns[index]?.header.length ?? 0, 6);
  while (excess > 0) {
    let widest = -1;
    columns.forEach((column, index) => {
      if (column.shrink && (result[index] ?? 0) > minimum(index) &&
        (widest < 0 || (result[index] ?? 0) > (result[widest] ?? 0))) widest = index;
    });
    if (widest < 0) break;
    result[widest] = (result[widest] ?? 0) - 1;
    excess--;
  }
  return result;
}

function renderTable(
  view: TableViewSpec<unknown, unknown>,
  value: unknown,
  context: ViewContext,
): string | undefined {
  const rows: unknown = view.rows ? view.rows(value) : value;
  // A shape mismatch must never read as "no results"; the caller falls back to generic output.
  if (!Array.isArray(rows)) return undefined;
  if (rows.length === 0) return view.empty ?? "No results.";
  const cells = rows.map((row) =>
    view.columns.map((column) => formatViewValue(column.value(row), column.format, context.now)));
  const widths = fitWidths(
    view.columns.map((column, index) =>
      Math.max(column.header.length, ...cells.map((row) => row[index]?.length ?? 0))),
    view.columns,
    context.width,
  );
  const line = (row: readonly string[]) =>
    row.map((cell, index) => truncate(cell, widths[index] ?? 0).padEnd(widths[index] ?? 0))
      .join("  ").trimEnd();
  return [line(view.columns.map((column) => column.header)), ...cells.map(line)].join("\n");
}

function renderRecord(view: RecordViewSpec<unknown>, value: unknown, context: ViewContext): string {
  const lines: string[] = [];
  const title = view.title?.(value);
  if (title) lines.push(title);
  const fields = view.fields
    .map((field) => [field.label, formatViewValue(field.value(value), field.format, context.now)] as const)
    .filter(([, text]) => text !== "");
  const labelWidth = Math.max(0, ...fields.map(([label]) => label.length + 1));
  lines.push(...fields.map(([label, text]) => `${`${label}:`.padEnd(labelWidth)}  ${text}`));
  for (const section of view.sections ?? []) {
    const items = section.lines(value);
    if (items === undefined) continue;
    const width = context.width === undefined ? undefined : context.width - 2;
    lines.push("", `${section.title(value)}:`,
      ...(items.length === 0 ? ["none"] : items).map((item) =>
        `  ${width === undefined ? item : truncate(item, width)}`));
  }
  const commands = nextCommands(view.next?.(value) ?? [], context.cliName, context.profile);
  if (commands.length > 0) lines.push("", "Next:", ...commands.map((line) => `  ${line}`));
  return lines.join("\n");
}

/** Printable follow-up commands with the selected profile; an action with an unsafe token is omitted. */
export function nextCommands(
  actions: readonly (readonly string[])[],
  cliName: string,
  profile: string,
): string[] {
  return actions
    .map((argv) => [...argv, "--profile", profile])
    .filter((argv) => argv.length > 2 && argv.every((token) => safeToken.test(token)))
    .map((argv) => [cliName, ...argv].join(" "));
}

/** The view's text, or undefined when a table's rows are not an array. */
export function renderView(view: HumanView, value: unknown, context: ViewContext): string | undefined {
  return view.kind === "table" ? renderTable(view, value, context) : renderRecord(view, value, context);
}
