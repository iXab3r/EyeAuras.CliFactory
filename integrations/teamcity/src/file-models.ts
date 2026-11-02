import { idPath, integerId } from "./locator.js";
import { object, safeScalars } from "./triage-models.js";
import { collection, integer } from "./system-models.js";
import { credentialAlias } from "./admin-models.js";
import { pathSegment } from "./authoring-models.js";
export type FileTree = "jobs" | "builds" | "instances" | "server";
export type DownloadFormat = "bytes" | "zip" | "png" | "svg";
export const fileFields = "name,size,modificationTime";
export function remotePath(value: string) {
  if (
    !value ||
    value.startsWith("/")
  )
    throw new Error(
      "Expected a nonempty relative remote path without traversal.",
    );
  const parts = value.split("/");
  if (parts.some((p) => !p || p === "." || p === ".."))
    throw new Error("Remote path contains empty/dot segments.");
  return parts.map((p) => encodeURIComponent(p)).join("/");
}
export function treePath(kind: FileTree, id: string) {
  if (kind === "server")
    return "/app/rest/server/files/" + pathSegment(id);
  if (kind === "builds")
    return "/app/rest/builds/id:" + integerId(id, "Build ID") + "/artifacts";
  return kind === "jobs"
    ? "/app/rest/buildTypes/" + idPath(id, "Job ID") + "/vcs/files/latest"
    : "/app/rest/vcs-root-instances/" + idPath(id, "VCS instance ID") + "/files/latest";
}
export function fileQuery(kind: FileTree): Record<string, string> {
  return kind === "builds"
    ? { resolveParameters: "false", logBuildUsage: "false" }
    : kind === "jobs"
      ? { resolveParameters: "false" }
      : {};
}
export const fileLocator = (count: number) =>
  `count:${integer(count, 0, Number.MAX_SAFE_INTEGER)},recursive:false,hidden:false,browseArchives:false`;
export function safeFile(value: unknown) {
  const v = object(value);
  if (typeof v.name !== "string")
    throw new Error("Invalid file metadata.");
  if (v.size !== undefined) integer(v.size, Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
  return safeScalars(v, ["name", "size", "modificationTime"]);
}
export const safeFiles = (v: unknown) => collection(v, "file", safeFile);
export function serverPath(value: string) {
  if (
    !value ||
    !/^(?:[A-Za-z]:[\\/]|\/|\\\\)/.test(value)
  )
    throw new Error("Expected an absolute server path; response omitted.");
  return { serverPath: value };
}
export const referenceKey = (alias: string) => "secure-reference:" + credentialAlias(alias);
export function sensitiveSegment(value: string) {
  if (
    !value ||
    value === "." ||
    value === ".."
  )
    throw new Error("Invalid secure reference; value omitted.");
  return encodeURIComponent(value);
}
