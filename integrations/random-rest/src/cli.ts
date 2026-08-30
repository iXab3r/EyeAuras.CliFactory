import { createCli, type CliApplication, type CliRuntime } from "@eyeauras/cli-factory";
import { RandomHttpClient } from "./client.js";
import { createRandomCommands } from "./commands.js";
import { contactEmail, serviceUrl } from "./validation.js";

export function createRandomRestCli(runtime?: CliRuntime): CliApplication {
  const clients = new Map<string, { url: string; contact: string; client: RandomHttpClient }>();
  return createCli({
    name: "random-rest-cli",
    applicationId: "random-rest-cli",
    version: "0.1.0",
    description: "Small anonymous RANDOM.ORG client using its older HTTP interface",
    permissions: {},
    profile: {
      defaults: { url: "https://www.random.org" },
      fields: [
        { name: "url", flags: "--url <url>", description: "RANDOM.ORG HTTPS origin", required: true },
        { name: "contact", flags: "--contact <email>", description: "Operator email for the service User-Agent", required: true },
      ],
      validate(values) {
        serviceUrl(values.url);
        if (values.contact !== undefined && values.contact !== "") contactEmail(values.contact);
      },
    },
    commands: createRandomCommands((context) => {
      const url = serviceUrl(context.profile.values.url).href;
      const contact = contactEmail(context.profile.values.contact);
      let cached = clients.get(context.profile.name);
      if (!cached || cached.url !== url || cached.contact !== contact) {
        cached = { url, contact, client: new RandomHttpClient({ url, contact, fetch: context.fetch }) };
        clients.set(context.profile.name, cached);
      }
      return cached.client;
    }),
    ...(runtime === undefined ? {} : { runtime }),
  });
}
