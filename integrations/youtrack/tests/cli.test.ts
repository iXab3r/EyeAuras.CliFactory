import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { after, afterEach, before, test } from "node:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { configuredFixture, fixture } from "./cli-fixture.js";

const server = setupServer();
before(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
after(() => server.close());
const service = "ai-cli-factory:youtrack-cli";
const identity = { id: "1-1", login: "fixture-user" };

test("fresh configure validates before keyring storage and keeps config non-secret", async (t) => {
  const f = await fixture(t, "synthetic-candidate\n");
  server.use(http.get("https://youtrack.example.com/track/api/users/me", async ({ request }) => {
    assert.equal(await f.secrets.get(service, "dev:token"), undefined);
    assert.equal(request.headers.get("authorization"), "Bearer synthetic-candidate");
    assert.equal(new URL(request.url).searchParams.get("fields"), "id,login");
    return HttpResponse.json(identity);
  }));
  assert.equal(await f.cli.run(["profile", "configure", "dev", "--url", "https://youtrack.example.com/track", "--token-stdin", "--json"]), 0);
  assert.equal(await f.secrets.get(service, "dev:token"), "synthetic-candidate");
  assert.deepEqual(JSON.parse(f.stdout()).identity, identity);
  assert.ok(!f.stdout().includes("synthetic-candidate"));
  const config = await readFile(join(f.appArguments.RoamingAppDataDirectory, "profiles.json"), "utf8");
  assert.ok(!config.includes("synthetic-candidate"));
  assert.ok(f.paths.includes(join(f.appArguments.RoamingAppDataDirectory, "dev")));
});

test("rejected candidates do not replace credentials and errors reveal no server payload", async (t) => {
  const f = await fixture(t, "synthetic-rejected\n");
  await f.cli.execute(["profile", "create", "dev", "--url", "https://youtrack.example.com"]);
  await f.secrets.set(service, "dev:token", "synthetic-existing");
  server.use(http.get("*/api/users/me", () => new HttpResponse("synthetic-rejected private-data", { status: 401 })));
  assert.equal(await f.cli.run(["auth", "login", "--profile", "dev", "--token-stdin", "--json"]), 1);
  assert.equal(await f.secrets.get(service, "dev:token"), "synthetic-existing");
  assert.equal(f.stdout(), "");
  assert.match(f.stderr(), /HTTP 401/);
  assert.doesNotMatch(f.stderr(), /synthetic-|private-data/);
});

test("invalid configuration is rejected before reading or writing keyring", async (t) => {
  const f = await fixture(t, "synthetic-candidate\n");
  f.secrets.get = async () => { assert.fail("Invalid URL reached keyring"); };
  f.secrets.set = async () => { assert.fail("Invalid URL reached keyring"); };
  assert.equal(await f.cli.run(["profile", "configure", "dev", "--url", "http://youtrack.example.com", "--token-stdin"]), 1);
  assert.match(f.stderr(), /YouTrack URL must/);
});

test("noninteractive unconfigured identity fails actionably before network", async (t) => {
  const f = await fixture(t);
  assert.equal(await f.cli.run(["user", "me", "--json"]), 1);
  assert.equal(f.stdout(), "");
  assert.match(f.stderr(), /youtrack-cli profile configure default --url <url>/);
  await assert.rejects(f.cli.execute(["user", "me"]), /profile configure/);
});

test("profile credentials, URLs, permissions and logout remain isolated", async (t) => {
  const f = await fixture(t);
  for (const name of ["dev", "production"]) {
    await f.cli.execute(["profile", "create", name, "--url", `https://${name}.example.com/track`]);
    await f.secrets.set(service, `${name}:token`, `synthetic-${name}`);
  }
  let calls = 0;
  server.use(http.get("*/api/users/me", ({ request }) => {
    calls++;
    const name = new URL(request.url).hostname.split(".")[0];
    assert.equal(request.headers.get("authorization"), `Bearer synthetic-${name}`);
    return HttpResponse.json({ id: `fixture-${name}`, login: `user-${name}` });
  }));
  await f.cli.execute(["permissions", "grant", "Update", "--profile", "dev"]);
  const productionPermissions = await f.cli.execute(["permissions", "list", "--profile", "production"]);
  assert.ok(Array.isArray(productionPermissions));
  assert.equal(productionPermissions.find((p) => p.name === "Update")?.enabled, false);
  for (const name of ["dev", "production"])
    assert.deepEqual(await f.cli.execute(["user", "me", "--profile", name]), { id: `fixture-${name}`, login: `user-${name}` });
  assert.equal(calls, 2);
  await f.cli.execute(["permissions", "revoke", "ReadOnly", "--profile", "dev"]);
  await assert.rejects(f.cli.execute(["user", "me", "--profile", "dev"]), /Permission 'ReadOnly' is disabled/);
  assert.equal(calls, 2);
  await f.cli.execute(["auth", "logout", "--profile", "dev"]);
  assert.equal(await f.secrets.get(service, "dev:token"), undefined);
  assert.equal(await f.secrets.get(service, "production:token"), "synthetic-production");
});

test("persistent RPC uses the actual declaration with profile-specific identity and AppData", async (t) => {
  const requests = ["dev", "production", "dev"].map((name, id) => JSON.stringify({
    jsonrpc: "2.0", id, method: "cli.execute", params: { argv: ["user", "me", "--profile", name] },
  })).join("\n") + "\n";
  const f = await fixture(t, requests);
  for (const name of ["dev", "production"]) {
    await f.cli.execute(["profile", "create", name, "--url", `https://${name}.example.com`]);
    await f.secrets.set(service, `${name}:token`, `synthetic-${name}`);
  }
  server.use(http.get("*/api/users/me", ({ request }) => {
    const name = new URL(request.url).hostname.split(".")[0];
    assert.equal(request.headers.get("authorization"), `Bearer synthetic-${name}`);
    return HttpResponse.json({ id: `fixture-${name}`, login: `user-${name}` });
  }));
  f.paths.length = 0;
  assert.equal(await f.cli.run(["--json-rpc"]), 0);
  const replies = f.stdout().trim().split("\n").map((line) => JSON.parse(line));
  assert.deepEqual(replies.map((reply) => reply.result.login), ["user-dev", "user-production", "user-dev"]);
  // Readiness and handler contexts follow admission; denied requests create neither.
  assert.deepEqual(f.paths, ["dev", "production", "dev"].map((name) => join(f.appArguments.RoamingAppDataDirectory, name)).flatMap((path) => [path, path]));
  assert.equal(f.stderr(), "");
});


test("keyring write failure never falls back to files or exposes the candidate", async (t) => {
  const f = await fixture(t, "synthetic-candidate\n");
  server.use(http.get("*/api/users/me", () => HttpResponse.json(identity)));
  f.secrets.set = async () => { throw new Error("OS credential store unavailable."); };
  assert.equal(await f.cli.run(["profile", "configure", "dev", "--url", "https://youtrack.example.com", "--token-stdin", "--json"]), 1);
  assert.equal(await f.secrets.get(service, "dev:token"), undefined);
  assert.equal(f.stdout(), "");
  assert.match(f.stderr(), /Could not save profile configuration or authentication/);
  assert.doesNotMatch(f.stderr(), /synthetic-candidate/);
  const config = await readFile(join(f.appArguments.RoamingAppDataDirectory, "profiles.json"), "utf8");
  assert.ok(!config.includes("synthetic-candidate"));
});

test("unavailable keyring stops a service command before the HTTP boundary", async (t) => {
  const f = await fixture(t);
  await f.cli.execute(["profile", "create", "dev", "--url", "https://youtrack.example.com"]);
  f.secrets.get = async () => { throw new Error("OS credential store unavailable."); };
  assert.equal(await f.cli.run(["user", "me", "--profile", "dev", "--json"]), 1);
  assert.equal(f.stdout(), "");
  assert.match(f.stderr(), /OS credential store unavailable/);
});

test("human and JSON identity commands render the same minimal domain value", async (t) => {
  server.use(http.get("*/api/users/me", () => HttpResponse.json(identity)));
  for (const json of [false, true]) {
    const f = await configuredFixture(t, { url: "https://youtrack.example.com" });
    assert.equal(await f.cli.run(["user", "me", "--profile", "dev", ...(json ? ["--json"] : [])]), 0);
    if (json) assert.deepEqual(JSON.parse(f.stdout()), identity);
    else {
      assert.match(f.stdout(), /1-1/);
      assert.match(f.stdout(), /fixture-user/);
    }
    assert.equal(f.stderr(), "");
  }
});

const readCommands = [
  { argv: ["project", "list", "--fields", "id", "--top", "3", "--skip", "2"], path: "/api/admin/projects", array: true, query: { $top: "3", $skip: "2" } },
  { argv: ["issues", "list", "--fields", "id", "--query", "project: DEMO"], path: "/api/issues", array: true, query: { $top: "50", $skip: "0", query: "project: DEMO" } },
  { argv: ["issues", "get", "DEMO-1", "--fields", "id"], path: "/api/issues/DEMO-1", array: false, query: {} },
  { argv: ["issues", "comments", "list", "DEMO-1", "--fields", "id"], path: "/api/issues/DEMO-1/comments", array: true, query: { $top: "50", $skip: "0" } },
  { argv: ["user", "me", "--fields", "id"], path: "/api/users/me", array: false, query: {} },
];

test("every read declaration renders the actual HTTP result as human and JSON output", async (t) => {
  for (const row of readCommands) {
    const result = row.array ? [{ id: "fixture-id" }] : { id: "fixture-id" };
    for (const json of [false, true]) {
      const f = await configuredFixture(t);
      let calls = 0;
      server.use(http.get("*", ({ request }) => {
        calls++;
        const url = new URL(request.url);
        assert.equal(url.pathname, `/context${row.path}`);
        assert.equal(url.searchParams.get("fields"), "id");
        assert.deepEqual(Object.fromEntries(url.searchParams), { fields: "id", ...row.query });
        assert.equal(request.headers.get("authorization"), "Bearer synthetic-token");
        return HttpResponse.json(result);
      }));
      assert.equal(await f.cli.run([...row.argv, "--profile", "dev", ...(json ? ["--json"] : [])]), 0);
      if (json) assert.deepEqual(JSON.parse(f.stdout()), result);
      else assert.match(f.stdout(), /fixture-id/);
      assert.equal(f.stderr(), "");
      assert.equal(calls, 1);
    }
  }
});

test("every read leaf is denied before HTTP when its profile revokes ReadOnly", async (t) => {
  const f = await configuredFixture(t, { url: "https://youtrack.example.com" });
  await f.cli.execute(["permissions", "revoke", "ReadOnly", "--profile", "dev"]);
  let calls = 0;
  server.use(http.get("*", () => { calls++; return HttpResponse.json({}); }));
  for (const row of readCommands)
    await assert.rejects(f.cli.execute([...row.argv, "--profile", "dev"]), /Permission 'ReadOnly' is disabled/);
  assert.equal(calls, 0);
});

test("new read input validation runs before HTTP through the real declaration", async (t) => {
  const f = await configuredFixture(t, { url: "https://youtrack.example.com" });
  let calls = 0;
  server.use(http.get("*", () => { calls++; return HttpResponse.json({}); }));
  for (const argv of [
    ["project", "list", "--top", "0"], ["issues", "list", "--skip", "-1"],
    ["issues", "list", "--skip", ""], ["issues", "get", "."],
    ["issues", "comments", "list", ".."], ["user", "me", "--fields", " "],
  ]) await assert.rejects(f.cli.execute([...argv, "--profile", "dev"]), /YouTrack/);
  assert.equal(calls, 0);
});

test("all read leaves share profile-isolated URLs, credentials and AppData in persistent RPC", async (t) => {
  const selectedProfiles = ["dev", "production", "dev", "production", "dev"];
  const requests = readCommands.map((row, id) => JSON.stringify({
    jsonrpc: "2.0", id, method: "cli.execute",
    params: { argv: [...row.argv, "--profile", selectedProfiles[id]] },
  })).join("\n") + "\n";
  const f = await fixture(t, requests);
  for (const name of ["dev", "production"]) {
    await f.cli.execute(["profile", "create", name, "--url", `https://${name}.example.com/context`]);
    await f.secrets.set(service, `${name}:token`, `synthetic-${name}`);
  }
  let calls = 0;
  server.use(http.get("*", ({ request }) => {
    const row = readCommands[calls];
    const name = selectedProfiles[calls++];
    assert.ok(row);
    assert.equal(new URL(request.url).hostname, `${name}.example.com`);
    assert.equal(new URL(request.url).pathname, `/context${row.path}`);
    assert.equal(request.headers.get("authorization"), `Bearer synthetic-${name}`);
    return HttpResponse.json(row.array ? [{ id: "fixture-id" }] : { id: "fixture-id" });
  }));
  f.paths.length = 0;
  assert.equal(await f.cli.run(["--json-rpc"]), 0);
  const replies = f.stdout().trim().split("\n").map((line) => JSON.parse(line));
  assert.deepEqual(replies.map((reply) => reply.result), readCommands.map((row) => row.array ? [{ id: "fixture-id" }] : { id: "fixture-id" }));
  // Readiness and handler contexts follow admission; denied requests create neither.
  assert.deepEqual(f.paths, selectedProfiles.map((name) => join(f.appArguments.RoamingAppDataDirectory, name)).flatMap((path) => [path, path]));
  assert.equal(calls, readCommands.length);
  assert.equal(f.stderr(), "");
});

test("read errors keep existing CLI/RPC envelopes and explicit user fields cannot change auth projection", async (t) => {
  const f = await configuredFixture(t, { url: "https://youtrack.example.com" });
  server.use(http.get("*/api/users/me", ({ request }) => {
    const fields = new URL(request.url).searchParams.get("fields");
    return HttpResponse.json(fields === "email" ? { email: null } : identity);
  }));
  assert.deepEqual(await f.cli.execute(["user", "me", "--fields", "email", "--profile", "dev"]), { email: null });
  const auth = await f.cli.execute(["auth", "status", "--profile", "dev"]);
  assert.deepEqual(auth, { authenticated: true, profile: "dev", identity });
  server.use(http.get("*/api/issues", () => new HttpResponse("synthetic-private", { status: 403 })));
  assert.equal(await f.cli.run(["issues", "list", "--profile", "dev", "--json"]), 1);
  assert.equal(f.stdout(), "");
  assert.match(f.stderr(), /HTTP 403/);
  assert.doesNotMatch(f.stderr(), /synthetic-private/);
});

test("RPC read errors use the existing -32000 envelope without remote diagnostics", async (t) => {
  const request = JSON.stringify({
    jsonrpc: "2.0", id: 1, method: "cli.execute",
    params: { argv: ["issues", "list", "--profile", "dev"] },
  });
  const f = await configuredFixture(t, {
    url: "https://youtrack.example.com",
    input: request + "\n",
  });
  server.use(http.get("*/api/issues", () => new HttpResponse("synthetic-private", { status: 403 })));
  assert.equal(await f.cli.run(["--json-rpc"]), 0);
  const reply = JSON.parse(f.stdout());
  assert.equal(reply.error.code, -32000);
  assert.match(reply.error.message, /HTTP 403/);
  assert.doesNotMatch(f.stdout(), /synthetic-private/);
  assert.equal(f.stderr(), "");
});

const mutationCommands = [
  { argv: ["issues", "create"], body: { project: { id: "fixture-project" }, summary: "Summary" }, path: "/api/issues" },
  { argv: ["issues", "update", "DEMO-1"], body: { description: null }, path: "/api/issues/DEMO-1" },
  { argv: ["issues", "comments", "add", "DEMO-1"], body: { text: "First line\n\nSecond line" }, path: "/api/issues/DEMO-1/comments" },
];

test("all mutation leaves deny Update before HTTP while malformed JSON fails during parsing", async (t) => {
  const f = await configuredFixture(t, { url: "https://youtrack.example.com" });
  let calls = 0;
  server.use(http.post("*", () => { calls++; return HttpResponse.json({}); }));
  for (const row of mutationCommands) {
    await assert.rejects(
      f.cli.execute([...row.argv, "--body", JSON.stringify(row.body), "--profile", "dev"]),
      /Permission 'Update' is disabled/,
    );
    await assert.rejects(
      f.cli.execute([...row.argv, "--body", "synthetic-invalid-json", "--profile", "dev"]),
      /body must be valid JSON/,
    );
  }
  assert.equal(calls, 0);
});

test("allowed mutations bind exact bodies and return human/JSON through their real declarations", async (t) => {
  for (const row of mutationCommands) {
    for (const json of [false, true]) {
      const f = await configuredFixture(t, { permissions: ["ReadOnly", "Update"] });
      let calls = 0;
      server.use(http.post("*", async ({ request }) => {
        calls++;
        const url = new URL(request.url);
        assert.equal(url.pathname, `/context${row.path}`);
        assert.equal(url.searchParams.get("fields"), row.path.endsWith("comments")
          ? "id,text,author(id,login),created,updated" : "id,idReadable,summary,updated");
        assert.equal(request.headers.get("authorization"), "Bearer synthetic-token");
        assert.deepEqual(await request.json(), row.body);
        return HttpResponse.json({ id: "fixture-id" });
      }));
      assert.equal(await f.cli.run([...row.argv, "--body", JSON.stringify(row.body), "--profile", "dev", ...(json ? ["--json"] : [])]), 0);
      if (json) assert.deepEqual(JSON.parse(f.stdout()), { id: "fixture-id" });
      else assert.match(f.stdout(), /fixture-id/);
      assert.equal(calls, 1);
      assert.equal(f.stderr(), "");
    }
  }
});

test("mutation body syntax and unsupported fields fail locally without echoing input", async (t) => {
  const f = await configuredFixture(t, {
    url: "https://youtrack.example.com",
    permissions: ["ReadOnly", "Update"],
  });
  let calls = 0;
  server.use(http.post("*", () => { calls++; return HttpResponse.json({}); }));
  for (const row of mutationCommands) {
    await assert.rejects(f.cli.execute([...row.argv, "--profile", "dev"]), /required option/);
    assert.equal(await f.cli.run([...row.argv, "--profile", "dev", "--json", "--body", '{"synthetic-private-key":"synthetic-private-value"']), 1);
    assert.equal(await f.cli.run([...row.argv, "--profile", "dev", "--json", "--body", '{"synthetic-private-key":"synthetic-private-value"}']), 1);
  }
  assert.equal(calls, 0);
  assert.equal(f.stdout(), "");
  assert.match(f.stderr(), /body must be valid JSON/);
  assert.match(f.stderr(), /supports only these body fields/);
  assert.doesNotMatch(f.stderr(), /synthetic-private/);
});

test("mutation RPC preserves per-profile Update gates, URLs, credentials, AppData and null success", async (t) => {
  const frames = [
    { row: mutationCommands[0]!, profile: "dev" },
    { row: mutationCommands[1]!, profile: "production" },
    { row: mutationCommands[2]!, profile: "dev" },
    { row: mutationCommands[1]!, profile: "dev" },
  ];
  const requests = frames.map(({ row, profile }, id) => JSON.stringify({
    jsonrpc: "2.0", id, method: "cli.execute",
    params: { argv: [...row.argv, "--body", JSON.stringify(row.body), "--profile", profile] },
  })).join("\n") + "\n";
  const f = await fixture(t, requests);
  for (const name of ["dev", "production"]) {
    await f.cli.execute(["profile", "create", name, "--url", `https://${name}.example.com/context`]);
    await f.secrets.set(service, `${name}:token`, `synthetic-${name}`);
  }
  await f.cli.execute(["permissions", "grant", "Update", "--profile", "dev"]);
  let calls = 0;
  server.use(http.post("*", async ({ request }) => {
    const row = [mutationCommands[0], mutationCommands[2], mutationCommands[1]][calls++];
    assert.ok(row);
    assert.equal(new URL(request.url).hostname, "dev.example.com");
    assert.equal(new URL(request.url).pathname, `/context${row.path}`);
    assert.equal(request.headers.get("authorization"), "Bearer synthetic-dev");
    assert.deepEqual(await request.json(), row.body);
    return new HttpResponse(null, { status: 204 });
  }));
  f.paths.length = 0;
  assert.equal(await f.cli.run(["--json-rpc"]), 0);
  const replies = f.stdout().trim().split("\n").map((line) => JSON.parse(line));
  assert.equal(replies[0].result, null);
  assert.equal(replies[1].error.code, -32000);
  assert.match(replies[1].error.message, /Permission 'Update' is disabled/);
  assert.equal(replies[2].result, null);
  assert.equal(replies[3].result, null);
  assert.equal(calls, 3);
  // Readiness and handler contexts follow admission; denied requests create neither.
  assert.deepEqual(f.paths, frames.filter(({ profile }) => profile === "dev").map(({ profile }) => join(f.appArguments.RoamingAppDataDirectory, profile)).flatMap((path) => [path, path]));
  assert.equal(f.stderr(), "");
});

test("all mutation bodies fail before fresh-profile TTY onboarding across CLI and RPC modes", async (t) => {
  for (const row of mutationCommands) {
    for (const body of [undefined, '{"synthetic-private":"unterminated']) {
      for (const mode of ["tty", "json", "execute", "rpc"] as const) {
        const argv = [...row.argv, ...(body === undefined ? [] : ["--body", body])];
        const request = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "cli.execute", params: { argv } });
        const f = await fixture(t, mode === "rpc" ? request + "\n" : "https://example.com\n");
        Object.assign(f.runtime.input, { isTTY: true, setRawMode: () => assert.fail("Unexpected token prompt") });
        Object.assign(f.runtime.error, { isTTY: true });
        f.secrets.get = async () => { assert.fail("Invalid body reached keyring"); };
        if (mode === "execute") {
          await assert.rejects(f.cli.execute(argv), /required option|body must be valid JSON/);
        } else if (mode === "rpc") {
          assert.equal(await f.cli.run(["--json-rpc"]), 0);
          const reply = JSON.parse(f.stdout());
          assert.equal(reply.error.code, -32000);
          assert.match(reply.error.message, /required option|body must be valid JSON/);
        } else {
          assert.equal(await f.cli.run([...argv, ...(mode === "json" ? ["--json"] : [])]), 1);
          assert.equal(f.stdout(), "");
          assert.match(f.stderr(), /required option|body must be valid JSON/);
        }
        assert.doesNotMatch(f.stdout() + f.stderr(), /synthetic-private|Token:|YouTrack server URL including/);
      }
    }
  }
});

