import assert from "node:assert/strict";
import { after, afterEach, before, test } from "node:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import {
  currentUser,
  getIssueAttachmentDownloadMetadata,
  readNullableObject,
  readObject,
  youTrackUrl,
} from "../src/client.js";

const server = setupServer();
before(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
after(() => server.close());
const options = { baseUrl: "https://youtrack.example.com/track/", token: "synthetic-token" };

test("identity uses the context path, bearer token and minimal projection", async () => {
  server.use(http.get("https://youtrack.example.com/track/api/users/me", ({ request }) => {
    assert.equal(request.headers.get("authorization"), "Bearer synthetic-token");
    assert.equal(request.headers.get("accept"), "application/json");
    assert.equal(new URL(request.url).searchParams.get("fields"), "id,login");
    return HttpResponse.json({ id: "1-1", login: "fixture-user", email: "omit@example.com" });
  }));
  assert.deepEqual(await currentUser(options), { id: "1-1", login: "fixture-user" });
});

test("server URL validation rejects unsafe or API URLs without echoing input", () => {
  for (const value of ["", "http://youtrack.example.com", "ftp://localhost", "https://u:p@example.com",
    "https://example.com?token=synthetic", "https://example.com/#private", "https://example.com/api/",
    "https://example.com/track/%61pi", "https://example.com/track\\api", "https://example.com/\napi"]) {
    assert.throws(() => youTrackUrl(value), /^Error: YouTrack URL must /);
  }
  for (const value of ["http://localhost:8080/track", "http://127.0.0.1:8080", "http://[::1]:8080"])
    assert.ok(youTrackUrl(value).startsWith("http://"));
  assert.equal(youTrackUrl(" https://example.com/track/// "), "https://example.com/track/");
});

test("HTTP failures expose status only, never upstream diagnostics or URLs", async () => {
  for (const status of [400, 401, 403, 404, 409, 429, 500]) {
    server.use(http.get("*/api/users/me", () => new HttpResponse("synthetic-token private diagnostic", { status })));
    await assert.rejects(currentUser(options), new RegExp(`^Error: YouTrack request failed \\(HTTP ${status}\\)\\.$`));
  }
});

test("redirects never reach another endpoint and errors redact network details", async () => {
  let redirected = 0;
  server.use(
    http.get("https://youtrack.example.com/track/api/users/me", () => HttpResponse.redirect("https://other.example.com/capture")),
    http.get("https://other.example.com/capture", () => { redirected++; return HttpResponse.json({}); }),
  );
  await assert.rejects(currentUser(options), /YouTrack request failed/);
  assert.equal(redirected, 0);
  const fetch: typeof globalThis.fetch = async (_url, init) => {
    assert.equal(init?.redirect, "error");
    throw new Error("synthetic-token https://private.example.com");
  };
  await assert.rejects(currentUser({ ...options, fetch }), /^Error: YouTrack request failed; check connectivity, TLS and the configured URL\.$/);
});

test("malformed JSON and incomplete identity cannot validate credentials", async () => {
  for (const body of ["synthetic-token", "null", "[]", "{}", '{"id":"1-1"}', '{"id":"","login":"fixture"}']) {
    server.use(http.get("*/api/users/me", () => new HttpResponse(body)));
    await assert.rejects(currentUser(options), /^Error: YouTrack returned an invalid identity response\.$/);
  }
});

test("empty or multiline tokens fail without any request; cancellation reaches fetch", async () => {
  let calls = 0;
  const controller = new AbortController();
  const fetch: typeof globalThis.fetch = async (_url, init) => {
    calls++;
    assert.equal(init?.signal, controller.signal);
    return Response.json({ id: "1-1", login: "fixture" });
  };
  for (const token of ["", " ", "synthetic\nvalue"])
    await assert.rejects(currentUser({ ...options, token, fetch }), /non-empty single-line token/);
  assert.equal(calls, 0);
  await currentUser({ ...options, fetch, signal: controller.signal });
  assert.equal(calls, 1);
});

test("identity rejects credential-bearing fields instead of accepting scrubbed placeholders", async () => {
  for (const text of [
    "synthetic-token", "Bearer synthetic-token",
    "https://youtrack.example.com/file?download=synthetic%2Dtoken",
    "https://youtrack.example.com/file#download=synthetic%2Dtoken",
    "/track/api/files/fixture/sign=synthetic-signature",
    "See https://youtrack.example.com/file?sign=synthetic-signature here",
  ]) {
    for (const key of ["id", "login"]) {
      const value = { id: "1-1", login: "fixture-user", [key]: text };
      server.use(http.get("*/api/users/me", () => HttpResponse.json(value)));
      await assert.rejects(currentUser(options), /^Error: YouTrack returned an invalid identity response\.$/);
    }
  }
});

test("download metadata uses only its fixed endpoint and transient projection", async () => {
  const metadata = {
    id: "attachment/1", name: "fixture.txt", mimeType: null,
    url: "/track/api/files/99-1?sign=synthetic-signature",
  };
  let calls = 0;
  server.use(http.get("https://youtrack.example.com/track/api/issues/:issue/attachments/:attachment", ({ request }) => {
    calls++;
    const url = new URL(request.url);
    assert.equal(url.pathname, "/track/api/issues/DEMO%2F1/attachments/attachment%2F1");
    assert.equal(url.searchParams.get("fields"), "id,name,mimeType,url");
    assert.equal(request.headers.get("authorization"), "Bearer synthetic-token");
    return HttpResponse.json({ ...metadata, ignored: { private: "do not retain" } });
  }));
  assert.deepEqual(await getIssueAttachmentDownloadMetadata(options, "DEMO/1", "attachment/1"), metadata);
  assert.equal(calls, 1);
  assert.equal((await readObject(options, "api/issues/DEMO%2F1/attachments/attachment%2F1", {
    fields: "id,name,mimeType,url",
  })).url, "[redacted]");
});

test("download metadata rejects malformed and credential-reflecting fields safely", async () => {
  const metadata = {
    id: "1-1", name: "fixture.txt", mimeType: "text/plain", url: "/track/api/files/99-1?sign=fixture",
  };
  for (const value of [
    null, [], {}, { ...metadata, id: " " }, { ...metadata, name: 42 },
    { ...metadata, url: null }, { ...metadata, mimeType: false },
    ...["id", "name", "mimeType", "url"].map((key) => ({ ...metadata, [key]: "synthetic-token" })),
  ]) {
    server.use(http.get("*/api/issues/DEMO-1/attachments/1-1", () => HttpResponse.json(value)));
    await assert.rejects(getIssueAttachmentDownloadMetadata(options, "DEMO-1", "1-1"), (error: Error) => {
      assert.match(error.message, /^YouTrack returned (an invalid object response|invalid attachment download metadata or no download URL)\.$/);
      assert.ok(!error.message.includes("synthetic-token"));
      return true;
    });
  }
  let calls = 0;
  const fetch: typeof globalThis.fetch = async () => { calls++; return Response.json(metadata); };
  for (const id of [".", "..", "", "bad\nid"]) {
    await assert.rejects(getIssueAttachmentDownloadMetadata({ ...options, fetch }, "DEMO-1", id));
  }
  assert.equal(calls, 0);
});

test("nullable object reads accept JSON null only and retain normal scrubbing and errors", async () => {
  const path = "api/articles/KB-1/parentArticle";
  server.use(http.get(`*/${path}`, () => HttpResponse.json(null)));
  assert.equal(await readNullableObject(options, path, { fields: "id" }), null);
  await assert.rejects(readObject(options, path, { fields: "id" }), /invalid object response/);
  server.use(http.get(`*/${path}`, () => HttpResponse.json({ id: "1-1", url: "/api/files/1?sign=fixture" })));
  assert.deepEqual(await readNullableObject(options, path, { fields: "id,url" }), { id: "1-1", url: "[redacted]" });
  for (const body of ["", "[]", '"private fixture"']) {
    server.use(http.get(`*/${path}`, () => new HttpResponse(body)));
    await assert.rejects(readNullableObject(options, path, { fields: "id" }), /YouTrack returned an invalid/);
  }
  server.use(http.get(`*/${path}`, () => new HttpResponse("private fixture", { status: 404 })));
  await assert.rejects(readNullableObject(options, path, { fields: "id" }), /^Error: YouTrack request failed \(HTTP 404\)\.$/);
});
