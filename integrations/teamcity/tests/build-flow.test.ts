import assert from "node:assert/strict";
import test from "node:test";
import { CliError, Permission } from "@eyeauras/cli-factory";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createTestRuntime } from "./support.js";

const server = setupServer();
test.before(() => server.listen({ onUnhandledRequest: "error" }));
test.afterEach(() => server.resetHandlers());
test.after(() => server.close());

const base = "https://teamcity.test/app/rest";
const queued = { id: 201, buildTypeId: "Demo_Tests", state: "queued", queuePosition: 1 };
const running = { id: 201, buildTypeId: "Demo_Tests", state: "running", status: "SUCCESS" };
const finished = (status: string, extra: Record<string, unknown> = {}) => ({
  id: 201, buildTypeId: "Demo_Tests", state: "finished", status, ...extra,
});

function updater(t: test.TestContext) {
  return createTestRuntime(t, {
    profiles: [{
      name: "default", url: "https://teamcity.test",
      permissions: [Permission.ReadOnly, Permission.Update],
    }],
  });
}

/** Serves successive build states for GET /builds/id:201 and counts every request. */
function buildStates(states: ReadonlyArray<Record<string, unknown> | number>) {
  const seen = { posts: 0, reads: 0, other: 0 };
  server.use(
    http.post(`${base}/buildQueue`, () => {
      seen.posts++;
      return HttpResponse.json(queued);
    }),
    http.get(`${base}/builds/id:201`, () => {
      const state = states[Math.min(seen.reads++, states.length - 1)];
      return typeof state === "number"
        ? new HttpResponse(null, { status: state })
        : HttpResponse.json(state);
    }),
    http.all(`${base}/*`, () => {
      seen.other++;
      return new HttpResponse(null, { status: 500 });
    }),
  );
  return seen;
}

test("builds list filters one branch with a locator TeamCity cannot re-parse", async (t) => {
  const locators: string[] = [];
  server.use(http.get(`${base}/builds`, ({ request }) => {
    locators.push(new URL(request.url).searchParams.get("locator") ?? "");
    return HttpResponse.json({ build: [] });
  }));
  const runtime = await createTestRuntime(t);
  const cli = runtime.createCli();
  assert.deepEqual(await cli.execute(["builds", "list", "--job", "Demo_Tests", "--branch", "main"]), []);
  assert.deepEqual(await cli.execute(["builds", "list", "--branch", "release/1.0,hotfix"]), []);
  assert.deepEqual(locators, [
    "defaultFilter:false,branch:(name:main),buildType:(id:Demo_Tests),start:0,count:100",
    "defaultFilter:false,branch:(name:(value:($base64:" +
      `${Buffer.from("release/1.0,hotfix").toString("base64url")}))),start:0,count:100`,
  ]);
});

test("builds show accepts exactly one selector and rejects mixtures before any request", async (t) => {
  let requests = 0;
  const runtime = await createTestRuntime(t);
  runtime.runtime.fetch = async () => {
    requests++;
    return HttpResponse.json({});
  };
  const cli = runtime.createCli();
  for (const [argv, message] of [
    [["builds", "show"], /Specify a build ID, or --job <id> --latest/],
    [["builds", "show", "101", "--latest", "--job", "Demo_Tests"], /either a build ID or --latest/],
    [["builds", "show", "--latest"], /--latest requires --job/],
    [["builds", "show", "101", "--job", "Demo_Tests"], /only together with --latest/],
    [["builds", "show", "--branch", "main"], /only together with --latest/],
  ] as const) {
    const result = await runtime.run(cli, [...argv]);
    assert.equal(result.exitCode, 1, argv.join(" "));
    assert.match(result.stderr, message);
    await assert.rejects(cli.execute([...argv]), message);
  }
  assert.equal(requests, 0);
});

