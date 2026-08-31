import assert from "node:assert/strict";
import { after, afterEach, before, test } from "node:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { addComment, createIssue, updateIssue } from "../src/client.js";

const server = setupServer();
before(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
after(() => server.close());
const connection = { baseUrl: "https://youtrack.example.com/context/", token: "synthetic-token" };
const issueFields = "id,idReadable,summary,updated";
const commentFields = "id,text,author(id,login),created,updated";

test("create, update and comment send one exact POST with finite response projections", async () => {
  const id = "DEMO /?#%é";
  const rows = [
    {
      path: "/api/issues", fields: issueFields,
      body: { project: { id: "fixture-project" }, summary: " Fixture summary ", description: "Line one\n\n- item\tvalue" },
      run: (body: unknown) => createIssue(connection, body),
    },
    {
      path: `/api/issues/${encodeURIComponent(id)}`, fields: issueFields,
      body: { description: null }, run: (body: unknown) => updateIssue(connection, id, body),
    },
    {
      path: `/api/issues/${encodeURIComponent(id)}/comments`, fields: commentFields,
      body: { text: "First line\n\n```text\nsecond line\n```" },
      run: (body: unknown) => addComment(connection, id, body),
    },
  ];
  for (const row of rows) {
    let calls = 0;
    server.use(http.post("*", async ({ request }) => {
      calls++;
      const url = new URL(request.url);
      assert.equal(url.pathname, `/context${row.path}`);
      assert.equal(url.searchParams.get("fields"), row.fields);
      assert.equal(request.headers.get("content-type"), "application/json");
      assert.equal(request.headers.get("authorization"), "Bearer synthetic-token");
      assert.deepEqual(await request.json(), row.body);
      return HttpResponse.json({ id: "fixture-id", updated: null });
    }));
    assert.deepEqual(await row.run(row.body), { id: "fixture-id", updated: null });
    assert.equal(calls, 1);
  }
});

test("unspecified descriptions stay omitted and explicit description null is sent", async () => {
  const bodies: unknown[] = [];
  server.use(http.post("*", async ({ request }) => {
    bodies.push(await request.json());
    return HttpResponse.json({ id: "fixture-id" });
  }));
  await createIssue(connection, { project: { id: "fixture-project" }, summary: "Summary" });
  await createIssue(connection, { project: { id: "fixture-project" }, summary: "Summary", description: null });
  await updateIssue(connection, "DEMO-1", { summary: "Changed" });
  await updateIssue(connection, "DEMO-1", { description: "" });
  assert.deepEqual(bodies, [
    { project: { id: "fixture-project" }, summary: "Summary" },
    { project: { id: "fixture-project" }, summary: "Summary", description: null },
    { summary: "Changed" }, { description: "" },
  ]);
});

test("all mutation families return null only for empty success, and redact object results", async () => {
  const runs = [
    () => createIssue(connection, { project: { id: "fixture-project" }, summary: "Summary" }),
    () => updateIssue(connection, "DEMO-1", { description: null }),
    () => addComment(connection, "DEMO-1", { text: "Comment" }),
  ];
  for (const run of runs) {
    server.use(http.post("*", () => new HttpResponse(null, { status: 204 })));
    assert.equal(await run(), null);
    for (const body of ["null", "[]", "synthetic-private-malformed"]) {
      server.use(http.post("*", () => new HttpResponse(body)));
      await assert.rejects(run(), /invalid .*response/);
    }
    server.use(http.post("*", () => HttpResponse.json({
      text: "synthetic-token", attachment: { url: "api/files/1?sign=synthetic-signature" },
    })));
    assert.deepEqual(await run(), { text: "[redacted]", attachment: { url: "[redacted]" } });
  }
});

test("strict mutation bodies reject unsupported root/nested fields and missing values before fetch", async () => {
  const local = { ...connection, fetch: (async () => { assert.fail("Invalid body reached fetch"); }) as typeof globalThis.fetch };
  for (const body of [null, [], "private", {}, { summary: "Summary" },
    { project: { id: "" }, summary: "Summary" },
    { project: { id: "fixture", name: "Unsupported" }, summary: "Summary" },
    { project: { id: "fixture" }, summary: " " },
    { project: { id: "fixture" }, summary: "Summary", description: 1 },
    { project: { id: "fixture" }, summary: "Summary", customFields: [] },
  ]) await assert.rejects(createIssue(local, body), /YouTrack/);
  for (const body of [null, [], {}, { summary: " " }, { summary: null }, { description: 1 },
    { summary: undefined }, { description: undefined }, { customFields: [] },
  ]) await assert.rejects(updateIssue(local, "DEMO-1", body), /YouTrack/);
  for (const body of [null, [], {}, { text: " " }, { text: null }, { text: "Comment", visibility: {} }])
    await assert.rejects(addComment(local, "DEMO-1", body), /YouTrack/);
});

test("remote rejection never retries any mutation or exposes body diagnostics", async () => {
  const runs = [
    () => createIssue(connection, { project: { id: "fixture-project" }, summary: "Summary" }),
    () => updateIssue(connection, "DEMO-1", { summary: "Summary" }),
    () => addComment(connection, "DEMO-1", { text: "Comment" }),
  ];
  for (const run of runs) {
    for (const status of [400, 401, 403, 409, 429, 500]) {
      let calls = 0;
      server.use(http.post("*", () => {
        calls++;
        return new HttpResponse("synthetic-token synthetic-private-validation", { status });
      }));
      await assert.rejects(run(), new RegExp(`^Error: YouTrack request failed \\(HTTP ${status}\\)\\.$`));
      assert.equal(calls, 1);
    }
  }
});