test("RPC continues after missing required body and malformed JSON before a valid mutation", async (t) => {
  const requests = [
    ["issues", "update", "DEMO-1", "--profile", "dev"],
    ["issues", "update", "DEMO-1", "--body", "synthetic-private-json", "--profile", "dev"],
    ["issues", "update", "DEMO-1", "--body", '{"description":null}', "--profile", "dev"],
  ].map((argv, id) => JSON.stringify({ jsonrpc: "2.0", id, method: "cli.execute", params: { argv } })).join("\n") + "\n";
  const f = await configuredFixture(t, {
    url: "https://youtrack.example.com",
    permissions: ["ReadOnly", "Update"],
    input: requests,
  });
  let calls = 0;
  server.use(http.post("*/api/issues/DEMO-1", async ({ request }) => {
    calls++;
    assert.deepEqual(await request.json(), { description: null });
    return HttpResponse.json({ id: "fixture-id" });
  }));
  assert.equal(await f.cli.run(["--json-rpc"]), 0);
  const replies = f.stdout().trim().split("\n").map((line) => JSON.parse(line));
  assert.deepEqual(replies.map((reply) => reply.id), [0, 1, 2]);
  assert.equal(replies[0].error.code, -32000);
  assert.match(replies[0].error.message, /required option/);
  assert.equal(replies[1].error.code, -32000);
  assert.match(replies[1].error.message, /body must be valid JSON/);
  assert.deepEqual(replies[2].result, { id: "fixture-id" });
  assert.doesNotMatch(f.stdout(), /synthetic-private-json/);
  assert.equal(f.stderr(), "");
  assert.equal(calls, 1);
});