test("builds show --latest reads the newest finished build once and names its scope", async (t) => {
  const reads: string[] = [];
  const latest = finished("FAILURE", { id: 150, branchName: "main" });
  server.use(http.get(`${base}/builds`, ({ request }) => {
    reads.push(new URL(request.url).searchParams.get("locator") ?? "");
    return HttpResponse.json(reads.length === 1 ? { build: [latest] } : {});
  }));
  const runtime = await createTestRuntime(t);
  const cli = runtime.createCli();

  const human = await runtime.run(cli, ["builds", "show", "--job", "Demo_Tests", "--branch", "main", "--latest"]);
  assert.equal(human.exitCode, 0, human.stderr);
  assert.match(human.stdout, /^Build 150 · Demo_Tests · main\n/);
  assert.equal(human.stderr, "Latest finished build on the selected branch: 150\n");
  assert.deepEqual(reads, [
    "defaultFilter:false,buildType:(id:Demo_Tests),branch:(name:main),state:finished," +
      "personal:false,count:1",
  ]);

  const none = await runtime.run(cli, ["builds", "show", "--job", "Demo_Tests", "--latest", "--json"]);
  assert.equal(none.exitCode, 1);
  assert.equal(none.stdout, "");
  assert.match(none.stderr, /No finished build matches this job and branch/);
});

test("jobs run sends one-off parameters in the single queue request and never echoes them", async (t) => {
  let body: unknown;
  let posts = 0;
  server.use(http.post(`${base}/buildQueue`, async ({ request }) => {
    posts++;
    body = await request.json();
    return HttpResponse.json(queued);
  }));
  const runtime = await updater(t);
  const cli = runtime.createCli();

  const result = await runtime.json(cli, [
    "jobs", "run", "Demo_Tests", "--branch", "main",
    "--param", "env.MODE=synthetic-mode-value", "--param", "empty.value=",
  ]);
  assert.deepEqual(result, { accepted: true, build: queued });
  assert.deepEqual(body, {
    buildType: { id: "Demo_Tests" },
    branchName: "main",
    properties: {
      property: [
        { name: "env.MODE", value: "synthetic-mode-value" },
        { name: "empty.value", value: "" },
      ],
    },
  });
  const human = await runtime.run(cli, ["jobs", "run", "Demo_Tests", "--param", "env.MODE=synthetic-mode-value"]);
  assert.equal(human.exitCode, 0, human.stderr);
  assert.match(human.stdout, /^Queued: Build 201 · Demo_Tests\n/);
  assert.match(human.stdout, /Next:\n {2}teamcity-cli builds wait 201 --profile default\n$/);
  assert.doesNotMatch(human.stdout + human.stderr, /synthetic-mode-value/);
  assert.equal(posts, 2);

  for (const argv of [
    ["--param", "env.MODE=a", "--param", "env.MODE=b"],
    ["--param", "=value"],
    ["--timeout", "10m"],
    ["--interval", "5s"],
    ["--wait", "--timeout", "10"],
  ]) {
    const rejected = await runtime.run(cli, ["jobs", "run", "Demo_Tests", ...argv]);
    assert.equal(rejected.exitCode, 1, argv.join(" "));
  }
  assert.equal(posts, 2, "Invalid runs never reach TeamCity.");
});

test("jobs run --wait keeps Update, queues once and follows only by reads to success", async (t) => {
  const seen = buildStates([queued, running, finished("SUCCESS")]);
  const denied = await createTestRuntime(t);
  const refused = await denied.run(denied.createCli(), ["jobs", "run", "Demo_Tests", "--wait"]);
  assert.equal(refused.exitCode, 1);
  assert.match(refused.stderr, /Permission 'Update' is disabled/);
  assert.deepEqual(seen, { posts: 0, reads: 0, other: 0 });

  const runtime = await updater(t);
  const result = await runtime.run(runtime.createCli(), [
    "jobs", "run", "Demo_Tests", "--wait", "--interval", "1s", "--timeout", "1m",
  ]);
  assert.equal(result.exitCode, 0, result.stderr);
  assert.equal(
    result.stderr,
    "Build 201: queued (position 1)\nBuild 201: running\nBuild 201: finished: succeeded\n",
  );
  // "Queued" titles only a build still in the queue, not the finished result of the wait.
  assert.match(result.stdout, /^Build 201 · Demo_Tests\nOutcome: +succeeded\nState: +finished\n/);
  assert.deepEqual(seen, { posts: 1, reads: 3, other: 0 });
});

