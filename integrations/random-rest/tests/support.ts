import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable, Writable } from "node:stream";
import type { TestContext } from "node:test";
import { AppArguments, MemorySecretStore, ProfileStore, type CliRuntime } from "@eyeauras/cli-factory";

export async function runtimeFor(test: TestContext, input = "") {
  const root = await mkdtemp(join(tmpdir(), "random-cli-test-"));
  test.after(() => rm(root, { recursive: true, force: true }));
  const appArguments = new AppArguments({ AppName: "random-rest-cli", Environment: {
    AppDomainDirectory: root, ApplicationExecutablePath: join(root, "test.js"),
    EnvironmentAppData: root, EnvironmentLocalAppData: root, ProcessId: process.pid,
  } });
  const profileStore = new ProfileStore({ applicationId: "random-rest-cli", appArguments,
    defaults: { url: "https://random.test", contact: "operator@example.com" } });
  let stdout = "";
  let stderr = "";
  const runtime: CliRuntime = {
    appArguments, profileStore, secretStore: new MemorySecretStore(), input: Readable.from([input]),
    output: new Writable({ write(chunk, _encoding, done) { stdout += String(chunk); done(); } }),
    error: new Writable({ write(chunk, _encoding, done) { stderr += String(chunk); done(); } }),
  };
  return { runtime, profileStore, stdout: () => stdout, stderr: () => stderr,
    reset() { stdout = ""; stderr = ""; } };
}
