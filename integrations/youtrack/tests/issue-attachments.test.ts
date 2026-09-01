import assert from "node:assert/strict";
import fs from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import { after, afterEach, before, test, type TestContext } from "node:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createYouTrackCli } from "../src/cli.js";
import { configuredFixture as cliFixture } from "./cli-fixture.js";
import { getIssueAttachment, listIssueAttachments, uploadIssueAttachment } from "../src/issue-attachments.js";

const server = setupServer();
before(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
after(() => server.close());
const connection = { baseUrl: "https://youtrack.example.com/track", token: "synthetic-attachment-token" };
const metadata = { id: "attachment-fixture", name: "fixture.bin", size: 4, mimeType: null };
const bytes = new Uint8Array([0, 255, 13, 10]);

async function temporary(t: TestContext) {
  const directory = await mkdtemp(join(tmpdir(), "youtrack-attachments-test-"));
  t.after(async () => {
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep));
    await rm(directory, { recursive: true, force: true });
  });
  const file = join(directory, "fixture.bin");
  await writeFile(file, bytes);
  return { directory, file };
}

async function fixture(t: TestContext, input = "") {
  const local = await temporary(t);
  const shared = await cliFixture(t, { input, url: connection.baseUrl, token: connection.token });
  return { ...local, ...shared };
}

test("attachment list sends one bounded native GET with default metadata projection", async () => {
  let calls = 0;
  server.use(http.get("*/track/api/issues/fixture-issue/attachments", ({ request }) => {
    calls++;
    const url = new URL(request.url);
    assert.equal(url.searchParams.get("fields"), "id,name,size,mimeType");
    assert.equal(url.searchParams.get("$top"), "50");
    assert.equal(url.searchParams.get("$skip"), "0");
    assert.equal(request.headers.get("authorization"), "Bearer " + connection.token);
    return HttpResponse.json([metadata]);
  }));
  assert.deepEqual(await listIssueAttachments(connection, "fixture-issue"), [metadata]);
  assert.equal(calls, 1);
});

test("attachment detail encodes both IDs once, retains context, and scrubs explicit sparse URL fields", async () => {
  const issue = "issue/a?#%2e";
  const attachment = "attachment/a?#%2e";
  server.use(http.get("*", ({ request }) => {
    const url = new URL(request.url);
    assert.equal(url.pathname, "/track/api/issues/" + encodeURIComponent(issue) + "/attachments/" + encodeURIComponent(attachment));
    assert.equal(url.searchParams.get("fields"), "url,mimeType,thumbnailURL");
    assert.equal(url.searchParams.has("$top"), false);
    assert.equal(url.searchParams.has("$skip"), false);
    return HttpResponse.json({
      url: "/track/api/files/fixture/sign=synthetic-signature",
      mimeType: null,
      thumbnailURL: "https://files.example.com/preview?access_token=synthetic-signature",
      nested: { value: connection.token },
    });
  }));
  assert.deepEqual(await getIssueAttachment(connection, issue, attachment, { fields: "url,mimeType,thumbnailURL" }), {
    url: "[redacted]", mimeType: null, thumbnailURL: "[redacted]", nested: { value: "[redacted]" },
  });
});

test("attachment list honors sparse projection and exact caller pagination", async () => {
  server.use(http.get("*", ({ request }) => {
    const url = new URL(request.url);
    assert.equal(url.searchParams.get("fields"), "id");
    assert.equal(url.searchParams.get("$top"), "2");
    assert.equal(url.searchParams.get("$skip"), "7");
    return HttpResponse.json([{}]);
  }));
  assert.deepEqual(await listIssueAttachments(connection, "fixture-issue", { fields: "id", top: 2, skip: 7 }), [{}]);
});

