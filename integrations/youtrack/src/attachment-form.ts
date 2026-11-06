import fs from "node:fs";
import { basename } from "node:path";
import { inputFilePath } from "./client.js";

export async function attachmentForm(filePath: string): Promise<FormData> {
  inputFilePath(filePath);
  let file: Blob;
  try {
    if (!(await fs.promises.stat(filePath)).isFile()) {
      throw new Error();
    }
    file = await fs.openAsBlob(filePath);
  } catch {
    throw new Error("The upload requires a readable regular file.");
  }
  const form = new FormData();
  form.append("upload1", file, basename(filePath));
  return form;
}
