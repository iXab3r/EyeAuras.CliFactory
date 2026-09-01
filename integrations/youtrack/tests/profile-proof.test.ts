import assert from "node:assert/strict";
import { test } from "node:test";
import { formatProfileProof, runProfileProof } from "../integration-tests/profile-proof.js";

const profileArgs = ["--profile", "dev"];
const responses = [
  { id: "fixture-user-id", login: "fixture-private-login" },
  [{ id: "fixture-project-id", name: "Synthetic project", shortName: "FIX" }],
  [{ id: "fixture-issue-id" }],
  { id: "fixture-issue-id" },
  [{ id: "fixture-comment-id" }],
  { id: "fixture-project-id" },
  [{ id: "fixture-project-field-id" }],
  [{ id: "fixture-user-id" }],
  [{ id: "fixture-issue-field-id" }],
  [{ id: "fixture-attachment-id" }],
  [{ id: "fixture-tag-id" }],
  [{ id: "fixture-link-id" }],
  [{ id: "fixture-work-item-id" }],
  [{ id: "fixture-global-field-id" }],
  [{ id: "fixture-user-bundle-id" }],
  [{ id: "fixture-group-id" }],
  { id: "fixture-project-team-id" },
  { id: "fixture-project-time-settings-id" },
  [{ id: "fixture-work-item-type-id" }],
  [{ id: "fixture-agile-id" }],
  [{ id: "fixture-article-id" }],
  [{ id: "fixture-build-bundle-id" }],
  [{ id: "fixture-owned-bundle-id" }],
  [{ id: "fixture-version-bundle-id" }],
];
const endpoints = [
  "GET /api/users/me",
  "GET /api/admin/projects",
  "GET /api/issues",
  "GET /api/issues/{issueID}",
  "GET /api/issues/{issueID}/comments",
  "GET /api/admin/projects/{projectID}",
  "GET /api/admin/projects/{projectID}/customFields",
  "GET /api/users",
  "GET /api/issues/{issueID}/customFields",
  "GET /api/issues/{issueID}/attachments",
  "GET /api/issues/{issueID}/tags",
  "GET /api/issues/{issueID}/links",
  "GET /api/issues/{issueID}/timeTracking/workItems",
  "GET /api/admin/customFieldSettings/customFields",
  "GET /api/admin/customFieldSettings/bundles/user",
  "GET /api/groups",
  "GET /api/admin/projects/{projectID}/team",
  "GET /api/admin/projects/{projectID}/timeTrackingSettings",
  "GET /api/admin/timeTrackingSettings/workItemTypes",
  "GET /api/agiles",
  "GET /api/articles",
  "GET /api/admin/customFieldSettings/bundles/build",
  "GET /api/admin/customFieldSettings/bundles/ownedField",
  "GET /api/admin/customFieldSettings/bundles/version",
];
const commands: readonly string[][] = [
  ["user", "me"],
  ["project", "list", "--top", "3", "--skip", "0"],
  ["issues", "list", "--top", "3", "--skip", "0", "--fields", "id"],
  ["issues", "get", "fixture-issue-id", "--fields", "id"],
  ["issues", "comments", "list", "fixture-issue-id", "--top", "3", "--skip", "0", "--fields", "id"],
  ["project", "get", "fixture-project-id", "--fields", "id"],
  ["project", "field", "list", "fixture-project-id", "--top", "3", "--skip", "0", "--fields", "id"],
  ["user", "list", "--top", "3", "--skip", "0", "--fields", "id"],
  ["issues", "fields", "list", "fixture-issue-id", "--top", "3", "--skip", "0", "--fields", "id"],
  ["issues", "attachments", "list", "fixture-issue-id", "--top", "3", "--skip", "0", "--fields", "id"],
  ["issues", "tags", "list", "fixture-issue-id", "--top", "3", "--skip", "0", "--fields", "id"],
  ["issues", "links", "list", "fixture-issue-id", "--top", "3", "--skip", "0", "--fields", "id"],
  ["issues", "work-items", "list", "fixture-issue-id", "--top", "3", "--skip", "0", "--fields", "id"],
  ["field", "list", "--top", "3", "--skip", "0", "--fields", "id"],
  ["bundle", "user", "list", "--top", "3", "--skip", "0", "--fields", "id"],
  ["group", "list", "--top", "3", "--skip", "0", "--fields", "id"],
  ["project", "team", "get", "fixture-project-id", "--fields", "id"],
  ["project", "time-tracking", "get", "fixture-project-id", "--fields", "id"],
  ["work-item-type", "list", "--top", "3", "--skip", "0", "--fields", "id"],
  ["agile", "list", "--top", "3", "--skip", "0", "--fields", "id"],
  ["article", "list", "--top", "3", "--skip", "0", "--fields", "id"],
  ["bundle", "build", "list", "--top", "3", "--skip", "0", "--fields", "id"],
  ["bundle", "owned", "list", "--top", "3", "--skip", "0", "--fields", "id"],
  ["bundle", "version", "list", "--top", "3", "--skip", "0", "--fields", "id"],
];

