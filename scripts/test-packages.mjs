// An explicit registry-install check, separate from the offline service test suite.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const npmCli = process.env.npm_execpath;
assert.ok(npmCli, "Run this check through npm run test:packages.");
const packages = [
  { directory: "packages/core", name: "@eyeauras/cli-factory" },
  { directory: "integrations/teamcity", name: "@eyeauras/teamcity-cli", bin: "teamcity-cli", factory: "createTeamCityCli" },
  { directory: "integrations/youtrack", name: "@eyeauras/youtrack-cli", bin: "youtrack-cli", factory: "createYouTrackCli" },
];
const temporary = await realpath(await mkdtemp(join(tmpdir(), "cli-factory-packages-")));
const prefix = join(temporary, "global");
const working = join(temporary, "working");
const archives = join(temporary, "archives");
const windows = process.platform === "win32";
const modules = join(prefix, ...(windows ? [] : ["lib"]), "node_modules");
const bins = windows ? prefix : join(prefix, "bin");
const environment = { ...process.env };
// Never pass npm credentials or caller-controlled Node loaders into the smoke commands.
for (const key of Object.keys(environment)) {
  if (/^(?:npm_config_|npm_token$|node_auth_token$|node_options$|node_path$|teamcity_token$|youtrack_token$)/i.test(key)) {
    delete environment[key];
  }
}
const pathKey = Object.keys(environment).find((key) => key.toLowerCase() === "path") ?? "PATH";
environment[pathKey] = bins + delimiter + (environment[pathKey] ?? "");

function run(executable, argv, { cwd = working, input, timeout = 30_000 } = {}) {
  const result = spawnSync(executable, argv, {
    cwd, input, env: environment, encoding: "utf8", timeout,
    maxBuffer: 4 * 1024 * 1024, windowsHide: true,
  });
  // npm failures may contain registry/user configuration; do not echo captured streams.
  const npmError = /npm error code ([A-Z0-9]+)/.exec(result.stderr ?? "")?.[1];
  assert.ok(!result.error && result.status === 0,
    `Package check failed (${executable === process.execPath ? "node/npm" : "installed command"}, status ${result.status}, ${result.error?.code ?? npmError ?? "no process error"}).`);
  return result.stdout;
}

function npm(argv, options) {
  return run(process.execPath, [npmCli, ...argv,
    "--cache", join(temporary, "cache"),
    "--userconfig", join(temporary, "npmrc"),
    "--globalconfig", join(temporary, "npmrc-global"),
    "--registry", "https://registry.npmjs.org/",
  ], options);
}

function command(name, argv, input) {
  // Fixed command names/arguments only. Windows must execute npm's actual .cmd shim.
  return windows
    ? run(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", `${name}.cmd ${argv.join(" ")}`], { input })
    : run(join(bins, name), argv, { input });
}

try {
  await Promise.all([mkdir(working), mkdir(archives),
    writeFile(join(temporary, "npmrc"), ""), writeFile(join(temporary, "npmrc-global"), "")]);
  const license = await readFile(join(root, "LICENSE"), "utf8");
  const tarballs = [];
  for (const entry of packages) {
    const manifest = JSON.parse(await readFile(join(root, entry.directory, "package.json"), "utf8"));
    assert.equal(manifest.name, entry.name);
    assert.notEqual(manifest.private, true);
    assert.equal(manifest.license, "MIT");
    assert.equal(manifest.publishConfig.access, "public");
    assert.equal(await readFile(join(root, entry.directory, "LICENSE"), "utf8"), license);
    if (entry.bin) assert.deepEqual(manifest.bin, { [entry.bin]: "dist/src/bin.js" });
    const [packed] = JSON.parse(npm([
      "pack", "--json", "--ignore-scripts", "--workspace", entry.name,
      "--pack-destination", archives,
    ], { cwd: root }));
    const files = new Set(packed.files.map((file) => file.path));
    for (const file of ["package.json", "README.md", "LICENSE", "dist/src/index.js", "dist/src/index.d.ts"]) {
      assert.ok(files.has(file), `${entry.name}: missing ${file}`);
    }
    for (const file of files) {
      assert.ok(["package.json", "README.md", "LICENSE"].includes(file) ||
        /^dist\/src\/[\w-]+\.(?:js|d\.ts)(?:\.map)?$/.test(file),
      `${entry.name}: unexpected archive member ${file}`);
    }
    if (entry.bin) assert.ok(files.has("dist/src/bin.js"));
    tarballs.push(join(archives, packed.filename));
    console.log(`${entry.name}: ${files.size} package files checked`);
  }

  // Install all three exact tarballs together; npm must satisfy the Core dependency from
  // the tarball, even before the first Core version exists on the public registry.
  npm(["install", "--global", "--prefix", prefix, "--no-audit", "--no-fund", ...tarballs], { timeout: 180_000 });
  for (const entry of packages) {
    const installed = join(modules, ...entry.name.split("/"));
    assert.equal(await realpath(installed), installed, "Installed package must not be a workspace symlink.");
    const manifest = JSON.parse(await readFile(join(installed, "package.json"), "utf8"));
    assert.equal(manifest.name, entry.name);
    const coreUrl = JSON.parse(run(process.execPath, ["--input-type=module", "--eval", `
      for (const suffix of ["", "/testing", "/proof"]) await import("@eyeauras/cli-factory" + suffix);
      console.log(JSON.stringify(import.meta.resolve("@eyeauras/cli-factory")));
    `], { cwd: installed }));
    const core = await realpath(fileURLToPath(coreUrl));
    assert.ok(!relative(await realpath(prefix), core).startsWith(".."), "Core must resolve inside the isolated prefix.");
    if (!entry.bin) continue;
    const help = command(entry.bin, ["--help"]);
    assert.ok(help.includes(`Usage: ${entry.bin}`));
    assert.equal(command(entry.bin, ["--version"]).trim(), manifest.version);
    // Root/help output is intentionally human text even with --json. Exercise a real
    // JSON leaf through installed exports with synthetic AppData, never the user's profile.
    run(process.execPath, ["--input-type=module", "--eval", `
      import test from "node:test";
      import assert from "node:assert/strict";
      import { createCliFixture } from "@eyeauras/cli-factory/testing";
      import { ${entry.factory} as createApp } from ${JSON.stringify(entry.name)};
      test("installed JSON command with synthetic profile", async t => {
        const fixture = await createCliFixture(t, { applicationId: ${JSON.stringify(entry.bin)} });
        const app = fixture.createApplication(runtime => createApp(runtime));
        const profiles = await fixture.json(app, ["profile", "list"]);
        assert.equal(profiles.length, 1);
        assert.equal(profiles[0].name, "default");
        assert.equal(profiles[0].default, true);
      });
    `], { cwd: installed });
    const requests = [1, 2].map((id) => JSON.stringify({
      jsonrpc: "2.0", id, method: "cli.execute", params: { argv: ["--help"] },
    })).join("\n") + "\n";
    const frames = command(entry.bin, ["--json-rpc"], requests).trim().split("\n").map((line) => JSON.parse(line));
    assert.equal(frames.length, 2);
    for (const [index, frame] of frames.entries()) {
      assert.equal(frame.jsonrpc, "2.0");
      assert.equal(frame.id, index + 1);
      assert.ok(frame.result.help.includes(`Usage: ${entry.bin}`));
    }
    console.log(`${entry.bin}: installed executable, version, JSON and persistent RPC passed`);
  }
} finally {
  await rm(temporary, { recursive: true, force: true });
}
