import { pageResult } from "./page-result.js";
import assert from "node:assert/strict";
import test from "node:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { configuredFixture, fixture } from "./cli-fixture.js";

const server = setupServer();
test.before(() => server.listen({ onUnhandledRequest: "error" }));
test.afterEach(() => server.resetHandlers());
test.after(() => server.close());

test("YouTrack paging preserves defaults, leading zeros and inclusive bounds at native fetch", async t => {
  const f = await configuredFixture(t, { url: "https://youtrack.example.com" });
  const pages = [["50", "0"], ["1", "0"], ["1000", "9007199254739991"]];
  let calls = 0;
  server.use(http.get("https://youtrack.example.com/api/admin/projects", ({ request }) => {
    const [pageSize, start] = pages[calls++] ?? [];
    assert.deepEqual(Object.fromEntries(new URL(request.url).searchParams), {
      fields: "id,name,shortName", $top: pageSize, $skip: start,
    });
    return HttpResponse.json([]);
  }));
  for (const options of [[], ["--page-size", "001", "--start", "000"], ["--page-size", "1000", "--start", "9007199254739991"]]) {
    assert.deepEqual(await f.cli.execute(["project", "list", ...options, "--profile", "dev"]), pageResult([]));
  }
  assert.equal(calls, 3);
});

test("YouTrack invalid paging fails before TTY onboarding and auth on CLI, execute and RPC", async t => {
  const f = await fixture(t);
  Object.assign(f.runtime.input, { isTTY: true, setRawMode: () => assert.fail("Unexpected prompt") });
  Object.assign(f.runtime.output, { isTTY: true });
  Object.assign(f.runtime.error, { isTTY: true });
  f.secrets.get = async () => assert.fail("Invalid paging reached credentials");
  let calls = 0;
  server.use(http.all("*", () => { calls++; return HttpResponse.json([]); }));
  const cases = [
    ...["-1", "9007199254740992", "-0", "+1", "1.0", "1e2", "0x10", " 1", "1\n", "synthetic-secret\u0000value"].map(value => ({
      argv: ["project", "list", "--page-size", value],
      message: "--page-size must be a nonnegative safe decimal integer.",
    })),
    ...["-0", "-1", "9007199254740992"].map(value => ({
      argv: ["project", "list", "--start", value],
      message: "--start must be a nonnegative integer.",
    })),
    { argv: ["issues", "create", "--body", '{"synthetic-secret":"unterminated'],
      message: "The body must be valid JSON." },
  ];
  for (const { argv, message } of cases) {
    await assert.rejects(f.cli.execute(argv), { message });
    for (const suffix of [[], ["--json"]]) {
      f.resetOutput();
      assert.equal(await f.cli.run([...argv, ...suffix]), 1);
      assert.equal(f.stdout(), "");
      // JSON mode reports Core's machine error; a rejected option value is invalid usage.
      assert.partialDeepStrictEqual(
        suffix.length ? JSON.parse(f.stderr()) : f.stderr().trim(),
        suffix.length ? { error: { code: "usage", message, exitCode: 1 } } : message,
      );
    }
  }
  assert.partialDeepStrictEqual(await f.rpc(f.cli, cases.map(row => row.argv)), cases.map(({ message }, id) => ({
    jsonrpc: "2.0", id, error: { code: -32000, message, data: { code: "usage", exitCode: 1 } },
  })));
  assert.equal(calls, 0);
});
