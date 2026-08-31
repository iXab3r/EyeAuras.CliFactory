import { type CliDefinition, type CliRuntime } from "@eyeauras/cli-factory";
import {
  createRandomCommands,
  randomProfile,
  RandomProfiles,
  serviceUrl,
  contactEmail,
} from "@eyeauras/random-common";
import { RandomHttpClient } from "./client.js";

export function createRandomRestDefinition(
  runtime?: CliRuntime,
): CliDefinition {
  const profiles = new RandomProfiles();
  return {
    name: "random-rest-cli",
    version: "0.1.0",
    description:
      "Small anonymous RANDOM.ORG client using its older HTTP interface",
    permissions: {},
    concurrency: 1,
    resources: [profiles],
    profile: randomProfile,
    commands: createRandomCommands(
      (context) =>
        new RandomHttpClient({
          url: serviceUrl(context.profile.values.url).href,
          contact: contactEmail(context.profile.values.contact),
          fetch: context.fetch,
          state: profiles.for(context),
        }),
    ),
    ...(runtime === undefined ? {} : { runtime }),
  };
}
