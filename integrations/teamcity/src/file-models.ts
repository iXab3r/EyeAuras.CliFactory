import { idPath, positiveId } from "./locator.js";
import { allowedField } from "./advanced-authoring-models.js";
import { object, safeScalars } from "./triage-models.js";
import { collection, integer } from "./system-models.js";
import { credentialAlias } from "./admin-models.js";
export type FileTree = "jobs" | "builds" | "instances" | "server";
export type DownloadFormat = "bytes" | "zip" | "png" | "svg";
export const fileFields = "name,size,modificationTime";
export function remotePath(value: string) {
  if (
    !value ||
    value.length > 2048 ||
    /[\\%:\u0000-\u001f\u007f]/.test(value) ||
    value.startsWith("/")
  )
    throw new Error(
      "Expected a nonempty relative remote path, without traversal or encoded segments.",
    );
  const parts = value.split("/");
  if (parts.some((p) => !p || p === "." || p === ".."))
    throw new Error("Remote path contains empty/dot segments.");
  return parts.map((p) => encodeURIComponent(p)).join("/");
}
export function treePath(kind: FileTree, id: string) {
  if (kind === "server")
    return "/app/rest/server/files/" + allowedField(id, ["logs", "backups", "dataDirectory"]);
  if (kind === "builds")
    return "/app/rest/builds/id:" + positiveId(Number(id), "Build ID") + "/artifacts";
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
  `count:${integer(count, 1, 100)},recursive:false,hidden:false,browseArchives:false`;
export function safeFile(value: unknown) {
  const v = object(value);
  if (typeof v.name !== "string" || /[\u0000-\u001f]/.test(v.name))
    throw new Error("Invalid file metadata.");
  if (v.size !== undefined) integer(v.size, 0, Number.MAX_SAFE_INTEGER);
  return safeScalars(v, ["name", "size", "modificationTime"]);
}
export const safeFiles = (v: unknown) => collection(v, "file", safeFile);
export function serverPath(value: string) {
  if (
    !value ||
    value.length > 8192 ||
    /[\u0000-\u001f\u007f]/.test(value) ||
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
    value === ".." ||
    value.length > 8192 ||
    /[\u0000-\u001f]/.test(value)
  )
    throw new Error("Invalid secure reference; value omitted.");
  return encodeURIComponent(value);
}
