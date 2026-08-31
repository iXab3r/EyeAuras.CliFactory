import { link, lstat, mkdir, mkdtemp, open, rmdir, unlink, type FileHandle } from "node:fs/promises";
import { isAbsolute, join, parse, resolve, sep } from "node:path";
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

class DownloadError extends Error {}

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

interface DirectoryIdentity {
  path: string;
  dev: bigint;
  ino: bigint;
}

async function directoryIdentity(path: string): Promise<DirectoryIdentity> {
  const stat = await lstat(path, { bigint: true });
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new DownloadError(
      "YouTrack download directory must contain only real directories, without links or junctions.",
    );
  }
  return { path, dev: stat.dev, ino: stat.ino };
}

async function prepareDirectories(path: string): Promise<DirectoryIdentity[]> {
  if (!isAbsolute(path)) {
    throw new DownloadError("YouTrack downloads require an absolute profile AppData directory.");
  }
  const absolute = resolve(path);
  let current = parse(absolute).root;
  const directories = [await directoryIdentity(current)];
  for (const segment of absolute.slice(current.length).split(sep).filter(Boolean)) {
    current = join(current, segment);
    try {
      await mkdir(current, { mode: 0o700 });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
        throw error;
      }
    }
    directories.push(await directoryIdentity(current));
  }
  return directories;
}

async function verifyDirectories(directories: DirectoryIdentity[]): Promise<void> {
  for (const expected of directories) {
    const actual = await directoryIdentity(expected.path);
    if (actual.dev !== expected.dev || actual.ino !== expected.ino) {
      throw new DownloadError("YouTrack download directory changed during the transfer.");
    }
  }
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
  const metadata = await getIssueAttachmentDownloadMetadata(connection, issueID, attachmentID);
  if (metadata.id !== attachmentID) {
    throw new DownloadError("YouTrack returned a different attachment identity for the download.");
  }
  const { url, secrets } = attachmentUrl(connection, metadata.url);
  const id = filenamePart(redact(metadata.id, secrets), "attachment", 64);
  const name = requestedName ?? downloadName(`${id}-${filenamePart(redact(metadata.name, secrets), "attachment", 96)}`);
  if (redact(name, secrets) !== name || redact(appDataDirectory, secrets) !== appDataDirectory) {
    throw new DownloadError("YouTrack download destination must not contain reflected credentials or signatures.");
  }
  const destination = join(appDataDirectory, "downloads", name);
  const controller = new AbortController();
  const signal = connection.signal === undefined
    ? controller.signal : AbortSignal.any([controller.signal, connection.signal]);
  let directories: DirectoryIdentity[] = [];
  let temporaryDirectory: string | undefined;
  let temporaryFile: string | undefined;
  let file: FileHandle | undefined;
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  const cancelReader = () => { void reader?.cancel().catch(() => {}); };
  try {
    signal.throwIfAborted();
    directories = await prepareDirectories(join(appDataDirectory, "downloads"));
    try {
      await lstat(destination);
      throw new DownloadError("YouTrack download destination already exists; choose a different name.");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
    await verifyDirectories(directories);
    temporaryDirectory = await mkdtemp(join(appDataDirectory, "downloads", ".download-"));
    directories.push(await directoryIdentity(temporaryDirectory));
    temporaryFile = join(temporaryDirectory, "content");
    file = await open(temporaryFile, "wx", 0o600);
    const fileIdentity = await file.stat({ bigint: true });
    const response = await (connection.fetch ?? globalThis.fetch)(url, {
      method: "GET",
      headers: { Accept: "application/octet-stream", "Accept-Encoding": "identity" },
      credentials: "omit",
      redirect: "error",
      signal,
    });
    reader = response.body?.getReader();
    signal.addEventListener("abort", cancelReader, { once: true });
    if (!response.ok || response.status === 206) {
      throw new DownloadError(`YouTrack attachment download failed (HTTP ${response.status}).`);
    }
    const lengthHeader = response.headers.get("content-length");
    const declaredLength = lengthHeader === null ? undefined : Number(lengthHeader);
    if (lengthHeader !== null && (!/^\d+$/.test(lengthHeader) || !Number.isSafeInteger(declaredLength))) {
      throw new DownloadError("YouTrack attachment has an invalid Content-Length.");
    }
    if (declaredLength !== undefined && declaredLength > maxBytes) {
      throw new DownloadError("YouTrack attachment exceeds the configured byte limit.");
    }
    let bytes = 0;
    while (reader) {
      signal.throwIfAborted();
      const chunk = await reader.read();
      signal.throwIfAborted();
      if (chunk.done) {
        break;
      }
      bytes += chunk.value.byteLength;
      if (bytes > maxBytes) {
        throw new DownloadError("YouTrack attachment exceeds the configured byte limit.");
      }
      await file.writeFile(chunk.value);
    }
    const encoding = response.headers.get("content-encoding");
    if (declaredLength !== undefined && (!encoding || encoding === "identity") && bytes !== declaredLength) {
      throw new DownloadError("YouTrack attachment transfer length does not match Content-Length.");
    }
    await file.sync();
    await file.close();
    file = undefined;
    await verifyDirectories(directories);
    const currentFile = await lstat(temporaryFile, { bigint: true });
    if (!currentFile.isFile() || currentFile.isSymbolicLink() ||
        currentFile.dev !== fileIdentity.dev || currentFile.ino !== fileIdentity.ino) {
      throw new DownloadError("YouTrack download temporary file changed during the transfer.");
    }
    signal.throwIfAborted();
    try {
      await link(temporaryFile, destination);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") {
        throw new DownloadError("YouTrack download destination already exists; choose a different name.");
      }
      throw new DownloadError(
        "YouTrack could not publish the download exclusively; the profile filesystem must support hard links.",
      );
    }
    return {
      id, name, path: destination, bytes,
      contentType: contentType(response.headers.get("content-type") ?? metadata.mimeType, secrets),
    };
  } catch (error) {
    throw error instanceof DownloadError ? error : new DownloadError(
      "YouTrack attachment download failed; check cancellation, connectivity and profile filesystem access.",
    );
  } finally {
    controller.abort();
    signal.removeEventListener("abort", cancelReader);
    await reader?.cancel().catch(() => {});
    await file?.close().catch(() => {});
    if (temporaryDirectory !== undefined) {
      try {
        await verifyDirectories(directories);
        if (temporaryFile !== undefined) {
          await unlink(temporaryFile).catch((error: NodeJS.ErrnoException) => {
            if (error.code !== "ENOENT") {
              throw error;
            }
          });
        }
        await rmdir(temporaryDirectory);
      } catch {
        throw new DownloadError(
          "YouTrack could not safely clean temporary download data; inspect the profile downloads directory.",
        );
      }
    }
  }
}




