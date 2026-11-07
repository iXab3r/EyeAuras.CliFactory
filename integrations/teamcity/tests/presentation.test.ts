import assert from "node:assert/strict";
import { Writable } from "node:stream";
import test from "node:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createTestRuntime } from "./support.js";

const server = setupServer();
test.before(() => server.listen({ onUnhandledRequest: "error" }));
test.afterEach(() => server.resetHandlers());
test.after(() => server.close());

const failed = {
  id: 101,
  buildTypeId: "Demo_UnitTests_With_A_Rather_Long_Configuration_Identifier",
  number: "42",
  state: "finished",
  status: "FAILURE",
  statusText: "Tests failed: 2 (1 new), passed: 40",
  branchName: "feature/a-deliberately-long-synthetic-branch-name",
  queuedDate: "20260926T100000+0000",
  startDate: "20260926T100005+0000",
  finishDate: "20260926T100405+0000",
  webUrl: "https://teamcity.test/build/101",
  agent: { id: 7, name: "fixture-agent" },
};
const running = {
  id: 1_234_567_890,
  buildTypeId: "Short",
  state: "running",
  status: "SUCCESS",
  percentageComplete: 40,
  branchName: "main",
  startDate: "20260926T115900+0000",
};

function terminal(columns: number) {
  let text = "";
  const stream = Object.assign(
    new Writable({ write(chunk, _encoding, done) { text += chunk.toString(); done(); } }),
    { isTTY: true, columns },
  );
  return { stream, text: () => text };
}

function headings(help: string): string[] {
  return help.split("\n").filter((line) => /^[A-Z][A-Za-z ]*:$/.test(line));
}

function commandsUnder(help: string, heading: string): string[] {
  const lines = help.split("\n");
  const start = lines.indexOf(heading);
  const names: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^ {3,}\S/.test(line)) continue; // a wrapped description
    const match = /^ {2}([a-z][a-z-]*)/.exec(line);
    if (!match?.[1]) break;
    names.push(match[1]);
  }
  return names;
}

test("help starts with everyday commands, keeps every command and shows scenario examples", async (t) => {
  const runtime = await createTestRuntime(t);
  const cli = runtime.createCli();

  assert.equal(await cli.run(["builds", "--help"]), 0);
  const builds = runtime.stdout();
  assert.deepEqual(headings(builds), ["Options:", "Everyday:", "Files:", "Control:", "Evidence:", "Examples:"]);
  assert.deepEqual(commandsUnder(builds, "Everyday:").slice(0, 4), ["list", "show", "wait", "diagnose"]);
  const all = ["Everyday:", "Files:", "Control:", "Evidence:"].flatMap((heading) => commandsUnder(builds, heading));
  assert.equal(all.length, 39, "Regrouping must not drop or duplicate a builds command.");
  assert.equal(new Set(all).size, all.length);
  assert.match(builds, /Examples:\n {2}teamcity-cli builds list --job Demo_Tests/);

  runtime.resetOutput();
  assert.equal(await cli.run(["builds"]), 0);
  assert.equal(runtime.stdout(), builds, "A bare group shows the same help, examples included.");

  for (const [branch, everyday] of [
    ["jobs", ["list", "show", "run"]],
    ["projects", ["list", "show"]],
    ["queue", ["list", "show", "cancel"]],
    ["agents", ["list", "show"]],
  ] as const) {
    runtime.resetOutput();
    assert.equal(await cli.run([branch, "--help"]), 0);
    const help = runtime.stdout();
    assert.equal(headings(help)[1], "Everyday:", `${branch} help starts with everyday commands`);
    assert.deepEqual(commandsUnder(help, "Everyday:"), everyday);
  }

  runtime.resetOutput();
  assert.equal(await cli.run(["--help"]), 0);
  const root = runtime.stdout();
  assert.deepEqual(
    headings(root),
    ["Options:", "Everyday:", "Triage:", "Administration:", "Configuration:", "Commands:", "Examples:"],
  );
  assert.deepEqual(commandsUnder(root, "Everyday:"), ["builds", "jobs", "projects", "queue", "agents"]);
  assert.match(root, /Examples:\n {2}teamcity-cli builds list --job Demo_Tests --branch main --limit 20\n/);
});