test("projected credential keys and encoded tokens never reach human, JSON or RPC output", async (t) => {
  const argv = ["issues", "get", "DEMO-1", "--fields", "attachments", "--profile", "dev"];
  const expected = { attachments: [{ "[redacted]": "[redacted]" }], safe: "fixture-value" };
  let calls = 0;
  server.use(http.get("https://youtrack.example.com/api/issues/DEMO-1", ({ request }) => {
    calls++;
    assert.equal(new URL(request.url).searchParams.get("fields"), "attachments");
    assert.equal(request.headers.get("authorization"), "Bearer synthetic-token");
    return HttpResponse.json({
      attachments: [{
        "/track/api/files/fixture/sign=synthetic-signature":
          "https://example.com/file?download=synthetic%2Dtoken",
      }],
      safe: "fixture-value",
    });
  }));
  for (const mode of ["human", "json", "rpc"]) {
    const input = mode === "rpc" ? JSON.stringify({
      jsonrpc: "2.0", id: 1, method: "cli.execute", params: { argv },
    }) + "\n" : "";
    const f = await configuredFixture(t, { url: "https://youtrack.example.com", input });
    assert.equal(await f.cli.run(mode === "rpc" ? ["--json-rpc"] : [...argv, ...(mode === "json" ? ["--json"] : [])]), 0);
    assert.doesNotMatch(f.stdout(), /synthetic|sign=|download=/);
    assert.equal(f.stderr(), "");
    if (mode === "human") {
      assert.match(f.stdout(), /redacted/);
      assert.match(f.stdout(), /fixture-value/);
    } else {
      const result = JSON.parse(f.stdout());
      assert.deepEqual(mode === "rpc" ? result.result : result, expected);
    }
  }
  assert.equal(calls, 3);
});

