import assert from "node:assert/strict";
import test from "node:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { TeamCityClient } from "../src/client.js";

const server = setupServer();
const baseUrl = "https://teamcity.test";

const buildFields =
  "id,buildTypeId,number,state,status,statusText,branchName,defaultBranch,personal," +
  "queuedDate,startDate,finishDate,percentageComplete,queuePosition,waitReason,webUrl," +
  "agent(id,name)";

test.before(() => server.listen({ onUnhandledRequest: "error" }));
test.afterEach(() => server.resetHandlers());
test.after(() => server.close());

function client(fetchImplementation?: typeof fetch): TeamCityClient {
  return new TeamCityClient({
    baseUrl,
    token: "fixture-token",
    ...(fetchImplementation === undefined ? {} : { fetch: fetchImplementation }),
  });
}

function assertReadRequest(request: Request): URL {
  assert.equal(request.method, "GET");
  assert.equal(request.headers.get("accept"), "application/json");
  assert.equal(request.headers.get("authorization"), "Bearer fixture-token");
  return new URL(request.url);
}

test("lists operational builds across all branches with bounded filters", async () => {
  server.use(
    http.get(`${baseUrl}/app/rest/builds`, ({ request }) => {
      const url = assertReadRequest(request);
      assert.equal(
        url.searchParams.get("locator"),
        "defaultFilter:false,branch:default:any,buildType:(id:Example_Build)," +
          "affectedProject:(id:Example),state:running,status:FAILURE,start:10,count:5",
      );
      assert.equal(url.searchParams.get("fields"), `build(${buildFields})`);
      return HttpResponse.json({
        build: [
          {
            id: 101,
            buildTypeId: "Example_Build",
            state: "running",
            status: "FAILURE",
            percentageComplete: 40,
            branchName: "feature/fix",
            defaultBranch: false,
            agent: { id: 8, name: "fixture-agent" },
          },
        ],
      });
    }),
  );

  assert.equal(
    (
      await client().listBuilds({
        job: "Example_Build",
        project: "Example",
        state: "running",
        status: "FAILURE",
        limit: 5,
        start: 10,
      })
    )[0]?.id,
    101,
  );
});

test("gets one build by numeric ID", async () => {
  server.use(
    http.get(`${baseUrl}/app/rest/builds/id:101`, ({ request }) => {
      const url = assertReadRequest(request);
      assert.equal(url.searchParams.get("fields"), buildFields);
      return HttpResponse.json({ id: 101, state: "finished", status: "SUCCESS" });
    }),
  );

  assert.deepEqual(await client().getBuild(101), {
    id: 101,
    state: "finished",
    status: "SUCCESS",
  });
});

test("lists build tests with a TeamCity test-status filter", async () => {
  server.use(
    http.get(`${baseUrl}/app/rest/testOccurrences`, ({ request }) => {
      const url = assertReadRequest(request);
      assert.equal(
        url.searchParams.get("locator"),
        "build:(id:101),status:failure,start:2,count:3",
      );
      assert.equal(
        url.searchParams.get("fields"),
        "testOccurrence(id,name,status,duration,ignored,newFailure,muted," +
          "currentlyMuted,currentlyInvestigated,details)",
      );
      return HttpResponse.json({
        testOccurrence: [
          {
            id: "id:fixture-test,build:(id:101)",
            name: "Fixture test",
            status: "FAILURE",
            duration: 15,
            ignored: false,
            newFailure: true,
            muted: false,
          },
        ],
      });
    }),
  );

  assert.equal(
    (await client().listBuildTests(101, { status: "failure", limit: 3, start: 2 }))[0]
      ?.name,
    "Fixture test",
  );
});

test("lists build problems with nested problem summaries", async () => {
  server.use(
    http.get(`${baseUrl}/app/rest/problemOccurrences`, ({ request }) => {
      const url = assertReadRequest(request);
      assert.equal(url.searchParams.get("locator"), "build:(id:101),start:0,count:4");
      assert.equal(
        url.searchParams.get("fields"),
        "problemOccurrence(id,type,identity,newFailure,currentlyMuted," +
          "currentlyInvestigated,logAnchor,details,problem(id,type,identity,description))",
      );
      return HttpResponse.json({
        problemOccurrence: [
          {
            id: "problem:fixture",
            type: "TC_EXIT_CODE",
            identity: "fixture-step",
            newFailure: true,
            problem: {
              id: "fixture",
              type: "TC_EXIT_CODE",
              identity: "fixture-step",
              description: "Fixture process exited with code 1",
            },
          },
        ],
      });
    }),
  );

  assert.equal(
    (await client().listBuildProblems(101, { limit: 4 }))[0]?.problem?.description,
    "Fixture process exited with code 1",
  );
});

test("lists build changes and normalizes TeamCity's commiter spelling", async () => {
  server.use(
    http.get(`${baseUrl}/app/rest/changes`, ({ request }) => {
      const url = assertReadRequest(request);
      assert.equal(url.searchParams.get("locator"), "build:(id:101),start:1,count:2");
      assert.equal(
        url.searchParams.get("fields"),
        "change(id,version,internalVersion,date,commitDate,comment,webUrl," +
          "commiter(vcsUsername))",
      );
      return HttpResponse.json({
        change: [
          {
            id: 55,
            version: "fixture-revision",
            date: "20260829T110000+0200",
            comment: "Fixture change",
            commiter: { vcsUsername: "fixture-author" },
          },
        ],
      });
    }),
  );

  assert.deepEqual(await client().listBuildChanges(101, { limit: 2, start: 1 }), [
    {
      id: 55,
      version: "fixture-revision",
      date: "20260829T110000+0200",
      comment: "Fixture change",
      committer: "fixture-author",
    },
  ]);
});

test("returns empty arrays and validates pagination before fetch", async () => {
  server.use(
    http.get(`${baseUrl}/app/rest/builds`, () => HttpResponse.json({})),
  );
  assert.deepEqual(await client().listBuilds(), []);

  let fetchCalls = 0;
  const countingFetch: typeof fetch = async () => {
    fetchCalls += 1;
    return HttpResponse.json({});
  };
  const isolated = client(countingFetch);
  await assert.rejects(isolated.listBuilds({ limit: 101 }), /between 1 and 100/);
  await assert.rejects(isolated.listBuildTests(101, { start: -1 }), /non-negative/);
  assert.equal(fetchCalls, 0);
});
