import assert from "node:assert/strict";
import test from "node:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { TeamCityClient, TeamCityHttpError } from "../src/client.js";

const server = setupServer();
const baseUrl = "https://teamcity.test";
const token = "fixture-token";

const buildFields =
  "id,buildTypeId,number,state,status,statusText,branchName,defaultBranch,personal," +
  "queuedDate,startDate,finishDate,percentageComplete,queuePosition,waitReason,webUrl," +
  "agent(id,name)";

test.before(() => server.listen({ onUnhandledRequest: "error" }));
test.afterEach(() => server.resetHandlers());
test.after(() => server.close());

function client(): TeamCityClient {
  return new TeamCityClient({ baseUrl, token });
}

function assertReadRequest(request: Request): URL {
  assert.equal(request.method, "GET");
  assert.equal(request.headers.get("accept"), "application/json");
  assert.equal(request.headers.get("authorization"), `Bearer ${token}`);
  assert.equal(request.headers.get("content-type"), null);
  return new URL(request.url);
}

test("validates authentication with a minimal current-user response", async () => {
  server.use(
    http.get(`${baseUrl}/app/rest/users/current`, ({ request }) => {
      const url = assertReadRequest(request);
      assert.equal(url.searchParams.get("fields"), "id,username,name,email");
      return HttpResponse.json({ id: 7, username: "fixture-user", name: "Fixture User" });
    }),
  );

  assert.deepEqual(await client().currentUser(), {
    id: 7,
    username: "fixture-user",
    name: "Fixture User",
  });
});

test("gets the bounded server status", async () => {
  server.use(
    http.get(`${baseUrl}/app/rest/server`, ({ request }) => {
      const url = assertReadRequest(request);
      assert.equal(
        url.searchParams.get("fields"),
        "version,versionMajor,versionMinor,buildNumber,startTime,currentTime,role,webUrl",
      );
      return HttpResponse.json({
        version: "2026.1.3 (build 222742)",
        versionMajor: 2026,
        versionMinor: 1,
        buildNumber: "222742",
        startTime: "20260829T100000+0200",
        currentTime: "20260829T120000+0200",
        role: "main_node",
        webUrl: baseUrl,
      });
    }),
  );

  assert.equal((await client().getServerStatus()).buildNumber, "222742");
});

test("guest access uses TeamCity's guestAuth REST path without an Authorization header", async () => {
  server.use(
    http.get(`${baseUrl}/guestAuth/app/rest/server`, ({ request }) => {
      assert.equal(request.headers.get("authorization"), null);
      return HttpResponse.json({
        version: "2026.2 EAP",
        buildNumber: "238763",
        webUrl: baseUrl,
      });
    }),
  );

  const guestClient = new TeamCityClient({ baseUrl, guest: true });
  assert.equal((await guestClient.getServerStatus()).buildNumber, "238763");
});

test("lists a bounded page of active child projects", async () => {
  server.use(
    http.get(`${baseUrl}/app/rest/projects`, ({ request }) => {
      const url = assertReadRequest(request);
      assert.equal(
        url.searchParams.get("locator"),
        "project:(id:Parent),archived:false,start:3,count:2",
      );
      assert.equal(
        url.searchParams.get("fields"),
        "project(id,name,parentProjectId,archived,description,webUrl)",
      );
      return HttpResponse.json({
        project: [
          {
            id: "Child",
            name: "Child project",
            parentProjectId: "Parent",
            archived: false,
          },
        ],
      });
    }),
  );

  assert.deepEqual(
    await client().listProjects({ parent: "Parent", limit: 2, start: 3 }),
    [
      {
        id: "Child",
        name: "Child project",
        parentProjectId: "Parent",
        archived: false,
      },
    ],
  );
});

test("gets one project by stable external ID", async () => {
  server.use(
    http.get(`${baseUrl}/app/rest/projects/id:Example`, ({ request }) => {
      const url = assertReadRequest(request);
      assert.equal(
        url.searchParams.get("fields"),
        "id,name,parentProjectId,archived,description,webUrl",
      );
      return HttpResponse.json({ id: "Example", name: "Example", archived: false });
    }),
  );

  assert.deepEqual(await client().getProject("Example"), {
    id: "Example",
    name: "Example",
    archived: false,
  });
});

