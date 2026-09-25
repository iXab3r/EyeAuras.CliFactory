import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { after, afterEach, before, test } from "node:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { manifestRows } from "../src/issue-batch.js";
import { configuredFixture } from "./cli-fixture.js";

const server = setupServer();
before(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
after(() => server.close());
const priority = [{ $type: "SingleEnumIssueCustomField", name: "Priority", value: { name: "Major" } }];
const rows = [
  { action: "create", project: { shortName: "DEMO" }, summary: "First", description: "Line \"one\"\nLine two", customFields: priority },
  { action: "update", issue: "DEMO-1", summary: "Second" },
  { action: "create", project: { id: "0-1" }, summary: "Third" },
];
const csv = [
  "﻿action,issue,project.id,project.shortName,summary,description,customFields",
  `create,,,DEMO,First,"Line ""one""\nLine two","${JSON.stringify(priority).replaceAll("\"", "\"\"")}"`,
  "update,DEMO-1,,,Second,,",
  "create,,0-1,,Third,,",
].join("\r\n");

async function fixtureWithManifest(t: Parameters<typeof configuredFixture>[0], name: string, content: string) {
  const f = await configuredFixture(t);
  const path = join(f.root, name);
  await writeFile(path, content);
  return { f, path };
}

test("JSON and CSV manifests validate to identical writes; malformed rows name their row", () => {
  const writes = (text: string, path: string) => manifestRows(text, path).map(({ row, issue, write }) => ({ row, issue, write }));
  assert.deepEqual(writes(csv, "rows.CSV"), writes(JSON.stringify(rows), "rows.json"));
  for (const [text, path, error] of [
    ["[]", "rows.json", /nonempty array/],
    ["{", "rows.json", /valid JSON/],
    [JSON.stringify(rows), "rows.txt", /\.json or \.csv/],
    ["action,other\ncreate,x", "rows.csv", /unsupported column/],
    ["action,customFields\ncreate,not-json", "rows.csv", /customFields must be a JSON array/],
    ["action,summary\ncreate,\"unterminated", "rows.csv", /valid CSV/],
    [JSON.stringify([rows[0], { action: "delete", issue: "DEMO-1" }]), "rows.json", /^Error: YouTrack manifest row 2: manifest action/],
    [JSON.stringify([rows[0], { action: "update", summary: "No issue" }]), "rows.json", /row 2/],
    [JSON.stringify([{ ...rows[2], issue: "DEMO-1" }]), "rows.json", /row 1/],
    [JSON.stringify([rows[1], { action: "update", issue: "DEMO-2", project: { id: "0-1" } }]), "rows.json", /row 2/],
    [JSON.stringify([{ ...rows[2], summary: " " }]), "rows.json", /^Error: YouTrack manifest row 1: summary must be nonempty text\.$/],
  ] as const) assert.throws(() => manifestRows(text, path), error);
});

test("validate is local-only and apply checks Update before reading the manifest", async (t) => {
  const { f, path } = await fixtureWithManifest(t, "rows.csv", csv);
  server.use(http.all("*", () => assert.fail("Validation or denial reached the network.")));
  assert.deepEqual(await f.cli.execute(["issues", "batch", "validate", "--file", path, "--profile", "dev"]),
    { rows: 3, create: 2, update: 1 });
  await assert.rejects(f.cli.execute(["issues", "batch", "validate", "--file", join(f.root, "missing.json"), "--profile", "dev"]),
    /readable regular file/);
  await assert.rejects(f.cli.execute(["issues", "batch", "apply", "--file", join(f.root, "missing.json"), "--profile", "dev"]),
    /Permission 'Update' is disabled/);
  await f.cli.execute(["permissions", "grant", "Update", "--profile", "dev"]);
  await writeFile(join(f.root, "bad.json"), JSON.stringify([rows[1], { action: "update" }]));
  await assert.rejects(f.cli.execute(["issues", "batch", "apply", "--file", join(f.root, "bad.json"), "--profile", "dev"]), /row 2/);
});

/** Rows run in order; each POST answers with the next scripted status. */
function script(statuses: readonly number[]) {
  const posts: string[] = [];
  server.use(
    http.get("*/api/admin/projects/DEMO", () => HttpResponse.json({ id: "0-1", shortName: "DEMO" })),
    http.get("*/api/admin/projects/0-1/customFields", () => HttpResponse.json([{ id: "92-1", field: { name: "Priority" } }])),
    http.post("*", ({ request }) => {
      posts.push(new URL(request.url).pathname);
      const status = statuses[posts.length - 1]!;
      return status === 200 ? HttpResponse.json({ id: `2-${posts.length}` }) : new HttpResponse("synthetic-private", { status });
    }),
  );
  return posts;
}

test("apply stops at the first unsuccessful row by default and never retries", async (t) => {
  const { f, path } = await fixtureWithManifest(t, "rows.json", JSON.stringify(rows));
  await f.cli.execute(["permissions", "grant", "Update", "--profile", "dev"]);
  const posts = script([200, 400]);
  assert.deepEqual(await f.cli.execute(["issues", "batch", "apply", "--file", path, "--profile", "dev"]), {
    status: "incomplete", completed: 1, failed: 1, uncertain: 0, unattempted: 1,
    rows: [
      { row: 1, status: "completed", result: { id: "2-1" } },
      { row: 2, status: "failed", error: "YouTrack request failed (HTTP 400)." },
      { row: 3, status: "unattempted" },
    ],
  });
  assert.deepEqual(posts, ["/context/api/issues", "/context/api/issues/DEMO-1"]);
});

test("continue-on-error separates definite and uncertain failures; failed rows exclude uncertain ones", async (t) => {
  const manifest = [rows[2], rows[1], { ...rows[1], issue: "DEMO-2" }, { ...rows[0], project: { shortName: "NOPE" } }, rows[2]];
  const { f, path } = await fixtureWithManifest(t, "rows.json", JSON.stringify(manifest));
  await f.cli.execute(["permissions", "grant", "Update", "--profile", "dev"]);
  const posts = script([200, 409, 503, 200]);
  server.use(http.get("*/api/admin/projects/NOPE", () => new HttpResponse(null, { status: 404 })));
  const result = await f.cli.execute([
    "issues", "batch", "apply", "--file", path, "--continue-on-error", "--failed-rows", "retry.json", "--profile", "dev",
  ]) as Record<string, unknown>;
  assert.deepEqual((result.rows as { status: string }[]).map((row) => row.status),
    ["completed", "failed", "uncertain", "failed", "completed"]);
  assert.deepEqual([result.status, result.completed, result.failed, result.uncertain, result.unattempted],
    ["incomplete", 2, 2, 1, 0]);
  assert.equal(posts.length, 4);
  const saved = result.failedRows as { path: string };
  assert.equal(saved.path, join(f.paths.at(-1)!, "downloads", "retry.json"));
  assert.deepEqual(JSON.parse(await readFile(saved.path, "utf8")), [manifest[1], manifest[3]]);
  assert.doesNotMatch(JSON.stringify(result), /synthetic-private|synthetic-token/);

  script([400]);
  const again = await f.cli.execute([
    "issues", "batch", "apply", "--file", path, "--failed-rows", "retry.json", "--profile", "dev",
  ]) as Record<string, unknown>;
  assert.match(String((again.failedRows as { error: string }).error), /already exists/);
  await assert.rejects(f.cli.execute([
    "issues", "batch", "apply", "--file", path, "--failed-rows", "retry.txt", "--profile", "dev",
  ]), /must end with \.json/);
});
