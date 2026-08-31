import { type CliDefinition, type CliRuntime } from "@eyeauras/cli-factory";
import {
  BrowserRuntime,
  browserCommandOptions,
  browserOperationOptions,
} from "@eyeauras/cli-factory-playwright";
import {
  createRandomCommands,
  randomProfile,
  RandomProfiles,
  serviceUrl,
  contactEmail,
} from "@eyeauras/random-common";
import { RandomBrowserClient } from "./client.js";

export function createRandomPwDefinition(
  runtime?: CliRuntime,
  browser: BrowserRuntime = new BrowserRuntime(),
): CliDefinition {
  const profiles = new RandomProfiles();
  return {
    name: "random-pw-cli",
    version: "0.1.0",
    description: "Small anonymous RANDOM.ORG client using real browser forms",
    concurrency: 1,
    permissions: {},
    resources: [browser, profiles],
    profile: randomProfile,
    ...(runtime === undefined ? {} : { runtime }),
    commands: createRandomCommands(
      (context, options) =>
        new RandomBrowserClient(
          browser,
          {
            appArguments: context.appArguments,
            baseURL: serviceUrl(context.profile.values.url).href,
            userAgent: `random-pw-cli/0.1.0 (${contactEmail(context.profile.values.contact)})`,
          },
          browserOperationOptions(options, context),
          profiles.for(context),
        ),
      browserCommandOptions,
    ),
  };
}
