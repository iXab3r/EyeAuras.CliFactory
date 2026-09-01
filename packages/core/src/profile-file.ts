import { createHash } from "node:crypto";
import type { BigIntStats } from "node:fs";
import {
  link,
  lstat,
  mkdir,
  mkdtemp,
  open,
  realpath,
  rmdir,
  unlink,
  type FileHandle,
} from "node:fs/promises";
import { isAbsolute, join, parse, relative, resolve, sep } from "node:path";
import { privateDirectory } from "./private-storage.js";
import { consumeResponseBody } from "./response-body.js";

export class ProfileFileError extends Error {
  public constructor(
    message: string,
    public readonly published = false,
    public readonly cleanupFailed = false,
  ) {
    super(message);
  }
}

export interface PublishedProfileFile {
  path: string;
  bytes: number;
  sha256: string;
}

export interface StagedProfileFile {
  path: string;
  bytes: number;
  prefix: Uint8Array;
}

export interface ProfileFileOptions {
  appDataDirectory: string;
  name: string;
  maxBytes: number;
  signal?: AbortSignal | undefined;
  openResponse: () => Promise<Response>;
  inspectResponse: (response: Response) => void | Promise<void>;
  validateFile?: ((file: StagedProfileFile) => void | Promise<void>) | undefined;
}

interface PathIdentity {
  path: string;
  dev: bigint;
  ino: bigint;
}

interface FileIdentity extends PathIdentity {
  size: bigint;
  mtimeNs: bigint;
  ctimeNs: bigint;
}

function fileIdentityFromStat(path: string, stat: BigIntStats): FileIdentity {
  if (!stat.isFile()) throw new Error();
  return {
    path,
    dev: stat.dev,
    ino: stat.ino,
    size: stat.size,
    mtimeNs: stat.mtimeNs,
    ctimeNs: stat.ctimeNs,
  };
}

function inside(parent: string, child: string): void {
  const part = relative(parent, child);
  if (part === ".." || part.startsWith(".." + sep) || isAbsolute(part)) throw new Error();
}

async function directoryIdentity(path: string): Promise<PathIdentity> {
  const stat = await lstat(path, { bigint: true });
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error();
  return { path, dev: stat.dev, ino: stat.ino };
}

async function fileIdentity(path: string): Promise<FileIdentity> {
  const stat = await lstat(path, { bigint: true });
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error();
  return fileIdentityFromStat(path, stat);
}

