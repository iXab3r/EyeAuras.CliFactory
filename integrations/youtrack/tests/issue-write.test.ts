import assert from "node:assert/strict";
import { after, afterEach, before, test } from "node:test";
import { createCliFixture } from "@eyeauras/cli-factory/testing";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createYouTrackCli } from "../src/cli.js";
import { createIssue, updateIssue } from "../src/issue-fields.js";

const server = setupServer();
before(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
after(() => server.close());
const connection = { baseUrl: "https://youtrack.example.com/context/", token: "synthetic-token" };
const writeFields = "id,idReadable,summary,updated";

/** Answer GET routes from a table and record every request; POST bodies are captured. */
function serve(gets: Record<string, unknown>, post: () => Response = () => HttpResponse.json({ id: "2-1" })) {
  const calls: string[] = [];
  const bodies: unknown[] = [];
  server.use(http.all("*", async ({ request }) => {
    const url = new URL(request.url);
    const call = `${request.method} ${url.pathname}?${decodeURIComponent(url.searchParams.toString())}`;
    calls.push(call);
    assert.equal(request.headers.get("authorization"), "Bearer synthetic-token");
    if (request.method === "POST") {
      bodies.push(await request.json());
      return post();
    }
    const value = gets[call];
    return value === undefined ? new HttpResponse(null, { status: 404 }) : HttpResponse.json(value);
  }));
  return { calls, bodies };
}

const projectLookup = "GET /context/api/admin/projects/DEMO?fields=id,shortName";
const projectFields = "GET /context/api/admin/projects/0-1/customFields?fields=id,field(name)&$top=50&$skip=0";
const issueFields = "GET /context/api/issues/DEMO-1/customFields?fields=id,name&$top=50&$skip=0";

test("create resolves shortName and field names, then satisfies required fields in one typed POST", async () => {
  const { calls, bodies } = serve({
    [projectLookup]: { id: "0-1", shortName: "demo" },
    [projectFields]: [
      { id: "92-1", field: { name: "Priority" } },
      { id: "92-2", field: { name: "Assignee" } },
      { id: "92-3", field: null },
    ],
  });
  assert.deepEqual(await createIssue(connection, {
    project: { shortName: "DEMO" },
    summary: "Summary",
    description: "Line one\n\nLine two",
    customFields: [
      { $type: "SingleEnumIssueCustomField", name: "Priority", value: { name: "Critical" } },
      { $type: "SingleUserIssueCustomField", name: "Assignee", value: { login: "fixture-user" } },
      { $type: "DateIssueCustomField", id: "92-9", value: 1_700_000_000_000 },
    ],
  }), { id: "2-1" });
  assert.deepEqual(calls, [projectLookup, projectFields, `POST /context/api/issues?fields=${writeFields}`]);
  assert.deepEqual(bodies, [{
    project: { id: "0-1" },
    summary: "Summary",
    description: "Line one\n\nLine two",
    customFields: [
      { $type: "SingleEnumIssueCustomField", id: "92-1", value: { name: "Critical" } },
      { $type: "SingleUserIssueCustomField", id: "92-2", value: { login: "fixture-user" } },
      { $type: "DateIssueCustomField", id: "92-9", value: 1_700_000_000_000 },
    ],
  }]);
});

test("exact IDs use exactly one POST without discovery; update clears, sets multi and owned values", async () => {
  const { calls, bodies } = serve({ [issueFields]: [{ id: "1-2", name: "Subsystem" }] });
  await createIssue(connection, {
    project: { id: "0-1" }, summary: "Summary",
    customFields: [{ $type: "SingleEnumIssueCustomField", id: "92-1", value: { id: "67-1" } }],
  });
  await updateIssue(connection, "DEMO-1", {
    summary: "Changed", description: null,
    customFields: [
      { $type: "MultiEnumIssueCustomField", id: "1-1", value: [] },
      { $type: "SingleOwnedIssueCustomField", name: "Subsystem", value: { name: "UI" } },
      { $type: "PeriodIssueCustomField", id: "1-3", value: null },
      { $type: "MultiUserIssueCustomField", id: "1-4", value: [{ login: "a" }, { id: "1-9" }] },
    ],
  });
  assert.deepEqual(calls, [
    `POST /context/api/issues?fields=${writeFields}`,
    issueFields,
    `POST /context/api/issues/DEMO-1?fields=${writeFields}`,
  ]);
  assert.deepEqual(bodies[1], {
    summary: "Changed", description: null,
    customFields: [
      { $type: "MultiEnumIssueCustomField", id: "1-1", value: [] },
      { $type: "SingleOwnedIssueCustomField", id: "1-2", value: { name: "UI" } },
      { $type: "PeriodIssueCustomField", id: "1-3", value: null },
      { $type: "MultiUserIssueCustomField", id: "1-4", value: [{ login: "a" }, { id: "1-9" }] },
    ],
  });
});

test("invalid bodies fail locally and unresolved selectors fail before any POST", async () => {
  const local = {
    ...connection,
    fetch: (async () => assert.fail("Invalid body reached fetch")) as typeof globalThis.fetch,
  };
  const field = { $type: "SingleEnumIssueCustomField", name: "Priority", value: { name: "Major" } };
  for (const body of [
    { project: { id: "0-1", shortName: "DEMO" }, summary: "S" },
    { project: {}, summary: "S" },
    { project: { id: "0-1" }, summary: "S", customFields: [] },
    { project: { id: "0-1" }, summary: "S", customFields: [{ ...field, id: "92-1" }] },
    { project: { id: "0-1" }, summary: "S", customFields: [{ $type: field.$type, value: field.value }] },
    { project: { id: "0-1" }, summary: "S", customFields: [{ $type: field.$type, name: "Priority" }] },
    { project: { id: "0-1" }, summary: "S", customFields: [{ ...field, event: { id: "start" } }] },
    { project: { id: "0-1" }, summary: "S", customFields: [{ $type: "StateMachineIssueCustomField", id: "1-1", value: null }] },
    { project: { id: "0-1" }, summary: "S", customFields: [{ $type: "UnknownIssueCustomField", id: "1-1", value: null }] },
  ]) await assert.rejects(createIssue(local, body), /YouTrack/);
  await assert.rejects(updateIssue(local, "DEMO-1", { customFields: [{ ...field, value: [] }] }), /YouTrack/);

  const cases: [Record<string, unknown>, unknown, RegExp][] = [
    [{ [projectLookup]: { id: "0-9", shortName: "OTHER" } }, { project: { shortName: "DEMO" }, summary: "S" }, /did not resolve/],
    [{}, { project: { shortName: "DEMO" }, summary: "S" }, /HTTP 404/],
    [{ [projectFields]: [{ id: "92-1", field: { name: "Priority " } }] },
      { project: { id: "0-1" }, summary: "S", customFields: [field] }, /match exactly one field/],
    [{ [projectFields]: [{ id: "92-1", field: { name: "Priority" } }, { id: "92-2", field: { name: "Priority" } }] },
      { project: { id: "0-1" }, summary: "S", customFields: [field] }, /match exactly one field/],
    [{ [projectFields]: [{ id: "92-1", field: { name: "Priority" } }] },
      { project: { id: "0-1" }, summary: "S", customFields: [field, { ...field, name: undefined, id: "92-1" }] },
      /must not repeat a field/],
  ];
  for (const [gets, body, error] of cases) {
    const { calls } = serve(gets);
    await assert.rejects(createIssue(connection, JSON.parse(JSON.stringify(body))), error);
    assert.ok(calls.every((call) => call.startsWith("GET ")), "A failed selector reached the write.");
  }
});

test("CLI selector resolution and the write stay inside the selected profile", async (t) => {
  const f = await createCliFixture(t, {
    applicationId: "youtrack-cli",
    profiles: [
      { name: "default", values: { url: "https://uat.example.com/yt" }, permissions: ["ReadOnly", "Update"],
        secrets: { token: "synthetic-uat" } },
      { name: "prod", values: { url: "https://prod.example.com/yt" }, permissions: ["ReadOnly", "Update"],
        secrets: { token: "synthetic-prod" } },
    ],
  });
  const cli = f.createApplication(createYouTrackCli);
  const seen: string[] = [];
  server.use(http.all("*", ({ request }) => {
    const url = new URL(request.url);
    seen.push(`${url.host} ${request.headers.get("authorization")} ${request.method} ${url.pathname}`);
    if (url.pathname.endsWith("/projects/DEMO")) return HttpResponse.json({ id: "0-1", shortName: "DEMO" });
    if (url.pathname.endsWith("/customFields")) return HttpResponse.json([{ id: "92-1", field: { name: "Priority" } }]);
    return HttpResponse.json({ id: "2-1", idReadable: "DEMO-1" });
  }));
  const body = JSON.stringify({
    project: { shortName: "DEMO" }, summary: "S",
    customFields: [{ $type: "SingleEnumIssueCustomField", name: "Priority", value: { name: "Major" } }],
  });
  for (const [profile, host, token] of [["prod", "prod.example.com", "synthetic-prod"], ["default", "uat.example.com", "synthetic-uat"]]) {
    seen.length = 0;
    assert.deepEqual(await cli.execute(["issues", "create", "--body", body, "--profile", profile!]), { id: "2-1", idReadable: "DEMO-1" });
    assert.deepEqual(seen, [
      `${host} Bearer ${token} GET /yt/api/admin/projects/DEMO`,
      `${host} Bearer ${token} GET /yt/api/admin/projects/0-1/customFields`,
      `${host} Bearer ${token} POST /yt/api/issues`,
    ]);
  }
});