function commandIndex(argv: readonly string[]): number {
  const index = commands.findIndex((command) =>
    JSON.stringify(argv) === JSON.stringify([...command, ...profileArgs, "--json"]));
  assert.notEqual(index, -1, "Unexpected proof command.");
  return index;
}

function dependentRows(index: number): number[] {
  return index === 1 ? [5, 6, 16, 17] : index === 2 ? [3, 4, 8, 9, 10, 11, 12] : [];
}

test("proof executes exactly twenty-four bounded ReadOnly commands with one explicit profile", async () => {
  let calls = 0;
  const result = await runProfileProof(profileArgs, {}, async ({ argv }) => {
    assert.deepEqual(argv, [...commands[calls]!, ...profileArgs, "--json"]);
    return JSON.stringify(responses[calls++]);
  });
  assert.equal(calls, 24);
  assert.deepEqual(result, {
    passed: true,
    rows: endpoints.map((endpoint) => ({ endpoint, status: "PASS", count: 1 })),
  });
  assert.equal(formatProfileProof(result),
    endpoints.map((endpoint) => `PASS ${endpoint}: 1 records\n`).join(""));
  assert.doesNotMatch(formatProfileProof(result), /fixture|dev/);
});

test("proof accepts empty pages and skips only reads depending on empty projects or issues", async () => {
  const called: number[] = [];
  const result = await runProfileProof(profileArgs, {}, async ({ argv }) => {
    const index = commandIndex(argv);
    called.push(index);
    return JSON.stringify(index === 0 ? responses[0] : []);
  });
  assert.deepEqual(called, [0, 1, 2, 7, 13, 14, 15, 18, 19, 20, 21, 22, 23]);
  assert.equal(result.passed, true);
  assert.deepEqual(result.rows.map(({ status, count }) => [status, count]), [
    ["PASS", 1], ["PASS", 0], ["PASS", 0], ["SKIP", 0], ["SKIP", 0],
    ["SKIP", 0], ["SKIP", 0], ["PASS", 0], ["SKIP", 0], ["SKIP", 0],
    ["SKIP", 0], ["SKIP", 0], ["SKIP", 0],
    ["PASS", 0], ["PASS", 0], ["PASS", 0], ["SKIP", 0], ["SKIP", 0],
    ["PASS", 0], ["PASS", 0], ["PASS", 0],
    ["PASS", 0], ["PASS", 0], ["PASS", 0],
  ]);
});

test("every denied read fails while only uncalled dependencies skip and no error data escapes", async () => {
  for (let denied = 0; denied < 24; denied++) {
    const called: number[] = [];
    const result = await runProfileProof(profileArgs, {}, async ({ argv }) => {
      const index = commandIndex(argv);
      called.push(index);
      if (index === denied) {
        throw Object.assign(new Error("YouTrack request failed (HTTP 403). synthetic-private-token"), {
          stderr: "https://private.example.com/private?token=synthetic-token",
          stdout: "synthetic-private-payload",
        });
      }
      return JSON.stringify(responses[index]);
    });
    const skipped = dependentRows(denied);
    assert.deepEqual(called, commands.map((_, index) => index).filter((index) => !skipped.includes(index)));
    assert.equal(result.passed, false);
    assert.equal(result.rows.length, 24);
    assert.deepEqual(result.rows.map((row, index) => row.status),
      commands.map((_, index) => index === denied ? "FAIL" : skipped.includes(index) ? "SKIP" : "PASS"));
    assert.doesNotMatch(JSON.stringify(result) + formatProfileProof(result), /private|token|https:|403/);
  }
});

