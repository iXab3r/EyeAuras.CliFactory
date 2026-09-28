import { saveProfileFile } from "@eyeauras/cli-factory";
import { parse } from "csv-parse/sync";
import { encodedID, mutate, mutationBody, type Connection, type YouTrackObject, type YouTrackValue } from "./client.js";
import { issueRequest, issueWrite, issueWriteFields, type IssueWrite } from "./issue-fields.js";

const columns = ["action", "issue", "project.id", "project.shortName", "summary", "description", "customFields"];

export interface BatchRow {
  row: number;
  source: Record<string, unknown>;
  issue?: string;
  write: IssueWrite;
}

function csvRows(text: string): Record<string, unknown>[] {
  let records: Record<string, string>[];
  try {
    records = parse(text, {
      bom: true,
      skip_empty_lines: true,
      columns: (header: string[]) => {
        if (header.some((column) => !columns.includes(column)) || new Set(header).size !== header.length) {
          throw new Error();
        }
        return header;
      },
    }) as Record<string, string>[];
  } catch {
    throw new Error("The manifest must be valid CSV with one header of distinct supported columns.");
  }
  return records.map((record) => {
    const row: Record<string, unknown> = {};
    for (const [column, cell] of Object.entries(record)) {
      if (cell === "") continue;
      if (column.startsWith("project.")) {
        row.project = { ...(row.project as object | undefined), [column.slice("project.".length)]: cell };
      } else if (column === "customFields") {
        try {
          row.customFields = JSON.parse(cell);
        } catch {
          row.customFields = cell; // Invalid JSON then fails row validation with its row number.
        }
      } else {
        row[column] = cell;
      }
    }
    return row;
  });
}

/** Parse a .json array or header-row .csv manifest and validate every row locally. */
export function manifestRows(text: string, path: string): BatchRow[] {
  const csv = /\.csv$/i.test(path);
  if (!csv && !/\.json$/i.test(path)) throw new Error("The manifest must be a .json or .csv file.");
  let rows: unknown;
  if (csv) {
    rows = csvRows(text);
  } else {
    try {
      rows = JSON.parse(text);
    } catch {
      throw new Error("The manifest must be valid JSON.");
    }
  }
  if (!Array.isArray(rows) || !rows.length) throw new Error("The manifest must be a nonempty array of rows.");
  return rows.map((value: unknown, index) => {
    try {
      const source = mutationBody(value, ["action", "issue", "project", "summary", "description", "customFields"]);
      const { action, issue, ...body } = source;
      if (action === "create" && issue === undefined) return { row: index + 1, source, write: issueWrite(body, true) };
      if (action === "update" && typeof issue === "string") {
        encodedID(issue, "issue ID");
        return { row: index + 1, source, issue, write: issueWrite(body, false) };
      }
      throw new Error("The action must be create, or update with an issue ID.");
    } catch (error) {
      throw new Error(`Manifest row ${index + 1}: ${(error as Error).message}`);
    }
  });
}

/**
 * Apply rows in order without retries or rollback. HTTP 4xx and pre-write failures are definite;
 * other write failures are uncertain and never enter the resubmittable failed-row manifest.
 */
export async function applyIssueBatch(
  connection: Connection,
  rows: readonly BatchRow[],
  options: {
    appDataDirectory: string;
    continueOnError?: boolean;
    failedRows?: string;
    /** One human-only line per failed row and every ten rows. */
    progress?: (message: string) => void;
  },
) {
  if (options.failedRows !== undefined && !/\.json$/i.test(options.failedRows)) {
    throw new Error("--failed-rows must end with .json.");
  }
  const results: YouTrackObject[] = [];
  let stop = false;
  for (const [index, row] of rows.entries()) {
    if (stop || connection.signal?.aborted) {
      results.push({ row: row.row, status: "unattempted" });
      continue;
    }
    let sent = false;
    try {
      const { path, body } = await issueRequest(connection, row.write, row.issue);
      sent = true;
      results.push({ row: row.row, status: "completed", result: await mutate(connection, path, body, issueWriteFields) });
    } catch (error) {
      const status = (error as { status?: unknown }).status;
      const rejected = !sent || (typeof status === "number" && status >= 400 && status < 500);
      const message = (error as Error).message;
      results.push({ row: row.row, status: rejected ? "failed" : "uncertain", error: message });
      options.progress?.(`Row ${row.row}: ${rejected ? "failed" : "uncertain"} (${message})`);
      stop = !options.continueOnError;
    }
    if ((index + 1) % 10 === 0 && index + 1 < rows.length) options.progress?.(`Applied ${index + 1} of ${rows.length} rows.`);
  }
  const count = (status: string) => results.filter((result) => result.status === status).length;
  const resubmit = rows.filter((_row, index) => ["failed", "unattempted"].includes(String(results[index]?.status)));
  let failedRows: YouTrackValue = null;
  if (options.failedRows !== undefined && resubmit.length) {
    try {
      failedRows = {
        ...await saveProfileFile({
          appDataDirectory: options.appDataDirectory,
          name: options.failedRows,
          content: `${JSON.stringify(resubmit.map((row) => row.source), null, 2)}\n`,
          signal: connection.signal,
        }),
      };
    } catch (error) {
      failedRows = { error: (error as Error).message };
    }
  }
  return {
    status: count("completed") === rows.length ? "completed" : "incomplete",
    completed: count("completed"),
    failed: count("failed"),
    uncertain: count("uncertain"),
    unattempted: count("unattempted"),
    rows: results,
    ...(options.failedRows === undefined ? {} : { failedRows }),
  };
}