test("attachment read validation rejects invalid IDs/pages and malformed shapes", async () => {
  let calls = 0;
  server.use(http.get("*", () => { calls++; return HttpResponse.json({}); }));
  await assert.rejects(getIssueAttachment(connection, "..", "fixture-attachment"), /dot path/);
  await assert.rejects(getIssueAttachment(connection, "fixture-issue", "."), /dot path/);
  await assert.rejects(listIssueAttachments(connection, "fixture-issue", { top: 0 }), /top/);
  await assert.rejects(listIssueAttachments(connection, "fixture-issue", { skip: -1 }), /skip/);
  await assert.rejects(getIssueAttachment(connection, "fixture-issue", "fixture-attachment", { fields: "" }), /fields/);
  assert.equal(calls, 0);
  await assert.rejects(listIssueAttachments(connection, "fixture-issue"), /invalid collection/);
  server.use(http.get("*", () => HttpResponse.json([{}, {}])));
  await assert.rejects(listIssueAttachments(connection, "fixture-issue", { top: 1 }), /top limit/);
  await assert.rejects(getIssueAttachment(connection, "fixture-issue", "fixture-attachment"), /invalid object/);
});

test("one selected attachment uploads exact bytes and basename in native multipart upload1", async (t) => {
  const f = await temporary(t);
  let calls = 0;
  server.use(http.post("*/track/api/issues/fixture-issue/attachments", async ({ request }) => {
    calls++;
    assert.equal(new URL(request.url).searchParams.get("fields"), "id,name,size,mimeType");
    assert.equal(new URL(request.url).searchParams.has("muteUpdateNotifications"), false);
    assert.equal(request.headers.get("authorization"), "Bearer " + connection.token);
    assert.equal(request.redirect, "error");
    assert.match(request.headers.get("content-type")!, /^multipart\/form-data; boundary=.+/);
    const form = await request.formData();
    assert.deepEqual([...form.keys()], ["upload1"]);
    const file = form.get("upload1");
    assert.ok(file instanceof File);
    assert.equal(file.name, "fixture.bin");
    assert.equal(file.type, "application/octet-stream");
    assert.deepEqual(new Uint8Array(await file.arrayBuffer()), bytes);
    return HttpResponse.json([{ ...metadata, url: "/track/api/files/fixture/sign=synthetic-signature" }], { status: 201 });
  }));
  assert.deepEqual(await uploadIssueAttachment(connection, "fixture-issue", f.file), [{ ...metadata, url: "[redacted]" }]);
  assert.equal(calls, 1);
});

test("upload preserves documented arrays and handles empty HTTP successes as null", async (t) => {
  const f = await temporary(t);
  for (const body of [[], [metadata], [metadata, { id: "second-fixture" }]]) {
    server.use(http.post("*", () => HttpResponse.json(body)));
    assert.deepEqual(await uploadIssueAttachment(connection, "fixture-issue", f.file), body);
  }
  for (const status of [200, 204]) {
    server.use(http.post("*", () => new HttpResponse(null, { status })));
    assert.equal(await uploadIssueAttachment(connection, "fixture-issue", f.file), null);
  }
});

test("upload rejects malformed JSON and non-array/non-object result shapes", async (t) => {
  const f = await temporary(t);
  for (const body of ["{", "null", "{}", "[null]", "[1]"]) {
    server.use(http.post("*", () => new HttpResponse(body)));
    await assert.rejects(uploadIssueAttachment(connection, "fixture-issue", f.file), /invalid .*response/);
  }
});

test("upload errors are static and never retried, including server size/permission limits", async (t) => {
  const f = await temporary(t);
  let calls = 0;
  for (const status of [403, 413, 429, 500]) {
    server.use(http.post("*", () => {
      calls++;
      return new HttpResponse("synthetic-private-diagnostic " + connection.token, {
        status, headers: { "Retry-After": "7" },
      });
    }));
    await assert.rejects(uploadIssueAttachment(connection, "fixture-issue", f.file), (error: Error) => {
      assert.match(error.message, new RegExp("HTTP " + status));
      assert.doesNotMatch(error.message, /synthetic-|fixture.bin/);
      if (status === 429) assert.match(error.message, /7 seconds/);
      return true;
    });
  }
  assert.equal(calls, 4);
});

