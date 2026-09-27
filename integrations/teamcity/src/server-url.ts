import { parseServerUrl } from "@eyeauras/cli-factory";

export const teamCityUrlHelp = "TeamCity server URL, such as https://teamcity.example.test or https://example.test/teamcity";

export function teamCityUrl(value: unknown): string {
  const message = "TeamCity URL must be http(s)://host[:port][/context], without /app/rest, a page path, credentials or a query.";
  const url = parseServerUrl(value, message);
  const path = decodeURIComponent(url.pathname);
  if (/\/(?:app\/(?:rest|rest-latest|rest-[^/]+)|guestAuth\/app\/rest|httpAuth\/app\/rest)(?:\/|$)/i.test(path) ||
      /\/[^/]+\.(?:html?|jsp)(?:\/|$)/i.test(path) || /\/(?:buildConfiguration|project|admin)(?:\/|$)/i.test(path)) {
    throw new Error(message);
  }
  return url.href.replace(/\/+$/, "");
}
