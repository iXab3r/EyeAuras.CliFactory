import { parseServerUrl } from "@eyeauras/cli-factory";

export const teamCityUrlHelp = "Set URL: http(s)://host[:port][/context]";

export function teamCityUrl(value: unknown): string {
  const message = "TeamCity URL must be http(s)://host[:port][/context], without credentials, a query or a fragment.";
  const url = parseServerUrl(value, message);
  return url.href.replace(/\/+$/, "");
}
