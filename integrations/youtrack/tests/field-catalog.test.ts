import assert from "node:assert/strict";
import { after, afterEach, before, test } from "node:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import {
  getCustomField,
  getEnumBundle,
  getEnumValue,
  getStateBundle,
  getStateValue,
  listEnumValues,
  listStateValues,
} from "../src/field-catalog.js";
import { catalogCases } from "./field-catalog-cases.js";

const server = setupServer();
before(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
after(() => server.close());
const connection = { baseUrl: "https://youtrack.example.com/context/", token: "synthetic-token" };

for (const row of catalogCases) test(`catalog GET ${row.path} sends its finite projection and one-page contract`, async () => {
  let calls = 0;
  server.use(http.get("*", async ({ request }) => {
    const explicit = calls++ === 1;
    const url = new URL(request.url);
    assert.equal(url.pathname, row.path);
    assert.equal(request.method, "GET");
    assert.equal(await request.text(), "");
    assert.equal(request.redirect, "error");
    assert.equal(request.headers.get("authorization"), "Bearer synthetic-token");
    assert.equal(request.headers.get("accept"), "application/json");
    assert.deepEqual(Object.fromEntries(url.searchParams), {
      fields: explicit ? "id,$type" : row.fields,
      ...(row.collection ? { $top: explicit ? "2" : "50", $skip: explicit ? "3" : "0" } : {}),
    });
    return HttpResponse.json(row.collection ? [{ id: "fixture-result" }] : { id: "fixture-result" });
  }));
  const expected = row.collection ? [{ id: "fixture-result" }] : { id: "fixture-result" };
  assert.deepEqual(await row.run(connection), expected);
  assert.deepEqual(await row.run(connection, { fields: "id,$type", top: 2, skip: 3 }), expected);
  assert.equal(calls, 2);
});

test("all catalog routes retain empty/sparse data and reject malformed responses without leaking diagnostics", async () => {
  for (const row of catalogCases) {
    server.use(http.get("*", () => HttpResponse.json(row.collection ? [] : {})));
    assert.deepEqual(await row.run(connection), row.collection ? [] : {});
    for (const body of ["null", row.collection ? "{}" : "[]", "malformed-synthetic-private"]) {
      server.use(http.get("*", () => new HttpResponse(body)));
      await assert.rejects(row.run(connection), /invalid .*response/);
    }
    let calls = 0;
    server.use(http.get("*", () => {
      calls++;
      return new HttpResponse("synthetic-token private-server-message", { status: 403 });
    }));
    await assert.rejects(row.run(connection), /^Error: YouTrack request failed \(HTTP 403\)\.$/);
    assert.equal(calls, 1);
  }
});

test("catalog nullable metadata, archived values and state resolution flags remain source-shaped", async () => {
  const choice = { id: "fixture-choice", localizedName: null, description: null, archived: true, isResolved: false };
  server.use(http.get("*", () => HttpResponse.json([choice])));
  assert.deepEqual(await listStateValues(connection, "fixture-bundle"), [choice]);
  const detail = { id: "fixture-field", aliases: null, localizedName: null, fieldType: { id: "enum[*]", isMultiValue: true } };
  server.use(http.get("*", () => HttpResponse.json(detail)));
  assert.deepEqual(await getCustomField(connection, "fixture-field"), detail);
  server.use(http.get("*", () => HttpResponse.json({
    values: [{ name: "synthetic-token", url: "/files/a?sign=synthetic-secret" }],
  })));
  assert.deepEqual(await getEnumBundle(connection, "fixture-bundle", { fields: "values(name,url)" }), {
    values: [{ name: "[redacted]", url: "[redacted]" }],
  });
});

test("catalog rejects invalid paging and projection before fetch and detects oversized collection pages", async () => {
  let calls = 0;
  server.use(http.get("*", () => { calls++; return HttpResponse.json([{ id: "a" }, { id: "b" }]); }));
  for (const row of catalogCases) {
    await assert.rejects(row.run(connection, { fields: " " }), /fields must be nonempty/);
    if (row.collection) {
      for (const options of [{ top: 0 }, { top: 101 }, { top: 1.5 }, { skip: -1 }, { skip: Number.MAX_SAFE_INTEGER + 1 }]) {
        await assert.rejects(row.run(connection, options), /YouTrack/);
      }
    }
  }
  assert.equal(calls, 0);
  for (const row of catalogCases.filter((item) => item.collection)) {
    await assert.rejects(row.run(connection, { top: 1 }), /more items than the requested top limit/);
  }
  assert.equal(calls, catalogCases.filter((item) => item.collection).length);
});

test("all catalog ID positions reject dot traversal, controls and malformed Unicode locally", async () => {
  let calls = 0;
  const local = { ...connection, fetch: (async () => { calls++; throw new Error("Unexpected fetch"); }) as typeof globalThis.fetch };
  for (const id of [".", "..", "bad\nvalue", "\ud800"]) {
    for (const run of [
      () => getCustomField(local, id),
      () => getEnumBundle(local, id),
      () => listEnumValues(local, id),
      () => getEnumValue(local, id, "valid"),
      () => getEnumValue(local, "valid", id),
      () => getStateBundle(local, id),
      () => listStateValues(local, id),
      () => getStateValue(local, id, "valid"),
      () => getStateValue(local, "valid", id),
    ]) await assert.rejects(run(), /YouTrack/);
  }
  assert.equal(calls, 0);
  server.use(http.get("*", ({ request }) => {
    assert.equal(new URL(request.url).pathname, "/context/api/admin/customFieldSettings/bundles/state/%252e/values/%252e%252e");
    return HttpResponse.json({ id: "fixture-value" });
  }));
  assert.deepEqual(await getStateValue(connection, "%2e", "%2e%2e"), { id: "fixture-value" });
});