test("lists non-template jobs with direct-project pagination", async () => {
  server.use(
    http.get(`${baseUrl}/app/rest/buildTypes`, ({ request }) => {
      const url = assertReadRequest(request);
      assert.equal(
        url.searchParams.get("locator"),
        "templateFlag:false,project:(id:Example),start:4,count:5",
      );
      assert.equal(
        url.searchParams.get("fields"),
        "buildType(id,name,projectId,projectName,paused,description,webUrl)",
      );
      return HttpResponse.json({
        buildType: [
          {
            id: "Example_Build",
            name: "Build",
            projectId: "Example",
            projectName: "Example project",
            paused: false,
          },
        ],
      });
    }),
  );

  assert.equal(
    (await client().listJobs({ project: "Example", limit: 5, start: 4 }))[0]?.id,
    "Example_Build",
  );
});

test("gets one job with its documented minimal fields", async () => {
  server.use(
    http.get(`${baseUrl}/app/rest/buildTypes/id:Example_Build`, ({ request }) => {
      const url = assertReadRequest(request);
      assert.equal(
        url.searchParams.get("fields"),
        "id,name,projectId,projectName,paused,description,webUrl",
      );
      return HttpResponse.json({
        id: "Example_Build",
        name: "Build",
        projectId: "Example",
        projectName: "Example project",
        paused: false,
        description: "Builds the fixture",
      });
    }),
  );

  assert.equal((await client().getJob("Example_Build")).description, "Builds the fixture");
});

test("jobs status requests the real latest build without TeamCity default filtering", async () => {
  server.use(
    http.get(`${baseUrl}/app/rest/builds`, ({ request }) => {
      const url = assertReadRequest(request);
      assert.equal(
        url.searchParams.get("locator"),
        "buildType:(id:Example_Build),defaultFilter:false,branch:default:any,count:1",
      );
      assert.equal(url.searchParams.get("fields"), `build(${buildFields})`);
      return HttpResponse.json({
        build: [
          {
            id: 42,
            buildTypeId: "Example_Build",
            number: "42",
            state: "finished",
            status: "FAILURE",
            branchName: "feature/fix",
            defaultBranch: false,
          },
        ],
      });
    }),
  );

  assert.deepEqual(await client().getJobStatus("Example_Build"), {
    jobId: "Example_Build",
    latestBuild: {
      id: 42,
      buildTypeId: "Example_Build",
      number: "42",
      state: "finished",
      status: "FAILURE",
      branchName: "feature/fix",
      defaultBranch: false,
    },
  });
});

test("reports HTTP and malformed-JSON failures without exposing credentials", async () => {
  server.use(
    http.get(`${baseUrl}/app/rest/users/current`, () =>
      new HttpResponse(`Unauthorized bearer ${token}`, { status: 401 }),
    ),
  );

  await assert.rejects(
    client().currentUser(),
    (error: unknown) =>
      error instanceof TeamCityHttpError &&
      error.status === 401 &&
      !error.message.includes(token),
  );

  server.use(
    http.get(`${baseUrl}/app/rest/projects/id:Missing`, () =>
      new HttpResponse("Project was not found", { status: 404 }),
    ),
  );
  await assert.rejects(
    client().getProject("Missing"),
    (error: unknown) =>
      error instanceof TeamCityHttpError &&
      error.status === 404 &&
      error.message === "TeamCity request failed with HTTP 404.",
  );

  server.use(
    http.get(`${baseUrl}/app/rest/buildTypes/id:Forbidden`, () =>
      new HttpResponse("Insufficient permissions", { status: 403 }),
    ),
  );
  await assert.rejects(
    client().getJob("Forbidden"),
    (error: unknown) => error instanceof TeamCityHttpError && error.status === 403,
  );

  server.use(
    http.get(`${baseUrl}/app/rest/server`, () =>
      new HttpResponse("not-json", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );

  await assert.rejects(client().getServerStatus(), /not valid JSON/i);
});
