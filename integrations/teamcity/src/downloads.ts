import { readFile } from "node:fs/promises";
import {
  ProfileFileError,
  publishProfileFile,
  type IAppArguments,
  type StagedProfileFile,
} from "@eyeauras/cli-factory";
import type { DownloadFormat } from "./file-models.js";
import { integer } from "./system-models.js";

export interface DownloadOptions {
  output: string;
  maxBytes?: number;
}

function mediaType(response: Response, format: DownloadFormat) {
  const media = (response.headers.get("Content-Type") ?? "application/octet-stream")
    .split(";")[0]!
    .trim()
    .toLowerCase();
  if (media.length > 100 || !/^[-a-z0-9+.]+\/[-a-z0-9+.]+$/.test(media)) {
    throw new Error("Invalid download media type.");
  }
  const allowed =
    format === "png"
      ? ["image/png"]
      : format === "svg"
        ? ["image/svg+xml"]
        : format === "zip"
          ? ["application/zip", "application/x-zip-compressed", "application/octet-stream"]
          : undefined;
  if (allowed && !allowed.includes(media)) {
    throw new Error("Unexpected download media type.");
  }
  return media;
}

async function verifyFormat(file: StagedProfileFile, format: DownloadFormat) {
  const prefix = Buffer.from(file.prefix);
  if (
    format === "png" &&
    !prefix.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  ) {
    throw new Error("Invalid PNG signature.");
  }
  if (
    format === "zip" &&
    !(
      prefix[0] === 80 &&
      prefix[1] === 75 &&
      ((prefix[2] === 3 && prefix[3] === 4) ||
        (prefix[2] === 5 && prefix[3] === 6) ||
        (prefix[2] === 7 && prefix[3] === 8))
    )
  ) {
    throw new Error("Invalid ZIP signature.");
  }
  if (format === "svg") {
    const value = await readFile(file.path, "utf8");
    if (
      /<!DOCTYPE|<!ENTITY/i.test(value) ||
      !/^\s*(?:<\?xml\s+[^?]*\?>\s*)?<svg(?:\s|>)/.test(value) ||
      !/<\/svg>\s*$|\/\>\s*$/.test(value)
    ) {
      throw new Error("Invalid/unsafe SVG document; never rendered.");
    }
  }
}

export async function saveDownload(
  app: IAppArguments,
  options: DownloadOptions,
  format: DownloadFormat,
  openResponse: () => Promise<Response>,
  signal?: AbortSignal,
) {
  const name = options.output;
  if (
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(name) ||
    name.endsWith(".") ||
    /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(name)
  ) {
    throw new Error("Output must be a safe new basename, not a path/device name.");
  }
  const configured = integer(options.maxBytes ?? 16 * 1024 * 1024, 1, 64 * 1024 * 1024);
  const maxBytes = format === "svg" ? Math.min(configured, 1024 * 1024) : configured;
  let media = "application/octet-stream";
  const saved = await publishProfileFile({
    appDataDirectory: app.AppDataDirectory,
    name,
    maxBytes,
    signal,
    openResponse,
    inspectResponse(response) {
      // These are whole-file requests: no Range, resume or partial-response reassembly.
      if (!response.ok) {
        throw new ProfileFileError(`TeamCity request failed with HTTP ${response.status}.`);
      }
      if (response.status === 206) {
        throw new ProfileFileError(
          "Download failed, was partial, or was cancelled; no destination was published.",
        );
      }
      media = mediaType(response, format);
      const length = response.headers.get("Content-Length");
      const declared = length === null ? undefined : Number(length);
      if (length !== null && (!/^\d+$/.test(length) || !Number.isSafeInteger(declared) ||
          declared! > maxBytes)) {
        throw new Error("Download exceeds byte bound.");
      }
    },
    validateFile: (file) => verifyFormat(file, format),
  });
  return { ...saved, mediaType: media };
}