test("default identity and auth status reject sensitive fields in human, JSON and RPC output", async (t) => {
  const message = "YouTrack returned an invalid identity response.";
  for (const command of [["user", "me"], ["auth", "status"]]) {
    for (const mode of ["human", "json", "rpc"]) {
      const argv = [...command, "--profile", "dev"];
      const input = mode === "rpc" ? JSON.stringify({
        jsonrpc: "2.0", id: 1, method: "cli.execute", params: { argv },
      }) + "\n" : "";
      const f = await configuredFixture(t, { url: "https://youtrack.example.com", input });
      let calls = 0;
      server.use(http.get("*/api/users/me", ({ request }) => {
        calls++;
        assert.equal(new URL(request.url).searchParams.get("fields"), "id,login");
        return HttpResponse.json(command[0] === "user" ? {
          id: "1-1", login: "https://youtrack.example.com/file?download=synthetic%2Dtoken",
        } : {
          id: "/track/api/files/fixture/sign=synthetic-signature", login: "fixture-user",
        });
      }));
      const exit = await f.cli.run(mode === "rpc" ? ["--json-rpc"] : [...argv, ...(mode === "json" ? ["--json"] : [])]);
      assert.equal(exit, mode === "rpc" ? 0 : 1);
      if (mode === "rpc") {
        const reply = JSON.parse(f.stdout());
        assert.equal(reply.error.code, -32000);
        assert.equal(reply.error.message, message);
        assert.equal(reply.result, undefined);
        assert.equal(f.stderr(), "");
      } else {
        assert.equal(f.stdout(), "");
        assert.match(f.stderr(), /YouTrack returned an invalid identity response\./);
      }
      assert.doesNotMatch(f.stdout() + f.stderr(), /synthetic|https:|sign=|\[redacted\]/);
      assert.equal(await f.secrets.get(service, "dev:token"), "synthetic-token");
      assert.equal(calls, 1);
    }
  }
});

