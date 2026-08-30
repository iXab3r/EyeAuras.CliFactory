import assert from "node:assert/strict";
import { after, afterEach, before, test, type TestContext } from "node:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { fixture as baseFixture } from "./cli-fixture.js";
import {
  addIssueLink, addIssueTag, getIssueLink, getLinkType, getTag, listIssueLinks,
  listIssueTags, listLinkedIssues, listLinkTypes, listTags, removeIssueLink, removeIssueTag,
} from "../src/issue-relations.js";
import type { PageOptions } from "../src/client.js";

const server = setupServer();
before(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
after(() => server.close());
const connection = { baseUrl: "https://youtrack.example.com/context/", token: "synthetic-token" };
const sourceID = "source /?#%é";
const linkID = "link /?#%t";
const targetID = "target /?#%é";
const sourcePath = `/context/api/issues/${encodeURIComponent(sourceID)}`;
const linkPath = `${sourcePath}/links/${encodeURIComponent(linkID)}`;
const typeFields = "id,name,directed,sourceToTarget,targetToSource";
const linkFields = `id,direction,linkType(${typeFields})`;
const linkedFields = "id,idReadable,summary";
const tagFields = "id,name";
const reads = [
  { argv: ["link-types", "list"], path: "/context/api/issueLinkTypes", projection: typeFields, list: true,
    run: (options: PageOptions) => listLinkTypes(connection, options) },
  { argv: ["link-types", "get", linkID], path: `/context/api/issueLinkTypes/${encodeURIComponent(linkID)}`, projection: typeFields, list: false,
    run: (options: PageOptions) => getLinkType(connection, linkID, options) },
  { argv: ["issues", "links", "list", sourceID], path: `${sourcePath}/links`, projection: linkFields, list: true,
    run: (options: PageOptions) => listIssueLinks(connection, sourceID, options) },
  { argv: ["issues", "links", "get", sourceID, linkID], path: linkPath, projection: linkFields, list: false,
    run: (options: PageOptions) => getIssueLink(connection, sourceID, linkID, options) },
  { argv: ["issues", "links", "issues", sourceID, linkID], path: `${linkPath}/issues`, projection: linkedFields, list: true,
    run: (options: PageOptions) => listLinkedIssues(connection, sourceID, linkID, options) },
  { argv: ["tags", "list"], path: "/context/api/tags", projection: tagFields, list: true,
    run: (options: PageOptions) => listTags(connection, options) },
  { argv: ["tags", "get", targetID], path: `/context/api/tags/${encodeURIComponent(targetID)}`, projection: tagFields, list: false,
    run: (options: PageOptions) => getTag(connection, targetID, options) },
  { argv: ["issues", "tags", "list", sourceID], path: `${sourcePath}/tags`, projection: tagFields, list: true,
    run: (options: PageOptions) => listIssueTags(connection, sourceID, options) },
];
const writes = [
  { argv: ["issues", "links", "add", sourceID, linkID, "--body", JSON.stringify({ id: targetID })],
    path: `${linkPath}/issues`, method: "POST", projection: linkedFields,
    run: () => addIssueLink(connection, sourceID, linkID, { id: targetID }) },
  { argv: ["issues", "links", "remove", sourceID, linkID, targetID],
    path: `${linkPath}/issues/${encodeURIComponent(targetID)}`, method: "DELETE", projection: null,
    run: () => removeIssueLink(connection, sourceID, linkID, targetID) },
  { argv: ["issues", "tags", "add", sourceID, "--body", JSON.stringify({ id: targetID })],
    path: `${sourcePath}/tags`, method: "POST", projection: tagFields,
    run: () => addIssueTag(connection, sourceID, { id: targetID }) },
  { argv: ["issues", "tags", "remove", sourceID, targetID],
    path: `${sourcePath}/tags/${encodeURIComponent(targetID)}`, method: "DELETE", projection: null,
    run: () => removeIssueTag(connection, sourceID, targetID) },
];

async function fixture(t: TestContext, input = "") {
  const f = await baseFixture(t, input);
  for (const name of ["dev", "other"]) {
    await f.cli.execute(["profile", "create", name, "--url", `https://${name}.example.com/context/`]);
    await f.secrets.set("ai-cli-factory:youtrack-cli", `${name}:token`, `synthetic-${name}`);
  }
  return f;
}
for (const row of reads) {
  test(`relations read ${row.argv.join(" ")}: exact GET and bounded sparse projection`, async () => {
    let calls = 0;
    let expectedFields = row.projection;
    let expectedTop = "50";
    let expectedSkip = "0";
    const value = { id: "fixture", linkType: null, summary: null };
    server.use(http.get("*", ({ request }) => {
      calls++;
      const url = new URL(request.url);
      assert.equal(url.pathname, row.path);
      assert.equal(url.searchParams.get("fields"), expectedFields);
      assert.equal(url.searchParams.get("$top"), row.list ? expectedTop : null);
      assert.equal(url.searchParams.get("$skip"), row.list ? expectedSkip : null);
      assert.equal([...url.searchParams.keys()].length, row.list ? 3 : 1);
      assert.equal(request.headers.get("authorization"), "Bearer synthetic-token");
      return HttpResponse.json(row.list ? [value] : value);
    }));
    assert.deepEqual(await row.run({}), row.list ? [value] : value);
    expectedFields = "id,linkType(id),summary";
    expectedTop = "2";
    expectedSkip = "3";
    assert.deepEqual(await row.run({ fields: expectedFields, top: 2, skip: 3 }), row.list ? [value] : value);
    assert.equal(calls, 2);
    if (row.list) {
      server.use(http.get("*", () => HttpResponse.json([])));
      assert.deepEqual(await row.run({}), []);
      server.use(http.get("*", () => HttpResponse.json([{}, {}])));
      await assert.rejects(row.run({ top: 1 }), /top limit/);
    }
  });
}

for (const row of writes) {
  test(`relations write ${row.method} ${row.path}: exact target and empty success`, async () => {
    let calls = 0;
    server.use(http.all("*", async ({ request }) => {
      calls++;
      const url = new URL(request.url);
      assert.equal(request.method, row.method);
      assert.equal(url.pathname, row.path);
      assert.equal(url.searchParams.get("fields"), row.projection);
      assert.equal([...url.searchParams.keys()].length, row.method === "POST" ? 1 : 0);
      assert.equal(request.headers.get("authorization"), "Bearer synthetic-token");
      if (row.method === "POST") {
        assert.equal(request.headers.get("content-type"), "application/json");
        assert.deepEqual(await request.json(), { id: targetID });
      } else {
        assert.equal(request.headers.get("content-type"), null);
        assert.equal(await request.text(), "");
      }
      return new HttpResponse(null, { status: 204 });
    }));
    assert.equal(await row.run(), null);
    assert.equal(calls, 1);
  });
}

test("relations mutations reject nonobjects, extra keys and invalid reference IDs before fetch", async () => {
  const local = { ...connection, fetch: (async () => { assert.fail("Invalid input reached fetch"); }) as typeof fetch };
  for (const body of [null, [], {}, { id: null }, { id: "" }, { id: " " }, { id: "fixture\n" },
    { id: ".." }, { id: "fixture", name: "Unsupported" }, { idReadable: "DEMO-1" }]) {
    await assert.rejects(addIssueLink(local, "source", "link", body), /YouTrack/);
    await assert.rejects(addIssueTag(local, "source", body), /YouTrack/);
  }
  for (const id of ["", ".", "..", "x\n", "\ud800"]) {
    await assert.rejects(getLinkType(local, id), /YouTrack/);
    await assert.rejects(getTag(local, id), /YouTrack/);
    await assert.rejects(getIssueLink(local, id, "link"), /YouTrack/);
    await assert.rejects(getIssueLink(local, "source", id), /YouTrack/);
    await assert.rejects(removeIssueLink(local, "source", "link", id), /YouTrack/);
    await assert.rejects(removeIssueTag(local, "source", id), /YouTrack/);
  }
});

test("direction markers and literal percent segments are preserved without discovery", async () => {
  const seen: string[] = [];
  server.use(http.post("*", ({ request }) => {
    seen.push(new URL(request.url).pathname);
    return HttpResponse.json({ id: "fixture-target" });
  }));
  for (const id of ["fixture-s", "fixture-t", "fixture", "%2e"])
    await addIssueLink(connection, "%2e%2e", id, { id: "fixture-target" });
  assert.deepEqual(seen, ["fixture-s", "fixture-t", "fixture", "%252e"].map((id) =>
    `/context/api/issues/%252e%252e/links/${id}/issues`));
});

test("all relation writes sanitize responses and fail remote errors without retries", async () => {
  for (const row of writes) {
    server.use(http.all("*", () => HttpResponse.json({ value: "synthetic-token", nested: { url: "/files?sign=synthetic" } })));
    assert.deepEqual(await row.run(), { value: "[redacted]", nested: { url: "[redacted]" } });
    for (const raw of ["null", "[]", "synthetic-private-malformed"]) {
      server.use(http.all("*", () => new HttpResponse(raw)));
      await assert.rejects(row.run(), /invalid .*response/);
    }
    for (const status of [400, 401, 403, 404, 409, 429, 500]) {
      let calls = 0;
      server.use(http.all("*", () => {
        calls++;
        return new HttpResponse("synthetic-token private-diagnostic", { status });
      }));
      await assert.rejects(row.run(), new RegExp(`^Error: YouTrack request failed \\(HTTP ${status}\\)\\.$`));
      assert.equal(calls, 1);
    }
  }
});

test("real CLI declares all twelve relations routes and gates each write before network", async (t) => {
  const f = await fixture(t);
  let calls = 0;
  server.use(http.all("*", () => { calls++; return HttpResponse.json({}); }));
  for (const row of writes)
    await assert.rejects(f.cli.execute([...row.argv, "--profile", "dev"]), /Permission 'Update' is disabled/);
  assert.equal(calls, 0);
  await f.cli.execute(["permissions", "grant", "Update", "--profile", "dev"]);
  for (const row of writes) {
    server.use(http.all("*", async ({ request }) => {
      calls++;
      assert.equal(request.method, row.method);
      assert.equal(new URL(request.url).pathname, row.path);
      assert.equal(request.headers.get("authorization"), "Bearer synthetic-dev");
      if (row.method === "POST") assert.deepEqual(await request.json(), { id: targetID });
      return new HttpResponse(null, { status: 204 });
    }));
    assert.equal(await f.cli.execute([...row.argv, "--profile", "dev"]), null);
    await assert.rejects(f.cli.execute([...row.argv, "--profile", "other"]), /Permission 'Update' is disabled/);
  }
  assert.equal(calls, 4);
  for (const row of reads) {
    server.use(http.get("*", ({ request }) => {
      calls++;
      assert.equal(new URL(request.url).pathname, row.path);
      return HttpResponse.json(row.list ? [{ id: "fixture" }] : { id: "fixture" });
    }));
    assert.deepEqual(await f.cli.execute([...row.argv, "--profile", "dev"]), row.list ? [{ id: "fixture" }] : { id: "fixture" });
  }
  assert.equal(calls, 12);
  await f.cli.execute(["permissions", "revoke", "ReadOnly", "--profile", "dev"]);
  for (const row of reads)
    await assert.rejects(f.cli.execute([...row.argv, "--profile", "dev"]), /Permission 'ReadOnly' is disabled/);
  assert.equal(calls, 12);
});

test("relations JSON/human/RPC use real declarations and preserve profile isolation", async (t) => {
  server.use(http.get("*", ({ request }) => {
    const url = new URL(request.url);
    const profile = url.hostname.split(".")[0];
    assert.equal(request.headers.get("authorization"), `Bearer synthetic-${profile}`);
    return HttpResponse.json([{ id: "fixture-tag", name: "Fixture label" }]);
  }));
  const json = await fixture(t);
  assert.equal(await json.cli.run(["tags", "list", "--profile", "dev", "--json"]), 0);
  assert.deepEqual(JSON.parse(json.stdout()), [{ id: "fixture-tag", name: "Fixture label" }]);
  const human = await fixture(t);
  assert.equal(await human.cli.run(["tags", "list", "--profile", "other"]), 0);
  assert.match(human.stdout(), /Fixture label/);
  const input = [
    ["tags", "list", "--profile", "dev"],
    ["issues", "tags", "remove", "fixture-issue", "fixture-tag", "--profile", "other"],
    ["issues", "tags", "list", "fixture-issue", "--profile", "other"],
  ].map((argv, id) => JSON.stringify({ jsonrpc: "2.0", id, method: "cli.execute", params: { argv } })).join("\n") + "\n";
  const rpc = await fixture(t, input);
  assert.equal(await rpc.cli.run(["--json-rpc"]), 0);
  const responses = rpc.stdout().trim().split("\n").map((line) => JSON.parse(line));
  assert.deepEqual(responses[0].result, [{ id: "fixture-tag", name: "Fixture label" }]);
  assert.equal(responses[1].error.code, -32000);
  assert.match(responses[1].error.message, /Permission 'Update' is disabled/);
  assert.deepEqual(responses[2].result, responses[0].result);
  assert.equal(rpc.stderr(), "");
});



test("relation body commands reject missing, malformed and unsupported JSON before fetch", async (t) => {
  const f = await fixture(t);
  await f.cli.execute(["permissions", "grant", "Update", "--profile", "dev"]);
  let calls = 0;
  server.use(http.all("*", () => { calls++; return HttpResponse.json({}); }));
  for (const argv of [["issues", "links", "add", "fixture-source", "fixture-link"],
    ["issues", "tags", "add", "fixture-source"]]) {
    await assert.rejects(f.cli.execute([...argv, "--profile", "dev"]), /required option/);
    for (const body of ["{", "{}", '{"name":"Unsupported"}', '{"id":"fixture","extra":true}'])
      await assert.rejects(f.cli.execute([...argv, "--body", body, "--profile", "dev"]), /YouTrack/);
  }
  assert.equal(calls, 0);
});

test("relation write JSON and persistent RPC return sanitized domain values without profile bleed", async (t) => {
  let posts = 0;
  let deletes = 0;
  server.use(
    http.post("*", async ({ request }) => {
      posts++;
      assert.equal(request.headers.get("authorization"), "Bearer synthetic-dev");
      assert.deepEqual(await request.json(), { id: "fixture-target" });
      return HttpResponse.json({ id: "fixture-target", name: "synthetic-dev", url: "/files?sign=synthetic" });
    }),
    http.delete("*", ({ request }) => {
      deletes++;
      assert.equal(request.headers.get("authorization"), "Bearer synthetic-dev");
      assert.equal(new URL(request.url).pathname, "/context/api/issues/fixture-source/tags/fixture-target");
      return new HttpResponse(null, { status: 204 });
    }),
  );
  const add = ["issues", "tags", "add", "fixture-source", "--body", '{"id":"fixture-target"}'];
  const remove = ["issues", "tags", "remove", "fixture-source", "fixture-target"];
  const json = await fixture(t);
  await json.cli.execute(["permissions", "grant", "Update", "--profile", "dev"]);
  assert.equal(await json.cli.run([...remove, "--profile", "dev", "--json"]), 0);
  assert.equal(JSON.parse(json.stdout()), null);
  const input = [[...add, "--profile", "dev"], [...remove, "--profile", "other"], [...remove, "--profile", "dev"]]
    .map((argv, id) => JSON.stringify({ jsonrpc: "2.0", id, method: "cli.execute", params: { argv } })).join("\n") + "\n";
  const rpc = await fixture(t, input);
  await rpc.cli.execute(["permissions", "grant", "Update", "--profile", "dev"]);
  assert.equal(await rpc.cli.run(["--json-rpc"]), 0);
  const responses = rpc.stdout().trim().split("\n").map((line) => JSON.parse(line));
  assert.deepEqual(responses[0].result, { id: "fixture-target", name: "[redacted]", url: "[redacted]" });
  assert.equal(responses[1].error.code, -32000);
  assert.equal(responses[2].result, null);
  assert.equal(posts, 1);
  assert.equal(deletes, 2);
  assert.equal(rpc.stderr(), "");
});