test("jobs run --wait queues and waits with one client, reading its credential only once", async (t) => {
  buildStates([queued, finished("SUCCESS")]);
  const runtime = await updater(t);
  let reads = 0;
  const get = runtime.secretStore.get.bind(runtime.secretStore);
  runtime.secretStore.get = async (service, account) => {
    if (account.endsWith(":token")) reads++;
    return get(service, account);
  };
  const cli = runtime.createCli();
  assert.equal((await runtime.run(cli, ["jobs", "run", "Demo_Tests"])).exitCode, 0);
  const queueOnly = reads;
  assert.ok(queueOnly > 0);
  reads = 0;
  const waited = await runtime.run(cli, ["jobs", "run", "Demo_Tests", "--wait", "--interval", "1s"]);
  assert.equal(waited.exitCode, 0, waited.stderr);
  assert.equal(reads, queueOnly);
});

test("failed, canceled and unknown results exit 1 with the final build as data", async (t) => {
  for (const [build, outcome, message] of [
    [finished("FAILURE"), "failed", "Build 201 finished with FAILURE."],
    [finished("UNKNOWN", { canceledInfo: { timestamp: "20260926T100405+0000" } }), "canceled",
      "Build 201 was canceled."],
    [finished("UNKNOWN"), "unknown", "Build 201 finished without a known result."],
  ] as const) {
    server.resetHandlers();
    const seen = buildStates([build]);
    const runtime = await updater(t);
    const cli = runtime.createCli();
    const result = await runtime.run(cli, ["jobs", "run", "Demo_Tests", "--wait", "--json"]);
    assert.equal(result.exitCode, 1, outcome);
    assert.deepEqual(JSON.parse(result.stdout), { accepted: true, build, outcome });
    assert.equal(result.stderr, `${message}\n`);
    assert.deepEqual(seen, { posts: 1, reads: 1, other: 0 });

    const waited = await runtime.run(cli, ["builds", "wait", "201", "--json"]);
    assert.equal(waited.exitCode, 1);
    assert.deepEqual(JSON.parse(waited.stdout), { build, outcome });
  }
});

test("a deadline stops only local waiting: exit 124 with the last state and no cancel", async (t) => {
  const seen = buildStates([running]);
  const runtime = await createTestRuntime(t);
  const started = Date.now();
  const result = await runtime.run(runtime.createCli(), [
    "builds", "wait", "201", "--timeout", "1s", "--interval", "1s", "--json",
  ]);
  assert.equal(result.exitCode, 124);
  assert.ok(Date.now() - started < 5_000, "The deadline bounds the whole wait.");
  assert.deepEqual(JSON.parse(result.stdout), { build: running, outcome: "timedOut" });
  assert.match(result.stderr, /did not finish in time; it continues on the server and was not canceled/);
  assert.equal(seen.posts + seen.other, 0);
});

test("an interrupt stops waiting with exit 130 and never cancels the build", async (t) => {
  const seen = buildStates([running]);
  const runtime = await createTestRuntime(t);
  const interrupt = new AbortController();
  server.use(http.get(`${base}/builds/id:201`, () => {
    seen.reads++;
    setImmediate(() => interrupt.abort());
    return HttpResponse.json(running);
  }));
  const result = await runtime.run(runtime.createCli(), ["builds", "wait", "201", "--json"], {
    signal: interrupt.signal,
  });
  assert.equal(result.exitCode, 130);
  assert.deepEqual(JSON.parse(result.stdout), { build: running, outcome: "interrupted" });
  assert.match(result.stderr, /Stopped waiting for build 201; it continues on the server/);
  assert.equal(seen.posts + seen.other, 0);
});

