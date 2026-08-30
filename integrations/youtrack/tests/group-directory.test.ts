import assert from "node:assert/strict";
import { after, afterEach, before, test, type TestContext } from "node:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { fixture as baseFixture } from "./cli-fixture.js";
import {
  getGroup,
  getProjectTeam,
  listGroupMembers,
  listGroups,
  listProjectTeamGroups,
  listProjectTeamUsers,
  listSubgroups,
  type MemberOptions,
} from "../src/group-directory.js";

const server = setupServer();
before(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
after(() => server.close());
const connection = { baseUrl: "https://youtrack.example.com/context/", token: "synthetic-token" };
const id = "fixture /?#%é";
const encoded = encodeURIComponent(id);
const groupPath = `/context/api/groups/${encoded}`;
const teamPath = `/context/api/admin/projects/${encoded}/team`;
const groupFields = "id,name,usersCount";
const userFields = "id,login,fullName";
const rows = [
  {
    argv: ["group", "list"], path: "/context/api/groups", fields: groupFields, list: true,
    run: (options: MemberOptions) => listGroups(connection, options),
  },
  {
    argv: ["group", "get", id], path: groupPath, fields: groupFields, list: false,
    run: (options: MemberOptions) => getGroup(connection, id, options),
  },
  {
    argv: ["group", "member", "list", id, "--direct"], path: `${groupPath}/ownUsers`, fields: userFields, list: true,
    run: (options: MemberOptions) => listGroupMembers(connection, id, { ...options, direct: true }),
  },
  {
    argv: ["group", "subgroup", "list", id], path: `${groupPath}/subGroups`, fields: groupFields, list: true,
    run: (options: MemberOptions) => listSubgroups(connection, id, options),
  },
  {
    argv: ["group", "member", "list", id], path: `${groupPath}/users`, fields: userFields, list: true,
    run: (options: MemberOptions) => listGroupMembers(connection, id, options),
  },
  {
    argv: ["project", "team", "get", id], path: teamPath, fields: groupFields, list: false,
    run: (options: MemberOptions) => getProjectTeam(connection, id, options),
  },
  {
    argv: ["project", "team", "group", "list", id], path: `${teamPath}/groups`, fields: groupFields, list: true,
    run: (options: MemberOptions) => listProjectTeamGroups(connection, id, options),
  },
  {
    argv: ["project", "team", "user", "list", id, "--direct"], path: `${teamPath}/ownUsers`, fields: userFields, list: true,
    run: (options: MemberOptions) => listProjectTeamUsers(connection, id, { ...options, direct: true }),
  },
  {
    argv: ["project", "team", "user", "list", id], path: `${teamPath}/users`, fields: userFields, list: true,
    run: (options: MemberOptions) => listProjectTeamUsers(connection, id, options),
  },
];

async function fixture(t: TestContext, input = "") {
  const f = await baseFixture(t, input);
  for (const name of ["dev", "other"]) {
    await f.cli.execute(["profile", "create", name, "--url", `https://${name}.example.com/context/`]);
    await f.secrets.set("ai-cli-factory:youtrack-cli", `${name}:token`, `synthetic-${name}`);
  }
  return f;
}

for (const row of rows) {
  test(`directory GET ${row.path}: exact one-request route, defaults and sparse projection`, async () => {
    let calls = 0;
    let expectedFields = row.fields;
    let expectedTop = "50";
    let expectedSkip = "0";
    const object = { id: "fixture", ringId: null };
    server.use(http.get("*", ({ request }) => {
      calls++;
      const url = new URL(request.url);
      assert.equal(url.pathname, row.path);
      assert.equal(url.searchParams.get("fields"), expectedFields);
      assert.equal(url.searchParams.get("$top"), row.list ? expectedTop : null);
      assert.equal(url.searchParams.get("$skip"), row.list ? expectedSkip : null);
      assert.equal([...url.searchParams].length, row.list ? 3 : 1);
      assert.equal(request.headers.get("authorization"), "Bearer synthetic-token");
      return HttpResponse.json(row.list ? [object] : object);
    }));
    assert.deepEqual(await row.run({}), row.list ? [object] : object);
    assert.equal(calls, 1);
    expectedFields = "id,ringId";
    expectedTop = "2";
    expectedSkip = "3";
    assert.deepEqual(await row.run({ fields: expectedFields, top: 2, skip: 3 }), row.list ? [object] : object);
    assert.equal(calls, 2);
    if (row.list) {
      server.use(http.get("*", () => HttpResponse.json([])));
      assert.deepEqual(await row.run({}), []);
      server.use(http.get("*", () => HttpResponse.json([{}, {}])));
      await assert.rejects(row.run({ top: 1 }), /top limit/);
    }
  });
}

test("directory selectors and collection bounds fail locally before fetch", async () => {
  const local = {
    ...connection,
    fetch: (async () => { assert.fail("Invalid directory input reached fetch"); }) as typeof fetch,
  };
  for (const invalid of ["", ".", "..", "fixture\n", "\ud800"]) {
    await assert.rejects(getGroup(local, invalid), /YouTrack/);
    await assert.rejects(listGroupMembers(local, invalid), /YouTrack/);
    await assert.rejects(listSubgroups(local, invalid), /YouTrack/);
    await assert.rejects(getProjectTeam(local, invalid), /YouTrack/);
    await assert.rejects(listProjectTeamGroups(local, invalid), /YouTrack/);
    await assert.rejects(listProjectTeamUsers(local, invalid, { direct: true }), /YouTrack/);
  }
  for (const options of [{ top: 0 }, { top: 101 }, { top: 1.5 }, { skip: -1 }, { skip: Number.MAX_SAFE_INTEGER + 1 }, { fields: "" }]) {
    await assert.rejects(listGroups(local, options), /YouTrack/);
    await assert.rejects(listGroupMembers(local, "fixture", options), /YouTrack/);
    await assert.rejects(listSubgroups(local, "fixture", options), /YouTrack/);
    await assert.rejects(listProjectTeamGroups(local, "fixture", options), /YouTrack/);
    await assert.rejects(listProjectTeamUsers(local, "fixture", options), /YouTrack/);
  }
});

test("directory permission/version failures stay errors without retries or Hub fallback", async () => {
  for (const row of rows) {
    for (const status of [401, 403, 404, 429, 500]) {
      let calls = 0;
      server.use(http.get("*", ({ request }) => {
        calls++;
        assert.equal(new URL(request.url).pathname, row.path);
        return new HttpResponse("synthetic-token private-diagnostic", { status });
      }));
      await assert.rejects(row.run({}), new RegExp(`^Error: YouTrack request failed \\(HTTP ${status}\\)\\.$`));
      assert.equal(calls, 1);
    }
    server.use(http.get("*", () => HttpResponse.json(row.list ? {} : [])));
    await assert.rejects(row.run({}), /invalid .*response/);
  }
});

test("directory projections scrub nested credentials for all nine routes", async () => {
  for (const row of rows) {
    const value = { id: "fixture", nested: { url: "/files?sign=synthetic", text: "synthetic-token" } };
    server.use(http.get("*", () => HttpResponse.json(row.list ? [value] : value)));
    const scrubbed = { id: "fixture", nested: { url: "[redacted]", text: "[redacted]" } };
    assert.deepEqual(await row.run({ fields: "id,nested(url,text)" }), row.list ? [scrubbed] : scrubbed);
  }
});

test("real CLI reaches all nine directory routes and denies ReadOnly before fetch", async (t) => {
  const f = await fixture(t);
  let calls = 0;
  for (const row of rows) {
    server.use(http.get("*", ({ request }) => {
      calls++;
      const url = new URL(request.url);
      assert.equal(url.hostname, "dev.example.com");
      assert.equal(url.pathname, row.path);
      assert.equal(url.searchParams.get("fields"), "id");
      assert.equal(url.searchParams.get("$top"), row.list ? "2" : null);
      assert.equal(url.searchParams.get("$skip"), row.list ? "3" : null);
      assert.equal(request.headers.get("authorization"), "Bearer synthetic-dev");
      return HttpResponse.json(row.list ? [{ id: "fixture" }] : { id: "fixture" });
    }));
    const paging = row.list ? ["--top", "2", "--skip", "3"] : [];
    assert.deepEqual(
      await f.cli.execute([...row.argv, "--fields", "id", ...paging, "--profile", "dev"]),
      row.list ? [{ id: "fixture" }] : { id: "fixture" },
    );
  }
  assert.equal(calls, 9);
  await f.cli.execute(["permissions", "revoke", "ReadOnly", "--profile", "dev"]);
  for (const row of rows) {
    await assert.rejects(f.cli.execute([...row.argv, "--profile", "dev"]), /Permission 'ReadOnly' is disabled/);
  }
  assert.equal(calls, 9);
});

test("direct is a boolean selector, malformed flags and unsupported query fail before fetch", async (t) => {
  const f = await fixture(t);
  let calls = 0;
  server.use(http.get("*", () => { calls++; return HttpResponse.json([]); }));
  for (const argv of [["group", "member", "list", "fixture"], ["project", "team", "user", "list", "fixture"]]) {
    for (const flags of [["--direct=false"], ["--direct", "false"], ["--no-direct"], ["--direct", "true"]]) {
      await assert.rejects(f.cli.execute([...argv, ...flags, "--profile", "dev"]));
    }
  }
  await assert.rejects(f.cli.execute(["group", "list", "--query", "fixture", "--profile", "dev"]));
  await assert.rejects(f.cli.execute(["project", "team", "get", "fixture", "--top", "2", "--profile", "dev"]));
  assert.equal(calls, 0);
});

test("directory JSON/human and persistent RPC distinguish direct members and isolate profiles", async (t) => {
  const seen: string[] = [];
  server.use(http.get("*", ({ request }) => {
    const url = new URL(request.url);
    const profile = url.hostname.split(".")[0];
    assert.equal(request.headers.get("authorization"), `Bearer synthetic-${profile}`);
    seen.push(`${profile}:${url.pathname}`);
    const direct = url.pathname.endsWith("/ownUsers");
    return HttpResponse.json(direct ? [{ id: "fixture-direct", login: "fixture-user" }] : [
      { id: "fixture-direct", login: "fixture-user" }, { id: "fixture-inherited", login: "inherited-user" },
    ]);
  }));
  const json = await fixture(t);
  assert.equal(await json.cli.run(["group", "member", "list", "fixture", "--direct", "--profile", "dev", "--json"]), 0);
  assert.deepEqual(JSON.parse(json.stdout()), [{ id: "fixture-direct", login: "fixture-user" }]);
  const human = await fixture(t);
  assert.equal(await human.cli.run(["project", "team", "user", "list", "fixture", "--profile", "other"]), 0);
  assert.match(human.stdout(), /inherited-user/);
  const input = [
    ["group", "member", "list", "%2e", "--direct", "--profile", "dev"],
    ["project", "team", "user", "list", "%2e", "--profile", "other"],
    ["project", "team", "user", "list", "%2e", "--direct", "--profile", "dev"],
  ].map((argv, id) => JSON.stringify({ jsonrpc: "2.0", id, method: "cli.execute", params: { argv } })).join("\n") + "\n";
  const rpc = await fixture(t, input);
  assert.equal(await rpc.cli.run(["--json-rpc"]), 0);
  const responses = rpc.stdout().trim().split("\n").map((line) => JSON.parse(line));
  assert.equal(responses[0].result.length, 1);
  assert.equal(responses[1].result.length, 2);
  assert.equal(responses[2].result.length, 1);
  assert.deepEqual(seen.slice(-3), [
    "dev:/context/api/groups/%252e/ownUsers",
    "other:/context/api/admin/projects/%252e/team/users",
    "dev:/context/api/admin/projects/%252e/team/ownUsers",
  ]);
  assert.equal(rpc.stderr(), "");
});
