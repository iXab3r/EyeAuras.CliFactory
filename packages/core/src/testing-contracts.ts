import assert from "node:assert/strict";
import type { TestContext } from "node:test";
import type { CliApplication } from "./types.js";
import type { CliFixture } from "./testing.js";

export interface HttpRequestExpectation {
  method: string;
  /** Origin and pathname, without query; authored independently of production routes. */
  url: string;
  query?: Readonly<Record<string, string | readonly string[]>>;
  headers?: Readonly<Record<string, string | null>>;
  body?: { json: unknown } | { text: string };
}

export async function assertHttpRequest(request: Request, expected: HttpRequestExpectation): Promise<void> {
  const url = new URL(request.url);
  assert.equal(request.method, expected.method, "HTTP method");
  assert.equal(url.origin + url.pathname, expected.url, "HTTP origin/path");
  const actualQuery = Object.fromEntries([...new Set(url.searchParams.keys())].map(key => [key, url.searchParams.getAll(key)]));
  const expectedQuery = Object.fromEntries(Object.entries(expected.query ?? {}).map(([key, value]) =>
    [key, typeof value === "string" ? [value] : [...value]]));
  assert.deepEqual(actualQuery, expectedQuery, "HTTP query (including repeated values)");
  for (const [name, value] of Object.entries(expected.headers ?? {}))
    assert.equal(request.headers.get(name), value, "HTTP header: " + name);
  if (expected.body && "json" in expected.body) assert.deepEqual(await request.json(), expected.body.json, "HTTP JSON body");
  else assert.equal(await request.text(), expected.body?.text ?? "", "HTTP text body");
}

/** Register on a catch-all MSW handler so unexpected routes are counted too. */
export function trackRequests(
  t: Pick<TestContext, "after">,
  expectedCount: number,
  respond: (request: Request, index: number) => Response | Promise<Response>,
) {
  assert.ok(Number.isSafeInteger(expectedCount) && expectedCount >= 0, "Expected request count must be nonnegative.");
  let count = 0;
  const failures: unknown[] = [];
  const verify = () => {
    if (failures.length) throw failures[0];
    assert.equal(count, expectedCount, "HTTP request count (no retries or hidden requests)");
  };
  // MSW turns resolver exceptions into HTTP errors. Re-raise the original assertion outside it,
  // even when the CLI assertion or the test itself fails first.
  t.after(verify);
  return {
    get count() { return count; },
    verify,
    async handle(request: Request): Promise<Response> {
      const index = count++;
      try {
        assert.ok(count <= expectedCount, "Unexpected extra HTTP request.");
        return await respond(request, index);
      } catch (error) {
        failures.push(error);
        return new Response(null, { status: 500 });
      }
    },
  };
}

export async function assertPermissionDenied(
  app: CliApplication, argv: readonly string[], permission: string, requests: { readonly count: number },
): Promise<void> {
  assert.equal(requests.count, 0, "Permission check must start before service I/O.");
  await assert.rejects(app.execute(argv), error => error instanceof Error &&
    error.message.includes("Permission '" + permission + "' is disabled"));
  assert.equal(requests.count, 0, "Permission denial must precede service I/O.");
}

/** For repeatable mocked commands making exactly one HTTP request in each human/JSON invocation. */
export async function assertCliOutput(
  fixture: CliFixture, app: CliApplication, argv: readonly string[], expected: unknown, human: RegExp,
  requests: { readonly count: number },
): Promise<void> {
  const before = requests.count;
  const result = await fixture.run(app, argv);
  assert.equal(requests.count, before + 1, "Human invocation must make exactly one HTTP request.");
  assert.equal(result.exitCode, 0, result.stderr);
  assert.match(result.stdout, human);
  assert.equal(result.stderr, "");
  const json = await fixture.run(app, ["--json", ...argv]);
  assert.equal(requests.count, before + 2, "JSON invocation must make exactly one HTTP request.");
  assert.equal(json.exitCode, 0, json.stderr);
  assert.deepEqual(JSON.parse(json.stdout), expected);
  assert.equal(json.stderr, "");
}

export async function assertSafeCliFailure(
  fixture: CliFixture, app: CliApplication, argv: readonly string[], message: RegExp, forbidden: RegExp,
): Promise<void> {
  const result = await fixture.run(app, argv);
  assert.equal(result.exitCode, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, message);
  assert.doesNotMatch(result.stderr, forbidden);
}
