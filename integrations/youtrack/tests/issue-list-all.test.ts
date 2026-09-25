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
function serve(items: readonly object[], page?: (index: number, top: number, skip: number) => Response | undefined) {
  const requests: Record<string, string>[] = [];
  server.use(http.get("*/context/api/issues", ({ request }) => {
    const query = Object.fromEntries(new URL(request.url).searchParams);
    requests.push(query);
    const top = Number(query.$top);
    const skip = Number(query.$skip);
    return page?.(requests.length - 1, top, skip) ?? HttpResponse.json(items.slice(skip, skip + top));
  }));
  return requests;
}

test("--all reads pages in server order with the same query and projection until a short page", async () => {
  const requests = serve(issues(5));
  const result = await listIssues(connection, { query: "project: DEMO", fields: "id,summary", top: 2, skip: 0, maxResults: 10 });
  assert.deepEqual(result, issues(5));
  assert.deepEqual(requests, [0, 2, 4].map((skip) => ({
    fields: "id,summary", $top: "2", $skip: String(skip), query: "project: DEMO",
  })));
});

test("empty, exact-page and exact-budget selections are complete; repeated IDs are removed", async () => {
  let requests = serve([]);
  assert.deepEqual(await listIssues(connection, { maxResults: 3 }), []);
  assert.equal(requests.length, 1);
  requests = serve(issues(4));
  assert.deepEqual(await listIssues(connection, { top: 2, maxResults: 10 }), issues(4));
  assert.deepEqual(requests.map((query) => query.$skip), ["0", "2", "4"]);
  requests = serve(issues(3));
  assert.deepEqual(await listIssues(connection, { top: 10, maxResults: 3 }), issues(3));
  assert.deepEqual(requests.map((query) => query.$top), ["4"]);
  // A concurrent insertion shifts later pages by one item: the repeated ID appears once.
  requests = serve(issues(4), (index, top, skip) =>
    index >= 1 ? HttpResponse.json(issues(4).slice(skip - 1, skip - 1 + top)) : undefined);
  assert.deepEqual(await listIssues(connection, { top: 2, maxResults: 10 }), issues(4));
});

test("budgets and later-page failures fail the whole selection without partial output", async () => {
  let requests = serve(issues(5));
  await assert.rejects(listIssues(connection, { top: 10, maxResults: 3 }), /exceeds --max-results/);
  assert.deepEqual(requests.map((query) => query.$top), ["4"]);
  serve(issues(5));
  await assert.rejects(listIssues(connection, { top: 2, maxResults: 10, maxBytes: 60 }), /exceeded --max-bytes/);
  serve(issues(5));
  await assert.rejects(listIssues(connection, { maxBytes: 20 }), /exceeded --max-bytes/);
  assert.equal((await listIssues(connection, { top: 2, maxResults: 10, maxBytes: 1000 })).length, 5);
  requests = serve(issues(5), (index) => index === 1 ? new HttpResponse("synthetic-private", { status: 500 }) : undefined);
  await assert.rejects(listIssues(connection, { top: 2, maxResults: 10 }), /^Error: YouTrack request failed \(HTTP 500\)\.$/);
  assert.equal(requests.length, 2);
  requests = serve(issues(2), () => HttpResponse.json(issues(2)));
  await assert.rejects(listIssues(connection, { top: 2, maxResults: 10 }), /repeated a full page/);
  assert.equal(requests.length, 2);
  for (const options of [{ maxResults: 0 }, { maxResults: 1.5 }, { maxBytes: 0 }]) {
    await assert.rejects(listIssues({ ...connection, fetch: () => assert.fail("fetch") }, options), /positive safe integer/);
  }
});

test("cancellation stops paging before another request", async () => {
  const controller = new AbortController();
  const requests = serve(issues(5), (index) => {
    if (index === 0) controller.abort();
    return undefined;
  });
  await assert.rejects(listIssues({ ...connection, signal: controller.signal }, { top: 2, maxResults: 10 }));
  assert.equal(requests.length, 1);
});

test("CLI --all requires --max-results and returns the same JSON array over CLI and RPC", async (t) => {
  const f = await configuredFixture(t);
  const requests = serve(issues(3));
  for (const argv of [["issues", "list", "--all"], ["issues", "list", "--max-results", "5"]]) {
    await assert.rejects(f.cli.execute([...argv, "--profile", "dev"]), /--all and --max-results must be used together/);
  }
  await assert.rejects(f.cli.execute(["issues", "list", "--all", "--max-results", "0", "--profile", "dev"]),
    /max-results must be a positive safe decimal integer/);
  assert.equal(requests.length, 0);
  const argv = ["issues", "list", "--all", "--max-results", "5", "--top", "2", "--fields", "id,summary", "--profile", "dev"];
  assert.deepEqual(await f.json(f.cli, argv), issues(3));
  const [reply] = await f.rpc(f.cli, [argv]) as { result: unknown }[];
  assert.deepEqual(reply!.result, issues(3));
});
