import assert from "node:assert/strict";
import test from "node:test";
import { TeamCityClient } from "../src/client.js";

const enabled = process.env.TEAMCITY_INTEGRATION === "1";

test(
  "read-only smoke against an explicitly configured TeamCity server",
  { skip: enabled ? false : "Set TEAMCITY_INTEGRATION=1 to run the live smoke test." },
  async () => {
    const baseUrl = process.env.TEAMCITY_URL;
    const token = process.env.TEAMCITY_TOKEN;
    assert.ok(baseUrl, "TEAMCITY_URL is required when TEAMCITY_INTEGRATION=1.");
    assert.ok(token, "TEAMCITY_TOKEN is required when TEAMCITY_INTEGRATION=1.");

    const client = new TeamCityClient({ baseUrl, token });
    const [user, server, projects, jobs, builds, queue, agents] = await Promise.all([
      client.currentUser(),
      client.getServerStatus(),
      client.listProjects({ limit: 1 }),
      client.listJobs({ limit: 1 }),
      client.listBuilds({ limit: 1 }),
      client.listQueue({ limit: 1 }),
      client.listAgents({ limit: 1 }),
    ]);

    assert.equal(typeof user.username, "string");
    assert.equal(typeof server.version, "string");
    for (const page of [projects, jobs, builds, queue, agents]) {
      assert.ok(page.length <= 1);
    }
  },
);
