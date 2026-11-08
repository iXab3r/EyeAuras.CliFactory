// Checks the actual Core archive in an isolated install; no product source or credentials.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const npmCli = process.env.npm_execpath;
assert.ok(npmCli, "Run this check through npm run test:packages.");
const registry = process.argv.includes("--registry");
const version = registry ? process.argv[process.argv.indexOf("--registry") + 1] : undefined;
assert.ok(!registry || /^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(version ?? ""), "Pass --registry <version>.");
const supplied = process.argv.includes("--tarball") ? process.argv[process.argv.indexOf("--tarball") + 1] : undefined;
assert.ok(!process.argv.includes("--tarball") || supplied, "Pass --tarball <archive>.");
const temp = await realpath(await mkdtemp(join(tmpdir(), "factory-package-")));
const prefix = join(temp, "install");
const archives = join(temp, "archives");
const environment = { ...process.env };
for (const key of Object.keys(environment)) {
  if (/token|secret|password|^npm_config_|^node_options$|^node_path$/i.test(key)) delete environment[key];
}
function run(tool, argv, { cwd = prefix, input } = {}) {
  const result = spawnSync(tool, argv, { cwd, input, env: environment, encoding: "utf8", timeout: 180_000, maxBuffer: 4 * 1024 * 1024, windowsHide: true });
  assert.ok(!result.error && result.status === 0, `Package check failed: status ${result.status}, ${result.error?.code ?? "process failure"}.`);
  return result.stdout;
}
function npm(argv, options) {
  return run(process.execPath, [npmCli, ...argv, "--cache", join(temp, "cache"), "--userconfig", join(temp, "npmrc"),
    "--globalconfig", join(temp, "global-npmrc"), "--registry", "https://registry.npmjs.org/"], options);
}
async function closedReader(argv, input = "") {
  const child = spawn(process.execPath, [join(prefix, "fixture.mjs"), ...argv], { cwd: prefix, env: environment });
  let stderr = "";
  child.stderr.setEncoding("utf8").on("data", chunk => { stderr += chunk; });
  const timer = setTimeout(() => child.kill(), 10_000);
  try {
    const done = new Promise((resolve, reject) => { child.once("error", reject); child.once("close", (code, signal) => resolve({ code, signal })); });
    child.stdout.destroy();
    child.stdin.end(input);
    assert.deepEqual(await done, { code: 141, signal: null });
    assert.equal(stderr, "");
  } finally { clearTimeout(timer); }
}
try {
  await Promise.all([mkdir(prefix), mkdir(archives), writeFile(join(temp, "npmrc"), ""), writeFile(join(temp, "global-npmrc"), "")]);
  let archive;
  if (registry) {
    const [packed] = JSON.parse(npm(["pack", `@eyeauras/cli-factory@${version}`, "--json", "--ignore-scripts", "--pack-destination", archives]));
    archive = join(archives, packed.filename);
  } else if (supplied) archive = resolve(root, supplied);
  else {
    const [packed] = JSON.parse(npm(["pack", "--json", "--ignore-scripts", "--workspace", "@eyeauras/cli-factory", "--pack-destination", archives], { cwd: root }));
    archive = join(archives, packed.filename);
  }
  const [packed] = JSON.parse(npm(["pack", archive, "--dry-run", "--ignore-scripts", "--json"]));
  const files = new Set(packed.files.map(file => file.path));
  for (const file of ["package.json", "README.md", "LICENSE", "dist/src/index.js", "dist/src/index.d.ts", "dist/src/testing.js", "dist/src/proof.js"]) assert.ok(files.has(file), `Missing ${file}`);
  for (const file of files) assert.ok(["package.json", "README.md", "LICENSE"].includes(file) || /^dist\/src\/[\w-]+\.(?:js|d\.ts)(?:\.map)?$/.test(file), `Unexpected archive member ${file}`);
  npm(["install", "--prefix", prefix, "--no-audit", "--no-fund", archive]);
  const installed = join(prefix, "node_modules/@eyeauras/cli-factory");
  assert.equal(await realpath(installed), installed, "Core must not be a workspace symlink.");
  const manifest = JSON.parse(await readFile(join(installed, "package.json"), "utf8"));
  assert.equal(manifest.name, "@eyeauras/cli-factory");
  assert.equal(manifest.version, registry ? version : JSON.parse(await readFile(join(root, "packages/core/package.json"), "utf8")).version);
  assert.equal(await readFile(join(installed, "LICENSE"), "utf8"), await readFile(join(root, "LICENSE"), "utf8"));
  await writeFile(join(prefix, "fixture.mjs"), await readFile(join(root, "scripts/package-fixture.mjs")));
  const resolved = JSON.parse(run(process.execPath, ["--input-type=module", "--eval", 'for (const suffix of ["", "/testing", "/proof"]) await import("@eyeauras/cli-factory" + suffix); console.log(JSON.stringify(import.meta.resolve("@eyeauras/cli-factory")));']));
  assert.ok(!relative(prefix, await realpath(fileURLToPath(resolved))).startsWith(".."));
  assert.match(run(process.execPath, ["fixture.mjs", "--help"]), /Usage: package-fixture/);
  assert.equal(run(process.execPath, ["fixture.mjs", "--version"]).trim(), manifest.version);
  assert.deepEqual(run(process.execPath, ["fixture.mjs", "items", "--json"]).trim().split("\n").map(JSON.parse), [{ id: 1 }, { id: 2 }]);
  const input = [["items"], ["profile", "list"], ["--help"]].map((argv, id) => JSON.stringify({ jsonrpc: "2.0", id, method: "cli.execute", params: { argv } })).join("\n") + "\n";
  const frames = run(process.execPath, ["fixture.mjs", "--json-rpc"], { input }).trim().split("\n").map(JSON.parse);
  assert.equal(frames.length, 3);
  assert.deepEqual(frames[0].result, [{ id: 1 }, { id: 2 }]);
  assert.equal(frames[1].result[0].name, "default");
  assert.match(frames[2].result.help, /Usage: package-fixture/);
  await closedReader(["--help"]);
  await closedReader(["--json-rpc"], input);
  await closedReader(["items", "--json"]);
  if (process.platform !== "win32") {
    const pipe = spawnSync("bash", ["-o", "pipefail", "-c", '"$1" fixture.mjs --help | head -n 1', "fixture", process.execPath], { cwd: prefix, env: environment, encoding: "utf8", timeout: 10000 });
    assert.ok([0, 141].includes(pipe.status)); assert.equal(pipe.stderr, ""); assert.match(pipe.stdout, /^Usage: package-fixture/);
  }
  if (process.platform === "win32") run(process.execPath, ["fixture.mjs", "--dpapi-check"]);
  console.log(`Core ${manifest.version}: ${files.size} archive files, isolated exports, NDJSON, profiles, persistent RPC and closed pipes passed (${process.version}/${process.platform}/${process.arch}).`);
} finally { await rm(temp, { recursive: true, force: true }); }
