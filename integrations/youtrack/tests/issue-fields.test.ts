import assert from "node:assert/strict";
import { after, afterEach, before, test } from "node:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import {
  getProject, getProjectField, listProjectFields, listUsers,
  listIssueFields, getIssueField, setIssueField,
} from "../src/issue-fields.js";

const server = setupServer();
before(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
after(() => server.close());
const connection = { baseUrl: "https://youtrack.example.com/context/", token: "synthetic-token" };
const projectID = "DEMO /?#%é";
const fieldID = "field /?#%é";
const projectPath = `/context/api/admin/projects/${encodeURIComponent(projectID)}`;
const issuePath = `/context/api/issues/${encodeURIComponent(projectID)}`;
const projectFields = "id,field(id,name,fieldType(id,valueType,isMultiValue)),canBeEmpty,emptyFieldText,isPublic";
const issueFields = "id,name,$type,value(id,name,login,minutes,presentation,text),projectCustomField(id)";
const reads = [
  { path: projectPath, fields: "id,name,shortName,description,archived", collection: false,
    run: () => getProject(connection, projectID), projected: () => getProject(connection, projectID, { fields: "id" }) },
  { path: `${projectPath}/customFields`, fields: projectFields, collection: true,
    run: () => listProjectFields(connection, projectID), projected: () => listProjectFields(connection, projectID, { fields: "id", top: 3, skip: 7 }) },
  { path: `${projectPath}/customFields/${encodeURIComponent(fieldID)}`, fields: projectFields, collection: false,
    run: () => getProjectField(connection, projectID, fieldID), projected: () => getProjectField(connection, projectID, fieldID, { fields: "id" }) },
  { path: "/context/api/users", fields: "id,login,fullName", collection: true,
    run: () => listUsers(connection), projected: () => listUsers(connection, { fields: "id", top: 3, skip: 7 }) },
  { path: `${issuePath}/customFields`, fields: issueFields, collection: true,
    run: () => listIssueFields(connection, projectID), projected: () => listIssueFields(connection, projectID, { fields: "id", top: 3, skip: 7 }) },
  { path: `${issuePath}/customFields/${encodeURIComponent(fieldID)}`, fields: issueFields, collection: false,
    run: () => getIssueField(connection, projectID, fieldID), projected: () => getIssueField(connection, projectID, fieldID, { fields: "id" }) },
];

for (const row of reads) test(`field context GET ${row.path} preserves paths, projections and one-page shape`, async () => {
  let calls = 0;
  server.use(http.get("*", ({ request }) => {
    const explicit = calls++ === 1;
    const url = new URL(request.url);
    assert.equal(url.pathname, row.path);
    assert.equal(request.headers.get("authorization"), "Bearer synthetic-token");
    assert.equal(request.redirect, "error");
    assert.deepEqual(Object.fromEntries(url.searchParams), {
      fields: explicit ? "id" : row.fields,
      ...(row.collection ? { $top: explicit ? "3" : "50", $skip: explicit ? "7" : "0" } : {}),
    });
    return HttpResponse.json(row.collection ? [{ id: "fixture-id", value: null }] : { id: "fixture-id", value: null });
  }));
  const expected = row.collection ? [{ id: "fixture-id", value: null }] : { id: "fixture-id", value: null };
  assert.deepEqual(await row.run(), expected);
  assert.deepEqual(await row.projected(), expected);
  assert.equal(calls, 2);
});

test("field projections preserve polymorphic values and explicitly requested state-machine events", async () => {
  const values = [null, "plain", 0, 1.5, { id: "fixture-value" }, [], [{ id: "fixture-value" }], { text: "line one\nline two" }];
  server.use(http.get("*", () => HttpResponse.json(values.map((value) => ({ value })))));
  assert.deepEqual(await listIssueFields(connection, "DEMO-1"), values.map((value) => ({ value })));
  const fields = "id,$type,possibleEvents(id,presentation)";
  server.use(http.get("*", ({ request }) => {
    assert.equal(new URL(request.url).searchParams.get("fields"), fields);
    return HttpResponse.json({ $type: "StateMachineIssueCustomField", possibleEvents: [{ id: "start", presentation: null }] });
  }));
  assert.deepEqual(await getIssueField(connection, "DEMO-1", "fixture-field", { fields }), {
    $type: "StateMachineIssueCustomField", possibleEvents: [{ id: "start", presentation: null }],
  });
});

test("field reads reject remote errors and invalid shapes and redact nested credentials", async () => {
  for (const row of reads) {
    server.use(http.get("*", () => new HttpResponse("synthetic-token private-response", { status: 403 })));
    await assert.rejects(row.run(), /^Error: YouTrack request failed \(HTTP 403\)\.$/);
    server.use(http.get("*", () => HttpResponse.json(row.collection ? {} : [])));
    await assert.rejects(row.run(), /invalid .*response/);
    server.use(http.get("*", () => HttpResponse.json(row.collection ? [] : {})));
    assert.deepEqual(await row.run(), row.collection ? [] : {});
  }
  server.use(http.get("*", () => HttpResponse.json({ value: { text: "synthetic-token", url: "/files/a?sign=synthetic-signature" } })));
  assert.deepEqual(await getIssueField(connection, "DEMO-1", "fixture-field"), { value: { text: "[redacted]", url: "[redacted]" } });
});

const referenceFamilies = ["Enum", "Build", "Version", "Owned", "Group", "User"];
test("all eighteen concrete field types send validated source-shaped values with one POST", async () => {
  const bodies: Record<string, unknown>[] = referenceFamilies.flatMap((family) => [
    { $type: `Single${family}IssueCustomField`, value: family === "User" ? { login: "fixture-user" } : { name: "Fixture value" } },
    { $type: `Multi${family}IssueCustomField`, value: [{ id: "fixture-value" }] },
  ]);
  bodies.push(
    { $type: "StateIssueCustomField", value: { id: "fixture-state" } },
    { $type: "SimpleIssueCustomField", value: "line one\nline two" },
    { $type: "DateIssueCustomField", value: 43200000 },
    { $type: "PeriodIssueCustomField", value: { minutes: 0 } },
    { $type: "TextIssueCustomField", value: { text: "line one\n\nline two" } },
    { $type: "StateMachineIssueCustomField", event: { id: "start" } },
  );
  for (const body of bodies) {
    let calls = 0;
    server.use(http.post("*", async ({ request }) => {
      calls++;
      const url = new URL(request.url);
      assert.equal(url.pathname, `${issuePath}/customFields/${encodeURIComponent(fieldID)}`);
      assert.deepEqual(Object.fromEntries(url.searchParams), { fields: issueFields });
      assert.equal(request.headers.get("authorization"), "Bearer synthetic-token");
      assert.equal(request.headers.get("content-type"), "application/json");
      assert.deepEqual(await request.json(), body);
      return HttpResponse.json({ id: "fixture-field", $type: body.$type, value: null });
    }));
    assert.deepEqual(await setIssueField(connection, projectID, fieldID, body), { id: "fixture-field", $type: body.$type, value: null });
    assert.equal(calls, 1);
  }
});

test("field clearing, primitive numbers, period presentation and text null remain explicit", async () => {
  const bodies = [
    ...referenceFamilies.flatMap((family) => [
      { $type: `Single${family}IssueCustomField`, value: null },
      { $type: `Multi${family}IssueCustomField`, value: [] },
    ]),
    ...["State", "Simple", "Date", "Period", "Text"].map((family) => ({ $type: `${family}IssueCustomField`, value: null })),
    { $type: "SimpleIssueCustomField", value: 1.25 },
    { $type: "SimpleIssueCustomField", value: "" },
    { $type: "PeriodIssueCustomField", value: { presentation: "2h 30m" } },
    { $type: "TextIssueCustomField", value: { text: null } },
    { $type: "TextIssueCustomField", value: { text: "" } },
    { $type: "SingleUserIssueCustomField", value: { id: "fixture-user", login: "fixture-login", name: "Fixture User" } },
    { $type: "MultiUserIssueCustomField", value: [{ id: "fixture-user", login: "fixture-login" }] },
    { $type: "SingleEnumIssueCustomField", value: { id: "a", name: "b" } },
    { $type: "PeriodIssueCustomField", value: { minutes: 1, presentation: "1m" } },
  ];
  for (const body of bodies) {
    server.use(http.post("*", async ({ request }) => {
      assert.deepEqual(await request.json(), body);
      return new HttpResponse(null, { status: 204 });
    }));
    assert.equal(await setIssueField(connection, "DEMO-1", "fixture-field", body), null);
  }
});

test("invalid field payloads and IDs fail locally without secret-bearing diagnostics", async () => {
  let calls = 0;
  const local = { ...connection, fetch: (async () => { calls++; throw new Error("Unexpected fetch"); }) as typeof globalThis.fetch };
  const cases: unknown[] = [null, [], {}, { value: null }, { $type: "synthetic-private-type", value: null },
    { $type: "SimpleIssueCustomField" }, { $type: "SimpleIssueCustomField", value: true },
    { $type: "SimpleIssueCustomField", value: Infinity }, { $type: "SimpleIssueCustomField", value: NaN },
    { $type: "SimpleIssueCustomField", value: {} }, { $type: "SimpleIssueCustomField", value: "ok", id: "forbidden" },
    { $type: "SingleEnumIssueCustomField", value: {} }, { $type: "SingleEnumIssueCustomField", value: { name: " " } },
    { $type: "SingleEnumIssueCustomField", value: { login: "wrong-family" } },
    { $type: "SingleEnumIssueCustomField", value: { id: "a", $type: "EnumBundleElement" } },
    { $type: "MultiEnumIssueCustomField", value: null }, { $type: "MultiUserIssueCustomField", value: [null] },
    { $type: "DateIssueCustomField", value: 1.5 }, { $type: "DateIssueCustomField", value: Number.MAX_SAFE_INTEGER + 1 },
    { $type: "PeriodIssueCustomField", value: {} }, { $type: "PeriodIssueCustomField", value: { minutes: -1 } },
    { $type: "PeriodIssueCustomField", value: { minutes: 1.5 } },
    { $type: "PeriodIssueCustomField", value: { presentation: " " } },
    { $type: "TextIssueCustomField", value: { text: 3 } }, { $type: "TextIssueCustomField", value: { text: "x", markdownText: "forbidden" } },
    { $type: "StateMachineIssueCustomField", value: { id: "state" } },
    { $type: "StateMachineIssueCustomField", event: { id: "start" }, value: null },
    { $type: "StateMachineIssueCustomField", event: { presentation: "Start" } },
    { $type: "StateMachineIssueCustomField", event: { id: " " } },
  ];
  for (const input of cases) await assert.rejects(setIssueField(local, "DEMO-1", "fixture-field", input), (error: Error) => {
    assert.match(error.message, /YouTrack/);
    assert.doesNotMatch(error.message, /synthetic-private/);
    return true;
  });
  for (const id of [".", "..", "bad\nvalue", "\ud800"]) {
    await assert.rejects(getProject(local, id), /YouTrack/);
    await assert.rejects(getProjectField(local, "DEMO", id), /YouTrack/);
    await assert.rejects(getIssueField(local, "DEMO-1", id), /YouTrack/);
    await assert.rejects(setIssueField(local, "DEMO-1", id, { $type: "SimpleIssueCustomField", value: null }), /YouTrack/);
  }
  await assert.rejects(listUsers(local, { top: 101 }), /YouTrack/);
  await assert.rejects(listProjectFields(local, "DEMO", { skip: -1 }), /YouTrack/);
  await assert.rejects(listIssueFields(local, "DEMO-1", { fields: " " }), /YouTrack/);
  assert.equal(calls, 0);
});

test("field updates never retry rejection and preserve common empty/error/redaction rules", async () => {
  const run = () => setIssueField(connection, "DEMO-1", "fixture-field", { $type: "SimpleIssueCustomField", value: "x" });
  for (const status of [400, 401, 403, 409, 429, 500]) {
    let calls = 0;
    server.use(http.post("*", () => { calls++; return new HttpResponse("synthetic-token private-response", { status }); }));
    await assert.rejects(run(), new RegExp(`^Error: YouTrack request failed \\(HTTP ${status}\\)\\.$`));
    assert.equal(calls, 1);
  }
  for (const body of ["null", "[]", "malformed-private-response"]) {
    server.use(http.post("*", () => new HttpResponse(body)));
    await assert.rejects(run(), /invalid .*response/);
  }
  server.use(http.post("*", () => HttpResponse.json({ value: "synthetic-token", nested: { url: "files/a#access_token=synthetic-secret" } })));
  assert.deepEqual(await run(), { value: "[redacted]", nested: { url: "[redacted]" } });
});



test("period minutes enforce the explicit nonnegative Int32 CLI range before fetch", async () => {
  const allowed = [0, 2_147_483_647];
  let calls = 0;
  server.use(http.post("*", async ({ request }) => {
    assert.deepEqual(await request.json(), {
      $type: "PeriodIssueCustomField", value: { minutes: allowed[calls++] },
    });
    return new HttpResponse(null, { status: 204 });
  }));
  for (const minutes of allowed) {
    assert.equal(await setIssueField(connection, "DEMO-1", "fixture-field", {
      $type: "PeriodIssueCustomField", value: { minutes },
    }), null);
  }
  for (const minutes of [2_147_483_648, Number.MAX_SAFE_INTEGER]) {
    await assert.rejects(setIssueField(connection, "DEMO-1", "fixture-field", {
      $type: "PeriodIssueCustomField", value: { minutes },
    }), /between 0 and 2147483647/);
  }
  assert.equal(calls, 2);
});