test("each collection rejects malformed, unsafe or overlarge responses without leaking or following IDs", async () => {
  for (const position of [1, 2, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 18, 19, 20, 21, 22, 23]) {
    for (const invalid of [
      "synthetic-private-payload", "null", "{}", '[{"id":""}]', '[{"id":"--help"}]',
      '[{"id":"synthetic\\nprivate"}]', JSON.stringify(Array(4).fill({ id: "fixture-id" })),
    ]) {
      const called: number[] = [];
      const result = await runProfileProof(profileArgs, {}, async ({ argv }) => {
        const index = commandIndex(argv);
        called.push(index);
        return index === position ? invalid : JSON.stringify(responses[index]);
      });
      const skipped = dependentRows(position);
      assert.equal(called.length, 24 - skipped.length);
      assert.ok(skipped.every((index) => !called.includes(index)));
      assert.equal(result.passed, false);
      assert.equal(result.rows[position]?.status, "FAIL");
      assert.equal(result.rows.length, 24);
      assert.doesNotMatch(JSON.stringify(result) + formatProfileProof(result), /synthetic|private|help/);
    }
  }
});

test("identity, project defaults and selected details require their expected response shape", async () => {
  for (const [position, value] of [
    [0, { id: "fixture-user-id" }],
    [0, { id: "fixture-user-id", login: "" }],
    [1, [{ id: "fixture-project-id" }]],
    [1, [{ id: "fixture-project-id", name: null, shortName: "FIX" }]],
    [3, { id: "different-fixture-id" }],
    [5, { id: "different-fixture-project-id" }],
    [16, null],
    [16, { id: "" }],
    [17, []],
    [17, { id: "--help" }],
  ] as const) {
    const result = await runProfileProof(profileArgs, {}, async ({ argv }) => {
      const index = commandIndex(argv);
      return JSON.stringify(index === position ? value : responses[index]);
    });
    assert.equal(result.passed, false);
    assert.equal(result.rows[position]?.status, "FAIL");
  }
});

test("proof refuses CI and every URL/token/arbitrary command argument before invocation", async () => {
  const neverInvoke = async () => { assert.fail("Refused proof invoked the CLI"); };
  for (const name of ["CI", "GITHUB_ACTIONS", "TF_BUILD", "TEAMCITY_VERSION", "JENKINS_URL", "BUILDKITE", "ci"])
    await assert.rejects(runProfileProof(profileArgs, { [name]: "true" }, neverInvoke), /refuses CI/);
  for (const argv of [[], ["--profile"], ["--profile", "../dev"], ["--profile", "profiles.json"],
    ["--profile", "--json"], ["--profile", "a".repeat(65)], ["--profile", "dev", "--top", "10"],
    ["--profile", "dev", "--url", "https://example.com"], ["--profile", "dev", "--token", "synthetic"],
    ["--profile", "dev", "issues", "create"]]) {
    await assert.rejects(runProfileProof(argv, {}, neverInvoke), /Usage:/);
  }
});

test("zero successful executions cannot pass through dependent skips", async () => {
  const result = await runProfileProof(profileArgs, {}, async () => { throw new Error("synthetic-private"); });
  assert.equal(result.passed, false);
  assert.equal(result.rows.length, 24);
  assert.equal(result.rows.some(row => row.status === "PASS"), false);
  assert.equal(result.rows.filter(row => row.status === "SKIP").length, 11);
  assert.doesNotMatch(formatProfileProof(result), /synthetic|private/);
});
