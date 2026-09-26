import assert from "node:assert/strict";
import test from "node:test";
import { CliError } from "@eyeauras/cli-factory";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { continuation, pageBudget, readPages } from "../src/paging.js";
import { createTestRuntime } from "./support.js";

const server = setupServer();
test.before(() => server.listen({ onUnhandledRequest: "error" }));
test.afterEach(() => server.resetHandlers());
test.after(() => server.close());

const href = (locator: string) =>
  `/app/rest/builds?locator=${encodeURIComponent(locator)}&fields=nextHref,build(id)`;

type Read = Parameters<typeof readPages<number>>[2];

function scripted(pages: Array<{ items: number[]; next?: string } | Error>) {
  const requests: Array<{ start: number; count: number; lookupLimit?: number }> = [];
  const read: Read = async (request) => {
    requests.push(request);
    const page = pages[Math.min(requests.length - 1, pages.length - 1)];
    if (page instanceof Error) throw page;
    return { items: page?.items ?? [], nextHref: page?.next === undefined ? undefined : href(page.next) };
  };
  return { read, requests };
}

test("the continuation reads only top-level numeric start and lookupLimit", () => {
  assert.deepEqual(
    continuation(href("buildType:(id:X,start:9),branch:(name:($base64:YSxi)),start:20,count:21,lookupLimit:10000")),
    { start: 20, lookupLimit: 10000 },
  );
  assert.deepEqual(continuation(href("defaultFilter:false,start:5,count:6")), { start: 5 });
  for (const value of [undefined, "", 42, href("count:6"), href("start:x"), "/no-locator", "::"]) {
    assert.equal(continuation(value), undefined, String(value));
  }
});

test("one extra item proves more, and only a short page without continuation proves the end", async () => {
  const more = scripted([{ items: [1, 2, 3], next: "start:3,count:3" }]);
  assert.deepEqual(await readPages(2, 0, more.read), {
    count: 2, items: [1, 2], hasMore: true, nextStart: 2,
  });
  assert.deepEqual(more.requests, [{ start: 0, count: 3 }]);

  const end = scripted([{ items: [7] }]);
  assert.deepEqual(await readPages(5, 10, end.read), {
    count: 1, items: [7], hasMore: false, nextStart: null,
  });
  assert.deepEqual(end.requests, [{ start: 10, count: 6 }]);
});

test("an empty page that only raises the lookup limit is followed; its limit is carried", async () => {
  const pages = scripted([
    { items: [], next: "start:0,count:4,lookupLimit:10000" },
    { items: [4, 5], next: "start:2,count:4,lookupLimit:15000" },
    { items: [6] },
  ]);
  assert.deepEqual(await readPages(3, 0, pages.read), {
    count: 3, items: [4, 5, 6], hasMore: false, nextStart: null,
  });
  assert.deepEqual(pages.requests, [
    { start: 0, count: 4 },
    { start: 0, count: 4, lookupLimit: 10000 },
    { start: 2, count: 2, lookupLimit: 15000 },
  ]);
});

test("a repeated continuation, the request budget and the time budget leave completeness unknown", async () => {
  const loop = scripted([{ items: [1], next: "start:0,count:6" }]);
  assert.deepEqual(await readPages(5, 0, loop.read), {
    count: 1, items: [1], hasMore: null, nextStart: 0,
  });
  assert.equal(loop.requests.length, 1, "A continuation that does not advance is not followed.");

  let limit = 5000;
  const deep: Read = async () => ({ items: [], nextHref: href(`start:0,count:3,lookupLimit:${limit += 5000}`) });
  let calls = 0;
  const counted: Read = async (request) => { calls++; return deep(request); };
  assert.deepEqual(await readPages(2, 0, counted), {
    count: 0, items: [], hasMore: null, nextStart: 0,
  });
  assert.equal(calls, pageBudget.requests);

  let clock = 0;
  const slow = scripted([{ items: [1], next: "start:1,count:6" }, { items: [2], next: "start:2,count:5" }]);
  const timed: Read = async (request) => { clock += pageBudget.milliseconds; return slow.read(request); };
  assert.deepEqual(await readPages(5, 0, timed, () => clock), {
    count: 1, items: [1], hasMore: null, nextStart: 1,
  });
});

test("a full page without a continuation is not proof of the end", async () => {
  const full = scripted([{ items: Array.from({ length: pageBudget.size }, (_, i) => i) }]);
  const page = await readPages(5000, 0, full.read);
  assert.equal(page.count, pageBudget.size);
  assert.equal(page.hasMore, null);
  assert.equal(page.nextStart, pageBudget.size);
});

test("a failed later page keeps the items read so far; a failed first page is the original error", async () => {
  const failure = new Error("synthetic read failure");
  const later = scripted([{ items: [1, 2], next: "start:2,count:4" }, failure]);
  await assert.rejects(readPages(3, 0, later.read), (error: unknown) => {
    assert.ok(error instanceof CliError);
    assert.equal(error.code, "list.incomplete");
    assert.deepEqual(error.result, { count: 2, items: [1, 2], hasMore: null, nextStart: 2 });
    return true;
  });
  const first = scripted([failure]);
  await assert.rejects(readPages(3, 0, first.read), (error: unknown) => error === failure);
});

test("builds list reads across a lookup-limit continuation and reports completeness", async (t) => {
  const locators: string[] = [];
  server.use(http.get("https://teamcity.test/app/rest/builds", ({ request }) => {
    const url = new URL(request.url);
    locators.push(url.searchParams.get("locator") ?? "");
    assert.equal(url.searchParams.get("fields")?.startsWith("nextHref,build("), true);
    return locators.length === 1
      ? HttpResponse.json({ build: [], nextHref: href("defaultFilter:false,start:0,count:3,lookupLimit:10000") })
      : HttpResponse.json({ build: [{ id: 9, state: "finished", status: "SUCCESS" }] });
  }));
  const runtime = await createTestRuntime(t);
  const cli = runtime.createCli();
  const result = await runtime.run(cli, ["builds", "list", "--limit", "2", "--status", "SUCCESS"]);
  assert.equal(result.exitCode, 0, result.stderr);
  assert.match(result.stdout, /^BUILD\s+JOB\s+BRANCH\s+STATE\s+RESULT\s+AGE\n9\s+finished\s+SUCCESS/);
  assert.match(result.stdout, /\n\nShown: 1\. More results: no\.\n$/);
  assert.deepEqual(locators, [
    "defaultFilter:false,branch:default:any,status:SUCCESS,start:0,count:3",
    "defaultFilter:false,branch:default:any,status:SUCCESS,start:0,count:3,lookupLimit:10000",
  ]);
});

test("a failed later builds page still prints what was read and exits non-zero", async (t) => {
  let calls = 0;
  server.use(http.get("https://teamcity.test/app/rest/builds", () =>
    ++calls === 1
      ? HttpResponse.json({
          build: [{ id: 1, state: "finished", status: "SUCCESS" }],
          nextHref: href("start:1,count:2,lookupLimit:10000"),
        })
      : new HttpResponse(null, { status: 503 })));
  const runtime = await createTestRuntime(t);
  const result = await runtime.run(runtime.createCli(), ["builds", "list", "--limit", "2", "--json"]);
  assert.equal(result.exitCode, 1);
  assert.deepEqual(JSON.parse(result.stdout), {
    count: 1, items: [{ id: 1, state: "finished", status: "SUCCESS" }], hasMore: null, nextStart: 1,
  });
  assert.equal(JSON.parse(result.stderr).error.code, "list.incomplete");
});