test("a build that disappears or cannot be read keeps its accepted ID and a resume command", async (t) => {
  const vanished = buildStates([running, 404]);
  const runtime = await createTestRuntime(t);
  const cli = runtime.createCli();
  const gone = await runtime.run(cli, ["builds", "wait", "201", "--interval", "1s", "--json"]);
  assert.equal(gone.exitCode, 1);
  assert.deepEqual(JSON.parse(gone.stdout), { build: running, outcome: "missing" });
  assert.match(gone.stderr, /no longer available/);
  assert.deepEqual(vanished, { posts: 0, reads: 2, other: 0 });

  server.resetHandlers();
  buildStates([running, 404]);
  const human = await runtime.run(cli, ["builds", "wait", "201", "--interval", "1s"]);
  assert.equal(human.exitCode, 1);
  // A build that disappeared cannot be waited for or read again: no follow-up commands.
  assert.doesNotMatch(human.stdout, /Next:/);

  server.resetHandlers();
  const broken = buildStates([500]);
  const updates = await updater(t);
  const failed = await updates.run(updates.createCli(), ["jobs", "run", "Demo_Tests", "--wait", "--json"]);
  assert.equal(failed.exitCode, 1);
  assert.deepEqual(JSON.parse(failed.stdout), { accepted: true, build: queued });
  assert.match(failed.stderr, /Reading build 201 failed; it may still be running/);
  assert.deepEqual(broken, { posts: 1, reads: 1, other: 0 });

  const [reply] = await updates.rpc(updates.createCli(), [["jobs", "run", "Demo_Tests", "--wait"]]) as Array<{
    error: { data: { code: string; next: string[][]; result: unknown } };
  }>;
  assert.equal(reply?.error.data.code, "wait.failed");
  assert.deepEqual(reply?.error.data.next, [["builds", "wait", "201", "--profile", "default"]]);
  assert.deepEqual(reply?.error.data.result, { accepted: true, build: queued });
});

test("a lost queue response is reported as unknown and never retried", async (t) => {
  let posts = 0;
  const runtime = await updater(t);
  runtime.runtime.fetch = async (input, init) => {
    assert.equal(init?.method, "POST");
    assert.equal(new URL(String(input)).pathname, "/app/rest/buildQueue");
    posts++;
    throw new TypeError("synthetic connection reset");
  };
  const cli = runtime.createCli();
  const result = await runtime.run(cli, ["jobs", "run", "Demo_Tests", "--wait"]);
  assert.equal(result.exitCode, 1);
  assert.equal(result.stdout, "");
  assert.equal(
    result.stderr,
    "The queue request's outcome is unknown; check for a new build before running it again.\n" +
      "Next:\n  teamcity-cli builds list --job Demo_Tests --state any --profile default\n",
  );
  assert.doesNotMatch(result.stderr, /synthetic connection reset/);
  assert.equal(posts, 1);
  await assert.rejects(cli.execute(["jobs", "run", "Demo_Tests"]), (error: unknown) =>
    error instanceof CliError && error.code === "run.unknownOutcome" && error.result === undefined);
  assert.equal(posts, 2);
});

test("a 5xx or unreadable queue response is unknown too, and a refusal stays a plain failure", async (t) => {
  const responses = [
    () => new HttpResponse(null, { status: 502 }),
    () => new HttpResponse(null, { status: 500 }),
    () => new HttpResponse("<html>proxy</html>", { status: 200 }),
    () => HttpResponse.json({ buildType: { id: "Demo_Tests" } }),
  ];
  let posts = 0;
  server.use(
    http.post(`${base}/buildQueue`, () =>
      responses[posts++]?.() ?? new HttpResponse(null, { status: 400 })),
    http.all(`${base}/*`, () => new HttpResponse(null, { status: 500 })),
  );
  const runtime = await updater(t);
  const cli = runtime.createCli();
  for (const _ of responses) {
    const result = await runtime.run(cli, [
      "jobs", "run", "Demo_Tests", "--branch", "release/1.0", "--wait",
    ]);
    assert.equal(result.exitCode, 1);
    assert.equal(result.stdout, "");
    assert.equal(
      result.stderr,
      "The queue request's outcome is unknown; check for a new build before running it again.\n" +
        "Next:\n  teamcity-cli builds list --job Demo_Tests --branch release/1.0 --state any " +
        "--profile default\n",
    );
  }
  assert.equal(posts, responses.length);
  // TeamCity refused the request, so nothing was queued.
  const refused = await runtime.run(cli, ["jobs", "run", "Demo_Tests"]);
  assert.equal(refused.exitCode, 1);
  assert.match(refused.stderr, /HTTP 400/);
  assert.doesNotMatch(refused.stderr, /outcome is unknown/);
  assert.equal(posts, responses.length + 1);
});

