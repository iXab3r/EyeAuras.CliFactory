import assert from "node:assert/strict";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { after, afterEach, before, test, type TestContext } from "node:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { downloadIssueAttachment } from "../src/attachment-download.js";
import { fixture } from "./cli-fixture.js";

const server = setupServer();
before(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
after(() => server.close());
const connection = { baseUrl: "https://youtrack.example.com/track", token: "synthetic-download-token" };
const signedUrl = "/track/api/files/file-fixture?sign=synthetic%2Fsignature%0D%0A&updated=123";
const bytes = new Uint8Array([0, 255, 13, 10]);
const metadata = { id: "attachment-fixture", name: "fixture.bin", mimeType: "application/octet-stream", url: signedUrl };

async function temporary(t: TestContext) {
  const directory = await mkdtemp(join(tmpdir(), "youtrack-download-test-"));
  t.after(async () => {
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep));
    await rm(directory, { recursive: true, force: true });
  });
  return directory;
}

function serve(
  response: () => Response | Promise<Response> = () => new HttpResponse(bytes),
  attachment: Record<string, unknown> = metadata,
) {
  const calls: string[] = [];
  server.use(http.get("*", ({ request }) => {
    const url = new URL(request.url);
    calls.push(url.pathname);
    if (url.pathname.includes("/attachments/")) {
      assert.equal(url.searchParams.get("fields"), "id,name,mimeType,url");
      assert.equal(request.headers.get("authorization"), "Bearer " + connection.token);
      return HttpResponse.json(attachment);
    }
    assert.equal(request.headers.get("authorization"), null);
    assert.equal(request.headers.get("cookie"), null);
    assert.equal(request.credentials, "omit");
    assert.equal(request.redirect, "error");
    return response();
  }));
  return calls;
}

test("download uses exact encoded metadata then auth-free binary GET and profile-owned result", async (t) => {
  const directory = await temporary(t);
  const issueID = "issue/a?#%2e";
  const calls = serve(() => new HttpResponse(bytes, {
    headers: { "content-length": "4", "content-type": "application/octet-stream; charset=binary" },
  }));
  const result = await downloadIssueAttachment(connection, issueID, metadata.id, directory);
  assert.deepEqual(result, {
    id: metadata.id,
    name: "attachment-fixture-fixture.bin",
    path: join(directory, "downloads", "attachment-fixture-fixture.bin"),
    bytes: 4,
    contentType: "application/octet-stream",
  });
  assert.deepEqual(calls, [
    `/track/api/issues/${encodeURIComponent(issueID)}/attachments/attachment-fixture`,
    "/track/api/files/file-fixture",
  ]);
  assert.deepEqual(new Uint8Array(await readFile(result.path)), bytes);
  assert.deepEqual(await readdir(join(directory, "downloads")), [result.name]);
  assert.doesNotMatch(JSON.stringify(result), /synthetic|sign=|updated=/);
  if (process.platform !== "win32") {
    assert.equal((await stat(result.path)).mode & 0o777, 0o600);
  }
});

test("download supports relative and both documented signature forms without matching file and attachment IDs", async (t) => {
  for (const url of [
    "api/files/other-file?sign=synthetic%2Fsignature%0D%0A&updated=123",
    "/track/api/files/other-file/sign=synthetic%2Fsignature%0D%0A",
    "https://youtrack.example.com/track/api/files/other-file?sign=synthetic-signature",
  ]) {
    const directory = await temporary(t);
    const calls = serve(undefined, { ...metadata, url });
    const result = await downloadIssueAttachment(connection, "fixture-issue", metadata.id, directory);
    assert.equal(result.bytes, 4);
    assert.equal(calls.length, 2);
  }
});

test("download rejects foreign origins, userinfo, wrong context and normalized traversal before binary fetch", async (t) => {
  const urls = [
    "https://foreign.example.com/track/api/files/file?sign=synthetic",
    "http://youtrack.example.com/track/api/files/file?sign=synthetic",
    "https://user:pass@youtrack.example.com/track/api/files/file?sign=synthetic",
    "/api/files/file?sign=synthetic", "/track/api/users/me?sign=synthetic",
    "/track/api/files/../files/file?sign=synthetic", "/track/api/files/%2e%2e/files/file?sign=synthetic",
    "/track/api/files/file%2Fchild?sign=synthetic", "/track/api/files/file%5Cchild?sign=synthetic",
    "/track/api/files/file%252Fchild?sign=synthetic", "/track/api/files/file\\child?sign=synthetic",
    "/track/api/files/file/extra?sign=synthetic", "/track/api/files/file?sign=synthetic#fragment",
    "/track/api/files/file?sign=synthetic\ncontrol", "data:text/plain,synthetic",
  ];
  for (const url of urls) {
    const directory = await temporary(t);
    const calls = serve(undefined, { ...metadata, url });
    await assert.rejects(downloadIssueAttachment(connection, "fixture-issue", metadata.id, directory),
      /attachment URL|download URL/);
    assert.equal(calls.length, 1);
    assert.deepEqual(await readdir(directory), []);
  }
});

