import assert from "node:assert/strict";
import { after, afterEach, before, test } from "node:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import {
  getBuildBundle, getBuildValue, getOwnedBundle, getOwnedValue, getVersionBundle, getVersionValue,
  listBuildValues, listOwnedValues, listVersionValues,
} from "../src/bundle-values.js";
import { bundleCases } from "./bundle-values-cases.js";

const server = setupServer();
before(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
after(() => server.close());
const connection = { baseUrl: "https://youtrack.example.com/context/", token: "synthetic-token" };

for (const row of bundleCases) test(`bundle GET ${row.path} binds finite defaults, projection and one page`, async () => {
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

test("all bundle routes preserve empty/sparse data and reject malformed responses or remote denial safely", async () => {
  for (const row of bundleCases) {
    server.use(http.get("*", () => HttpResponse.json(row.collection ? [] : {})));
    assert.deepEqual(await row.run(connection), row.collection ? [] : {});
    for (const body of ["null", row.collection ? "{}" : "[]", "malformed-private-response"]) {
      server.use(http.get("*", () => new HttpResponse(body)));
      await assert.rejects(row.run(connection), /invalid .*response/);
    }
    let calls = 0;
    server.use(http.get("*", () => {
      calls++;
      return new HttpResponse("synthetic-token private-response", { status: 403 });
    }));
    await assert.rejects(row.run(connection), /^Error: YouTrack request failed \(HTTP 403\)\.$/);
    assert.equal(calls, 1);
  }
});

test("bundle dates, nullable owners and archive/release flags retain their service meaning", async () => {
  const buildValues = [
    { id: "fixture-build", assembleDate: 0, description: null, archived: true },
    { id: "fixture-build-two", assembleDate: null, archived: false },
  ];
  server.use(http.get("*", () => HttpResponse.json(buildValues)));
  assert.deepEqual(await listBuildValues(connection, "fixture-bundle"), buildValues);
  const ownedValues = [{ id: "fixture-owned", owner: null }, { id: "fixture-owned-two", owner: { id: "fixture-user", login: "fixture-login" } }];
  server.use(http.get("*", () => HttpResponse.json(ownedValues)));
  assert.deepEqual(await listOwnedValues(connection, "fixture-bundle"), ownedValues);
  const versionValues = [{ id: "fixture-version", released: false, archived: true, releaseDate: 0, startDate: null, description: null }];
  server.use(http.get("*", () => HttpResponse.json(versionValues)));
  assert.deepEqual(await listVersionValues(connection, "fixture-bundle"), versionValues);
});

test("explicit nested bundle projections cannot expose bearer tokens or signed URLs", async () => {
  for (const get of [getBuildBundle, getOwnedBundle, getVersionBundle]) {
    server.use(http.get("*", ({ request }) => {
      assert.equal(new URL(request.url).searchParams.get("fields"), "values(name,url)");
      return HttpResponse.json({ values: [{ name: "synthetic-token", url: "/files/a?sign=synthetic-secret" }] });
    }));
    assert.deepEqual(await get(connection, "fixture-bundle", { fields: "values(name,url)" }), {
      values: [{ name: "[redacted]", url: "[redacted]" }],
    });
  }
});

test("version startDate failure does not retry or fall back; callers can explicitly narrow fields", async () => {
  let calls = 0;
  server.use(http.get("*", ({ request }) => {
    calls++;
    return new URL(request.url).searchParams.get("fields")?.includes("startDate")
      ? new HttpResponse("private-version-message", { status: 400 })
      : HttpResponse.json({ id: "fixture-version" });
  }));
  await assert.rejects(getVersionValue(connection, "fixture-bundle", "fixture-value"), /HTTP 400/);
  assert.equal(calls, 1);
  assert.deepEqual(await getVersionValue(connection, "fixture-bundle", "fixture-value", { fields: "id" }), { id: "fixture-version" });
  assert.equal(calls, 2);
});

test("bundle lists reject invalid paging/projections before fetch and detect oversized pages", async () => {
  let calls = 0;
  server.use(http.get("*", () => { calls++; return HttpResponse.json([{ id: "a" }, { id: "b" }]); }));
  for (const row of bundleCases) {
    await assert.rejects(row.run(connection, { fields: " " }), /fields must be nonempty/);
    if (row.collection) {
      for (const options of [{ top: 0 }, { top: 101 }, { top: 1.5 }, { skip: -1 }, { skip: Number.MAX_SAFE_INTEGER + 1 }]) {
        await assert.rejects(row.run(connection, options), /YouTrack/);
      }
    }
  }
  assert.equal(calls, 0);
  for (const row of bundleCases.filter((item) => item.collection)) {
    await assert.rejects(row.run(connection, { top: 1 }), /more items than the requested top limit/);
  }
  assert.equal(calls, 6);
});

test("all bundle/value ID positions reject dot traversal, controls and malformed Unicode before fetch", async () => {
  let calls = 0;
  const local = { ...connection, fetch: (async () => { calls++; throw new Error("Unexpected fetch"); }) as typeof globalThis.fetch };
  for (const id of [".", "..", "bad\nvalue", "\ud800"]) {
    for (const get of [getBuildBundle, getOwnedBundle, getVersionBundle]) {
      await assert.rejects(get(local, id), /YouTrack/);
    }
    for (const list of [listBuildValues, listOwnedValues, listVersionValues]) {
      await assert.rejects(list(local, id), /YouTrack/);
    }
    for (const get of [getBuildValue, getOwnedValue, getVersionValue]) {
      await assert.rejects(get(local, id, "valid"), /YouTrack/);
      await assert.rejects(get(local, "valid", id), /YouTrack/);
    }
  }
  assert.equal(calls, 0);
  server.use(http.get("*", ({ request }) => {
    assert.equal(new URL(request.url).pathname, "/context/api/admin/customFieldSettings/bundles/ownedField/%252e/values/%252e%252e");
    return HttpResponse.json({ id: "fixture-value" });
  }));
  assert.deepEqual(await getOwnedValue(connection, "%2e", "%2e%2e"), { id: "fixture-value" });
});
