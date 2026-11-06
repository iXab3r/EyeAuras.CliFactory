import type { TestContext } from "node:test";
import { createCliFixture } from "@eyeauras/cli-factory/testing";
import { createYouTrackCli } from "../src/cli.js";

export async function fixture(t: TestContext, input = "") {
  const shared = await createCliFixture(t, { applicationId: "youtrack-cli", input });
  return wrapFixture(shared);
}

export async function configuredFixture(
  t: TestContext,
  options: {
    name?: string;
    url?: string;
    token?: string;
    permissions?: readonly string[];
    input?: string;
  } = {},
) {
  const name = options.name ?? "dev";
  const shared = await createCliFixture(t, {
    applicationId: "youtrack-cli",
    defaultProfile: name,
    profiles: [{
      name,
      values: { url: options.url ?? "https://youtrack.example.com/context" },
      ...(options.permissions === undefined ? {} : { permissions: options.permissions }),
      secrets: { token: options.token ?? "synthetic-token" },
    }],
    input: options.input ?? "",
  });
  return wrapFixture(shared);
}

function wrapFixture(shared: Awaited<ReturnType<typeof createCliFixture>>) {
  const paths: string[] = [];
  const withProfile = shared.appArguments.WithProfile.bind(shared.appArguments);
  shared.appArguments.WithProfile = (name) => {
    const scoped = withProfile(name);
    paths.push(scoped.AppDataDirectory);
    return scoped;
  };
  return {
    ...shared, paths, secrets: shared.secretStore,
    cli: (() => {
      const cli = shared.createApplication(createYouTrackCli);
      const run = cli.run.bind(cli);
      const execute = cli.execute.bind(cli);
      cli.run = (argv, invocation) => run(argv, { ...invocation, cwd: shared.root });
      // execute captures cwd synchronously, before starting asynchronous command work.
      cli.execute = (argv, signal) => {
        const previous = process.cwd();
        try { process.chdir(shared.root); return execute(argv, signal); }
        finally { process.chdir(previous); }
      };
      return cli;
    })(),
  };
}
