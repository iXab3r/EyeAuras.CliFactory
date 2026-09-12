import { createHash } from "node:crypto";
import { join } from "node:path";
import type { IAppArguments } from "@eyeauras/cli-factory";

export const internalMode = "--internal-cli-host";

export function hostPaths(app: IAppArguments) {
  const directory = join(app.RoamingAppDataDirectory, ".runtime");
  const identity = createHash("sha256")
    .update(app.RoamingAppDataDirectory)
    .digest("hex")
    .slice(0, 32);
  const path =
    process.platform === "win32"
      ? "\\\\.\\pipe\\clifactory-" + identity
      : join(directory, "host.sock");
  return {
    directory,
    path,
    endpoint:
      process.platform === "win32"
        ? "unix:////./pipe/clifactory-" + identity
        : "unix:" + path,
    owner: join(directory, "owner.json"),
  };
}