test("download rejects missing or mismatched metadata without binary IO or raw response disclosure", async (t) => {
  for (const attachment of [
    { ...metadata, id: "other" }, { ...metadata, url: null },
    { ...metadata, name: connection.token }, { ...metadata, mimeType: connection.token },
    { ...metadata, url: signedUrl + connection.token },
  ]) {
    const directory = await temporary(t);
    const calls = serve(undefined, attachment);
    await assert.rejects(downloadIssueAttachment(connection, "fixture-issue", metadata.id, directory), (error: Error) => {
      assert.doesNotMatch(error.message, /synthetic|sign=/);
      return true;
    });
    assert.equal(calls.length, 1);
    assert.deepEqual(await readdir(directory), []);
  }
});

test("download never follows redirect or returns binary error payloads", async (t) => {
  for (const status of [301, 302, 307, 308, 401, 403, 404, 429, 500]) {
    const directory = await temporary(t);
    const calls = serve(() => new HttpResponse("synthetic-signature synthetic-download-token", {
      status, headers: { location: "https://foreign.example.com/?sign=synthetic-signature" },
    }));
    await assert.rejects(downloadIssueAttachment(connection, "fixture-issue", metadata.id, directory), (error: Error) => {
      assert.doesNotMatch(error.message, /synthetic|foreign|sign=/);
      return true;
    });
    assert.equal(calls.length, 2);
    assert.deepEqual(await readdir(join(directory, "downloads")), []);
  }
});

test("download honors explicit filename, ignores Content-Disposition, and handles empty files", async (t) => {
  const directory = await temporary(t);
  serve(() => new HttpResponse(null, {
    headers: { "content-length": "0", "content-disposition": 'attachment; filename="../../bad.exe"' },
  }));
  const result = await downloadIssueAttachment(connection, "fixture-issue", metadata.id, directory, { name: "chosen.bin" });
  assert.equal(result.name, "chosen.bin");
  assert.equal(result.bytes, 0);
  assert.equal((await readFile(result.path)).length, 0);
});

test("download local validation rejects unsafe basenames and invalid limits before any fetch", async (t) => {
  const directory = await temporary(t);
  const calls = serve();
  for (const name of ["", ".", "..", "../file", "a/b", "a\\b", "C:\\file", "/file", "file:stream", "CON", "con.txt", "CON .txt", "CONIN$", "CONOUT$", "LPT1.log", "COM¹", "file.", "file ", "a\u0000b", "a\nb", "a\u202eb", "x".repeat(256)]) {
    await assert.rejects(downloadIssueAttachment(connection, "fixture-issue", metadata.id, directory, { name }), /basename/);
  }
  for (const maxBytes of [0, -1, 1.5, NaN, Infinity, 104857601]) {
    await assert.rejects(downloadIssueAttachment(connection, "fixture-issue", metadata.id, directory, { maxBytes }), /max-bytes/);
  }
  assert.equal(calls.length, 0);
  assert.deepEqual(await readdir(directory), []);
});

test("download sanitizes default metadata name and removes raw or decoded signature reflections", async (t) => {
  for (const name of ["../../CON:file?.bin", "synthetic%2Fsignature%0D%0A.bin", "synthetic/signature\r\n.bin"]) {
    const directory = await temporary(t);
    serve(() => new HttpResponse(bytes, { headers: { "content-type": "synthetic%2Fsignature%0D%0A/example" } }), {
      ...metadata, name, url: signedUrl,
    });
    const result = await downloadIssueAttachment(connection, "fixture-issue", metadata.id, directory);
    assert.equal(result.path, join(directory, "downloads", result.name));
    assert.doesNotMatch(result.name, /[/\\:?\r\n]/);
    assert.doesNotMatch(JSON.stringify(result), /synthetic|signature/);
  }
});

