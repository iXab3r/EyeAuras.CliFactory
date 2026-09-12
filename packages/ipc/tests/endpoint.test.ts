import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:net";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import type { IAppArguments } from "@eyeauras/cli-factory";
import { hostPaths } from "../src/endpoint.js";

test("IPC accepts a Unix socket path beyond the former local ceiling when the OS supports it", {
  skip: process.platform === "win32" ? "Unix domain socket path boundary" : false,
}, async t => {
  const root = await mkdtemp("/tmp/ipc-path-");
  t.after(() => rm(root, { recursive: true, force: true }));
  const suffix = "/.runtime/host.sock";
  const roaming = join(root, "x".repeat(101 - Buffer.byteLength(root) - 1 - suffix.length));
  const paths = hostPaths({ RoamingAppDataDirectory: roaming } as IAppArguments);
  assert.equal(Buffer.byteLength(paths.path), 101);
  await mkdir(paths.directory, { recursive: true });
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(paths.path, resolve);
  });
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});
