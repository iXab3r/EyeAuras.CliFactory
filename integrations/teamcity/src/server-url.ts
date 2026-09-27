import { parseServerUrl } from "@eyeauras/cli-factory";

export const teamCityUrlHelp = "TeamCity base URL including any context path, without /app/rest or a page URL; e.g. https://teamcity.example.test/ or https://example.test/teamcity/. Outer whitespace and trailing slashes are normalized";

export function teamCityUrl(value: unknown): string {
  const message = "TeamCity URL must be an HTTP or HTTPS base server URL without credentials, query or fragment. " + teamCityUrlHelp;
  const url = parseServerUrl(value, message);
  const path = decodeURIComponent(url.pathname);
  if (/\/(?:app\/(?:rest|rest-latest|rest-[^/]+)|guestAuth\/app\/rest|httpAuth\/app\/rest)(?:\/|$)/i.test(path) ||
      /\/[^/]+\.(?:html?|jsp)(?:\/|$)/i.test(path) || /\/(?:buildConfiguration|project|admin)(?:\/|$)/i.test(path)) {
    throw new Error(message);
  }
  return url.href.replace(/\/+$/, "");
}
