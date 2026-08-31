import assert from "node:assert/strict";
import { after, afterEach, before, test } from "node:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { getIssue, listComments, listIssues, listProjects, readUser } from "../src/client.js";

const server = setupServer();
before(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
after(() => server.close());
const connection = { baseUrl: "https://youtrack.example.com/context/", token: "synthetic-token" };
const listFields = "id,idReadable,summary,project(id,name,shortName),updated,resolved";

test("project, issue and comment collections use their exact defaults in one bounded request", async () => {
  const rows = [
    { run: () => listProjects(connection), path: "admin/projects", fields: "id,name,shortName" },
    { run: () => listIssues(connection), path: "issues", fields: listFields },
    { run: () => listComments(connection, "DEMO-1"), path: "issues/DEMO-1/comments", fields: "id,text,author(id,login),created,updated" },
  ];
  for (const row of rows) {
    let calls = 0;
    server.use(http.get(`https://youtrack.example.com/context/api/${row.path}`, ({ request }) => {
      calls++;
      const query = new URL(request.url).searchParams;
      assert.equal(query.get("fields"), row.fields);
      assert.equal(query.get("$top"), "50");
      assert.equal(query.get("$skip"), "0");
      assert.equal(request.headers.get("authorization"), "Bearer synthetic-token");
      return HttpResponse.json([]);
    }));
    assert.deepEqual(await row.run(), []);
    assert.equal(calls, 1);
  }
});

test("issue search preserves exact query and explicit projection/page values", async () => {
  const queryText = 'project: {Fixture Project} summary: "a+b & c" #Unresolved';
  server.use(http.get("https://youtrack.example.com/context/api/issues", ({ request }) => {
    const query = new URL(request.url).searchParams;
    assert.equal(query.get("query"), queryText);
    assert.equal(query.get("fields"), "summary,customFields(name,value(name))");
    assert.equal(query.get("$top"), "3");
    assert.equal(query.get("$skip"), "7");
    return HttpResponse.json([{ summary: null, customFields: [{ name: "State", value: null }] }]);
  }));
  assert.deepEqual(await listIssues(connection, {
    query: queryText, fields: "summary,customFields(name,value(name))", top: 3, skip: 7,
  }), [{ summary: null, customFields: [{ name: "State", value: null }] }]);
});

test("detail and comment paths encode one opaque ID segment without losing context", async () => {
  const id = "DEMO /?#%é";
  const encoded = encodeURIComponent(id);
  const expected = { id: "1-1", summary: null, project: null, description: null, resolved: null };
  server.use(http.get("*", ({ request }) => {
    const url = new URL(request.url);
    assert.ok([`/context/api/issues/${encoded}`, `/context/api/issues/${encoded}/comments`].includes(url.pathname));
    if (url.pathname.endsWith("/comments")) {
      assert.equal(url.searchParams.get("fields"), "text,author");
      return HttpResponse.json([{ text: null, author: null }]);
    }
    assert.equal(url.searchParams.get("fields"), `${listFields},description,created`);
    assert.equal(url.searchParams.has("$top"), false);
    return HttpResponse.json(expected);
  }));
  assert.deepEqual(await getIssue(connection, id), expected);
  assert.deepEqual(await listComments(connection, id, { fields: "text,author" }), [{ text: null, author: null }]);
});

test("user projection remains source-shaped and default identity remains minimal", async () => {
  server.use(http.get("*/api/users/me", ({ request }) => {
    const fields = new URL(request.url).searchParams.get("fields");
    return HttpResponse.json(fields === "email" ? { email: null } : { id: "1-1", login: "fixture-user" });
  }));
  assert.deepEqual(await readUser(connection, { fields: "email" }), { email: null });
  assert.deepEqual(await readUser(connection), { id: "1-1", login: "fixture-user" });
});

test("signed/credential URLs and known tokens are scrubbed recursively from explicit projections", async () => {
  const value = {
    attachments: [
      { url: "/api/files/1-1?sign=synthetic-signature&updated=1" },
      { thumbnailURL: "/api/files/1-2/sign=synthetic-signature" },
      { arbitrary: "https://fixture:synthetic-password@example.com/file" },
      { arbitrary: "https://example.com/file?X-Amz-Signature=synthetic-signature" },
    ],
    description: "prefix synthetic-token suffix",
    safe: "https://example.com/issue/DEMO-1?view=details",
    $type: "Issue",
  };
  server.use(http.get("*", () => HttpResponse.json(value)));
  const result = await getIssue(connection, "DEMO-1", { fields: "attachments(url,thumbnailURL),description" });
  assert.deepEqual(result.attachments, [
    { url: "[redacted]" }, { thumbnailURL: "[redacted]" },
    { arbitrary: "[redacted]" }, { arbitrary: "[redacted]" },
  ]);
  assert.equal(result.description, "prefix [redacted] suffix");
  assert.equal(result.safe, value.safe);
  assert.equal(result.$type, "Issue");
  assert.ok(!JSON.stringify(result).includes("synthetic-"));
});

test("local invalid paging, fields, query and traversal IDs fail before fetch", async () => {
  const fetch: typeof globalThis.fetch = async () => { assert.fail("Invalid input reached fetch"); };
  const local = { ...connection, fetch };
  for (const top of [0, 101, 1.5, NaN])
    await assert.rejects(listIssues(local, { top }), /top must/);
  for (const skip of [-1, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1])
    await assert.rejects(listProjects(local, { skip }), /skip must/);
  for (const fields of ["", " ", "id\nlogin"])
    await assert.rejects(readUser(local, { fields }), /fields must/);
  await assert.rejects(listIssues(local, { query: " " }), /query must/);
  for (const id of ["", " ", ".", "..", "bad\u0000id"]) {
    await assert.rejects(getIssue(local, id), /issue ID/);
    await assert.rejects(listComments(local, id), /issue ID/);
  }
});

test("read response shapes reject null, scalars, empty bodies and wrong collections", async () => {
  for (const body of ["null", '"text"', "", "[]"]) {
    server.use(http.get("*", () => new HttpResponse(body)));
    await assert.rejects(getIssue(connection, "DEMO-1"), /invalid .*response/);
  }
  for (const value of [{}, null, [null], [1], [[]]]) {
    server.use(http.get("*", () => HttpResponse.json(value)));
    await assert.rejects(listProjects(connection), /invalid .*response/);
  }
});

test("rate-limit errors preserve safe Retry-After information without body or header disclosure", async () => {
  server.use(http.get("*", () => new HttpResponse("synthetic-private-body", {
    status: 429, headers: { "Retry-After": "30" },
  })));
  await assert.rejects(listIssues(connection), /^Error: YouTrack request failed \(HTTP 429\)\. Retry after 30 seconds\.$/);
  server.use(http.get("*", () => new HttpResponse("synthetic-private-body", {
    status: 429, headers: { "Retry-After": "synthetic-private-header" },
  })));
  await assert.rejects(listIssues(connection), /^Error: YouTrack request failed \(HTTP 429\)\.$/);
});

test("valid HTTP-date Retry-After is normalized without copying arbitrary header data", async () => {
  server.use(http.get("*", () => new HttpResponse(null, {
    status: 429, headers: { "Retry-After": "Wed, 01 Jan 2031 00:00:00 GMT" },
  })));
  await assert.rejects(listProjects(connection), /^Error: YouTrack request failed \(HTTP 429\)\. Retry after Wed, 01 Jan 2031 00:00:00 GMT\.$/);
});

test("literal encoded dot IDs stay one encoded segment and redaction covers keys and embedded URLs", async () => {
  server.use(http.get("*", ({ request }) => {
    assert.equal(new URL(request.url).pathname, "/context/api/issues/%252e%252e");
    return HttpResponse.json({
      "synthetic-token": "value",
      description: "See https://example.com/api/files/1-1?sign=synthetic-signature for details",
    });
  }));
  assert.deepEqual(await getIssue(connection, "%2e%2e"), {
    "[redacted]": "value", description: "See [redacted] for details",
  });
});

test("collection reads reject a server page larger than the requested bound", async () => {
  server.use(http.get("*", () => HttpResponse.json([{ id: "1-1" }, { id: "1-2" }])));
  for (const run of [
    () => listProjects(connection, { top: 1 }),
    () => listIssues(connection, { top: 1 }),
    () => listComments(connection, "DEMO-1", { top: 1 }),
  ]) await assert.rejects(run(), /more items than the requested top limit/);
});

test("explicit fields scrub API-key URL spellings while preserving unsigned URLs", async () => {
  server.use(http.get("*", () => HttpResponse.json({
    links: ["https://example.com/?apiKey=synthetic-secret", "https://example.com/?apikey=synthetic-secret"],
    safe: "https://example.com/?view=details",
  })));
  assert.deepEqual(await readUser(connection, { fields: "links,safe" }), {
    links: ["[redacted]", "[redacted]"], safe: "https://example.com/?view=details",
  });
});

test("whole relative URL values and fragment credentials are redacted without changing unsigned links", async () => {
  server.use(http.get("*", () => HttpResponse.json({
    links: [
      "api/files/fixture?sign=synthetic-signature",
      "../api/files/fixture?sign=synthetic-signature",
      "https://example.com/file#access_token=synthetic-fragment",
      "https://example.com/file?apiKey=synthetic-key",
    ],
    safe: "https://example.com/file?assigned=true&design=compact#section",
  })));
  assert.deepEqual(await getIssue(connection, "DEMO-1", { fields: "links,safe" }), {
    links: ["[redacted]", "[redacted]", "[redacted]", "[redacted]"],
    safe: "https://example.com/file?assigned=true&design=compact#section",
  });
});

test("projected object keys use the same credential URL scrubber as string values", async () => {
  const safe = "https://example.com/files/part%2Fname?view=a%26b#section%2Ftwo";
  server.use(http.get("*", () => HttpResponse.json({
    entries: [
      { "/track/api/files/fixture/sign=synthetic-signature": "fixture" },
      { "See https://example.com/file?sign=synthetic-signature here": { "synthetic-token": null } },
      { [safe]: "unchanged" },
    ],
  })));
  assert.deepEqual(await getIssue(connection, "DEMO-1", { fields: "entries" }), {
    entries: [
      { "[redacted]": "fixture" },
      { "See [redacted] here": { "[redacted]": null } },
      { [safe]: "unchanged" },
    ],
  });
});

test("active bearer values in decoded URL components are redacted without rewriting safe URLs", async () => {
  const links = [
    "https://example.com/files/synthetic%2Dtoken",
    "https://example.com/file?download=synthetic%2Dtoken",
    "https://example.com/file?synthetic%2Dtoken=download",
    "https://example.com/file#synthetic%2Dtoken",
    "https://example.com/file#download=synthetic%2Dtoken",
    "https://example.com/file#synthetic%2Dtoken=download",
    "api/files/fixture?download=synthetic%2Dtoken",
  ];
  const safe = "https://example.com/files/part%2Fname?download=safe%26view%3D1#section%2Ftwo";
  server.use(http.get("*", () => HttpResponse.json({
    links, keys: [{ [links[1]!]: "fixture" }], safe,
    description: `See ${links[0]} for details`,
  })));
  assert.deepEqual(await readUser(connection, { fields: "links,keys,safe,description" }), {
    links: links.map(() => "[redacted]"), keys: [{ "[redacted]": "fixture" }], safe,
    description: "See [redacted] for details",
  });
});