test("invalid local files reject before fetch without exposing filesystem diagnostics", async (t) => {
  const f = await temporary(t);
  let calls = 0;
  server.use(http.post("*", () => { calls++; return HttpResponse.json([]); }));
  for (const file of [f.directory, join(f.directory, "not-present.bin")]) {
    await assert.rejects(uploadIssueAttachment(connection, "fixture-issue", file), (error: Error) => {
      assert.equal(error.message, "YouTrack upload requires a readable regular file.");
      assert.ok(!error.message.includes(f.directory));
      return true;
    });
  }
  await assert.rejects(uploadIssueAttachment(connection, "..", f.file), /dot path/);
  await assert.rejects(uploadIssueAttachment(connection, "fixture-issue", " "), /file path/);
  assert.equal(calls, 0);
});

test("attachment CLI shares read JSON/human commands and gated upload JSON result", async (t) => {
  const f = await fixture(t);
  let calls = 0;
  server.use(
    http.get("*/attachments", ({ request }) => {
      calls++;
      assert.equal(new URL(request.url).searchParams.get("$top"), "2");
      assert.equal(new URL(request.url).searchParams.get("$skip"), "3");
      assert.equal(new URL(request.url).searchParams.get("fields"), "id");
      return HttpResponse.json([{ id: metadata.id }]);
    }),
    http.get("*/attachments/fixture-attachment", () => { calls++; return HttpResponse.json(metadata); }),
    http.post("*/attachments", async ({ request }) => {
      calls++;
      const form = await request.formData();
      assert.deepEqual([...form.keys()], ["upload1"]);
      return HttpResponse.json([metadata]);
    }),
  );
  assert.equal(await f.cli.run(["issues", "attachments", "list", "fixture-issue", "--top", "2", "--skip", "3", "--fields", "id", "--profile", "dev", "--json"]), 0);
  assert.deepEqual(JSON.parse(f.stdout()), [{ id: metadata.id }]);
  assert.equal(await f.cli.run(["issues", "attachments", "get", "fixture-issue", "fixture-attachment", "--profile", "dev"]), 0);
  assert.match(f.stdout(), /fixture.bin/);
  await f.cli.execute(["permissions", "grant", "Update", "--profile", "dev"]);
  assert.deepEqual(await f.cli.execute(["issues", "attachments", "upload", "fixture-issue", "--file", f.file, "--profile", "dev"]), [metadata]);
  assert.equal(calls, 3);
  assert.equal(f.stderr(), "");
});

test("denied attachment commands reach neither file stat/open nor HTTP", async (t) => {
  const f = await fixture(t);
  let calls = 0;
  let fileOperations = 0;
  server.use(http.all("*", () => { calls++; return HttpResponse.json([]); }));
  t.mock.method(fs.promises, "stat", async () => { fileOperations++; throw new Error("unexpected file stat"); });
  t.mock.method(fs, "openAsBlob", async () => { fileOperations++; throw new Error("unexpected file open"); });
  await assert.rejects(f.cli.execute(["issues", "attachments", "upload", "fixture-issue", "--file", f.file, "--profile", "dev"]), /Permission 'Update' is disabled/);
  await f.cli.execute(["permissions", "revoke", "ReadOnly", "--profile", "dev"]);
  await assert.rejects(f.cli.execute(["issues", "attachments", "list", "fixture-issue", "--profile", "dev"]), /Permission 'ReadOnly' is disabled/);
  await assert.rejects(f.cli.execute(["issues", "attachments", "get", "fixture-issue", "fixture-attachment", "--profile", "dev"]), /Permission 'ReadOnly' is disabled/);
  assert.equal(calls, 0);
  assert.equal(fileOperations, 0);
});

test("upload missing/invalid file syntax rejects before fresh-profile authentication", async (t) => {
  const f = await fixture(t);
  let keyringReads = 0;
  t.mock.method(f.secrets, "get", async () => { keyringReads++; throw new Error("unexpected keyring"); });
  await assert.rejects(f.cli.execute(["issues", "attachments", "upload", "fixture-issue"]), /--file/);
  await assert.rejects(f.cli.execute(["issues", "attachments", "upload", "fixture-issue", "--file", " "]), /file path/);
  await assert.rejects(f.cli.execute(["issues", "attachments", "upload", "fixture-issue", "--file", "fixture\nfile"]), /file path/);
  assert.equal(keyringReads, 0);
});

