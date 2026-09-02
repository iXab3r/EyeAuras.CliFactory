import assert from "node:assert/strict";
import { join } from "node:path";
import { after, afterEach, before, test } from "node:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import type { PageOptions } from "../src/client.js";
import {
  getUser,
  getUserBundle,
  getUserBundleGroup,
  getUserBundleIndividual,
  listUserBundleGroups,
  listUserBundleIndividuals,
  listUserBundleMembers,
  listUserBundles,
} from "../src/user-directory.js";
import { configuredFixture, fixture } from "./cli-fixture.js";

const server = setupServer();
before(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
after(() => server.close());
const connection = { baseUrl: "https://youtrack.example.com/context/", token: "synthetic-token" };
const service = "ai-cli-factory:youtrack-cli";
const bundleID = "fixture bundle /?#%é";
const userID = "fixture.user /?#%é";
const groupID = "fixture group /?#%é";
const basePath = "/api/admin/customFieldSettings/bundles/user";
const bundlePath = `${basePath}/${encodeURIComponent(bundleID)}`;
const directUser = { id: "fixture-direct-user", login: "fixture.direct", fullName: "Fixture direct user" };
const inheritedUser = { id: "fixture-inherited-user", login: "fixture.inherited", fullName: "Fixture inherited user" };
const bundle = { id: "fixture-bundle", name: "Fixture user bundle", isUpdateable: false };
const group = { id: "fixture-group", name: "Fixture group", usersCount: 2, allUsersGroup: false };
const rows = [
  {
    path: basePath, fields: "id,name,isUpdateable", collection: true, result: [bundle],
    argv: ["bundle", "user", "list"],
    run: (options: PageOptions = {}) => listUserBundles(connection, options),
  },
  {
    path: bundlePath, fields: "id,name,isUpdateable", collection: false, result: bundle,
    argv: ["bundle", "user", "get", bundleID],
    run: (options: PageOptions = {}) => getUserBundle(connection, bundleID, options),
  },
  {
    path: `${bundlePath}/aggregatedUsers`, fields: "id,login,fullName", collection: true,
    result: [directUser, inheritedUser], argv: ["bundle", "user", "member", "list", bundleID],
    run: (options: PageOptions = {}) => listUserBundleMembers(connection, bundleID, options),
  },
  {
    path: `${bundlePath}/groups`, fields: "id,name,usersCount,allUsersGroup", collection: true,
    result: [group], argv: ["bundle", "user", "group", "list", bundleID],
    run: (options: PageOptions = {}) => listUserBundleGroups(connection, bundleID, options),
  },
  {
    path: `${bundlePath}/groups/${encodeURIComponent(groupID)}`,
    fields: "id,name,usersCount,allUsersGroup", collection: false, result: group,
    argv: ["bundle", "user", "group", "get", bundleID, groupID],
    run: (options: PageOptions = {}) => getUserBundleGroup(connection, bundleID, groupID, options),
  },
  {
    path: `${bundlePath}/individuals`, fields: "id,login,fullName", collection: true,
    result: [directUser], argv: ["bundle", "user", "individual", "list", bundleID],
    run: (options: PageOptions = {}) => listUserBundleIndividuals(connection, bundleID, options),
  },
  {
    path: `${bundlePath}/individuals/${encodeURIComponent(userID)}`,
    fields: "id,login,fullName", collection: false, result: directUser,
    argv: ["bundle", "user", "individual", "get", bundleID, userID],
    run: (options: PageOptions = {}) => getUserBundleIndividual(connection, bundleID, userID, options),
  },
  {
    path: `/api/users/${encodeURIComponent(userID)}`, fields: "id,login,fullName",
    collection: false, result: directUser, argv: ["user", "get", userID],
    run: (options: PageOptions = {}) => getUser(connection, userID, options),
  },
];

for (const row of rows) {
  test(`${row.argv.slice(0, row.collection ? 4 : 3).join(" ")} uses the exact encoded route and finite projection`, async () => {
    let calls = 0;
    server.use(http.get("*", async ({ request }) => {
      const explicit = calls++ === 1;
      const url = new URL(request.url);
      assert.equal(url.pathname, `/context${row.path}`);
      assert.equal(request.headers.get("authorization"), "Bearer synthetic-token");
      assert.equal(request.headers.get("content-type"), null);
      assert.equal(await request.text(), "");
      assert.equal(request.redirect, "error");
      assert.deepEqual(Object.fromEntries(url.searchParams), {
        fields: explicit ? "id" : row.fields,
        ...(row.collection ? { $top: explicit ? "3" : "50", $skip: explicit ? "7" : "0" } : {}),
      });
      return HttpResponse.json(explicit ? (row.collection ? [{ id: "fixture-only" }] : { id: "fixture-only" }) : row.result);
    }));
    assert.deepEqual(await row.run(), row.result);
    assert.deepEqual(await row.run({ fields: "id", top: 3, skip: 7 }), row.collection ? [{ id: "fixture-only" }] : { id: "fixture-only" });
    assert.equal(calls, 2);
  });
}

test("membership routes preserve aggregate, direct-account and attached-group semantics without follow-ups", async () => {
  const seen: string[] = [];
  server.use(http.get("*", ({ request }) => {
    const path = new URL(request.url).pathname;
    seen.push(path);
    if (path.endsWith("/aggregatedUsers")) {
      return HttpResponse.json([directUser, inheritedUser]);
    }
    if (path.endsWith("/individuals")) {
      return HttpResponse.json([directUser]);
    }
    assert.ok(path.endsWith("/groups"));
    return HttpResponse.json([group]);
  }));
  assert.deepEqual(await listUserBundleMembers(connection, bundleID), [directUser, inheritedUser]);
  assert.deepEqual(await listUserBundleIndividuals(connection, bundleID), [directUser]);
  assert.deepEqual(await listUserBundleGroups(connection, bundleID), [group]);
  assert.deepEqual(seen, ["aggregatedUsers", "individuals", "groups"].map((suffix) => `/context${bundlePath}/${suffix}`));
});

test("all eight reads reject remote errors and malformed response shapes without exposing payloads", async () => {
  for (const row of rows) {
    for (const status of [401, 403, 404, 429, 500]) {
      let calls = 0;
      server.use(http.get("*", () => {
        calls++;
        return new HttpResponse("synthetic-token synthetic-private-response", { status });
      }));
      await assert.rejects(row.run(), (error: Error) => {
        assert.match(error.message, new RegExp(`HTTP ${status}`));
        assert.doesNotMatch(error.message, /synthetic-token|synthetic-private-response/);
        return true;
      });
      assert.equal(calls, 1);
    }
    for (const body of [null, "bad", row.collection ? {} : [], ...(row.collection ? [[null]] : [])]) {
      server.use(http.get("*", () => HttpResponse.json(body)));
      await assert.rejects(row.run(), /invalid .*response/);
    }
    server.use(http.get("*", () => new HttpResponse("synthetic-private-invalid-json")));
    await assert.rejects(row.run(), /^Error: YouTrack returned an invalid JSON response\.$/);
    if (row.collection) {
      server.use(http.get("*", () => HttpResponse.json([])));
      assert.deepEqual(await row.run(), []);
      server.use(http.get("*", () => HttpResponse.json([{ id: "one" }, { id: "two" }])));
      await assert.rejects(row.run({ top: 1 }), /more items than the requested top limit/);
    }
  }
});

test("explicit directory projections preserve sparse nullable data and scrub nested credentials", async () => {
  server.use(http.get("*", ({ request }) => {
    const fields = new URL(request.url).searchParams.get("fields");
    assert.equal(fields, "email,ringId,avatarUrl");
    return HttpResponse.json({ email: null, ringId: null, avatarUrl: "/files/fixture?sign=synthetic-signature" });
  }));
  assert.deepEqual(await getUser(connection, "fixture.login", { fields: "email,ringId,avatarUrl" }), {
    email: null, ringId: null, avatarUrl: "[redacted]",
  });
  server.use(http.get("*", () => HttpResponse.json({
    icon: null, ringId: null, users: [{ login: "synthetic-token" }],
  })));
  assert.deepEqual(await getUserBundleGroup(connection, bundleID, groupID, { fields: "icon,ringId,users(login)" }), {
    icon: null, ringId: null, users: [{ login: "[redacted]" }],
  });
});

test("directory inputs reject invalid IDs, projections and paging before native fetch", async () => {
  let calls = 0;
  server.use(http.get("*", () => { calls++; return HttpResponse.json({}); }));
  for (const row of rows) {
    await assert.rejects(row.run({ fields: " " }), /YouTrack fields/);
    if (row.collection) {
      for (const options of [{ top: 0 }, { top: 101 }, { top: 1.5 }, { skip: -1 }, { skip: Number.MAX_SAFE_INTEGER + 1 }]) {
        await assert.rejects(row.run(options), /YouTrack (top|skip)/);
      }
    }
  }
  for (const id of ["", " ", ".", "..", "bad\nID", "\ud800"]) {
    for (const run of [
      () => getUserBundle(connection, id),
      () => listUserBundleMembers(connection, id),
      () => listUserBundleGroups(connection, id),
      () => getUserBundleGroup(connection, id, groupID),
      () => getUserBundleGroup(connection, bundleID, id),
      () => listUserBundleIndividuals(connection, id),
      () => getUserBundleIndividual(connection, id, userID),
      () => getUserBundleIndividual(connection, bundleID, id),
      () => getUser(connection, id),
    ]) {
      await assert.rejects(run(), /YouTrack/);
    }
  }
  assert.equal(calls, 0);
});

test("all eight real CLI declarations return matching human and JSON output with Update disabled", async (t) => {
  for (const row of rows) {
    for (const json of [false, true]) {
      const f = await configuredFixture(t, { url: connection.baseUrl, token: connection.token });
      let calls = 0;
      server.use(http.get("*", ({ request }) => {
        calls++;
        const url = new URL(request.url);
        assert.equal(url.pathname, `/context${row.path}`);
        assert.equal(url.searchParams.get("fields"), row.fields);
        if (row.collection) {
          assert.equal(url.searchParams.get("$top"), "3");
          assert.equal(url.searchParams.get("$skip"), "7");
        } else {
          assert.deepEqual([...url.searchParams.keys()], ["fields"]);
        }
        return HttpResponse.json(row.result);
      }));
      const args = [...row.argv, ...(row.collection ? ["--top", "3", "--skip", "7"] : []), "--profile", "dev"];
      assert.equal(await f.cli.run([...args, ...(json ? ["--json"] : [])]), 0);
      if (json) {
        assert.deepEqual(JSON.parse(f.stdout()), row.result);
      } else {
        assert.match(f.stdout(), /Fixture/);
      }
      assert.equal(f.stderr(), "");
      assert.equal(calls, 1);
    }
  }
});

test("each directory leaf enforces its profile ReadOnly gate before fetch", async (t) => {
  const f = await configuredFixture(t, { url: connection.baseUrl, token: connection.token });
  await f.cli.execute(["permissions", "revoke", "ReadOnly", "--profile", "dev"]);
  let calls = 0;
  server.use(http.get("*", () => { calls++; return HttpResponse.json({}); }));
  for (const row of rows) {
    await assert.rejects(f.cli.execute([...row.argv, "--profile", "dev"]), /Permission 'ReadOnly' is disabled/);
  }
  assert.equal(calls, 0);
});

test("directory RPC interleaves all eight reads across isolated profiles and survives denied requests", async (t) => {
  const frames = [
    { row: rows[1]!, profile: "locked" },
    ...rows.map((row, index) => ({ row, profile: index % 2 ? "production" : "dev" })),
  ];
  const requests = frames.map(({ row, profile }, id) => JSON.stringify({
    jsonrpc: "2.0", id, method: "cli.execute", params: { argv: [...row.argv, "--profile", profile] },
  })).join("\n") + "\n";
  const f = await fixture(t, requests);
  for (const name of ["dev", "production", "locked"]) {
    await f.cli.execute(["profile", "create", name, "--url", `https://${name}.example.com/context`]);
    await f.secrets.set(service, `${name}:token`, `synthetic-${name}`);
  }
  await f.cli.execute(["permissions", "revoke", "ReadOnly", "--profile", "locked"]);
  let calls = 0;
  server.use(http.get("*", ({ request }) => {
    const row = rows[calls];
    const profile = calls++ % 2 ? "production" : "dev";
    assert.ok(row);
    const url = new URL(request.url);
    assert.equal(url.hostname, `${profile}.example.com`);
    assert.equal(url.pathname, `/context${row.path}`);
    assert.equal(request.headers.get("authorization"), `Bearer synthetic-${profile}`);
    return HttpResponse.json(row.result);
  }));
  f.paths.length = 0;
  assert.equal(await f.cli.run(["--json-rpc"]), 0);
  const replies = f.stdout().trim().split("\n").map((line) => JSON.parse(line));
  assert.equal(replies[0].error.code, -32000);
  assert.match(replies[0].error.message, /ReadOnly/);
  assert.deepEqual(replies.slice(1).map((reply) => reply.result), rows.map((row) => row.result));
  // Readiness and handler contexts follow admission; denied requests create neither.
  assert.deepEqual(f.paths, frames.filter(({ profile }) => profile !== "locked").map(({ profile }) => join(f.appArguments.RoamingAppDataDirectory, profile)).flatMap((path) => [path, path]));
  assert.equal(f.stderr(), "");
  assert.equal(calls, 8);
});

test("required directory arguments fail before fresh-profile onboarding or keyring access", async (t) => {
  for (const argv of [
    ["bundle", "user", "get"],
    ["bundle", "user", "member", "list"],
    ["bundle", "user", "group", "list"],
    ["bundle", "user", "group", "get", bundleID],
    ["bundle", "user", "individual", "list"],
    ["bundle", "user", "individual", "get", bundleID],
    ["user", "get"],
  ]) {
    const f = await fixture(t);
    Object.assign(f.runtime.input, { isTTY: true, setRawMode: () => assert.fail("Unexpected token prompt") });
    Object.assign(f.runtime.error, { isTTY: true });
    f.secrets.get = async () => { assert.fail("Missing argument reached keyring"); };
    assert.equal(await f.cli.run(argv), 1);
    assert.equal(f.stdout(), "");
    assert.match(f.stderr(), /missing required argument/);
    assert.doesNotMatch(f.stderr(), /Token:|YouTrack server URL including/);
  }
});
