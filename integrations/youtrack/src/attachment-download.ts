import { diagnosticCause, fetchWithRedirects, ProfileFileError, publishProfileFile } from "@eyeauras/cli-factory";
import {
  encodedID,
  getAttachmentDownloadMetadata,
  issuePath,
  type Connection,
  youTrackUrl,
} from "./client.js";

export interface DownloadOptions {
  name?: string;
  maxBytes?: number;
  /** One human-only line when the transfer starts. */
  progress?: (message: string) => void;
}

export interface AttachmentDownloadResult {
  id: string;
  name: string;
  path: string;
  bytes: number;
  contentType: string;
}

class DownloadError extends ProfileFileError {}

export function downloadName(value: string): string {
  if (!value || value === "." || value === ".." ||
      /[<>:"/\\|?*\u0000-\u001f\u007f-\u009f\p{Cf}]/u.test(value) || /[. ]$/.test(value) ||
      /^(?:con|prn|aux|nul|conin\$|conout\$|clock\$|com[1-9¹²³]|lpt[1-9¹²³])(?:[ .]|$)/i.test(value)) {
    throw new Error("The file name must be one safe basename without reserved characters.");
  }
  return value;
}

export function downloadLimit(value: number | string): number {
  const number = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  if (typeof number !== "number" || !Number.isSafeInteger(number) || number < 1) {
    throw new Error("--max-bytes must be a positive integer.");
  }
  return number;
}

function attachmentUrl(connection: Connection, value: string): { url: URL; secrets: string[] } {
  const invalid = new DownloadError(
    "The attachment URL must point at the profile's YouTrack origin; external downloads are not followed.",
  );
  try {
    if (/[\\\u0000-\u0020\u007f]/.test(value) || value.includes("#")) {
      throw invalid;
    }
    const base = new URL(youTrackUrl(connection.baseUrl));
    const rawPath = value.split("?", 1)[0]!;
    const originPath = rawPath.replace(/^(?:https?:)?\/\/[^/]*/, "");
    const prefix = originPath.startsWith("/") ? `${base.pathname}api/files/` : "api/files/";
    if (!originPath.startsWith(prefix)) {
      throw invalid;
    }
    const segments = originPath.slice(prefix.length).split("/");
    const fileID = decodeURIComponent(segments[0] ?? "");
    if (!fileID || fileID === "." || fileID === ".." || /[/\\%?#\u0000-\u0020\u007f]/.test(fileID) ||
        segments.length > 2 || (segments.length === 2 && !/^sign=.+$/.test(segments[1]!))) {
      throw invalid;
    }
    const url = new URL(value, base);
    if (url.origin !== base.origin || url.protocol !== base.protocol || url.username || url.password || url.hash ||
        !url.pathname.startsWith(`${base.pathname}api/files/`)) {
      throw invalid;
    }
    const pathSignature = segments[1]?.slice(5);
    const querySignatures = url.search.slice(1).split("&")
      .filter((part) => part && part.split("=", 1)[0] !== "updated")
      .map((part) => part.slice(part.indexOf("=") + 1));
    const signatures = [
      ...(pathSignature === undefined ? [] : [pathSignature, decodeURIComponent(pathSignature)]),
      ...querySignatures.flatMap((part) => [part, decodeURIComponent(part.replace(/\+/g, " "))]),
    ];
    const token = connection.token.trim();
    if (decodeURIComponent(url.href).includes(token) ||
        [...url.searchParams].some(([key, part]) => key.includes(token) || part.includes(token))) {
      throw invalid;
    }
    return { url, secrets: [token, ...signatures].filter(Boolean) };
  } catch {
    throw invalid;
  }
}

function redact(value: string, secrets: string[]): string {
  for (const secret of secrets) {
    value = value.replaceAll(secret, "redacted");
  }
  return value;
}

function filenamePart(value: string, fallback: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^\.+|[. ]+$/g, "") || fallback;
}

function contentType(value: string | null, secrets: string[]): string {
  const type = value?.split(";", 1)[0]?.trim() ?? "";
  return type && redact(type, secrets) === type && /^[a-zA-Z0-9!#$&^_.+-]+\/[a-zA-Z0-9!#$&^_.+-]+$/.test(type)
    ? type : "application/octet-stream";
}

export async function downloadIssueAttachment(
  connection: Connection,
  issueID: string,
  attachmentID: string,
  appDataDirectory: string,
  options: DownloadOptions = {},
): Promise<AttachmentDownloadResult> {
  const path = `${issuePath(issueID)}/attachments/${encodedID(attachmentID, "attachment ID")}`;
  return downloadAttachment(connection, path, attachmentID, appDataDirectory, options);
}

export async function downloadArticleAttachment(
  connection: Connection,
  articleID: string,
  attachmentID: string,
  appDataDirectory: string,
  options: DownloadOptions = {},
): Promise<AttachmentDownloadResult> {
  const path = `api/articles/${encodedID(articleID, "article ID")}/attachments/${encodedID(attachmentID, "attachment ID")}`;
  return downloadAttachment(connection, path, attachmentID, appDataDirectory, options);
}

async function downloadAttachment(
  connection: Connection,
  attachmentPath: string,
  attachmentID: string,
  appDataDirectory: string,
  options: DownloadOptions,
): Promise<AttachmentDownloadResult> {
  const requestedName = options.name === undefined ? undefined : downloadName(options.name);
  const maxBytes = options.maxBytes === undefined ? undefined : downloadLimit(options.maxBytes);
  const diagnosticSecrets = [connection.token];
  try {
    const metadata = await getAttachmentDownloadMetadata(connection, attachmentPath);
    if (metadata.id !== attachmentID) {
      throw new DownloadError("The download metadata names a different attachment.");
    }
    const { url, secrets } = attachmentUrl(connection, metadata.url);
    diagnosticSecrets.push(...secrets);
    const id = filenamePart(redact(metadata.id, secrets), "attachment");
    const name = requestedName ??
      downloadName(`${id}-${filenamePart(redact(metadata.name, secrets), "attachment")}`);
    if (redact(name, secrets) !== name || redact(appDataDirectory, secrets) !== appDataDirectory) {
      throw new DownloadError(
        "The download destination must not contain reflected credentials or signatures.",
      );
    }
    options.progress?.(`Downloading ${name}…`);
    let type = "application/octet-stream";
    const saved = await publishProfileFile({
      appDataDirectory,
      name,
      maxBytes,
      signal: connection.signal,
      openResponse: () => fetchWithRedirects(connection.fetch ?? globalThis.fetch, url, {
        method: "GET",
        headers: { Accept: "application/octet-stream", "Accept-Encoding": "identity" },
        credentials: "omit",
        ...(connection.signal === undefined ? {} : { signal: connection.signal }),
      }),
      inspectResponse(response) {
        if (!response.ok || response.status === 206) {
          throw new DownloadError(`The attachment download failed with HTTP ${response.status}.`);
        }
        const length = response.headers.get("content-length");
        const declared = length === null ? undefined : Number(length);
        if (length !== null && (!/^\d+$/.test(length) || !Number.isSafeInteger(declared))) {
          throw new DownloadError("The attachment has an invalid Content-Length.");
        }
        if (maxBytes !== undefined && declared !== undefined && declared > maxBytes) {
          throw new DownloadError("The attachment exceeds --max-bytes.");
        }
        type = contentType(response.headers.get("content-type") ?? metadata.mimeType, secrets);
      },
    });
    return { id, name, path: saved.path, bytes: saved.bytes, contentType: type };
  } catch (error) {
    if (error instanceof ProfileFileError && error.cause !== undefined) error.cause = diagnosticCause(error.cause, diagnosticSecrets);
    throw error instanceof ProfileFileError ? error : new DownloadError(
      "The attachment download failed; check connectivity and the profile's downloads directory.",
      false, false, { cause: diagnosticCause(error, diagnosticSecrets) },
    );
  }
}
