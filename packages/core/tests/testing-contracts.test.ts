import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { command, createCli, Permission } from "../src/index.js";
import { createCliFixture, assertHttpRequest, trackRequests, assertPermissionDenied, assertCliOutput, assertSafeCliFailure } from "../src/testing.js";

function verificationContext() {
  const hooks: (() => void)[] = [];
  const context = { after(callback: () => void) { hooks.push(callback); } } as Pick<TestContext, "after">;
  return { context, hooks };
}

test("HTTP expectations reject method, origin, duplicate-query, header and body drift", async () => {
  const request = () => new Request("https://fixture.example.com/items?tag=one&tag=two", {
    method: "POST", headers: { "content-type": "application/json" }, body: '{"value":false}',
  });
  const expected = {
    method: "POST", url: "https://fixture.example.com/items", query: { tag: ["one", "two"] },
    headers: { "content-type": "application/json" }, body: { json: { value: false } },
  };
  await assertHttpRequest(request(), expected);
  for (const patch of [
    { method: "GET" }, { url: "https://other.example.com/items" }, { query: { tag: ["two"] } },
    { headers: { "content-type": null } }, { body: { json: { value: true } } },
  ]) await assert.rejects(assertHttpRequest(request(), { ...expected, ...patch }), assert.AssertionError);
  await assertHttpRequest(new Request("https://fixture.example.com/name", { method: "PUT", body: "Example" }),
    { method: "PUT", url: "https://fixture.example.com/name", body: { text: "Example" } });
  await assert.rejects(assertHttpRequest(new Request("https://fixture.example.com/name", { method: "POST", body: "hidden" }),
    { method: "POST", url: "https://fixture.example.com/name" }), /HTTP text body/);
});

test("request tracking preserves the original failure for deferred verification and rejects an extra request", async () => {
  const first = verificationContext();
  const original = new assert.AssertionError({ message: "Synthetic request contract mismatch." });
  const broken = trackRequests(first.context, 1, () => { throw original; });
  assert.equal((await broken.handle(new Request("https://fixture.example.com"))).status, 500);
  assert.throws(first.hooks[0]!, error => error === original);
  const second = verificationContext();
  const extra = trackRequests(second.context, 1, () => new Response("{}"));
  assert.equal((await extra.handle(new Request("https://fixture.example.com"))).status, 200);
  assert.equal((await extra.handle(new Request("https://fixture.example.com"))).status, 500);
  assert.throws(second.hooks[0]!, /Unexpected extra HTTP request/);
  const missing = verificationContext();
  trackRequests(missing.context, 1, () => new Response("{}"));
  assert.throws(missing.hooks[0]!, /HTTP request count/);
});

test("permission assertion requires the named disabled category and no service I/O", async t => {
  const f = await createCliFixture(t, { applicationId: "contract-fixture" });
  const requests = { count: 0 };
  const app = f.createApplication(runtime => createCli({
    name: "contract-fixture", description: "Synthetic contracts", runtime, permissions: {},
    commands: [
      command("read", "Read", () => { requests.count++; return null; }, { permission: Permission.ReadOnly }),
      command("change", "Change", () => { requests.count++; return null; }, { permission: Permission.Update }),
    ],
  }));
  await assertPermissionDenied(app, ["change"], "Update", requests);
  await app.execute(["permissions", "revoke", "ReadOnly"]);
  await assertPermissionDenied(app, ["read"], "ReadOnly", requests);
  await assert.rejects(assertPermissionDenied(app, ["read"], "Update", requests), assert.AssertionError);
  assert.equal(requests.count, 0);
  await app.execute(["permissions", "grant", "Update"]);
  await assert.rejects(assertPermissionDenied(app, ["change"], "Update", requests), assert.AssertionError);
  assert.equal(requests.count, 1);
});

test("output assertion rejects the wrong domain result and uneven requests hidden by an aggregate count", async t => {
  const f = await createCliFixture(t, { applicationId: "contract-fixture" });
  const requests = { count: 0 };
  const app = f.createApplication(runtime => createCli({
    name: "contract-fixture", description: "Synthetic contracts", runtime,
    commands: [command("read", "Read", () => { requests.count++; return { id: "fixture-id" }; })],
  }));
  await assert.rejects(assertCliOutput(f, app, ["read"], { id: "wrong-id" }, /fixture-id/, requests), assert.AssertionError);
  const uneven = { count: 0 };
  const doubled = f.createApplication(runtime => createCli({
    name: "contract-fixture", description: "Synthetic contracts", runtime,
    commands: [command("read", "Read", () => { uneven.count += uneven.count === 0 ? 2 : 0; return {}; })],
  }));
  await assert.rejects(assertCliOutput(f, doubled, ["read"], {}, /./, uneven), /Human invocation must make exactly one/);
});

test("safe failure assertion rejects forbidden output rather than accepting a matching status alone", async t => {
  const f = await createCliFixture(t, { applicationId: "contract-fixture" });
  const app = f.createApplication(runtime => createCli({
    name: "contract-fixture", description: "Synthetic contracts", runtime,
    commands: [command("fail", "Fail", () => { throw new Error("Request failed: synthetic-private"); })],
  }));
  await assert.rejects(assertSafeCliFailure(f, app, ["fail", "--json"], /Request failed/, /synthetic-private/), assert.AssertionError);
});