test("configure and login reject sensitive identity before persisting candidate credentials", async (t) => {
  for (const action of ["configure", "login"]) {
    const f = await fixture(t, "synthetic-token\n");
    await f.cli.execute(["profile", "create", "dev", "--url", "https://old.youtrack.example.com"]);
    await f.secrets.set(service, "dev:token", "synthetic-existing");
    const path = join(f.appArguments.RoamingAppDataDirectory, "profiles.json");
    const before = await readFile(path);
    let writes = 0;
    const unexpectedWrite = async () => { writes++; throw new Error("Unexpected secret mutation"); };
    f.secrets.set = unexpectedWrite;
    f.secrets.delete = unexpectedWrite;
    let calls = 0;
    server.use(http.get("*/api/users/me", ({ request }) => {
      calls++;
      assert.equal(request.headers.get("authorization"), "Bearer synthetic-token");
      assert.equal(new URL(request.url).searchParams.get("fields"), "id,login");
      return HttpResponse.json({
        id: "1-1", login: action === "configure"
          ? "https://youtrack.example.com/file?download=synthetic%2Dtoken"
          : "/track/api/files/fixture/sign=synthetic-signature",
      });
    }));
    const argv = action === "configure"
      ? ["profile", "configure", "dev", "--url", "https://new.youtrack.example.com"]
      : ["auth", "login", "--profile", "dev"];
    assert.equal(await f.cli.run([...argv, "--token-stdin", "--json"]), 1);
    assert.equal(f.stdout(), "");
    assert.match(f.stderr(), /YouTrack returned an invalid identity response\./);
    assert.doesNotMatch(f.stderr(), /synthetic|https:|sign=|\[redacted\]/);
    assert.equal(writes, 0);
    assert.equal(calls, 1);
    assert.equal(await f.secrets.get(service, "dev:token"), "synthetic-existing");
    assert.deepEqual(await readFile(path), before);
  }
});
