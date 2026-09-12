import assert from "node:assert/strict";
import { after, afterEach, before, test } from "node:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { configuredFixture } from "./cli-fixture.js";

const server = setupServer();
before(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
after(() => server.close());

test("long descriptions, comments and articles reach HTTP unchanged through execute, CLI and RPC", async t => {
  const f = await configuredFixture(t, { permissions: ["ReadOnly", "Update"] });
  const content = 'Описание задачи\n\n```json\n{"key":"value"}\n```\n'.repeat(1000);
  assert.ok(Buffer.byteLength(content) > 32768);
  const cases = [
    { argv: ["issues", "update", "DEMO-1"], path: "/issues/DEMO-1", body: { description: content } },
    { argv: ["issues", "comments", "add", "DEMO-1"], path: "/issues/DEMO-1/comments", body: { text: content } },
    { argv: ["article", "update", "DEMO-A-1"], path: "/articles/DEMO-A-1", body: { content } },
  ];
  for (const row of cases) {
    let calls = 0;
    server.use(http.post("https://youtrack.example.com/context/api" + row.path, async ({ request }) => {
      calls++;
      assert.deepEqual(await request.json(), row.body);
      return HttpResponse.json({ id: "fixture-id" });
    }));
    const argv = [...row.argv, "--body", JSON.stringify(row.body)];
    assert.deepEqual(await f.cli.execute(argv), { id: "fixture-id" });
    assert.deepEqual(await f.json(f.cli, argv), { id: "fixture-id" });
    const replies = await f.rpc(f.cli, [argv, argv]);
    assert.deepEqual(replies.map(reply => (reply as { result: unknown }).result), [{ id: "fixture-id" }, { id: "fixture-id" }]);
    assert.equal(calls, 4);
    server.resetHandlers();
  }
});

test("long content still cannot bypass Update permission", async t => {
  const f = await configuredFixture(t);
  let calls = 0;
  server.use(http.post("*", () => { calls++; return HttpResponse.json({ id: "fixture-id" }); }));
  const argv = ["issues", "update", "DEMO-1", "--body", JSON.stringify({ description: "я".repeat(20_000) })];
  await assert.rejects(f.cli.execute(argv), /Update/);
  const replies = await f.rpc(f.cli, [argv]);
  assert.ok((replies[0] as { error?: unknown }).error);
  assert.equal(calls, 0);
});