test("builds list reads at 120 and 80 columns without cutting IDs while JSON keeps every field", async (t) => {
  const typical = { ...failed, buildTypeId: "Demo_UnitTests_Nightly" };
  let builds: unknown[] = [typical, running];
  server.use(http.get("https://teamcity.test/app/rest/builds", () => HttpResponse.json({ build: builds })));
  const runtime = await createTestRuntime(t);
  const cli = runtime.createCli();

  for (const columns of [121, 81]) {
    const out = terminal(columns);
    assert.equal(await cli.run(["builds", "list"], { output: out.stream }), 0);
    const lines = out.text().trimEnd().split("\n");
    assert.match(lines[0] ?? "", /^BUILD\s+JOB\s+BRANCH\s+STATE\s+RESULT\s+AGE$/);
    assert.match(lines[1] ?? "", /^101\s+Demo_UnitTests_Nightly\s+feature\/\S+\s+finished\s+FAILURE\s+\S+$/);
    assert.match(lines[2] ?? "", /^1234567890\s+Short\s+main\s+running\s+-\s+\S+$/);
    for (const line of lines) assert.ok(line.length < columns, `${line.length} >= ${columns}: ${line}`);
  }
  const narrow = terminal(81);
  assert.equal(await cli.run(["builds", "list"], { output: narrow.stream }), 0);
  assert.match(narrow.text(), /feature\/a-de\S*…/, "Only the branch shrinks at 80 columns.");

  // An ID that cannot fit is never cut: the line wraps instead.
  builds = [failed];
  const tooLong = terminal(81);
  assert.equal(await cli.run(["builds", "list"], { output: tooLong.stream }), 0);
  assert.match(tooLong.text(), /^101\s+Demo_UnitTests_With_A_Rather_Long_Configuration_Identifier\s/m);

  const redirected = await runtime.run(cli, ["builds", "list"]);
  assert.match(redirected.stdout, /Demo_UnitTests_With_A_Rather_Long_Configuration_Identifier/);
  assert.match(redirected.stdout, /feature\/a-deliberately-long-synthetic-branch-name/);

  builds = [typical, running];
  assert.deepEqual(
    await runtime.json(cli, ["builds", "list"]),
    { count: 2, items: [typical, running], hasMore: false, nextStart: null },
  );
  assert.doesNotMatch(redirected.stdout, /More results|Shown:/);
});

test("builds show summarizes one build and suggests safe profile-bound next commands", async (t) => {
  server.use(
    http.get("https://teamcity.test/app/rest/builds/id:101", () => HttpResponse.json(failed)),
    http.get("https://teamcity.test/app/rest/builds/id:1234567890", () => HttpResponse.json(running)),
  );
  // "uat" is the only, and therefore the default, profile: printed follow-ups omit --profile.
  const runtime = await createTestRuntime(t, {
    profiles: [{ name: "uat", url: "https://teamcity.test" }],
    tokens: { uat: "fixture-token" },
  });
  const cli = runtime.createCli();

  const shown = await runtime.run(cli, ["builds", "show", "101", "--profile", "uat"]);
  assert.equal(shown.exitCode, 0, shown.stderr);
  assert.equal(
    shown.stdout,
    "Build 101 (#42) · Demo_UnitTests_With_A_Rather_Long_Configuration_Identifier · " +
      "feature/a-deliberately-long-synthetic-branch-name\n" +
      "State:     finished\n" +
      "Result:    FAILURE\n" +
      "Status:    Tests failed: 2 (1 new), passed: 40\n" +
      "Duration:  4m 00s\n" +
      "Agent:     fixture-agent\n" +
      "Web:       https://teamcity.test/build/101\n" +
      "\n" +
      "Next:\n" +
      "  teamcity-cli builds diagnose 101\n" +
      "  teamcity-cli builds artifacts list 101\n",
  );

  const live = await runtime.run(cli, ["builds", "show", "1234567890", "--profile", "uat"]);
  assert.match(live.stdout, /^State: {5}running \(40%\)$/m);
  assert.doesNotMatch(live.stdout, /Result:/, "A running build has no result yet.");
  assert.match(live.stdout, /Next:\n {2}teamcity-cli builds wait 1234567890\n$/);

  assert.deepEqual(await runtime.json(cli, ["builds", "show", "101", "--profile", "uat"]), failed);
});