async function prepareDirectories(path: string): Promise<PathIdentity[]> {
  const absolute = resolve(path);
  let current = parse(absolute).root;
  const result = [await directoryIdentity(current)];
  for (const segment of relative(current, absolute).split(sep).filter(Boolean)) {
    current = join(current, segment);
    try {
      await mkdir(current, { mode: 0o700 });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
    result.push(await directoryIdentity(current));
  }
  const actual = resolve(await realpath(absolute));
  const equal = process.platform === "win32"
    ? actual.toLowerCase() === absolute.toLowerCase()
    : actual === absolute;
  if (!equal) throw new Error();
  return result;
}

async function verifyIdentity(expected: PathIdentity, kind: "directory" | "file"): Promise<void> {
  const actual = kind === "directory"
    ? await directoryIdentity(expected.path)
    : await fileIdentity(expected.path);
  if (actual.dev !== expected.dev || actual.ino !== expected.ino) throw new Error();
}

async function verifyDirectories(directories: readonly PathIdentity[]): Promise<void> {
  for (const directory of directories) await verifyIdentity(directory, "directory");
}

async function verifyFileSnapshot(expected: FileIdentity): Promise<void> {
  const actual = await fileIdentity(expected.path);
  if (actual.dev !== expected.dev || actual.ino !== expected.ino ||
      actual.size !== expected.size || actual.mtimeNs !== expected.mtimeNs ||
      actual.ctimeNs !== expected.ctimeNs) {
    throw new Error();
  }
}

function safeBasename(value: string): boolean {
  return !!value && Buffer.byteLength(value, "utf8") <= 255 && value !== "." && value !== ".." &&
    !/[<>:"/\\|?*\u0000-\u001f\u007f-\u009f\p{Cf}]/u.test(value) && !/[. ]$/.test(value) &&
    !/^(?:con|prn|aux|nul|conin\$|conout\$|clock\$|com[1-9¹²³]|lpt[1-9¹²³])(?:[ .]|$)/i.test(value);
}

export async function publishProfileFile(
  options: ProfileFileOptions,
): Promise<PublishedProfileFile> {
  const { appDataDirectory, name, maxBytes, signal } = options;
  if (!isAbsolute(appDataDirectory)) {
    throw new ProfileFileError("Downloads require an absolute profile AppData directory.");
  }
  if (!safeBasename(name)) {
    throw new ProfileFileError("Download name must be one safe basename without reserved characters.");
  }
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new ProfileFileError("Download byte limit must be a positive safe integer.");
  }
  const profileDirectory = resolve(appDataDirectory);
  const downloadDirectory = join(profileDirectory, "downloads");
  const tempDirectory = join(profileDirectory, "temp");
  const destination = join(downloadDirectory, name);
  inside(profileDirectory, downloadDirectory);
  inside(profileDirectory, tempDirectory);
  inside(downloadDirectory, destination);

  let destinationDirectories: PathIdentity[] = [];
  let stagingDirectories: PathIdentity[] = [];
  let stagingDirectory: string | undefined;
  let stagingDirectoryIdentity: PathIdentity | undefined;
  let stagingPath: string | undefined;
  let stagingIdentity: FileIdentity | undefined;
  let file: FileHandle | undefined;
  let response: Response | undefined;
  let published = false;
  let cleanupFailed = false;
  let failureMessage =
    "Download failed, exceeded its byte limit, was cancelled, or had an incomplete transfer; " +
    "no destination was published.";
  let result: PublishedProfileFile | undefined;
  const hash = createHash("sha256");
  const prefix = new Uint8Array(8);
  let prefixBytes = 0;

  try {
    if (signal?.aborted) throw new Error();
    failureMessage =
      "Download directories could not be verified; symlinks, junctions and replacement are " +
      "unsupported; no destination was published.";
    destinationDirectories = await prepareDirectories(downloadDirectory);
    stagingDirectories = await prepareDirectories(tempDirectory);
    try {
      const existing = await lstat(destination);
      void existing;
      failureMessage =
        "Download destination already exists; no overwrite; no destination was published.";
      throw new Error();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    await verifyDirectories([...destinationDirectories, ...stagingDirectories]);
    stagingDirectory = await mkdtemp(join(tempDirectory, ".download-"));
    stagingDirectoryIdentity = await directoryIdentity(stagingDirectory);
    await privateDirectory(stagingDirectory);
    await verifyIdentity(stagingDirectoryIdentity, "directory");
    stagingPath = join(stagingDirectory, "content");
    file = await open(stagingPath, "wx", 0o600);
    const opened = await file.stat({ bigint: true });
    if (!opened.isFile()) throw new Error();
    stagingIdentity = fileIdentityFromStat(stagingPath, opened);

    failureMessage =
      "Download failed, exceeded its byte limit, was cancelled, or had an incomplete transfer; " +
      "no destination was published.";
    if (signal?.aborted) throw new Error();
    response = await options.openResponse();
    if (signal?.aborted) throw new Error();
    try {
      await options.inspectResponse(response);
    } catch (error) {
      if (error instanceof ProfileFileError) failureMessage = error.message;
      throw error;
    }
    const bytes = await consumeResponseBody(response, { maxBytes, signal }, async (chunk) => {
      const owned = Uint8Array.from(chunk);
      if (prefixBytes < prefix.length) {
        const count = Math.min(prefix.length - prefixBytes, owned.byteLength);
        prefix.set(owned.subarray(0, count), prefixBytes);
        prefixBytes += count;
      }
      hash.update(owned);
      let offset = 0;
      while (offset < owned.byteLength) {
        const written = await file!.write(owned, offset, owned.byteLength - offset);
        if (!written.bytesWritten) throw new Error();
        offset += written.bytesWritten;
      }
    });
    if (signal?.aborted) throw new Error();
    await file.sync();
    failureMessage =
      "Download directories or private staging changed during the transfer; " +
      "no destination was published.";
    await verifyDirectories([...destinationDirectories, ...stagingDirectories]);
    await verifyIdentity(stagingDirectoryIdentity, "directory");
    const completedIdentity = await fileIdentity(stagingIdentity.path);
    if (completedIdentity.dev !== stagingIdentity.dev ||
        completedIdentity.ino !== stagingIdentity.ino || completedIdentity.size !== BigInt(bytes)) {
      throw new Error();
    }
    stagingIdentity = completedIdentity;
    failureMessage =
      "Download failed file validation; no destination was published.";
    if (options.validateFile) {
      try {
        await options.validateFile({
          path: stagingPath,
          bytes,
          prefix: prefix.subarray(0, prefixBytes),
        });
      } catch (error) {
        if (error instanceof ProfileFileError) failureMessage = error.message;
        throw error;
      }
    }
    if (signal?.aborted) {
      failureMessage = "Download was cancelled; no destination was published.";
      throw new Error();
    }
    failureMessage =
      "Download directories or private staging changed during validation; " +
      "no destination was published.";
    await verifyDirectories([...destinationDirectories, ...stagingDirectories]);
    await verifyIdentity(stagingDirectoryIdentity, "directory");
    await verifyFileSnapshot(stagingIdentity);
    if (signal?.aborted) {
      failureMessage = "Download was cancelled; no destination was published.";
      throw new Error();
    }
    const sha256 = hash.digest("hex");
    try {
      await link(stagingPath, destination);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") {
        failureMessage =
          "Download destination already exists; no overwrite; no destination was published.";
      } else {
        failureMessage =
          "Download could not be published exclusively; the profile filesystem must support hard links.";
      }
      throw error;
    }
    published = true;
    failureMessage =
      "Download was published, but its destination identity could not be verified; " +
      "inspect the profile downloads directory.";
    await verifyDirectories([...destinationDirectories, ...stagingDirectories]);
    await verifyIdentity(stagingDirectoryIdentity, "directory");
    await verifyIdentity(stagingIdentity, "file");
    const publishedIdentity = await fileIdentity(destination);
    if (publishedIdentity.dev !== stagingIdentity.dev || publishedIdentity.ino !== stagingIdentity.ino) {
      throw new Error();
    }
    result = { path: destination, bytes, sha256 };
  } catch {
    // The selected static message is the only information exposed from this operation.
  } finally {
    void response?.body?.cancel().catch(() => undefined);
    let cleanupAllowed = true;
    let cleanupIdentity: FileIdentity | undefined;
    if (file) {
      try {
        if (!stagingPath) throw new Error();
        cleanupIdentity = fileIdentityFromStat(
          stagingPath,
          await file.stat({ bigint: true }),
        );
        await verifyFileSnapshot(cleanupIdentity);
      } catch {
        cleanupFailed = true;
        cleanupAllowed = false;
      }
    }
    try {
      await file?.close();
      file = undefined;
    } catch {
      cleanupFailed = true;
      cleanupAllowed = false;
    }
    if (stagingDirectory && cleanupAllowed) {
      try {
        if (!stagingDirectoryIdentity) throw new Error();
        await verifyDirectories(stagingDirectories);
        await verifyIdentity(stagingDirectoryIdentity, "directory");
        if (stagingPath && stagingIdentity) {
          try {
            if (!cleanupIdentity) throw new Error();
            await verifyFileSnapshot(cleanupIdentity);
            await unlink(stagingPath);
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
          }
        } else if (stagingPath) {
          throw new Error();
        }
        await verifyDirectories(stagingDirectories);
        await verifyIdentity(stagingDirectoryIdentity, "directory");
        await rmdir(stagingDirectory);
      } catch {
        cleanupFailed = true;
      }
    }
  }

  if (cleanupFailed) {
    throw new ProfileFileError(
      published
        ? "Download was published, but private staging cleanup failed; inspect the profile temp directory."
        : "Download was not published, and private staging cleanup failed; inspect the profile temp directory.",
      published,
      true,
    );
  }
  if (!result) throw new ProfileFileError(failureMessage, published, false);
  return result;
}