test("diagnose is bounded, marks truncation and never turns missing data into no failures", async (t) => {
  const summary = finished("FAILURE", {
    id: 101,
    statusText: "Tests failed: 25 (3 new), passed: 40",
    testOccurrences: { count: 65, passed: 40, failed: 25, newFailed: 3, muted: 1, ignored: 0 },
    problemOccurrences: { count: 1, newFailed: 1 },
  });
  const tests = Array.from({ length: 21 }, (_, index) => ({
    id: `test-${index}`, name: `Synthetic.Test${index}`, status: "FAILURE", newFailure: index < 3,
  }));
  const queries: string[] = [];
  let problemsStatus = 200;
  server.use(
    http.get(`${base}/builds/id:101`, ({ request }) => {
      queries.push(new URL(request.url).searchParams.get("fields") ?? "");
      return HttpResponse.json(summary);
    }),
    http.get(`${base}/problemOccurrences`, ({ request }) => {
      queries.push(new URL(request.url).searchParams.get("locator") ?? "");
      return problemsStatus === 200
        ? HttpResponse.json({
            problemOccurrence: [{
              id: "problem-1", type: "TC_EXIT_CODE", identity: "step", newFailure: true,
              details: "Process exited with code 1", problem: { id: "p", type: "TC_EXIT_CODE",
                identity: "step", description: "Process exited with code 1" },
            }],
          })
        : new HttpResponse(null, { status: problemsStatus });
    }),
    http.get(`${base}/testOccurrences`, ({ request }) => {
      const url = new URL(request.url);
      queries.push(url.searchParams.get("locator") ?? "", url.searchParams.get("fields") ?? "");
      return HttpResponse.json({ testOccurrence: tests });
    }),
  );
  const runtime = await createTestRuntime(t);
  const cli = runtime.createCli();

  const complete = await runtime.json(cli, ["builds", "diagnose", "101"]) as {
    outcome: string; partial: boolean;
    problems: { status: string; items: unknown[] };
    failedTests: { status: string; items: Array<{ name: string; newFailure?: boolean }> };
  };
  assert.equal(complete.outcome, "failed");
  assert.equal(complete.partial, false);
  assert.equal(complete.problems.status, "complete");
  assert.deepEqual(complete.problems.items, [{
    id: "problem-1", type: "TC_EXIT_CODE", identity: "step",
    description: "Process exited with code 1", details: "Process exited with code 1", newFailure: true,
  }]);
  assert.equal(complete.failedTests.status, "truncated");
  assert.equal(complete.failedTests.items.length, 20);
  assert.deepEqual(complete.failedTests.items[0], { id: "test-0", name: "Synthetic.Test0", newFailure: true });
  assert.ok(queries.includes("build:(id:101),start:0,count:11"));
  assert.ok(queries.includes("build:(id:101),status:failure,start:0,count:21"));
  assert.ok(queries.includes("testOccurrence(id,name,status,newFailure,muted,currentlyMuted,ignored)"),
    "Failed tests are read without stack traces.");

  const human = await runtime.run(cli, ["builds", "diagnose", "101"]);
  assert.equal(human.exitCode, 0, human.stderr);
  assert.match(human.stdout, /^Tests: +65 total, 40 passed, 25 failed \(3 new\), 1 muted, 0 ignored$/m);
  assert.match(human.stdout, /Problems \(1\):\n {2}\(new\) TC_EXIT_CODE: Process exited with code 1\n/);
  assert.match(human.stdout, /Failed tests \(first 20 of 25\):\n {2}Synthetic\.Test0 \(new\)\n/);

  problemsStatus = 403;
  const partial = await runtime.run(cli, ["builds", "diagnose", "101", "--json"]);
  assert.equal(partial.exitCode, 1);
  const data = JSON.parse(partial.stdout) as { partial: boolean; problems: unknown };
  assert.equal(data.partial, true);
  assert.deepEqual(data.problems, { status: "unavailable", reason: "denied" });
  assert.match(partial.stderr, /summary is partial/);
  const partialHuman = await runtime.run(cli, ["builds", "diagnose", "101"]);
  assert.match(partialHuman.stdout, /Problems:\n {2}unavailable: access denied\n/);
  assert.doesNotMatch(partialHuman.stdout, /Problems:\n {2}none/);
});
