import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { fetchWithRedirects } from "../src/http.js";
import { machineError } from "../src/errors.js";

test("same-host HTTP-to-HTTPS and relative redirects keep token authentication", async () => {
  const seen: { url: string; auth: string | null }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    seen.push({ url: String(input), auth: new Headers(init?.headers).get("authorization") });
    assert.equal(init?.redirect, "manual");
    if (seen.length === 1) return new Response(null, { status: 308, headers: { location: "https://service.test/api/me" } });
    if (seen.length === 2) return new Response(null, { status: 302, headers: { location: "./current" } });
    return Response.json({ authenticated: true });
  };
  const result = await fetchWithRedirects(fetch, "http://service.test/api/me", { headers: { Authorization: "Bearer synthetic-token" } });
  assert.equal(result.status, 200);
  assert.deepEqual(seen.map(x => x.url), ['http://service.test/api/me', 'https://service.test/api/me', 'https://service.test/api/current']);
  assert.ok(seen.every(x => x.auth === "Bearer synthetic-token"));
});

test("native redirects strip cross-origin credentials permanently and obey POST-to-GET semantics", async t => {
  const received: { auth: string | undefined; cookie: string | undefined; method: string | undefined; body: string }[] = [];
  const server = createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk;
    received.push({ auth: request.headers.authorization, cookie: request.headers.cookie, method: request.method, body });
    if (request.url === "/start") response.writeHead(302, { Location: `http://localhost:${(server.address() as { port: number }).port}/finish` });
    else if (request.url === "/finish") response.writeHead(307, { Location: `http://127.0.0.1:${(server.address() as { port: number }).port}/back` });
    else response.writeHead(200);
    response.end();
  });
  await new Promise<void>(resolve => server.listen(0, resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const port = (server.address() as { port: number }).port;
  const result = await fetchWithRedirects(globalThis.fetch, `http://127.0.0.1:${port}/start`, {
    method: "POST", body: "payload", headers: { Authorization: "Bearer synthetic-token", Cookie: "session=synthetic-cookie", "Content-Type": "text/plain" },
  });
  assert.equal(result.status, 200);
  await result.body?.cancel();
  assert.deepEqual(received, [
    { auth: "Bearer synthetic-token", cookie: "session=synthetic-cookie", method: "POST", body: "payload" },
    { auth: undefined, cookie: undefined, method: "GET", body: "" },
    { auth: undefined, cookie: undefined, method: "GET", body: "" },
  ]);
});

test("non-default port upgrades keep credentials, while downgrades and other port changes remove them", async () => {
  for (const [from, to, keep] of [
    ["http://service.test:8111/api", "https://service.test/api", true],
    ["http://service.test:8111/api", "https://service.test:8443/api", true],
    ["https://service.test/api", "http://service.test/api", false],
    ["https://service.test/api", "https://service.test:8443/api", false],
  ] as const) {
    let calls = 0;
    const fetch: typeof globalThis.fetch = async (_input, init) => {
      if (++calls === 1) return new Response(null, { status: 308, headers: { Location: to } });
      const headers = new Headers(init?.headers);
      assert.equal(headers.get("authorization"), keep ? "Bearer synthetic-token" : null);
      assert.equal(headers.get("x-api-key"), keep ? "synthetic-key" : null);
      return new Response(null);
    };
    await fetchWithRedirects(fetch, from, { headers: { Authorization: "Bearer synthetic-token", "X-API-Key": "synthetic-key" } });
    assert.equal(calls, 2);
  }
});

test("307/308 preserve replayable bodies; 303 changes methods; streams and loops fail without retries", async () => {
  for (const status of [307, 308, 303]) {
    let count = 0;
    const fetch: typeof globalThis.fetch = async (_url, init) => {
      if (++count === 1) return new Response(null, { status, headers: { Location: "/next" } });
      assert.equal(init?.method, status === 303 ? "GET" : "PUT");
      assert.equal(init?.body, status === 303 ? null : "fixture-body");
      return new Response(null);
    };
    await fetchWithRedirects(fetch, "https://service.test/first", { method: "PUT", body: "fixture-body" });
    assert.equal(count, 2);
  }
  let count = 0;
  const redirect: typeof globalThis.fetch = async () => { count++; return new Response(null, { status: 307, headers: { location: "/loop" } }); };
  await assert.rejects(fetchWithRedirects(redirect, "https://service.test", { method: "POST", body: new ReadableStream() }), /streaming request body/);
  assert.equal(count, 1);
  count = 0;
  await assert.rejects(fetchWithRedirects(redirect, "https://service.test"), /redirect limit exceeded/);
  assert.equal(count, 21);
});

test("transport failures retain native evidence without the token or an application retry", async () => {
  let calls = 0;
  const fetch: typeof globalThis.fetch = async () => {
    calls++;
    throw new TypeError("fetch failed", { cause: Object.assign(new Error("synthetic-token connection refused"), { code: "ECONNREFUSED" }) });
  };
  await assert.rejects(fetchWithRedirects(fetch, "https://service.test", { headers: { Authorization: "Bearer synthetic-token" } }), error => {
    const result = machineError(error);
    assert.equal(result.cause?.cause?.code, "ECONNREFUSED");
    assert.doesNotMatch(JSON.stringify(result), /synthetic-token/);
    return true;
  });
  assert.equal(calls, 1);
});
