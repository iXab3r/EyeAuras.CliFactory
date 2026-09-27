import assert from "node:assert/strict";
import { join } from "node:path";
import { Writable } from "node:stream";
import test from "node:test";
import {
  command,
  createCli,
  downloadCommands,
  recordView,
  saveProfileFile,
  tableView,
} from "../src/index.js";
import { createCliFixture } from "../src/testing.js";
import { formatViewValue, renderView } from "../src/view.js";

interface Row {
  id: number;
  name: string;
  state: string;
  started?: Date;
}

const now = Date.UTC(2026, 8, 26, 12, 0, 0);
const rows: Row[] = [
  { id: 101, name: "Synthetic_Very_Long_Configuration_Name_For_Width", state: "finished",
    started: new Date(now - 4 * 60_000) },
  { id: 1_234_567_890, name: "Short", state: "running" },
];
const rowTable = tableView<Row>({
  columns: [
    { header: "ID", value: (row) => row.id },
    { header: "NAME", value: (row) => row.name, shrink: true },
    { header: "STATE", value: (row) => row.state },
    { header: "AGE", value: (row) => row.started, format: "age" },
  ],
  empty: "Nothing here.",
});

function terminal(columns?: number) {
  let text = "";
  const stream = Object.assign(
    new Writable({ write(chunk, _encoding, done) { text += chunk.toString(); done(); } }),
    columns === undefined ? {} : { isTTY: true, columns },
  );
  return { stream, text: () => text };
}

test("view values format age, duration and binary sizes without a locale", () => {
  assert.equal(formatViewValue(new Date(now - 42_000), "age", now), "42s");
  assert.equal(formatViewValue(new Date(now - 4 * 60_000), "age", now), "4m");
  assert.equal(formatViewValue(new Date(now - 30 * 3_600_000), "age", now), "30h");
  assert.equal(formatViewValue(new Date(now - 3 * 86_400_000), "age", now), "3d");
  assert.equal(formatViewValue(new Date(now + 5_000), "age", now), "0s");
  assert.equal(formatViewValue(new Date(Number.NaN), "age", now), "");
  assert.equal(formatViewValue(240_000, "duration"), "4m 00s");
  assert.equal(formatViewValue(3_723_000, "duration"), "1h 02m");
  assert.equal(formatViewValue(9_000, "duration"), "9s");
  assert.equal(formatViewValue(512, "bytes"), "512 B");
  assert.equal(formatViewValue(1_572_864, "bytes"), "1.5 MiB");
  assert.equal(formatViewValue(null), "");
  assert.equal(formatViewValue(false), "false");
});

test("tables keep identifiers whole and shrink only secondary columns to the width", () => {
  const context = { now, cliName: "demo-cli", profile: "default" };
  const full = (renderView(rowTable, rows, context) ?? "").split("\n");
  assert.deepEqual(full.map((line) => line.split(/\s{2,}/)[0]), ["ID", "101", "1234567890"]);
  assert.match(full[1] ?? "", /Synthetic_Very_Long_Configuration_Name_For_Width\s+finished\s+4m$/);
  assert.doesNotMatch(full.join("\n"), /-{3}/, "Views do not print a separator row.");

  const narrow = (renderView(rowTable, rows, { ...context, width: 40 }) ?? "").split("\n");
  for (const line of narrow) assert.ok(line.length <= 40, `line exceeds 40 columns: ${line}`);
  assert.equal(narrow[1], "101         Synthetic_Ve…  finished  4m");
  assert.match(narrow[2] ?? "", /^1234567890\s+Short\s+running$/);

  const impossible = (renderView(rowTable, rows, { ...context, width: 10 }) ?? "").split("\n");
  assert.match(impossible[2] ?? "", /^1234567890 /, "Identifiers are never shortened.");
  assert.equal(renderView(rowTable, [], context), "Nothing here.");
  const selected = tableView<Row, { items: Row[] }>({
    rows: (value) => value.items,
    columns: [{ header: "ID", value: (row) => row.id }],
  });
  assert.equal(renderView(selected, { items: rows }, context), "ID\n101\n1234567890");
  // A result that does not match the view is never shown as an empty table.
  assert.equal(renderView(rowTable, { items: rows }, context), undefined);
  assert.equal(renderView(selected, { rows }, context), undefined);
});

