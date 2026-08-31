import type { TestContext } from "node:test";
import { createCliFixture } from "@eyeauras/cli-factory/testing";
import { createYouTrackCli } from "../src/cli.js";

export async function fixture(t: TestContext, input = "") {
  const shared = await createCliFixture(t, { applicationId: "youtrack-cli", input });
  const paths: string[] = [];
  const withProfile = shared.appArguments.WithProfile.bind(shared.appArguments);
  shared.appArguments.WithProfile = (name) => {
    const scoped = withProfile(name);
    paths.push(scoped.AppDataDirectory);
    return scoped;
  };
  return {
    ...shared, paths, secrets: shared.secretStore,
    cli: shared.createApplication(createYouTrackCli),
  };
}
