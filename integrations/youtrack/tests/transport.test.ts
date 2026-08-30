import assert from "node:assert/strict";
import { after, afterEach, before, test } from "node:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { deleteObject, readObject, uploadObjectCollection, type Connection } from "../src/client.js";

const server = setupServer();
before(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
after(() => server.close());
const connection: Connection = { baseUrl: "https://youtrack.example.com/track", token: "synthetic-token" };

test("object reads use GET or explicit JSON POST and neither accepts an empty or null response", async () => {
  let calls = 0;
  server.use(http.all("*/api/search/assist", async ({ request }) => {
    calls += 1;
    assert.equal(request.headers.get("authorization"), "Bearer synthetic-token");
    assert.equal(new URL(request.url).searchParams.get("fields"), "query");
    if (request.method === "POST") {
      assert.equal(request.headers.get("content-type"), "application/json");
      assert.deepEqual(await request.json(), { query: "fixture query" });
    } else {
      assert.equal(request.method, "GET");
      assert.equal(request.headers.get("content-type"), null);
      assert.equal(await request.text(), "");
    }
    return HttpResponse.json({ query: "synthetic-token" });
  }));
  assert.deepEqual(await readObject(connection, "api/search/assist", { fields: "query" }), { query: "[redacted]" });
  assert.deepEqual(await readObject(connection, "api/search/assist", { fields: "query" }, { query: "fixture query" }), { query: "[redacted]" });
  assert.equal(calls, 2);
  for (const body of ["", "null", "[]", "private malformed response"]) {
    server.use(http.post("*/api/search/assist", () => new HttpResponse(body)));
    await assert.rejects(readObject(connection, "api/search/assist", {}, { query: "fixture" }), /YouTrack returned an invalid/);
  }
});

test("DELETE has no request body, accepts empty success, and never retries or echoes a rejection", async () => {
  let calls = 0;
  server.use(http.delete("*/api/issues/1-1/tags/2-1", async ({ request }) => {
    calls += 1;
    assert.equal(request.headers.get("authorization"), "Bearer synthetic-token");
    assert.equal(request.headers.get("content-type"), null);
    assert.equal(await request.text(), "");
    return new HttpResponse(null, { status: 204 });
  }));
  assert.equal(await deleteObject(connection, "api/issues/1-1/tags/2-1"), null);
  assert.equal(calls, 1);
  server.use(http.delete("*/api/issues/1-1/tags/2-1", () => HttpResponse.json({ value: "synthetic-token" })));
  assert.deepEqual(await deleteObject(connection, "api/issues/1-1/tags/2-1"), { value: "[redacted]" });
  for (const body of ["null", "[]", "private malformed response"]) {
    server.use(http.delete("*/api/issues/1-1/tags/2-1", () => new HttpResponse(body)));
    await assert.rejects(deleteObject(connection, "api/issues/1-1/tags/2-1"), /YouTrack returned an invalid/);
  }
  calls = 0;
  server.use(http.delete("*/api/issues/1-1/tags/2-1", () => {
    calls += 1;
    return new HttpResponse("synthetic-token private server details", { status: 403 });
  }));
  await assert.rejects(deleteObject(connection, "api/issues/1-1/tags/2-1"), { message: "YouTrack request failed (HTTP 403)." });
  assert.equal(calls, 1);
});

test("multipart uses the native boundary and keeps upload arrays scrubbed with explicit empty-success semantics", async () => {
  const form = new FormData();
  form.set("upload1", new Blob(["fixture contents"], { type: "text/plain" }), "fixture.txt");
  let calls = 0;
  server.use(http.post("*/api/issues/1-1/attachments", async ({ request }) => {
    calls += 1;
    assert.equal(request.headers.get("authorization"), "Bearer synthetic-token");
    assert.match(request.headers.get("content-type") ?? "", /^multipart\/form-data; boundary=/);
    assert.equal(new URL(request.url).searchParams.get("fields"), "id,name,size,mimeType");
    const file = (await request.formData()).get("upload1");
    assert.ok(file instanceof File);
    assert.equal(file.name, "fixture.txt");
    assert.equal(await file.text(), "fixture contents");
    return HttpResponse.json([{ id: "1", url: "api/files/1?sign=fixture" }, { id: "2", name: "synthetic-token" }]);
  }));
  assert.deepEqual(await uploadObjectCollection(connection, "api/issues/1-1/attachments", form, "id,name,size,mimeType"), [
    { id: "1", url: "[redacted]" }, { id: "2", name: "[redacted]" },
  ]);
  assert.equal(calls, 1);
  server.use(http.post("*/api/issues/1-1/attachments", () => new HttpResponse(null, { status: 204 })));
  assert.equal(await uploadObjectCollection(connection, "api/issues/1-1/attachments", form, "id"), null);
  server.use(http.post("*/api/issues/1-1/attachments", () => HttpResponse.json([])));
  assert.deepEqual(await uploadObjectCollection(connection, "api/issues/1-1/attachments", form, "id"), []);
  for (const body of ["null", "{}", "[null]", "private malformed response"]) {
    server.use(http.post("*/api/issues/1-1/attachments", () => new HttpResponse(body)));
    await assert.rejects(uploadObjectCollection(connection, "api/issues/1-1/attachments", form, "id"), /YouTrack returned an invalid/);
  }
});
