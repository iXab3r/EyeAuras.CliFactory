import type { TestContext } from "node:test";
import { createCliFixture } from "@eyeauras/cli-factory/testing";
import { createTeamCityCli } from "../src/cli.js";

export async function createTestRuntime(
  t: TestContext,
  options: {
    profiles?: Array<{
      name: string;
      url?: string;
      guest?: boolean;
      permissions?: readonly string[];
    }>;
    tokens?: Record<string, string>;
    input?: string;
  } = {},
) {
  const profiles = options.profiles ?? [{ name: "default", url: "https://teamcity.test" }];
  const first = profiles[0];
  if (!first) throw new Error("At least one test profile is required.");
  const fixture = await createCliFixture(t, {
    applicationId: "teamcity-cli",
    defaultProfile: first.name,
    profiles: profiles.map(({ name, permissions, ...values }) => ({
      name, values, ...(permissions === undefined ? {} : { permissions }),
    })),
    ...(options.input === undefined ? {} : { input: options.input }),
  });
  // Keep the existing TeamCity tests' independent profile-store/AppArguments overrides.
  fixture.runtime.profileStore = fixture.profileStore;
  for (const [profile, token] of Object.entries(options.tokens ?? { default: "fixture-token" })) {
    await fixture.secretStore.set("ai-cli-factory:teamcity-cli", `${profile}:token`, token);
  }
  return { ...fixture, createCli: () => fixture.createApplication(createTeamCityCli) };
}
