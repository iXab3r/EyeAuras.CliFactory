import { completeResult } from "./page-result.js";
import assert from "node:assert/strict";
import { after, afterEach, before, test } from "node:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { listIssues } from "../src/client.js";
import { configuredFixture } from "./cli-fixture.js";

const server = setupServer();
before(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
after(() => server.close());
const connection = { baseUrl: "https://youtrack.example.com/context/", token: "synthetic-token" };
const issues = (count: number) => Array.from({ length: count }, (_, index) => ({ id: `2-${index}`, summary: "x" }));

/** Serve offset pages from a list; `page` can override one response by its request index. */
function serve(items: readonly object[], page?: (index: number, pageSize: number, start: number) => Response | undefined) {
  const requests: Record<string, string>[] = [];
  server.use(http.get("*/context/api/issues", ({ request }) => {
    const query = Object.fromEntries(new URL(request.url).searchParams);
    requests.push(query);
    const pageSize = Number(query.$top);
    const start = Number(query.$skip);
    return page?.(requests.length - 1, pageSize, start) ?? HttpResponse.json(items.slice(start, start + pageSize));
  }));
  return requests;
}

test("--all reads pages in server order with the same query and projection until an empty page", async () => {
  const requests = serve(issues(5));
  const result = await listIssues(connection, { query: "project: DEMO", fields: "id,summary", pageSize: 2, start: 0, maxResults: 10 });
  assert.deepEqual(result, completeResult(issues(5)));
  assert.deepEqual(requests, [0, 2, 4, 5].map((start) => ({
    fields: "id,summary", $top: "2", $skip: String(start), query: "project: DEMO",
  })));
});

test("empty, exact-page and exact-budget selections are complete; repeated IDs are removed", async () => {
  let requests = serve([]);
  assert.deepEqual(await listIssues(connection, { maxResults: 3 }), completeResult([]));
  assert.equal(requests.length, 1);
  requests = serve(issues(4));
  assert.deepEqual(await listIssues(connection, { pageSize: 2, maxResults: 10 }), completeResult(issues(4)));
  assert.deepEqual(requests.map((query) => query.$skip), ["0", "2", "4"]);
  requests = serve(issues(3));
  assert.deepEqual(await listIssues(connection, { pageSize: 10, maxResults: 3 }), completeResult(issues(3)));
  assert.deepEqual(requests.map((query) => query.$top), ["4", "1"]);
  // A concurrent insertion shifts later pages by one item: the repeated ID appears once.
  requests = serve(issues(4), (index, pageSize, start) =>
    index >= 1 ? HttpResponse.json(issues(4).slice(start - 1, start - 1 + pageSize)) : undefined);
  assert.deepEqual(await listIssues(connection, { pageSize: 2, maxResults: 10 }), completeResult(issues(4)));
});

test("budgets and later-page failures fail the whole selection without partial output", async () => {
  let requests = serve(issues(5));
  await assert.rejects(listIssues(connection, { pageSize: 10, maxResults: 3 }), /exceeds --max-results/);
  assert.deepEqual(requests.map((query) => query.$top), ["4"]);
  serve(issues(5));
  await assert.rejects(listIssues(connection, { pageSize: 2, maxResults: 10, maxBytes: 60 }), /exceeded --max-bytes/);
  serve(issues(5));
  await assert.rejects(listIssues(connection, { maxBytes: 20 }), /exceeded --max-bytes/);
  assert.equal((await listIssues(connection, { pageSize: 2, maxResults: 10, maxBytes: 1000 })).items.length, 5);
  requests = serve(issues(5), (index) => index === 1 ? new HttpResponse("synthetic-private", { status: 500 }) : undefined);
  await assert.rejects(listIssues(connection, { pageSize: 2, maxResults: 10 }), /^HttpError: YouTrack answered HTTP 500\.$/);
  assert.equal(requests.length, 2);
  requests = serve(issues(2), () => HttpResponse.json(issues(2)));
  await assert.rejects(listIssues(connection, { pageSize: 2, maxResults: 10 }), /A page repeated/);
  assert.equal(requests.length, 2);
  for (const options of [{ maxResults: 0 }, { maxResults: 1.5 }, { maxBytes: 0 }]) {
    await assert.rejects(listIssues({ ...connection, fetch: () => assert.fail("fetch") }, options), /positive integer/);
  }
});

test("cancellation stops paging before another request", async () => {
  const controller = new AbortController();
  const requests = serve(issues(5), (index) => {
    if (index === 0) controller.abort();
    return undefined;
  });
  await assert.rejects(listIssues({ ...connection, signal: controller.signal }, { pageSize: 2, maxResults: 10 }));
  assert.equal(requests.length, 1);
});

test("cancellation before the first read or between decoded pages prevents the next request", async () => {
  const reason = new Error("synthetic stop");
  const requests = serve(issues(5));
  await assert.rejects(listIssues({ ...connection, signal: AbortSignal.abort(reason) }, {
    pageSize: 2, maxResults: 10,
  }), error => error === reason);
  assert.equal(requests.length, 0);

  const controller = new AbortController();
  await assert.rejects(listIssues({ ...connection, signal: controller.signal }, {
    pageSize: 2, maxResults: 10, progress: () => controller.abort(reason),
  }), error => error === reason);
  assert.equal(requests.length, 1);
});

test("server caps do not prove completion; raw rows advance even after deduplication", async () => {
  const requests = serve(issues(5), (_index, _top, start) => HttpResponse.json(issues(5).slice(start, start + 1)));
  assert.deepEqual(await listIssues(connection, { pageSize: 50, maxResults: 5 }), completeResult(issues(5)));
  assert.deepEqual(requests.map(query => query.$skip), ["0", "1", "2", "3", "4", "5"]);
});

test("projections without IDs preserve duplicates and still enforce the explicit budget", async () => {
  const rows = [{ summary: "same" }, { summary: "same" }];
  serve(rows);
  assert.deepEqual(await listIssues(connection, { fields: "summary", pageSize: 1, maxResults: 2 }), completeResult(rows));
  serve(rows, () => HttpResponse.json([{ summary: "same" }]));
  await assert.rejects(listIssues(connection, { fields: "summary", pageSize: 1, maxResults: 2 }), /exceeds --max-results/);
});

test("zero complete-page size and unsafe continuation fail without a successful selection", async () => {
  await assert.rejects(listIssues({ ...connection, fetch: () => assert.fail("fetch") }, { pageSize: 0, maxResults: 2 }), /positive integer/);
  const requests = serve([], () => HttpResponse.json([{ id: "boundary" }]));
  await assert.rejects(listIssues(connection, { pageSize: 1, start: Number.MAX_SAFE_INTEGER, maxResults: Number.MAX_SAFE_INTEGER }), /safe integer/);
  assert.equal(requests.length, 0);
});

test("CLI --all requires --max-results and returns the same page envelope over CLI and RPC", async (t) => {
  const f = await configuredFixture(t);
  const requests = serve(issues(3));
  for (const argv of [["issues", "list", "--all"], ["issues", "list", "--max-results", "5"]]) {
    await assert.rejects(f.cli.execute([...argv, "--profile", "dev"]), /--all and --max-results go together/);
  }
  await assert.rejects(f.cli.execute(["issues", "list", "--all", "--max-results", "0", "--profile", "dev"]),
    /max-results must be a positive integer/);
  assert.equal(requests.length, 0);
  const argv = ["issues", "list", "--all", "--max-results", "5", "--page-size", "2", "--fields", "id,summary", "--profile", "dev"];
  assert.deepEqual(await f.json(f.cli, argv), completeResult(issues(3)));
  const [reply] = await f.rpc(f.cli, [argv]) as { result: unknown }[];
  assert.deepEqual(reply!.result, completeResult(issues(3)));
});
