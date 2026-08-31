import type { ProfileDefinition } from "@eyeauras/cli-factory";
import { contactEmail, serviceUrl } from "./validation.js";

export const randomProfile: ProfileDefinition = {
  defaults: { url: "https://www.random.org" },
  fields: [
    {
      name: "url",
      flags: "--url <url>",
      description: "RANDOM.ORG HTTPS origin",
      required: true,
    },
    {
      name: "contact",
      flags: "--contact <email>",
      description: "Operator email for the service User-Agent",
      required: true,
    },
  ],
  validate(values) {
    serviceUrl(values.url);
    if (values.contact !== undefined && values.contact !== "")
      contactEmail(values.contact);
  },
};
