import assert from "node:assert/strict";
import test from "node:test";
import { treeView, tableView } from "../src/index.js";
import { renderView } from "../src/view.js";

const context = { now: 0, cliName: "example-cli", profile: "uat", defaultProfile: "default" };
test("tree views preserve IDs, nest selected parents and retain orphans and cycles once", () => {
  type Item = { id: string; parent?: string };
  const view = treeView<Item>({ id: item => item.id, parent: item => item.parent, line: item => item.id,
    footer: () => "More results: --start 6", empty: "No projects found." });
  const items = [{ id: "child", parent: "root" }, { id: "root" }, { id: "orphan", parent: "absent" },
    { id: "cycle-a", parent: "cycle-b" }, { id: "cycle-b", parent: "cycle-a" }, { id: "self", parent: "self" }];
  const before = JSON.stringify(items);
  assert.equal(renderView(view, items, context),
    "root\n  child\norphan\ncycle-a\n  cycle-b\nself\n\nMore results: --start 6");
  assert.equal(renderView(view, [], context), "No projects found.\n\nMore results: --start 6");
  assert.equal(renderView(view, {}, context), undefined);
  assert.equal(renderView(treeView<Item>({ when: () => false,
    id: item => item.id, parent: item => item.parent, line: item => item.id }), items, context), undefined);
  assert.equal(JSON.stringify(items), before, "Rendering does not alter the domain shape.");
});

test("table follow-ups use the shared CLI/profile and safe-token rules even for empty results", () => {
  const view = tableView<string>({ columns: [{ header: "NAME", value: value => value }],
    next: () => [["files", "list"], ["files", "download", "unsafe;command"]] });
  assert.equal(renderView(view, [], context),
    "No results.\n\nNext:\n  example-cli files list --profile uat");
});
