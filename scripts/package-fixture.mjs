// Written outside the checkout by test:packages, resolving only the installed Core.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { AppArguments, PlatformSecretStore, ProfileSecrets, command, createCli, streamResult } from "@eyeauras/cli-factory";
import { createCliFixture } from "@eyeauras/cli-factory/testing";
const version = JSON.parse(await readFile(new URL("node_modules/@eyeauras/cli-factory/package.json", import.meta.url), "utf8")).version;
if (process.argv[2] === "--dpapi-check") {
  const root = join(import.meta.dirname, "dpapi");
  const arguments_ = new AppArguments({ AppName: "package-fixture", Environment: {
    AppDomainDirectory: root, ApplicationExecutablePath: join(root, "fixture.js"), EnvironmentAppData: root, EnvironmentLocalAppData: root, ProcessId: process.pid,
  } });
  const secrets = () => new ProfileSecrets(new PlatformSecretStore(arguments_), arguments_.AppName, "default");
  await secrets().set("token", "synthetic-packaged-dpapi");
  assert.equal(await secrets().require("token"), "synthetic-packaged-dpapi");
  await secrets().delete("token");
  assert.equal(await secrets().get("token"), undefined);
} else {
  const fixture = await createCliFixture({ after() {} }, { applicationId: "package-fixture", profiles: [{ name: "default" }] });
  try {
    const app = fixture.createApplication(runtime => createCli({ name: "package-fixture", description: "Synthetic installed Core fixture", version, runtime,
      commands: [command("items", "List items", () => streamResult(async function* () { yield { id: 1 }; yield { id: 2 }; }))],
    }));
    process.exitCode = await app.run(process.argv.slice(2), { input: process.stdin, output: process.stdout, error: process.stderr, cwd: fixture.root, environment: {} });
  } finally { await fixture.dispose(); }
}
