import assert from "node:assert/strict";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Readable, Writable } from "node:stream";
import type { TestContext } from "node:test";
import { AppArguments, MemorySecretStore } from "@eyeauras/cli-factory";
import { createYouTrackCli } from "../src/cli.js";
export async function fixture(t: TestContext, input = "") {
  const temporaryRoot = await realpath(tmpdir());
  const directory = await realpath(await mkdtemp(join(temporaryRoot, "youtrack-auth-test-")));
  t.after(async () => {
    const cleanupDirectory = await realpath(directory);
    assert.equal(cleanupDirectory, directory);
    assert.equal(dirname(cleanupDirectory), temporaryRoot);
    await rm(directory, { recursive: true, force: true });
  });
  const appArguments = new AppArguments({ AppName: "youtrack-cli", Environment: {
    AppDomainDirectory: join(directory, "executable"),
    ApplicationExecutablePath: join(directory, "executable", "youtrack-cli.js"),
    EnvironmentAppData: join(directory, "roaming"),
    EnvironmentLocalAppData: join(directory, "local"),
    ProcessId: 1,
  } });
  const paths: string[] = [];
  const withProfile = appArguments.WithProfile.bind(appArguments);
  appArguments.WithProfile = (name) => {
    const scoped = withProfile(name);
    paths.push(scoped.AppDataDirectory);
    return scoped;
  };
  const secrets = new MemorySecretStore();
  let stdout = "";
  let stderr = "";
  const runtime = {
    appArguments, secretStore: secrets, input: Readable.from([input]),
    output: new Writable({ write(chunk, _encoding, done) { stdout += chunk.toString(); done(); } }),
    error: new Writable({ write(chunk, _encoding, done) { stderr += chunk.toString(); done(); } }),
  };
  const cli = createYouTrackCli(runtime);
  return { cli, runtime, secrets, appArguments, paths, stdout: () => stdout, stderr: () => stderr };
}
