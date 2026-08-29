import assert from "node:assert/strict";
import { Readable, Writable } from "node:stream";
import test from "node:test";
import {
  MemorySecretStore,
  type ProfileStoreContract,
} from "@eyeauras/cli-factory";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { TeamCityClient, TeamCityHttpError } from "../src/client.js";
import { createTeamCityCli } from "../src/cli.js";

const server = setupServer();

test.before(() => server.listen({ onUnhandledRequest: "error" }));
test.afterEach(() => server.resetHandlers());
test.after(() => server.close());

test("lists jobs using bearer authentication and the requested locator", async () => {
  server.use(
    http.get("https://teamcity.test/app/rest/buildTypes", ({ request }) => {
      assert.equal(request.headers.get("authorization"), "Bearer test-token");
      const url = new URL(request.url);
      assert.equal(url.searchParams.get("locator"), "project:(id:Example),count:5");
      return HttpResponse.json({
        count: 1,
        buildType: [
          {
            id: "Example_Build",
            name: "Build",
            projectId: "Example",
            projectName: "Example project",
            paused: false,
            webUrl: "https://teamcity.test/buildConfiguration/Example_Build",
          },
        ],
      });
    }),
  );
  const client = new TeamCityClient({
    baseUrl: "https://teamcity.test/",
    token: "test-token",
  });

  assert.deepEqual(await client.listJobs({ project: "Example", limit: 5 }), [
    {
      id: "Example_Build",
      name: "Build",
      projectId: "Example",
      projectName: "Example project",
      paused: false,
      webUrl: "https://teamcity.test/buildConfiguration/Example_Build",
    },
  ]);
});

test("returns a null latest build when a job has never run", async () => {
  server.use(
    http.get("https://teamcity.test/app/rest/builds", () =>
      HttpResponse.json({ count: 0, build: [] }),
    ),
  );
  const client = new TeamCityClient({ baseUrl: "https://teamcity.test", token: "test-token" });

  assert.deepEqual(await client.getJobStatus("Example_Build"), {
    jobId: "Example_Build",
    latestBuild: null,
  });
});

test("reports HTTP failures without including the credential", async () => {
  server.use(
    http.get("https://teamcity.test/app/rest/users/current", () =>
      new HttpResponse("Unauthorized", { status: 401 }),
    ),
  );
  const client = new TeamCityClient({ baseUrl: "https://teamcity.test", token: "secret-token" });

  await assert.rejects(
    client.currentUser(),
    (error: unknown) =>
      error instanceof TeamCityHttpError &&
      error.status === 401 &&
      !error.message.includes("secret-token"),
  );
});

test("the CLI command tree renders a mocked service response as JSON", async () => {
  server.use(
    http.get("https://teamcity.test/app/rest/buildTypes", () =>
      HttpResponse.json({
        count: 1,
        buildType: [
          {
            id: "Example_Build",
            name: "Build",
            projectId: "Example",
            projectName: "Example project",
            paused: false,
          },
        ],
      }),
    ),
  );
  const profileStore: ProfileStoreContract = {
    async get(name = "default") {
      return { name, values: { url: "https://teamcity.test" } };
    },
    async list() {
      return {
        active: "default",
        profiles: [{ name: "default", values: { url: "https://teamcity.test" } }],
      };
    },
    async set(name, values) {
      return { name, values };
    },
    async use(name) {
      return { name, values: { url: "https://teamcity.test" } };
    },
    async getPermissions() {
      return undefined;
    },
    async setPermissions(_name, permissions) {
      return [...permissions];
    },
  };
  const secretStore = new MemorySecretStore();
  await secretStore.set("ai-cli-factory:teamcity-cli", "default:token", "test-token");
  let stdout = "";
  let stderr = "";
  const cli = createTeamCityCli({
    input: Readable.from([]),
    output: new Writable({
      write(chunk, _encoding, callback) {
        stdout += chunk.toString();
        callback();
      },
    }),
    error: new Writable({
      write(chunk, _encoding, callback) {
        stderr += chunk.toString();
        callback();
      },
    }),
    profileStore,
    secretStore,
  });

  assert.equal(await cli.run(["jobs", "list", "--json"]), 0);
  assert.deepEqual(JSON.parse(stdout), [
    {
      id: "Example_Build",
      name: "Build",
      projectId: "Example",
      projectName: "Example project",
      paused: false,
    },
  ]);
  assert.equal(stderr, "");
});