test("download Content-Length and actual streamed byte limits are enforced with partial cleanup", async (t) => {
  for (const contentLength of [undefined, "2", "4", "5", "invalid", "-1", "999999999999999999999"]) {
    const directory = await temporary(t);
    serve(() => new HttpResponse(new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(bytes.subarray(0, 2)); controller.enqueue(bytes.subarray(2)); controller.close(); },
    }), { headers: contentLength === undefined ? {} : { "content-length": contentLength } }));
    await assert.rejects(downloadIssueAttachment(connection, "fixture-issue", metadata.id, directory, { maxBytes: 3 }),
      /limit|Content-Length|length/);
    assert.deepEqual(await readdir(join(directory, "downloads")), []);
  }
});

test("download accepts an exact actual byte limit and rejects truncated Content-Length", async (t) => {
  const directory = await temporary(t);
  serve(() => new HttpResponse(bytes, { headers: { "content-length": "4" } }));
  const result = await downloadIssueAttachment(connection, "fixture-issue", metadata.id, directory, { maxBytes: 4 });
  assert.equal(result.bytes, 4);
  const incompleteDirectory = await temporary(t);
  serve(() => new HttpResponse(bytes, { headers: { "content-length": "5" } }));
  await assert.rejects(downloadIssueAttachment(connection, "fixture-issue", metadata.id, incompleteDirectory), /length|incomplete/);
  assert.deepEqual(await readdir(join(incompleteDirectory, "downloads")), []);
});

test("download reader failure and external abort remove profile temporary data", async (t) => {
  for (const abort of [false, true]) {
    const directory = await temporary(t);
    const controller = new AbortController();
    serve(() => new HttpResponse(new ReadableStream<Uint8Array>({
      start(stream) { stream.enqueue(bytes.subarray(0, 2)); },
      pull(stream) {
        if (abort) controller.abort(new Error("synthetic-signature"));
        else stream.error(new Error("synthetic-signature"));
      },
    })));
    await assert.rejects(downloadIssueAttachment({ ...connection, signal: controller.signal }, "fixture-issue", metadata.id, directory),
      (error: Error) => { assert.doesNotMatch(error.message, /synthetic/); return true; });
    assert.deepEqual(await readdir(join(directory, "downloads")), []);
  }
});

test("download refuses existing destination and directory links without binary IO", async (t) => {
  const directory = await temporary(t);
  await mkdir(join(directory, "downloads"));
  const target = join(directory, "downloads", "chosen.bin");
  await writeFile(target, "original");
  let calls = serve();
  await assert.rejects(downloadIssueAttachment(connection, "fixture-issue", metadata.id, directory, { name: "chosen.bin" }), /exists/);
  assert.equal(calls.length, 1);
  assert.equal(await readFile(target, "utf8"), "original");
  const linkedDirectory = await temporary(t);
  const outside = await temporary(t);
  await symlink(outside, join(linkedDirectory, "downloads"), process.platform === "win32" ? "junction" : "dir");
  calls = serve();
  await assert.rejects(downloadIssueAttachment(connection, "fixture-issue", metadata.id, linkedDirectory), /directory|link/);
  assert.equal(calls.length, 1);
  assert.deepEqual(await readdir(outside), []);
});

test("download refuses a linked destination and a linked AppData ancestor", async (t) => {
  const directory = await temporary(t);
  const outside = await temporary(t);
  await mkdir(join(directory, "downloads"));
  await symlink(outside, join(directory, "downloads", "chosen.bin"), process.platform === "win32" ? "junction" : "dir");
  const calls = serve();
  await assert.rejects(downloadIssueAttachment(connection, "fixture-issue", metadata.id, directory, { name: "chosen.bin" }), /exists/);
  await symlink(outside, join(directory, "linked"), process.platform === "win32" ? "junction" : "dir");
  await assert.rejects(downloadIssueAttachment(connection, "fixture-issue", metadata.id, join(directory, "linked", "profile")), /directory|link/);
  assert.equal(calls.length, 2);
  assert.deepEqual(await readdir(outside), []);
});