test("upload transport/redirect failures do not retry or follow another origin", async (t) => {
  const f = await temporary(t);
  let calls = 0;
  let followed = 0;
  server.use(
    http.get("https://redirect.example.com/*", () => { followed++; return HttpResponse.json([]); }),
    http.post("*", () => {
      calls++;
      return new HttpResponse(null, { status: 302, headers: {
        Location: "https://redirect.example.com/file?token=synthetic-redirect",
      } });
    }),
  );
  await assert.rejects(uploadIssueAttachment(connection, "fixture-issue", f.file), (error: Error) => {
    assert.doesNotMatch(error.message, /synthetic-|redirect.example|fixture.bin/);
    return true;
  });
  server.use(http.post("*", () => { calls++; return HttpResponse.error(); }));
  await assert.rejects(uploadIssueAttachment(connection, "fixture-issue", f.file), /YouTrack request failed; check connectivity/);
  assert.equal(calls, 2);
  assert.equal(followed, 0);
});

test("upload file-opening errors suppress private local diagnostics before HTTP", async (t) => {
  const f = await temporary(t);
  let calls = 0;
  server.use(http.post("*", () => { calls++; return HttpResponse.json([]); }));
  t.mock.method(fs, "openAsBlob", async () => { throw new Error("synthetic-private-path-and-diagnostic"); });
  await assert.rejects(uploadIssueAttachment(connection, "fixture-issue", f.file), {
    message: "YouTrack upload requires a readable regular file.",
  });
  assert.equal(calls, 0);
});

test("attachment RPC preserves profile routing and scrubs read/upload responses", async (t) => {
  const f = await fixture(t);
  await f.cli.execute(["profile", "create", "production", "--url", "https://production.example.com/context"]);
  await f.secrets.set("ai-cli-factory:youtrack-cli", "production:token", "synthetic-production-token");
  await f.cli.execute(["permissions", "grant", "Update", "--profile", "dev"]);
  const seen: string[] = [];
  server.use(
    http.get("*/attachments/fixture-attachment", ({ request }) => {
      const url = new URL(request.url);
      const production = url.hostname === "production.example.com";
      assert.equal(url.pathname, (production ? "/context" : "/track") + "/api/issues/fixture-issue/attachments/fixture-attachment");
      assert.equal(request.headers.get("authorization"), "Bearer " + (production ? "synthetic-production-token" : connection.token));
      seen.push(production ? "production" : "dev");
      return HttpResponse.json({ url: "/api/files/fixture/sign=synthetic-signature" });
    }),
    http.post("*/attachments", async ({ request }) => {
      assert.equal(new URL(request.url).hostname, "youtrack.example.com");
      assert.equal(request.headers.get("authorization"), "Bearer " + connection.token);
      const file = (await request.formData()).get("upload1");
      assert.ok(file instanceof File);
      assert.deepEqual(new Uint8Array(await file.arrayBuffer()), bytes);
      seen.push("upload");
      return HttpResponse.json([{ id: "fixture", url: "/api/files/fixture/sign=synthetic-signature" }]);
    }),
  );
  const argv = [
    ["issues", "attachments", "get", "fixture-issue", "fixture-attachment", "--fields", "url", "--profile", "dev"],
    ["issues", "attachments", "get", "fixture-issue", "fixture-attachment", "--fields", "url", "--profile", "production"],
    ["issues", "attachments", "upload", "fixture-issue", "--file", f.file, "--profile", "dev"],
  ];
  const input = argv.map((args, i) => JSON.stringify({ jsonrpc: "2.0", id: i + 1, method: "cli.execute", params: { argv: args } })).join("\n") + "\n";
  const rpc = f.createApplication(runtime => createYouTrackCli({ ...runtime, input: Readable.from([input]) }));
  assert.equal(await rpc.run(["--json-rpc"]), 0);
  const rows = f.stdout().trim().split("\n").map((line) => JSON.parse(line));
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map((row) => row.result), [
    { url: "[redacted]" }, { url: "[redacted]" }, [{ id: "fixture", url: "[redacted]" }],
  ]);
  assert.deepEqual(seen, ["dev", "production", "upload"]);
  assert.doesNotMatch(f.stdout(), /synthetic-/);
  assert.equal(f.stderr(), "");
});
