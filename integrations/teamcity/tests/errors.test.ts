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

const base = "https://teamcity.test/app/rest";

test("TeamCity failures have stable machine codes on stderr and in JSON-RPC, never response bodies", async (t) => {
  server.use(
    http.get(`${base}/builds/id:404`, () => HttpResponse.text("synthetic-private-body", { status: 404 })),
    http.get(`${base}/builds/id:403`, () => HttpResponse.text("synthetic-private-body", { status: 403 })),
    http.get(`${base}/builds/id:500`, () => HttpResponse.text("synthetic-private-body", { status: 500 })),
  );
  const runtime = await createTestRuntime(t);
  const cli = runtime.createCli();
  for (const [id, code] of [["404", "http.notFound"], ["403", "http.forbidden"], ["500", "http.serverError"]]) {
    const result = await runtime.run(cli, ["builds", "show", id!, "--json"]);
    assert.equal(result.exitCode, 1);
    assert.equal(result.stdout, "", "A failed read prints nothing on stdout.");
    assert.deepEqual(JSON.parse(result.stderr), {
      error: {
        code, message: `TeamCity request failed with HTTP ${id}.`, exitCode: 1, profile: "default",
      },
    });
    const [reply] = await runtime.rpc(cli, [["builds", "show", id!]]) as Array<{
      error: { message: string; data: unknown };
    }>;
    assert.deepEqual(reply?.error.data, { code, exitCode: 1, profile: "default" });
    assert.doesNotMatch(result.stderr + JSON.stringify(reply), /synthetic-private-body/);
  }
});

test("an uncertain mutation and a denied permission say what is known and what to do next", async (t) => {
  const denied = await createTestRuntime(t);
  const refused = await denied.run(denied.createCli(), ["builds", "cancel", "101", "--json"]);
  assert.equal(refused.exitCode, 1);
  assert.deepEqual(JSON.parse(refused.stderr), {
    error: {
      code: "permission.denied",
      message: "Permission 'Update' is disabled for profile 'default'.",
      exitCode: 1,
      profile: "default",
      next: [["permissions", "grant", "Update", "--profile", "default"]],
    },
  });

  const runtime = await createTestRuntime(t, {
    profiles: [{ name: "default", url: "https://teamcity.test", permissions: [Permission.ReadOnly, Permission.Update] }],
  });
  let posts = 0;
  runtime.runtime.fetch = async () => {
    posts++;
    throw new TypeError("synthetic connection reset");
  };
  const lost = await runtime.run(runtime.createCli(), ["builds", "cancel", "101", "--json"]);
  assert.equal(lost.exitCode, 1);
  assert.deepEqual(JSON.parse(lost.stderr), {
    error: {
      code: "request.unknownOutcome",
      message: "TeamCity network request failed; remote outcome is unknown.",
      exitCode: 1,
      profile: "default",
    },
  });
  assert.equal(posts, 1, "An uncertain mutation is never repeated.");
});

test("an interrupted read reports interrupted; an interrupted write keeps its unknown outcome", async (t) => {
  const runtime = await createTestRuntime(t, {
    profiles: [{
      name: "default", url: "https://teamcity.test",
      permissions: [Permission.ReadOnly, Permission.Update],
    }],
  });
  let interrupt = new AbortController();
  let requests = 0;
  // The request hangs until the caller's Ctrl+C aborts it.
  runtime.runtime.fetch = (_input, init) => new Promise((_resolve, reject) => {
    requests++;
    init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
    interrupt.abort();
  });
  const cli = runtime.createCli();
  const read = await runtime.run(cli, ["builds", "show", "101", "--json"], { signal: interrupt.signal });
  assert.equal(read.exitCode, 130);
  assert.deepEqual(JSON.parse(read.stderr), {
    error: { code: "interrupted", message: "Interrupted.", exitCode: 130, profile: "default" },
  });

  interrupt = new AbortController();
  const write = await runtime.run(cli, ["jobs", "run", "Demo_Tests", "--json"], {
    signal: interrupt.signal,
  });
  assert.equal(write.exitCode, 130);
  assert.deepEqual(JSON.parse(write.stderr), {
    error: {
      code: "run.unknownOutcome",
      message: "The queue request's outcome is unknown; check for a new build before running it again.",
      exitCode: 130, profile: "default",
      next: [["builds", "list", "--job", "Demo_Tests", "--state", "any", "--profile", "default"]],
    },
  });
  assert.equal(requests, 2, "Neither request is repeated.");
});
