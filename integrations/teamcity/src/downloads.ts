import { lstat, mkdir, open, link, unlink, realpath, readFile } from "node:fs/promises";
import { join, resolve, parse, relative, sep, isAbsolute } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import type { IAppArguments } from "@eyeauras/cli-factory";
import type { DownloadFormat } from "./file-models.js";
import { integer } from "./system-models.js";

export interface DownloadOptions {
  output: string;
  maxBytes?: number;
}
interface Target {
  destination: string;
  tempDirectory: string;
  profileDirectory: string;
  limit: number;
  format: DownloadFormat;
}
function inside(parent: string, child: string) {
  const part = relative(parent, child);
  if (part === ".." || part.startsWith(".." + sep) || isAbsolute(part))
    throw new Error("Download path escaped its profile.");
}
async function checkedDirectory(path: string, create: boolean) {
  const absolute = resolve(path),
    root = parse(absolute).root;
  let current = root;
  for (const part of relative(root, absolute).split(sep).filter(Boolean)) {
    current = join(current, part);
    let stat;
    try {
      stat = await lstat(current);
    } catch (error) {
      if (!create || (error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      try {
        await mkdir(current, { mode: 0o700 });
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
      }
      stat = await lstat(current);
    }
    if (!stat.isDirectory() || stat.isSymbolicLink())
      throw new Error("Download directory must not contain symlinks or junctions.");
  }
  if (resolve(await realpath(absolute)).toLowerCase() !== absolute.toLowerCase())
    throw new Error("Download directory resolves outside its declared path.");
}
export async function prepareDownload(
  app: IAppArguments,
  options: DownloadOptions,
  format: DownloadFormat,
): Promise<Target> {
  const name = options.output;
  if (
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(name) ||
    name.endsWith(".") ||
    /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(name)
  )
    throw new Error("Output must be a safe new basename, not a path/device name.");
  const limit = integer(options.maxBytes ?? 16 * 1024 * 1024, 1, 64 * 1024 * 1024),
    profileDirectory = resolve(app.AppDataDirectory),
    tempDirectory = resolve(app.TempDirectory),
    directory = join(profileDirectory, "downloads"),
    destination = join(directory, name);
  inside(profileDirectory, directory);
  inside(profileDirectory, tempDirectory);
  inside(directory, destination);
  await checkedDirectory(directory, true);
  await checkedDirectory(tempDirectory, true);
  try {
    await lstat(destination);
    throw new Error("Download destination already exists; no overwrite.");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
  return {
    destination,
    tempDirectory,
    profileDirectory,
    limit: format === "svg" ? Math.min(limit, 1024 * 1024) : limit,
    format,
  };
}
function mediaType(response: Response, format: DownloadFormat) {
  const media = (response.headers.get("Content-Type") ?? "application/octet-stream")
    .split(";")[0]!
    .trim()
    .toLowerCase();
  if (media.length > 100 || !/^[-a-z0-9+.]+\/[-a-z0-9+.]+$/.test(media))
    throw new Error("Invalid download media type.");
  const allowed =
    format === "png"
      ? ["image/png"]
      : format === "svg"
        ? ["image/svg+xml"]
        : format === "zip"
          ? ["application/zip", "application/x-zip-compressed", "application/octet-stream"]
          : undefined;
  if (allowed && !allowed.includes(media)) throw new Error("Unexpected download media type.");
  return media;
}
async function verifyFormat(path: string, format: DownloadFormat, prefix: Buffer) {
  if (
    format === "png" &&
    !prefix.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    throw new Error("Invalid PNG signature.");
  if (
    format === "zip" &&
    !(
      prefix[0] === 80 &&
      prefix[1] === 75 &&
      ((prefix[2] === 3 && prefix[3] === 4) ||
        (prefix[2] === 5 && prefix[3] === 6) ||
        (prefix[2] === 7 && prefix[3] === 8))
    )
  )
    throw new Error("Invalid ZIP signature.");
  if (format === "svg") {
    const value = await readFile(path, "utf8");
    if (
      /<!DOCTYPE|<!ENTITY/i.test(value) ||
      !/^\s*(?:<\?xml\s+[^?]*\?>\s*)?<svg(?:\s|>)/.test(value) ||
      !/<\/svg>\s*$|\/\>\s*$/.test(value)
    )
      throw new Error("Invalid/unsafe SVG document; never rendered.");
  }
}
export async function saveDownload(response: Response, target: Target, signal?: AbortSignal) {
  let staging: string | undefined;
  let writer: Awaited<ReturnType<typeof open>> | undefined;
  let published = false;
  const reader = response.body?.getReader(),
    cancel = () => {
      void reader?.cancel().catch(() => undefined);
    };
  signal?.addEventListener("abort", cancel, { once: true });
  try {
    // These are whole-file requests: no Range, resume or partial-response reassembly.
    if (!response.ok || response.status === 206 || signal?.aborted)
      throw new Error("Download failed, was partial, or was cancelled.");
    const media = mediaType(response, target.format),
      length = response.headers.get("Content-Length");
    if (length !== null && (!/^\d+$/.test(length) || Number(length) > target.limit))
      throw new Error("Download exceeds byte bound.");
    await checkedDirectory(target.tempDirectory, false);
    const candidate = join(target.tempDirectory, "download-" + randomUUID() + ".part");
    writer = await open(candidate, "wx", 0o600);
    staging = candidate;
    let bytes = 0,
      prefix = Buffer.alloc(0);
    const hash = createHash("sha256");
    if (reader)
      while (true) {
        if (signal?.aborted) throw new Error("Download cancelled.");
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > target.limit) throw new Error("Download exceeds byte bound.");
        if (prefix.length < 8)
          prefix = Buffer.concat([prefix, chunk.value.subarray(0, 8 - prefix.length)]);
        hash.update(chunk.value);
        let offset = 0;
        while (offset < chunk.value.length) {
          const n = await writer.write(chunk.value, offset);
          if (!n.bytesWritten) throw new Error("Could not write download.");
          offset += n.bytesWritten;
        }
      }
    if (signal?.aborted) throw new Error("Download cancelled.");
    await writer.sync();
    await writer.close();
    writer = undefined;
    await verifyFormat(staging, target.format, prefix);
    await checkedDirectory(join(target.profileDirectory, "downloads"), false);
    await checkedDirectory(target.tempDirectory, false);
    // Same-profile hard link is atomic and refuses an existing destination; rename can overwrite.
    if (signal?.aborted) throw new Error("Download cancelled before publication.");
    await link(staging, target.destination);
    published = true;
    await unlink(staging);
    staging = undefined;
    return { path: target.destination, bytes, sha256: hash.digest("hex"), mediaType: media };
  } catch {
    throw new Error(
      published
        ? "Download was saved but staging cleanup failed; inspect profile temp directory."
        : "Download failed, exceeded a bound, or was cancelled; no destination was published.",
    );
  } finally {
    signal?.removeEventListener("abort", cancel);
    cancel();
    reader?.releaseLock();
    await writer?.close().catch(() => undefined);
    if (staging) {
      try {
        await checkedDirectory(target.tempDirectory, false);
        await unlink(staging);
      } catch {
        /* Retain only our owned staging file if the directory can no longer be trusted. */
      }
    }
  }
}