test("two same-name downloads publish exactly once without overwrite or residual partial data", async (t) => {
  const directory = await temporary(t);
  let binaryRequests = 0;
  let release!: () => void;
  const barrier = new Promise<void>((resolve) => { release = resolve; });
  serve(async () => {
    if (++binaryRequests === 2) release();
    await barrier;
    return new HttpResponse(bytes);
  });
  const results = await Promise.allSettled([
    downloadIssueAttachment(connection, "fixture-issue", metadata.id, directory, { name: "chosen.bin" }),
    downloadIssueAttachment(connection, "fixture-issue", metadata.id, directory, { name: "chosen.bin" }),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected").length, 1);
  assert.deepEqual(new Uint8Array(await readFile(join(directory, "downloads", "chosen.bin"))), bytes);
  assert.deepEqual(await readdir(join(directory, "downloads")), ["chosen.bin"]);
});

test("download CLI invalid options fail before onboarding and permission denial precedes filesystem/network", async (t) => {
  for (const options of [["--name", "../unsafe"], ["--max-bytes", "0"], ["--max-bytes", "2.5"]]) {
    const f = await fixture(t);
    f.secrets.get = async () => { assert.fail("Invalid options reached keyring"); };
    assert.equal(await f.cli.run(["issues", "attachments", "download", "fixture-issue", metadata.id, ...options, "--json"]), 1);
    assert.match(f.stderr(), /basename|max-bytes/);
    assert.equal(f.stdout(), "");
  }
  const f = await fixture(t);
  await f.cli.execute(["profile", "create", "dev", "--url", connection.baseUrl]);
  await f.secrets.set("ai-cli-factory:youtrack-cli", "dev:token", connection.token);
  await f.cli.execute(["permissions", "revoke", "ReadOnly", "--profile", "dev"]);
  const calls = serve();
  await assert.rejects(f.cli.execute(["issues", "attachments", "download", "fixture-issue", metadata.id, "--profile", "dev"]), /Permission 'ReadOnly' is disabled/);
  assert.equal(calls.length, 0);
  await assert.rejects(stat(join(f.appArguments.WithProfile("dev").AppDataDirectory, "downloads")), /ENOENT/);
});

test("download CLI human and JSON return sanitized domain data beneath the selected profile", async (t) => {
  for (const json of [false, true]) {
    const f = await fixture(t);
    await f.cli.execute(["profile", "create", "dev", "--url", connection.baseUrl]);
    await f.secrets.set("ai-cli-factory:youtrack-cli", "dev:token", connection.token);
    serve();
    assert.equal(await f.cli.run(["issues", "attachments", "download", "fixture-issue", metadata.id,
      "--profile", "dev", "--name", "chosen.bin", "--max-bytes", "4", ...(json ? ["--json"] : [])]), 0);
    const path = join(f.appArguments.WithProfile("dev").AppDataDirectory, "downloads", "chosen.bin");
    assert.deepEqual(new Uint8Array(await readFile(path)), bytes);
    if (json) {
      assert.equal(JSON.parse(f.stdout()).path, path);
      assert.equal(JSON.parse(f.stdout()).bytes, 4);
    } else {
      assert.match(f.stdout(), /chosen.bin/);
    }
    assert.equal(f.stderr(), "");
    assert.doesNotMatch(f.stdout(), /synthetic|sign=/);
  }
});

test("download RPC interleaves profile paths, permissions and credentials without crossing profiles", async (t) => {
  const argv = [
    ["issues", "attachments", "download", "fixture-issue", metadata.id, "--profile", "dev", "--name", "chosen.bin"],
    ["issues", "attachments", "download", "fixture-issue", metadata.id, "--profile", "production", "--name", "chosen.bin"],
    ["issues", "attachments", "download", "fixture-issue", metadata.id, "--profile", "dev", "--name", "chosen.bin"],
    ["issues", "attachments", "download", "fixture-issue", metadata.id, "--profile", "production", "--name", "second.bin"],
  ];
  const input = argv.map((argv, id) => JSON.stringify({ jsonrpc: "2.0", id, method: "cli.execute", params: { argv } })).join("\n") + "\n";
  const f = await fixture(t, input);
  for (const profile of ["dev", "production"]) {
    await f.cli.execute(["profile", "create", profile, "--url", `https://${profile}.example.com/track`]);
    await f.secrets.set("ai-cli-factory:youtrack-cli", `${profile}:token`, `synthetic-${profile}`);
  }
  const calls: string[] = [];
  server.use(http.get("*", ({ request }) => {
    const url = new URL(request.url);
    const profile = url.hostname.split(".")[0];
    calls.push(profile!);
    if (url.pathname.includes("/attachments/")) {
      assert.equal(request.headers.get("authorization"), `Bearer synthetic-${profile}`);
      return HttpResponse.json(metadata);
    }
    assert.equal(request.headers.get("authorization"), null);
    return new HttpResponse(bytes);
  }));
  assert.equal(await f.cli.run(["--json-rpc"]), 0);
  const replies = f.stdout().trim().split("\n").map((line) => JSON.parse(line));
  assert.equal(replies[0].result.path, join(f.appArguments.WithProfile("dev").AppDataDirectory, "downloads", "chosen.bin"));
  assert.equal(replies[1].result.path, join(f.appArguments.WithProfile("production").AppDataDirectory, "downloads", "chosen.bin"));
  assert.equal(replies[2].error.code, -32000);
  assert.match(replies[2].error.message, /exists/);
  assert.equal(replies[3].result.name, "second.bin");
  assert.deepEqual(calls, ["dev", "dev", "production", "production", "dev", "production", "production"]);
  assert.doesNotMatch(f.stdout() + f.stderr(), /synthetic|sign=/);
});


test("download rejects percent-encoded active bearer reflections anywhere in a returned URL", async (t) => {
  const encodedToken = [...connection.token].map((character) => `%${character.charCodeAt(0).toString(16)}`).join("");
  for (const url of [
    `/track/api/files/file?sign=${encodedToken}`,
    `/track/api/files/file?${encodedToken}=synthetic-signature`,
    `/track/api/files/file/sign=${encodedToken}`,
    `/track/api/files/${encodedToken}?sign=synthetic-signature`,
  ]) {
    const directory = await temporary(t);
    const calls = serve(undefined, { ...metadata, url });
    await assert.rejects(downloadIssueAttachment(connection, "fixture-issue", metadata.id, directory), (error: Error) => {
      assert.doesNotMatch(error.message, /synthetic|sign=/);
      return true;
    });
    assert.equal(calls.length, 1);
  }
});

test("download strips reflected plain signatures from the filename and content type", async (t) => {
  const directory = await temporary(t);
  serve(() => new HttpResponse(bytes, { headers: { "content-type": "synthetic-signature/example" } }), {
    ...metadata, name: "synthetic-signature.bin", url: "/track/api/files/file/sign=synthetic-signature",
  });
  const result = await downloadIssueAttachment(connection, "fixture-issue", metadata.id, directory);
  assert.equal(result.name, "attachment-fixture-redacted.bin");
  assert.equal(result.contentType, "application/octet-stream");
  assert.doesNotMatch(JSON.stringify(result), /synthetic-signature/);
});

test("over-limit download cancels its body reader and leaves no partial data", async (t) => {
  const directory = await temporary(t);
  let cancellations = 0;
  const originalCancel = ReadableStreamDefaultReader.prototype.cancel;
  t.mock.method(ReadableStreamDefaultReader.prototype, "cancel", function (
    this: ReadableStreamDefaultReader<Uint8Array>, reason?: unknown,
  ) {
    cancellations++;
    return originalCancel.call(this, reason);
  });
  serve(() => new HttpResponse(bytes));
  await assert.rejects(downloadIssueAttachment(connection, "fixture-issue", metadata.id, directory, { maxBytes: 3 }), /limit/);
  assert.ok(cancellations > 0);
  assert.deepEqual(await readdir(join(directory, "downloads")), []);
});


test("path signature decoding preserves literal plus while preventing decoded MIME disclosure", async (t) => {
  const directory = await temporary(t);
  serve(() => new HttpResponse(bytes, { headers: { "content-type": "abc/def+ghi" } }), {
    ...metadata, name: "abc/def+ghi.bin", url: "/track/api/files/file/sign=abc%2Fdef+ghi",
  });
  const result = await downloadIssueAttachment(connection, "fixture-issue", metadata.id, directory);
  assert.equal(result.name, "attachment-fixture-redacted.bin");
  assert.equal(result.contentType, "application/octet-stream");
  assert.doesNotMatch(JSON.stringify(result), /abc|def|ghi/);
});

test("unsupported hard-link publication fails closed and cleans completed temporary bytes", async (t) => {
  const directory = await temporary(t);
  t.mock.method(fs.promises, "link", async () => {
    throw Object.assign(new Error("synthetic-filesystem-path synthetic-signature"), { code: "ENOTSUP" });
  });
  syncBuiltinESMExports();
  t.after(() => { t.mock.restoreAll(); syncBuiltinESMExports(); });
  serve();
  await assert.rejects(downloadIssueAttachment(connection, "fixture-issue", metadata.id, directory), (error: Error) => {
    assert.match(error.message, /hard links/);
    assert.doesNotMatch(error.message, /synthetic/);
    return true;
  });
  assert.deepEqual(await readdir(join(directory, "downloads")), []);
});
