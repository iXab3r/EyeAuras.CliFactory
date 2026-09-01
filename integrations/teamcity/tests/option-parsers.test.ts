import assert from "node:assert/strict";
import test from "node:test";
import { Permission } from "@eyeauras/cli-factory";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createTestRuntime } from "./support.js";

const server = setupServer();
test.before(() => server.listen({ onUnhandledRequest: "error" }));
test.afterEach(() => server.resetHandlers());
test.after(() => server.close());

test("TeamCity paging preserves defaults, leading zeros, signed zero and safe offsets", async t => {
  const f = await createTestRuntime(t);
  const cli = f.createCli();
  const locators = [
    "archived:false,start:0,count:100", "archived:false,start:0,count:1",
    "archived:false,start:9007199254740991,count:100", "archived:false,start:3,count:1",
  ];
  let calls = 0;
  server.use(http.get("https://teamcity.test/app/rest/projects", ({ request }) => {
    assert.equal(new URL(request.url).searchParams.get("locator"), locators[calls++]);
    return HttpResponse.json({ project: [] });
  }));
  for (const options of [
    [], ["--limit", "001", "--start", "-0"],
    ["--limit", "100", "--start", "9007199254740991"], ["--limit", "1", "--start", "0003"],
  ]) assert.deepEqual(await cli.execute(["projects", "list", ...options]), []);
  assert.equal(calls, 4);
});

test("TeamCity invalid paging and JSON reject before TTY onboarding, credentials or HTTP", async t => {
  const f = await createTestRuntime(t, { profiles: [{ name: "default" }], tokens: {} });
  Object.assign(f.runtime.input, { isTTY: true, setRawMode: () => assert.fail("Unexpected prompt") });
  Object.assign(f.runtime.output, { isTTY: true });
  Object.assign(f.runtime.error, { isTTY: true });
  f.secretStore.get = async () => assert.fail("Invalid input reached credentials");
  let calls = 0;
  server.use(http.all("*", () => { calls++; return HttpResponse.json({}); }));
  const cli = f.createCli();
  const cases = [
    ...["0", "101", "1e2", "synthetic-secret\u0000value"].map(value => ({
      argv: ["projects", "list", "--limit", value],
      message: "TeamCity page limit must be an integer between 1 and 100.",
    })),
    ...["-1", "9007199254740992", " 1"].map(value => ({
      argv: ["projects", "list", "--start", value],
      message: "Expected a non-negative integer within the safe integer range.",
    })),
    { argv: ["jobs", "steps", "replace-all", "Fixture_Job", "--item", "synthetic-secret{"],
      message: "Expected valid typed JSON; input is not echoed." },
  ];
  for (const { argv, message } of cases) {
    await assert.rejects(cli.execute(argv), { message });
    for (const suffix of [[], ["--json"]]) {
      f.resetOutput();
      assert.equal(await cli.run([...argv, ...suffix]), 1);
      assert.equal(f.stdout(), "");
      assert.equal(f.stderr().trim(), message);
    }
  }
  assert.deepEqual(await f.rpc(cli, cases.map(row => row.argv)), cases.map(({ message }, id) => ({
    jsonrpc: "2.0", id, error: { code: -32000, message },
  })));
  assert.equal(calls, 0);
});

test("TeamCity repeated JSON remains ordered and numeric IDs retain strict validation", async t => {
  const f = await createTestRuntime(t);
  const cli = f.createCli();
  await f.profileStore.setPermissions("default", [Permission.ReadOnly, Permission.Update]);
  let puts = 0, gets = 0;
  server.use(
    http.put("https://teamcity.test/app/rest/buildTypes/id:Fixture_Job/steps", async ({ request }) => {
      puts++;
      assert.deepEqual(await request.json(), { step: [
        { name: "First", type: "simpleRunner", properties: { property: [] } },
        { name: "Second", type: "simpleRunner", properties: { property: [] } },
      ] });
      return HttpResponse.json({ step: [] });
    }),
    http.get("https://teamcity.test/app/rest/builds/id:7", () => { gets++; return HttpResponse.json({ id: 7 }); }),
  );
  assert.deepEqual(await cli.execute([
    "jobs", "steps", "replace-all", "Fixture_Job",
    "--item", '{"name":"First","type":"simpleRunner"}',
    "--item", '{"name":"Second","type":"simpleRunner"}',
  ]), []);
  assert.deepEqual(await cli.execute(["builds", "show", "0007"]), { id: 7 });
  for (const id of ["0", "-0", "+7", "7e0", " 7", "9007199254740992"]) {
    await assert.rejects(cli.execute(["builds", "show", id]), {
      message: "Expected a positive integer within the safe integer range.",
    });
  }
  assert.equal(puts, 1);
  assert.equal(gets, 1);
});
