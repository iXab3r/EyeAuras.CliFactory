import assert from "node:assert/strict";
import { after, afterEach, before, test } from "node:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import {
  addWorkItem, getIssueWorkItem, getTimeTracking, getWorkItem,
  listIssueWorkItems, listWorkItems, updateWorkItem,
} from "../src/issue-time.js";

const server = setupServer();
before(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
after(() => server.close());
const connection = { baseUrl: "https://youtrack.example.com/context/", token: "synthetic-token" };
const itemFields = "id,date,duration(minutes,presentation),text,type(id,name),author(id,login),issue(id,idReadable)";
const issueID = "DEMO /?#%é";
const itemID = "work /?#%é";
const issueItems = `/api/issues/${encodeURIComponent(issueID)}/timeTracking/workItems`;

const reads = [
  { path: `/api/issues/${encodeURIComponent(issueID)}/timeTracking`, fields: "id,enabled", list: false,
    run: (options = {}) => getTimeTracking(connection, issueID, options) },
  { path: issueItems, fields: itemFields, list: true,
    run: (options = {}) => listIssueWorkItems(connection, issueID, options) },
  { path: `${issueItems}/${encodeURIComponent(itemID)}`, fields: itemFields, list: false,
    run: (options = {}) => getIssueWorkItem(connection, issueID, itemID, options) },
  { path: "/api/workItems", fields: itemFields, list: true,
    run: (options = {}) => listWorkItems(connection, options) },
  { path: `/api/workItems/${encodeURIComponent(itemID)}`, fields: itemFields, list: false,
    run: (options = {}) => getWorkItem(connection, itemID, options) },
];

test("five work-time reads preserve context, encoded IDs, finite defaults and bounded paging", async () => {
  for (const row of reads) {
    let calls = 0;
    server.use(http.get("*", ({ request }) => {
      calls++;
      const url = new URL(request.url);
      assert.equal(url.pathname, `/context${row.path}`);
      assert.equal(url.searchParams.get("fields"), row.fields);
      assert.equal(url.searchParams.get("$top"), row.list ? "50" : null);
      assert.equal(url.searchParams.get("$skip"), row.list ? "0" : null);
      assert.equal(request.headers.get("authorization"), "Bearer synthetic-token");
      return HttpResponse.json(row.list ? [{ id: "fixture-work", author: null }] : { id: "fixture-work", type: null });
    }));
    assert.deepEqual(await row.run(), row.list ? [{ id: "fixture-work", author: null }] : { id: "fixture-work", type: null });
    assert.equal(calls, 1);
  }
});

test("all work-time reads honor sparse explicit fields and scrub nested credential URLs", async () => {
  for (const row of reads) {
    server.use(http.get("*", ({ request }) => {
      assert.equal(new URL(request.url).searchParams.get("fields"), "text,issue(url)");
      const value = { text: "synthetic-token", issue: { url: "api/files/fixture?sign=synthetic-signature" } };
      return HttpResponse.json(row.list ? [value] : value);
    }));
    const value = { text: "[redacted]", issue: { url: "[redacted]" } };
    assert.deepEqual(await row.run({ fields: "text,issue(url)" }), row.list ? [value] : value);
  }
});

test("work-item pages are one request, support empty pages and reject over-sized responses", async () => {
  for (const row of reads.filter((item) => item.list)) {
    server.use(http.get("*", ({ request }) => {
      const query = new URL(request.url).searchParams;
      assert.equal(query.get("$top"), "1");
      assert.equal(query.get("$skip"), "3");
      return HttpResponse.json([]);
    }));
    assert.deepEqual(await row.run({ top: 1, skip: 3 }), []);
    server.use(http.get("*", () => HttpResponse.json([{ id: "one" }, { id: "two" }])));
    await assert.rejects(row.run({ top: 1 }), /more items than the requested top limit/);
  }
});

test("all work-time reads reject malformed responses and return safe HTTP status failures", async () => {
  for (const row of reads) {
    for (const payload of ["null", "42", "synthetic-private-malformed", row.list ? "{}" : "[]"]) {
      server.use(http.get("*", () => new HttpResponse(payload)));
      await assert.rejects(row.run(), /invalid .*response/);
    }
    for (const status of [400, 401, 403, 404, 429, 500]) {
      let calls = 0;
      server.use(http.get("*", () => {
        calls++;
        return new HttpResponse("synthetic-token private-data", { status });
      }));
      await assert.rejects(row.run(), new RegExp(`HTTP ${status}`));
      assert.equal(calls, 1);
    }
  }
});

test("invalid work-time IDs and paging fail before networking", async () => {
  const local = { ...connection, fetch: (async () => { assert.fail("Invalid input reached fetch"); }) as typeof globalThis.fetch };
  for (const id of ["", ".", "..", "bad\nvalue", "\ud800"]) {
    await assert.rejects(getTimeTracking(local, id), /YouTrack/);
    await assert.rejects(listIssueWorkItems(local, id), /YouTrack/);
    await assert.rejects(getIssueWorkItem(local, "DEMO-1", id), /YouTrack/);
    await assert.rejects(getWorkItem(local, id), /YouTrack/);
  }
  for (const options of [{ top: 0 }, { top: 101 }, { top: NaN }, { skip: -1 }, { skip: Number.MAX_SAFE_INTEGER + 1 }, { fields: "" }]) {
    await assert.rejects(listIssueWorkItems(local, "DEMO-1", options), /YouTrack/);
    await assert.rejects(listWorkItems(local, options), /YouTrack/);
  }
});

test("global work-item query is encoded once and remains absent from issue-local requests", async () => {
  const query = "project: {Fixture & Co} #Unresolved";
  server.use(http.get("*", ({ request }) => {
    const url = new URL(request.url);
    assert.equal(url.searchParams.get("query"), query);
    assert.equal(url.searchParams.get("$top"), "2");
    assert.equal(url.searchParams.size, 4);
    return HttpResponse.json([]);
  }));
  assert.deepEqual(await listWorkItems(connection, { query, top: 2 }), []);
  const local = { ...connection, fetch: (async () => { assert.fail("Invalid query reached fetch"); }) as typeof globalThis.fetch };
  for (const query of ["", " ", "value\nvalue"]) await assert.rejects(listWorkItems(local, { query }), /YouTrack query/);
});

const writes = [
  { path: issueItems, run: (body: unknown, options = {}) => addWorkItem(connection, issueID, body, options) },
  { path: `${issueItems}/${encodeURIComponent(itemID)}`,
    run: (body: unknown, options = {}) => updateWorkItem(connection, issueID, itemID, body, options) },
];

test("work-time POST bodies preserve supplied duration, selectors, null and multiline text without defaults", async () => {
  for (const row of writes) {
    for (const body of [
      { duration: { minutes: 90 } },
      { duration: { presentation: "1h 30m" } },
      { duration: { minutes: 90, presentation: "1h 30m" }, date: 1_700_006_400_000,
        author: { id: "fixture-author" }, type: { id: "fixture-type" }, text: "First line\n\n- Second line\tvalue",
        created: 1_700_006_401_000, updated: 1_700_006_402_000 },
      { duration: { minutes: 0 }, author: null, type: null, text: null, updated: null },
    ]) {
      let calls = 0;
      server.use(http.post("*", async ({ request }) => {
        calls++;
        const url = new URL(request.url);
        assert.equal(url.pathname, `/context${row.path}`);
        assert.equal(url.searchParams.get("fields"), itemFields);
        assert.equal(url.searchParams.size, 1);
        assert.equal(request.headers.get("content-type"), "application/json");
        assert.equal(request.headers.get("authorization"), "Bearer synthetic-token");
        assert.deepEqual(await request.json(), body);
        return HttpResponse.json({ id: "fixture-work", author: null });
      }));
      assert.deepEqual(await row.run(body), { id: "fixture-work", author: null });
      assert.equal(calls, 1);
    }
  }
});

test("work-time update permits each writable field alone and keeps omitted fields absent", async () => {
  const bodies = [{ text: "" }, { text: null }, { author: null }, { type: { id: "fixture-type" } },
    { date: 1_700_006_400_000 }, { created: 0 }, { updated: null }];
  for (const body of bodies) {
    server.use(http.post("*", async ({ request }) => {
      assert.deepEqual(await request.json(), body);
      return new HttpResponse(null, { status: 204 });
    }));
    assert.equal(await updateWorkItem(connection, issueID, itemID, body), null);
  }
});

test("work-time mutations support sparse fields, empty success and safe redacted object results", async () => {
  for (const row of writes) {
    const body = { duration: { minutes: 60 } };
    for (const status of [200, 204]) {
      server.use(http.post("*", () => new HttpResponse(null, { status })));
      assert.equal(await row.run(body), null);
    }
    for (const payload of ["null", "[]", "42", "synthetic-private-malformed"]) {
      server.use(http.post("*", () => new HttpResponse(payload)));
      await assert.rejects(row.run(body), /invalid .*response/);
    }
    server.use(http.post("*", ({ request }) => {
      assert.equal(new URL(request.url).searchParams.get("fields"), "text,issue(url)");
      return HttpResponse.json({ text: "synthetic-token", issue: { url: "/api/files/fixture?sign=synthetic-signature" } });
    }));
    assert.deepEqual(await row.run(body, { fields: "text,issue(url)" }),
      { text: "[redacted]", issue: { url: "[redacted]" } });
  }
});

test("work-time mutation validation rejects malformed values and unsupported fields before fetch", async () => {
  const local = { ...connection, fetch: (async () => { assert.fail("Invalid work-time body reached fetch"); }) as typeof globalThis.fetch };
  const invalid = [null, [], {}, "text", { duration: {} }, { duration: null },
    { duration: { minutes: "60" } }, { duration: { minutes: NaN } }, { duration: { minutes: Infinity } },
    { duration: { minutes: -1 } }, { duration: { minutes: 0.5 } }, { duration: { minutes: 2_147_483_648 } },
    { duration: { presentation: null } }, { duration: { presentation: " " } },
    { duration: { minutes: 60, presentation: 60 } }, { duration: { id: "60" } },
    { duration: { minutes: 60 }, creator: { id: "fixture-user" } },
    { duration: { minutes: 60 }, date: null }, { duration: { minutes: 60 }, date: "1700000000000" },
    { duration: { minutes: 60 }, date: Number.MAX_SAFE_INTEGER + 1 },
    { duration: { minutes: 60 }, created: null }, { duration: { minutes: 60 }, updated: 1.5 },
    { duration: { minutes: 60 }, author: {} }, { duration: { minutes: 60 }, author: { id: "" } },
    { duration: { minutes: 60 }, author: { id: "fixture", name: "Unsupported" } },
    { duration: { minutes: 60 }, type: { id: 1 } }, { duration: { minutes: 60 }, text: 1 },
    { duration: { minutes: 60 }, text: undefined }, { duration: undefined },
  ];
  for (const body of invalid) {
    await assert.rejects(addWorkItem(local, "DEMO-1", body), /YouTrack/);
    await assert.rejects(updateWorkItem(local, "DEMO-1", "fixture-work", body), /YouTrack/);
  }
  await assert.rejects(addWorkItem(local, "DEMO-1", { text: "No duration" }), /requires duration/);
  await assert.rejects(addWorkItem(local, "..", { duration: { minutes: 60 } }), /dot path/);
  await assert.rejects(updateWorkItem(local, "DEMO-1", "..", { text: null }), /dot path/);
});

test("neither work-time mutation retries remote failures or returns private diagnostics", async () => {
  for (const row of writes) {
    for (const status of [400, 401, 403, 404, 409, 429, 500]) {
      let calls = 0;
      server.use(http.post("*", () => {
        calls++;
        return new HttpResponse("synthetic-token private-validation", { status });
      }));
      await assert.rejects(row.run({ duration: { minutes: 60 } }),
        new RegExp(`^Error: YouTrack request failed \\(HTTP ${status}\\)\\.$`));
      assert.equal(calls, 1);
    }
  }
});