test("artifact listings and saved files read clearly without changing their JSON", async (t) => {
  const bytes = new TextEncoder().encode("synthetic artifact bytes");
  server.use(
    http.get("https://teamcity.test/app/rest/builds/id:101/artifacts", () =>
      HttpResponse.json({
        count: 2,
        file: [
          { name: "dist", children: {}, modificationTime: "20260926T100405+0000" },
          { name: "app.zip", children: {}, content: { href: "synthetic-private-href" }, size: 1_572_864, modificationTime: "20260926T100405+0000" },
        ],
      })),
    http.get("https://teamcity.test/app/rest/builds/id:101/artifacts/files/app.zip", () =>
      new HttpResponse(bytes, { headers: { "Content-Type": "application/octet-stream" } })),
  );
  const runtime = await createTestRuntime(t);
  const cli = runtime.createCli();

  const listed = await runtime.run(cli, ["builds", "artifacts", "list", "101"]);
  assert.equal(listed.exitCode, 0, listed.stderr);
  assert.match(listed.stdout, /^NAME\s+SIZE\s+MODIFIED\ndist\/\s+\S+\napp\.zip \(archive\)\s+1\.5 MiB\s+\S+\n/);
  assert.match(listed.stdout, /teamcity-cli builds artifacts children 101 dist/);
  assert.match(listed.stdout, /teamcity-cli builds artifacts download 101 app.zip --output app.zip/);
  assert.doesNotMatch(listed.stdout, /href|synthetic-private|More results|Shown:/);
  assert.deepEqual(await runtime.json(cli, ["builds", "artifacts", "list", "101"]), {
    count: 2,
    hasMore: false,
    items: [
      { name: "dist", directory: true, archive: false, modificationTime: "20260926T100405+0000" },
      { name: "app.zip", directory: false, archive: true, size: 1_572_864, modificationTime: "20260926T100405+0000" },
    ],
  });

  const saved = await runtime.run(
    cli, ["builds", "artifacts", "download", "101", "app.zip", "--output", "app.zip"],
  );
  assert.equal(saved.exitCode, 0, saved.stderr);
  const json = await runtime.json(
    cli, ["builds", "artifacts", "download", "101", "app.zip", "--output", "app-2.zip"],
  ) as { path: string };
  assert.equal(
    saved.stdout,
    "Saved file\n" +
      `Path:        ${json.path.replace(/app-2\.zip$/, "app.zip")}\n` +
      `Size:        ${bytes.length} bytes\n` +
      "SHA-256:     88f55cee374b166f1db9f308afa7e58141a8a50161cd7020fe53ce3980321cc3\n" +
      "Media type:  application/octet-stream\n",
  );

  runtime.resetOutput();
  assert.equal(await cli.run(["builds", "artifacts", "download", "--help"]), 0);
  assert.match(runtime.stdout(), /--output <path>\s+.*relative or absolute path/);
});

test("build tests and problems read as tables with flags and completeness; JSON is unchanged", async (t) => {
  const tests = [
    { id: "t1", name: "Demo.Suite.charges_card", status: "FAILURE", duration: 1_500, newFailure: true,
      details: "synthetic stack trace" },
    { id: "t2", name: "Demo.Suite.refunds", status: "FAILURE", duration: 65_000, currentlyMuted: true },
    { id: "t3", name: "Demo.Suite.voids", status: "FAILURE" },
  ];
  const problem = {
    id: "p1", type: "TC_EXIT_CODE", identity: "exit", newFailure: true,
    details: "Process exited with code 1 (Step: Run tests)",
    problem: { id: "2", type: "TC_EXIT_CODE", identity: "exit", description: "Process exited with code 1" },
  };
  server.use(
    http.get("https://teamcity.test/app/rest/testOccurrences", () =>
      HttpResponse.json({ count: 3, testOccurrence: tests })),
    http.get("https://teamcity.test/app/rest/problemOccurrences", () =>
      HttpResponse.json({ count: 1, problemOccurrence: [problem] })),
  );
  const runtime = await createTestRuntime(t);
  const cli = runtime.createCli();

  const listed = await runtime.run(cli, ["builds", "tests", "101", "--status", "failure", "--limit", "2"]);
  assert.equal(listed.exitCode, 0, listed.stderr);
  assert.equal(
    listed.stdout,
    "STATUS   FLAGS  DURATION  TEST\n" +
      "FAILURE  new    1s        Demo.Suite.charges_card\n" +
      "FAILURE  muted  1m 05s    Demo.Suite.refunds\n\n" +
      "More results: --start 2\n",
  );
  assert.deepEqual(
    await runtime.json(cli, ["builds", "tests", "101", "--status", "failure", "--limit", "2"]),
    { count: 2, items: tests.slice(0, 2), hasMore: true, nextStart: 2 },
  );

  const problems = await runtime.run(cli, ["builds", "problems", "101"]);
  assert.equal(problems.exitCode, 0, problems.stderr);
  assert.equal(
    problems.stdout,
    "TYPE          FLAGS  DESCRIPTION\nTC_EXIT_CODE  new    Process exited with code 1\n",
  );
});

