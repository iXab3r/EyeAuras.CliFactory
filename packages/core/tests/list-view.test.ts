import assert from "node:assert/strict";
import test from "node:test";
import { command, localCommand, createCli, helpLayout, listView, offsetFooter, recordView, tableView } from "../src/index.js";
import { formatHuman } from "../src/output.js";
import { moreResults, renderView } from "../src/view.js";
import { createCliFixture } from "../src/testing.js";

const context = { now: 0, cliName: "demo-cli", profile: "default", defaultProfile: "default" };

test("a list prints one line per item, its empty text, and a footer only when it has one", () => {
  const view = listView<{ name: string }>({ line: (item) => item.name, empty: "No tags.", footer: (items) => (items.length > 1 ? "more" : undefined) });
  assert.equal(renderView(view, [{ name: "alpha" }, { name: "beta" }], context), "alpha\nbeta\n\nmore");
  assert.equal(renderView(view, [{ name: "alpha" }], context), "alpha");
  assert.equal(renderView(view, [], context), "No tags.");
  // A shape mismatch falls back to the generic renderer instead of reading as an empty list.
  assert.equal(renderView(view, { items: [] }, context), undefined);
});

test("offset pages continue only when they came back full", () => {
  assert.equal(moreResults("--start", 50), "More results: --start 50");
  assert.equal(offsetFooter("--start", 50, 50), "More results: --start 50");
  assert.equal(offsetFooter("--start", 50, 50, 100), "More results: --start 150");
  assert.equal(offsetFooter("--start", 12, 50), undefined);
  assert.equal(offsetFooter("--start", 12, undefined), undefined);
  assert.equal(offsetFooter("--start", 0, 0), undefined);
});

test("views read the command's arguments and options through the context", async (t) => {
  const fixture = await createCliFixture(t, { applicationId: "input-cli", profiles: [{ name: "default" }] });
  const app = fixture.createApplication((runtime) => createCli({
    name: "input-cli", description: "Input fixture", runtime,
    commands: [
      localCommand("metadata <name>", "Show metadata", () => null, {
        view: recordView<null>({ title: (_value, ctx) => `Metadata ${ctx.input?.args.name}.`, fields: [] }),
      }),
      command("remove <tagID>", "Remove", () => null, {
        view: recordView<null>({ title: (_value, ctx) => `Removed tag ${ctx.input?.args.tagID}.`, fields: [] }),
      }),
      command("page", "Page", () => ["a", "b"], {
        options: [{ flags: "--page-size <count>", description: "Page size", defaultValue: 2, parse: Number }],
        view: tableView<string>({
          columns: [{ header: "NAME", value: (item) => item }],
          footer: (rows, ctx) => offsetFooter("--start", rows.length, Number(ctx.input?.options.pageSize)),
        }),
      }),
    ],
  }));
  assert.equal((await fixture.run(app, ["metadata", "fixture"])).stdout, "Metadata fixture.\n");
  assert.equal((await fixture.run(app, ["remove", "7"])).stdout, "Removed tag 7.\n");
  assert.equal((await fixture.run(app, ["page"])).stdout, "NAME\na\nb\n\nMore results: --start 2\n");
  assert.equal((await fixture.run(app, ["page", "--page-size", "5"])).stdout, "NAME\na\nb\n");
  assert.equal((await fixture.run(app, ["remove", "7", "--json"])).stdout, "null\n");
});

test("a view can decline an invocation and yield to the generic shape", () => {
  const view = tableView<{ name: string }>({
    columns: [{ header: "NAME", value: (item) => item.name }],
    when: (ctx) => ctx.input?.options.fields === undefined,
  });
  assert.equal(renderView(view, [{ name: "alpha" }], context), "NAME\nalpha");
  assert.equal(renderView(view, [{ name: "alpha" }], { ...context, input: { args: {}, options: { fields: "id" } } }), undefined);
  // A record whose accessors find nothing also yields, so a shape mismatch never reads as silence.
  const record = recordView<unknown>({ fields: [{ label: "Name", value: () => undefined }] });
  assert.equal(renderView(record, { other: 1 }, context), undefined);
  assert.equal(renderView(recordView<unknown>({ title: () => "Shown", fields: [] }), {}, context), "Shown");
});

test("the generic renderer prints a list of names one per line", () => {
  assert.equal(formatHuman(["alpha", "beta"]), "alpha\nbeta");
  assert.equal(formatHuman([]), "No results.");
});

test("help layout groups the named children in order and the rest under one heading", () => {
  const children = [command("c", "C", () => 1), command("a", "A", () => 1), command("b <x>", "B", () => 1)];
  const laid = helpLayout([["Everyday", ["b", "a"]]], children);
  assert.deepEqual(laid.map((child) => [child.name, child.group]), [["b <x>", "Everyday"], ["a", "Everyday"], ["c", "More"]]);
  assert.throws(() => helpLayout([["Everyday", ["missing"]]], children), /missing command 'missing'/);
});