test("records align present fields and print only safe follow-up commands with the profile", () => {
  const view = recordView<{ id: number; state: string; text?: string }>({
    title: (value) => `Item ${value.id}`,
    fields: [
      { label: "State", value: (value) => value.state },
      { label: "Status text", value: (value) => value.text },
      { label: "Took", value: () => 65_000, format: "duration" },
    ],
    next: (value) => [["items", "show", String(value.id)], ["items", "find", "a b"], []],
  });
  assert.equal(
    renderView(view, { id: 7, state: "done" }, { now, cliName: "demo-cli", profile: "uat" }),
    "Item 7\nState:  done\nTook:   1m 05s\n\nNext:\n  demo-cli items show 7 --profile uat",
  );
});

test("record sections list whole items, say none when empty and disappear when not applicable", () => {
  const view = recordView<{ problems?: string[]; tests: string[] }>({
    fields: [{ label: "Kind", value: () => "summary" }],
    sections: [
      { title: () => "Problems", lines: (value) => value.problems },
      { title: (value) => `Tests (${value.tests.length})`, lines: (value) => value.tests },
    ],
  });
  const context = { now, cliName: "demo-cli", profile: "default" };
  assert.equal(
    renderView(view, { problems: [], tests: ["alpha", "a-very-long-test-name-that-cannot-fit"] }, {
      ...context, width: 20,
    }),
    "Kind:  summary\n\nProblems:\n  none\n\nTests (2):\n  alpha\n  a-very-long-test-name-that-cannot-fit",
  );
  assert.equal(renderView(view, { tests: [] }, context), "Kind:  summary\n\nTests (0):\n  none");
});

test("one declaration renders its view for humans while JSON, execute and RPC keep domain data", async (t) => {
  const f = await createCliFixture(t, { applicationId: "view-cli" });
  const app = f.createApplication((runtime) => createCli({
    name: "view-cli",
    description: "View fixture",
    commands: [command("rows", "List rows", () => rows, { view: rowTable })],
    runtime,
  }));
  const wide = terminal(121);
  assert.equal(await app.run(["rows"], { output: wide.stream }), 0);
  assert.match(wide.text(), /^ID\s+NAME\s+STATE\s+AGE\n101\s+Synthetic_Very_Long_Configuration_Name_For_Width/);

  const narrow = terminal(41);
  assert.equal(await app.run(["rows"], { output: narrow.stream }), 0);
  assert.ok(narrow.text().trimEnd().split("\n").every((line) => line.length <= 40), narrow.text());

  const redirected = await f.run(app, ["rows"]);
  assert.match(redirected.stdout, /Synthetic_Very_Long_Configuration_Name_For_Width/);
  assert.equal(redirected.stderr, "");

  const json = await f.json(app, ["rows"]) as Array<{ id: number; started?: string }>;
  assert.deepEqual(json.map((row) => row.id), [101, 1_234_567_890]);
  assert.equal(json[0]?.started, rows[0]?.started?.toISOString());
  assert.deepEqual(await app.execute(["rows"]), rows);
  const [reply] = await f.rpc(app, [["rows"]]) as Array<{ result: unknown[] }>;
  assert.equal(reply?.result.length, 2);
});

test("a view that does not match its result falls back to generic output, never 'no results'", async (t) => {
  const f = await createCliFixture(t, { applicationId: "mismatch-cli" });
  const app = f.createApplication((runtime) => createCli({
    name: "mismatch-cli",
    description: "Mismatch fixture",
    commands: [command("rows", "Wrapped rows", () => ({ items: rows }), { view: rowTable })],
    runtime,
  }));
  const result = await f.run(app, ["rows"]);
  assert.equal(result.exitCode, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /Nothing here/);
  // The generic selection table: raw keys, not the view's headers.
  assert.match(result.stdout, /^id\s+name\s+state\s+started\n-+ .*\n101\s.*\n1234567890\s+Short/);
});