test("everyday control views render selected fields and empty collections", async t => {
  let empty = false;
  server.use(
    http.get("https://teamcity.test/app/rest/projects", () => HttpResponse.json({ project: empty ? [] : [
      { id: "Child", name: "Child project", parentProjectId: "Parent", archived: false },
      { id: "Parent", name: "Parent project", archived: false },
      { id: "Selected", name: "Selected project", parentProjectId: "Outside", archived: false },
    ] })),
    http.get("https://teamcity.test/app/rest/buildTypes", () => HttpResponse.json({ buildType: empty ? [] : [
      { id: "Demo_Tests", name: "Tests", projectId: "Parent", paused: false, settings: { private: "omit" } },
    ] })),
    http.get("https://teamcity.test/app/rest/agents", () => HttpResponse.json({ agent: empty ? [] : [
      { id: 7, name: "fixture-agent", connected: true, enabled: false, authorized: true, metadata: { private: "omit" } },
    ] })),
    http.get("https://teamcity.test/app/rest/buildQueue", () => HttpResponse.json({ build: empty ? [] : [
      { id: 101, buildTypeId: "Demo_Tests", state: "queued", waitReason: "waiting", nested: { private: "omit" } },
    ] })),
    http.post("https://teamcity.test/app/rest/builds/id:101", () => HttpResponse.json(failed)),
    http.post("https://teamcity.test/app/rest/buildQueue/id:101", () => HttpResponse.json(failed)),
  );
  const runtime = await createTestRuntime(t, { profiles: [{ name: "default", url: "https://teamcity.test",
    permissions: ["ReadOnly", "Update"] }] });
  const cli = runtime.createCli();
  const projects = await runtime.run(cli, ["projects", "list"]);
  assert.equal(projects.exitCode, 0, projects.stderr);
  assert.match(projects.stdout, /^Parent · Parent project\n  Child · Child project\nSelected · Selected project\n$/);
  for (const [branch, header, name] of [
    ["jobs", /^JOB\s+NAME\s+PROJECT\s+PAUSED/m, "Demo_Tests"],
    ["agents", /^AGENT\s+NAME\s+CONNECTED\s+ENABLED\s+AUTHORIZED/m, "fixture-agent"],
    ["queue", /^BUILD\s+JOB\s+BRANCH\s+STATE\s+RESULT\s+AGE/m, "Demo_Tests"],
  ] as const) {
    const result = await runtime.run(cli, [branch, "list"]);
    assert.equal(result.exitCode, 0, result.stderr);
    assert.match(result.stdout, header);
    assert.ok(result.stdout.includes(name));
    assert.doesNotMatch(result.stdout, /private|omit|\{|More results|Shown:/);
  }
  for (const branch of ["builds", "queue"]) {
    const result = await runtime.run(cli, [branch, "cancel", "101"]);
    assert.equal(result.exitCode, 0, result.stderr);
    assert.match(result.stdout, /^Build 101/);
    assert.doesNotMatch(result.stdout, /canceledInfo|\{/);
    assert.deepEqual(await runtime.json(cli, [branch, "cancel", "101"]), failed);
  }
  empty = true;
  for (const branch of ["projects", "jobs", "agents", "queue"]) {
    const result = await runtime.run(cli, [branch, "list"]);
    assert.equal(result.exitCode, 0, result.stderr);
    assert.match(result.stdout, /^No (projects|jobs|agents|builds) found\.\n$/);
  }
});

test("string collections use one line per item and readable empty output", async t => {
  let names = ["first-name", "second-name"];
  server.use(http.get("https://teamcity.test/app/rest/*", ({ request }) => {
    const path = new URL(request.url).pathname;
    if (path.endsWith("/tags") || path.endsWith("/buildTags")) return HttpResponse.json({ tag: names.map(name => ({ name })) });
    return HttpResponse.json({ [path.endsWith("/attributes") ? "entry" : "property"]: names.map(name => ({ name })) });
  }));
  const runtime = await createTestRuntime(t);
  const cli = runtime.createCli();
  const commands = [["jobs", "tags", "Demo_Tests"], ["builds", "tags", "list", "101"],
    ["changes", "attributes", "101"], ["users", "properties", "list", "3"],
    ["builds", "output-parameters", "list", "101"]];
  for (const argv of commands) {
    const result = await runtime.run(cli, argv);
    assert.equal(result.exitCode, 0, `${argv.join(" ")}: ${result.stderr}`);
    assert.equal(result.stdout, "first-name\nsecond-name\n");
    assert.deepEqual(await runtime.json(cli, argv), names);
  }
  names = [];
  for (const argv of commands) assert.equal((await runtime.run(cli, argv)).stdout, "No names found.\n");
});
