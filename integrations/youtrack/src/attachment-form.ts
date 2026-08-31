import fs from "node:fs";
import { basename } from "node:path";
import { requiredText } from "./client.js";

export async function attachmentForm(filePath: string): Promise<FormData> {
  requiredText(filePath, "file path");
  let file: Blob;
  try {
    if (!(await fs.promises.stat(filePath)).isFile()) {
      throw new Error();
    }
    file = await fs.openAsBlob(filePath);
  } catch {
    throw new Error("YouTrack upload requires a readable regular file.");
  }
  const form = new FormData();
  form.append("upload1", file, basename(filePath));
  return form;
}
