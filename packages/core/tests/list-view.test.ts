import assert from "node:assert/strict";
import test from "node:test";
import { command, createCli, helpLayout, listView, offsetFooter, recordView, tableView } from "../src/index.js";
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
  assert.equal(moreResults("--skip", 50), "More results: --skip 50");
  assert.equal(offsetFooter("--skip", 50, 50), "More results: --skip 50");
  assert.equal(offsetFooter("--skip", 50, 50, 100), "More results: --skip 150");
  assert.equal(offsetFooter("--skip", 12, 50), undefined);
  assert.equal(offsetFooter("--skip", 12, undefined), undefined);
});

test("views read the command's arguments and options through the context", async (t) => {
  const fixture = await createCliFixture(t, { applicationId: "input-cli", profiles: [{ name: "default" }] });
  const app = fixture.createApplication((runtime) => createCli({
    name: "input-cli", description: "Input fixture", runtime,
    commands: [
      command("remove <tagID>", "Remove", () => null, {
        view: recordView<null>({ title: (_value, ctx) => `Removed tag ${ctx.input?.args.tagID}.`, fields: [] }),
      }),
      command("page", "Page", () => ["a", "b"], {
        options: [{ flags: "--top <count>", description: "Page size", defaultValue: 2, parse: Number }],
        view: tableView<string>({
          columns: [{ header: "NAME", value: (item) => item }],
          footer: (rows, ctx) => offsetFooter("--skip", rows.length, Number(ctx.input?.options.top)),
        }),
      }),
    ],
  }));
  assert.equal((await fixture.run(app, ["remove", "7"])).stdout, "Removed tag 7.\n");
  assert.equal((await fixture.run(app, ["page"])).stdout, "NAME\na\nb\n\nMore results: --skip 2\n");
  assert.equal((await fixture.run(app, ["page", "--top", "5"])).stdout, "NAME\na\nb\n");
  assert.equal((await fixture.run(app, ["remove", "7", "--json"])).stdout, "null\n");
});

test("a view can decline an invocation and yield to the generic shape", () => {
  const view = tableView<{ name: string }>({
    columns: [{ header: "NAME", value: (item) => item.name }],
    when: (ctx) => ctx.input?.options.fields === undefined,
  });
  assert.equal(renderView(view, [{ name: "alpha" }], context), "NAME\nalpha");
  assert.equal(renderView(view, [{ name: "alpha" }], { ...context, input: { args: {}, options: { fields: "id" } } }), undefined);
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
