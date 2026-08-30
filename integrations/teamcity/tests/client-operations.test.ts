import assert from "node:assert/strict";
import test from "node:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { TeamCityClient, TeamCityHttpError } from "../src/client.js";

const server = setupServer();
const baseUrl = "https://teamcity.test";

const buildFields =
  "id,buildTypeId,number,state,status,statusText,branchName,defaultBranch,personal," +
  "queuedDate,startDate,finishDate,percentageComplete,queuePosition,waitReason,webUrl," +
  "agent(id,name)";
const agentFields =
  "id,name,connected,enabled,authorized,uptodate,webUrl," +
  "build(id,buildTypeId,number,state,status)";

test.before(() => server.listen({ onUnhandledRequest: "error" }));
test.afterEach(() => server.resetHandlers());
test.after(() => server.close());

function client(): TeamCityClient {
  return new TeamCityClient({ baseUrl, token: "fixture-token" });
}

function assertAuthorization(request: Request): URL {
  assert.equal(request.headers.get("accept"), "application/json");
  assert.equal(request.headers.get("authorization"), "Bearer fixture-token");
  return new URL(request.url);
}

test("lists a bounded queue page with job and direct-project filters", async () => {
  server.use(
    http.get(`${baseUrl}/app/rest/buildQueue`, ({ request }) => {
      const url = assertAuthorization(request);
      assert.equal(request.method, "GET");
      assert.equal(
        url.searchParams.get("locator"),
        "buildType:(id:Example_Build),project:(id:Example),start:6,count:7",
      );
      assert.equal(url.searchParams.get("fields"), `build(${buildFields})`);
      return HttpResponse.json({
        build: [{ id: 201, buildTypeId: "Example_Build", state: "queued", queuePosition: 1 }],
      });
    }),
  );

  assert.equal(
    (
      await client().listQueue({
        job: "Example_Build",
        project: "Example",
        limit: 7,
        start: 6,
      })
    )[0]?.queuePosition,
    1,
  );
});

test("lists all known agents with explicit state filters", async () => {
  server.use(
    http.get(`${baseUrl}/app/rest/agents`, ({ request }) => {
      const url = assertAuthorization(request);
      assert.equal(
        url.searchParams.get("locator"),
        "connected:true,enabled:any,authorized:false,start:0,count:10",
      );
      assert.equal(url.searchParams.get("fields"), `agent(${agentFields})`);
      return HttpResponse.json({
        agent: [
          {
            id: 8,
            name: "fixture-agent",
            connected: true,
            enabled: true,
            authorized: false,
            uptodate: true,
          },
        ],
      });
    }),
  );

  assert.equal(
    (
      await client().listAgents({
        connected: "true",
        authorized: "false",
        limit: 10,
      })
    )[0]?.authorized,
    false,
  );
});

test("gets one agent by numeric ID", async () => {
  server.use(
    http.get(`${baseUrl}/app/rest/agents/id:8`, ({ request }) => {
      const url = assertAuthorization(request);
      assert.equal(url.searchParams.get("fields"), agentFields);
      return HttpResponse.json({
        id: 8,
        name: "fixture-agent",
        connected: true,
        enabled: true,
        authorized: true,
      });
    }),
  );

  assert.equal((await client().getAgent(8)).name, "fixture-agent");
});

test("starts one job with the exact JSON payload", async () => {
  server.use(
    http.post(`${baseUrl}/app/rest/buildQueue`, async ({ request }) => {
      const url = assertAuthorization(request);
      assert.equal(request.headers.get("content-type"), "application/json");
      assert.equal(url.searchParams.get("fields"), buildFields);
      assert.deepEqual(await request.json(), {
        buildType: { id: "Example_Build" },
        branchName: "feature/fix",
        comment: { text: "Fixture request" },
      });
      return HttpResponse.json({ id: 201, buildTypeId: "Example_Build", state: "queued" });
    }),
  );

  assert.equal(
    (
      await client().runJob("Example_Build", {
        branch: "feature/fix",
        comment: "Fixture request",
      })
    ).id,
    201,
  );
});

test("cancels running and queued builds with metadata-preserving POSTs", async () => {
  server.use(
    http.post(`${baseUrl}/app/rest/builds/id:101`, async ({ request }) => {
      const url = assertAuthorization(request);
      assert.equal(url.searchParams.get("fields"), buildFields);
      assert.deepEqual(await request.json(), {
        comment: "Fixture cancellation",
        readdIntoQueue: false,
      });
      return HttpResponse.json({ id: 101, state: "finished", status: "UNKNOWN" });
    }),
    http.post(`${baseUrl}/app/rest/buildQueue/id:201`, async ({ request }) => {
      const url = assertAuthorization(request);
      assert.equal(url.searchParams.get("fields"), buildFields);
      assert.deepEqual(await request.json(), { readdIntoQueue: false });
      return HttpResponse.json({ id: 201, state: "finished", status: "UNKNOWN" });
    }),
  );

  assert.equal(
    (await client().cancelBuild(101, { comment: "Fixture cancellation" })).id,
    101,
  );
  assert.equal((await client().cancelQueuedBuild(201)).id, 201);
});

test("surfaces a remote mutation rejection without the token", async () => {
  server.use(
    http.post(`${baseUrl}/app/rest/builds/id:101`, () =>
      new HttpResponse("Build is already finished", { status: 409 }),
    ),
  );

  await assert.rejects(
    client().cancelBuild(101),
    (error: unknown) =>
      error instanceof TeamCityHttpError &&
      error.status === 409 &&
      error.message === "TeamCity request failed with HTTP 409." &&
      !error.message.includes("fixture-token"),
  );
});