test("Core's downloads list is a table of saved files for the selected profile", async (t) => {
  const f = await createCliFixture(t, { applicationId: "files-cli", profiles: [{ name: "default" }] });
  await saveProfileFile({
    appDataDirectory: f.appArguments.AppDataDirectory, name: "report.txt", content: "synthetic",
  });
  const app = f.createApplication((runtime) => createCli({
    name: "files-cli", description: "Files fixture", commands: [], builtins: [downloadCommands], runtime,
  }));
  const listed = await f.run(app, ["downloads", "list"]);
  assert.equal(listed.exitCode, 0, listed.stderr);
  const [header, row, ...rest] = listed.stdout.split("\n");
  assert.match(header ?? "", /^NAME\s+SIZE\s+MODIFIED\s+PATH$/);
  assert.match(row ?? "", /^report\.txt\s+9 B\s+\d+s\s+/);
  // Redirected output is never shortened, whatever characters the temporary path contains.
  assert.ok(row?.endsWith(join(f.appArguments.AppDataDirectory, "downloads", "report.txt")), row);
  assert.deepEqual(rest, [""]);
});

test("help groups siblings in declaration order, adds examples and keeps local commands last", async (t) => {
  const f = await createCliFixture(t, { applicationId: "help-cli" });
  const app = f.createApplication((runtime) => createCli({
    name: "help-cli",
    description: "Help fixture",
    commands: [
      command("items", "Work with items", [
        command("delete <id>", "Delete an item", () => null, { group: "Control" }),
        command("list", "List items", () => [], { group: "Everyday" }),
        command("show <id>", "Show one item", () => null, { group: "Everyday" }),
      ], { examples: ["items list", "items show 7"] }),
    ],
    runtime,
  }));
  const help = await f.run(app, ["items", "--help"]);
  assert.equal(help.exitCode, 0);
  const headings = help.stdout.split("\n").filter((line) => /^[A-Z][A-Za-z ]*:$/.test(line));
  assert.deepEqual(headings, ["Options:", "Control:", "Everyday:", "Examples:"]);
  assert.match(help.stdout, /Everyday:\n\s+list\s+List items\n\s+show <id>/);
  assert.match(help.stdout, /Examples:\n {2}help-cli items list\n {2}help-cli items show 7\n/);
  const bare = await f.run(app, ["items"]);
  assert.equal(bare.exitCode, 0);
  assert.equal(bare.stdout, help.stdout, "A bare group shows exactly its --help text.");
  assert.deepEqual(await app.execute(["items"]), { help: help.stdout.trimEnd() });

  const root = await f.run(app, ["--help"]);
  assert.match(root.stdout, /Commands:\n\s+items[^\n]*\n[\s\S]*Configuration:\n\s+profile/);
});

test("argument errors print one short usage instead of the command's complete help", async (t) => {
  const f = await createCliFixture(t, { applicationId: "usage-cli" });
  const app = f.createApplication((runtime) => createCli({
    name: "usage-cli",
    description: "Usage fixture",
    commands: [command("items", "Work with items", [
      command("show <id>", "Show one item", () => null, {
        options: [{ flags: "--limit <count>", description: "Maximum items" }],
      }),
    ])],
    runtime,
  }));
  const missing = await f.run(app, ["items", "show"]);
  assert.equal(missing.exitCode, 1);
  assert.equal(missing.stdout, "");
  assert.equal(
    missing.stderr,
    "error: missing required argument 'id'\n" +
      "Usage: usage-cli items show [options] <id>\n" +
      "Run 'usage-cli items show --help' for details.\n",
  );
  const unknown = await f.run(app, ["items", "shw"]);
  assert.match(unknown.stderr, /^error: unknown command 'shw'\n\(Did you mean show\?\)\nUsage: usage-cli items \[options\] \[command\]\n/);
  assert.equal(unknown.stderr.match(/error:/g)?.length, 1);
  const [reply] = await f.rpc(app, [["items", "show"]]) as Array<{ error: { message: string } }>;
  assert.match(reply?.error.message ?? "", /Usage: usage-cli items show \[options\] <id>/);
  assert.doesNotMatch(reply?.error.message ?? "", /Options:/);
});
