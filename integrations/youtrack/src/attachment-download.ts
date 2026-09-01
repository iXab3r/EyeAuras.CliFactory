import { ProfileFileError, publishProfileFile } from "@eyeauras/cli-factory";
import {
  getIssueAttachmentDownloadMetadata,
  type Connection,
  youTrackUrl,
} from "./client.js";

export interface DownloadOptions {
  name?: string;
  maxBytes?: number;
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
  if (!value || Buffer.byteLength(value, "utf8") > 180 || value === "." || value === ".." ||
      /[<>:"/\\|?*\u0000-\u001f\u007f-\u009f\p{Cf}]/u.test(value) || /[. ]$/.test(value) ||
      /^(?:con|prn|aux|nul|conin\$|conout\$|clock\$|com[1-9¹²³]|lpt[1-9¹²³])(?:[ .]|$)/i.test(value)) {
    throw new Error("YouTrack download name must be one safe basename, without reserved paths or characters.");
  }
  return value;
}

export function downloadLimit(value: number | string): number {
  const number = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  if (typeof number !== "number" || !Number.isSafeInteger(number) || number < 1 || number > 104857600) {
    throw new Error("YouTrack max-bytes must be an integer between 1 and 104857600.");
  }
  return number;
}

function attachmentUrl(connection: Connection, value: string): { url: URL; secrets: string[] } {
  const invalid = new DownloadError(
    "YouTrack attachment URL must use the profile origin and documented attachment path; " +
    "external/CDN downloads are unsupported.",
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

function filenamePart(value: string, fallback: string, length: number): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, length).replace(/^\.+|[. ]+$/g, "") || fallback;
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
  const requestedName = options.name === undefined ? undefined : downloadName(options.name);
  const maxBytes = downloadLimit(options.maxBytes ?? 25 * 1024 * 1024);
  try {
    const metadata = await getIssueAttachmentDownloadMetadata(connection, issueID, attachmentID);
    if (metadata.id !== attachmentID) {
      throw new DownloadError("YouTrack returned a different attachment identity for the download.");
    }
    const { url, secrets } = attachmentUrl(connection, metadata.url);
    const id = filenamePart(redact(metadata.id, secrets), "attachment", 64);
    const name = requestedName ??
      downloadName(`${id}-${filenamePart(redact(metadata.name, secrets), "attachment", 96)}`);
    if (redact(name, secrets) !== name || redact(appDataDirectory, secrets) !== appDataDirectory) {
      throw new DownloadError(
        "YouTrack download destination must not contain reflected credentials or signatures.",
      );
    }
    let type = "application/octet-stream";
    const saved = await publishProfileFile({
      appDataDirectory,
      name,
      maxBytes,
      signal: connection.signal,
      openResponse: () => (connection.fetch ?? globalThis.fetch)(url, {
        method: "GET",
        headers: { Accept: "application/octet-stream", "Accept-Encoding": "identity" },
        credentials: "omit",
        redirect: "error",
        ...(connection.signal === undefined ? {} : { signal: connection.signal }),
      }),
      inspectResponse(response) {
        if (!response.ok || response.status === 206) {
          throw new DownloadError(`YouTrack attachment download failed (HTTP ${response.status}).`);
        }
        const length = response.headers.get("content-length");
        const declared = length === null ? undefined : Number(length);
        if (length !== null && (!/^\d+$/.test(length) || !Number.isSafeInteger(declared))) {
          throw new DownloadError("YouTrack attachment has an invalid Content-Length.");
        }
        if (declared !== undefined && declared > maxBytes) {
          throw new DownloadError("YouTrack attachment exceeds the configured byte limit.");
        }
        type = contentType(response.headers.get("content-type") ?? metadata.mimeType, secrets);
      },
    });
    return { id, name, path: saved.path, bytes: saved.bytes, contentType: type };
  } catch (error) {
    throw error instanceof ProfileFileError ? error : new DownloadError(
      "YouTrack attachment download failed; check cancellation, connectivity and profile filesystem access.",
    );
  }
}
