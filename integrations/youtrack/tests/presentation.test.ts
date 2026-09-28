import assert from "node:assert/strict";
import { after, afterEach, before, test } from "node:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { configuredFixture } from "./cli-fixture.js";

const server = setupServer();
before(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
after(() => server.close());

const base = "https://youtrack.example.com/context/api";
const now = Date.now();
const issue = (n: number, extra: Record<string, unknown> = {}) => ({
  $type: "Issue", id: `2-${n}`, idReadable: `DEMO-${n}`, summary: `Issue ${n}`,
  project: { $type: "Project", id: "0-1", name: "Demo project", shortName: "DEMO" },
  updated: now - n * 3_600_000, resolved: n % 3 === 0 ? now - 1000 : null, ...extra,
});

async function human(t: Parameters<typeof configuredFixture>[0], argv: string[], permissions = ["ReadOnly", "Update"]) {
  const f = await configuredFixture(t, { permissions });
  const exitCode = await f.cli.run([...argv, "--profile", "dev"]);
  return { exitCode, stdout: f.stdout(), stderr: f.stderr(), f };
}

test("issue lists are tables that continue with --skip only when the page came back full", async (t) => {
  server.use(http.get(`${base}/issues`, ({ request }) =>
    HttpResponse.json(new URL(request.url).searchParams.get("$top") === "3" ? [issue(1), issue(2), issue(3)] : [issue(1)])));
  const full = await human(t, ["issues", "list", "--top", "3"]);
  assert.equal(
    full.stdout,
    "ISSUE   SUMMARY  PROJECT  STATE     UPDATED\n" +
      "DEMO-1  Issue 1  DEMO     open      1h\n" +
      "DEMO-2  Issue 2  DEMO     open      2h\n" +
      "DEMO-3  Issue 3  DEMO     resolved  3h\n" +
      "\nMore results: --skip 3\n",
  );
  assert.doesNotMatch(full.stdout, /\$type|\{"|17\d{11}/, "Human output shows no metadata, JSON or epoch numbers.");
  const short = await human(t, ["issues", "list"]);
  assert.doesNotMatch(short.stdout, /More results/);
  assert.equal(short.stderr, "");
  // JSON is the unchanged domain value.
  const json = await human(t, ["issues", "list", "--json"]);
  assert.deepEqual(JSON.parse(json.stdout), [issue(1)]);
});

test("an issue record names the object, wraps the description and suggests the next command", async (t) => {
  server.use(http.get(`${base}/issues/DEMO-7`, () =>
    HttpResponse.json(issue(7, { description: "First line.\nSecond line.", created: now - 86_400_000 }))));
  const shown = await human(t, ["issues", "get", "DEMO-7"]);
  assert.match(shown.stdout, /^DEMO-7 · Issue 7\nProject:  DEMO · Demo project\nState:    open\nCreated:  \d{4}-/);
  assert.match(shown.stdout, /\nDescription:\n {2}First line\.\n {2}Second line\.\n\nNext:\n {2}youtrack-cli issues comments list DEMO-7\n$/);
  // A projection that leaves the view's fields out still shows the data, generically.
  server.use(http.get(`${base}/issues/DEMO-8`, () => HttpResponse.json({ attachments: [{ id: "8-1", name: "trace.log" }] })));
  const projected = await human(t, ["issues", "get", "DEMO-8", "--fields", "attachments"]);
  assert.match(projected.stdout, /attachments: \[\{"id":"8-1","name":"trace\.log"\}\]/);
});

test("mutations name what they changed, and a 204 answer still reads as one line", async (t) => {
  server.use(
    http.get(`${base}/admin/projects/DEMO`, () => HttpResponse.json({ id: "0-1", shortName: "DEMO" })),
    http.post(`${base}/issues`, () => HttpResponse.json({ id: "2-99", idReadable: "DEMO-99", summary: "New issue", updated: now })),
    http.post(`${base}/issues/DEMO-7/comments`, () =>
      HttpResponse.json({ id: "4-2", text: "Fixed in build 42", author: { login: "me", id: "1-1" }, created: now, updated: null })),
    http.delete(`${base}/issues/DEMO-7/tags/6-1`, () => new HttpResponse(null, { status: 200 })),
  );
  const created = await human(t, ["issues", "create", "--body", '{"project":{"shortName":"DEMO"},"summary":"New issue"}']);
  assert.match(created.stdout, /^Created DEMO-99 · New issue\nUpdated:  \d{4}-.*\n\nNext:\n {2}youtrack-cli issues get DEMO-99\n$/s);
  const commented = await human(t, ["issues", "comments", "add", "DEMO-7", "--body", '{"text":"Fixed in build 42"}']);
  assert.match(commented.stdout, /^Added comment 4-2 to DEMO-7\nAuthor:   me\n/);
  assert.match(commented.stdout, /\nText:\n {2}Fixed in build 42\n$/);
  const removed = await human(t, ["issues", "tags", "remove", "DEMO-7", "6-1"]);
  assert.equal(removed.stdout, "Removed tag 6-1 from DEMO-7.\n");
  assert.equal((await human(t, ["issues", "tags", "remove", "DEMO-7", "6-1", "--json"])).stdout, "null\n");
});

test("lists, counts and reference tables read as names, not JSON", async (t) => {
  server.use(
    http.get(`${base}/issues/DEMO-7/tags`, () => HttpResponse.json([{ id: "6-1", name: "urgent" }, { id: "6-2", name: "backend" }])),
    http.get(`${base}/issues/DEMO-7/links`, () => HttpResponse.json([
      { id: "1s", direction: "OUTWARD", linkType: { name: "Relates", sourceToTarget: "relates to", targetToSource: "relates to", directed: false } },
      { id: "3t", direction: "INWARD", linkType: { name: "Depend", sourceToTarget: "is required for", targetToSource: "depends on", directed: true } },
    ])),
    http.post(`${base}/issuesGetter/count`, () => HttpResponse.json({ count: 42 })),
    http.get(`${base}/admin/projects`, () => HttpResponse.json([{ $type: "Project", id: "0-1", name: "Demo project", shortName: "DEMO" }])),
    http.get(`${base}/users/me`, () => HttpResponse.json({ id: "1-1", login: "me" })),
  );
  assert.equal((await human(t, ["issues", "tags", "list", "DEMO-7"])).stdout, "urgent (6-1)\nbackend (6-2)\n");
  assert.equal((await human(t, ["issues", "links", "list", "DEMO-7"])).stdout, "relates to (1s)\ndepends on (3t)\n");
  assert.equal((await human(t, ["issues", "count", "--query", "project: DEMO"])).stdout, '42 issues match "project: DEMO".\n');
  assert.equal((await human(t, ["project", "list"])).stdout, "ID   KEY   NAME\n0-1  DEMO  Demo project\n");
  assert.equal((await human(t, ["user", "me"])).stdout, "me\nID:  1-1\n");
});

test("reading every page reports progress to a person only, and the batch summary reads as lines", async (t) => {
  server.use(http.get(`${base}/issues`, ({ request }) => {
    const skip = Number(new URL(request.url).searchParams.get("$skip"));
    return HttpResponse.json(skip >= 4 ? [issue(5)] : [issue(skip + 1), issue(skip + 2)]);
  }));
  const all = await human(t, ["issues", "list", "--all", "--max-results", "10", "--top", "2"]);
  assert.equal(all.stderr, "Read 2 so far; reading the next page.\nRead 4 so far; reading the next page.\n");
  assert.match(all.stdout, /DEMO-5/);
  assert.doesNotMatch(all.stdout, /More results/);
  assert.equal((await human(t, ["issues", "list", "--all", "--max-results", "10", "--top", "2", "--json"])).stderr, "");
});

test("help groups the root commands and every everyday description is short", async (t) => {
  const { stdout } = await human(t, ["--help"]);
  assert.match(stdout, /Everyday:\n {2}issues +Read and update issues\n/);
  assert.match(stdout, /Reference:\n {2}field +Inspect custom fields and their types\n/);
  assert.match(stdout, /Examples:\n {2}youtrack-cli issues list --query/);
  assert.doesNotMatch(stdout, /List one page of|non-secret|explicitly|\(required\) *$/m);
  const issues = await human(t, ["issues", "--help"]);
  const commands = issues.stdout.split("\nExamples:")[0] ?? "";
  const descriptions = commands.split("\n").filter((line) => /^ {2}\S/.test(line) && !line.includes("--help"))
    .map((line) => line.replace(/^ {2}\S+( \[options\])?( <[^>]+>)* +/, ""));
  for (const description of descriptions) {
    assert.ok(description.split(" ").length <= 8, `Too long: ${description}`);
  }
});
