// One supported npm/TypeScript build path. Publish readiness only after every workspace succeeds.
import { spawn } from "node:child_process";
import { rm, readFile, glob } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
await rm(join(root, ".cli-build.json"), { force: true });
const rootPackage = JSON.parse(
  await readFile(join(root, "package.json"), "utf8"),
);
const packages = new Map();
for (const pattern of rootPackage.workspaces ?? []) {
  for await (const path of glob(pattern + "/package.json", {
    cwd: root,
    exclude: ["**/node_modules/**"],
  })) {
    const manifest = JSON.parse(await readFile(join(root, path), "utf8"));
    packages.set(manifest.name, manifest);
  }
}
const built = new Set(),
  building = new Set();
async function build(name) {
  if (built.has(name)) return;
  if (building.has(name))
    throw new Error("Cyclic workspace build dependencies.");
  building.add(name);
  const pkg = packages.get(name);
  for (const dependency of Object.keys(pkg.dependencies ?? {}))
    if (packages.has(dependency)) await build(dependency);
  if (pkg.scripts?.build)
    await new Promise((resolve, reject) => {
      const child = spawn(
        process.execPath,
        [process.env.npm_execpath, "run", "build", "--workspace", name],
        { cwd: root, stdio: "inherit", windowsHide: true },
      );
      child.once("error", reject);
      child.once("exit", (code) =>
        code === 0
          ? resolve()
          : reject(new Error("Workspace build failed: " + name)),
      );
    });
  building.delete(name);
  built.add(name);
}
for (const name of packages.keys()) await build(name);
const { writeBuildManifest } = await import(
  "../packages/ipc/dist/src/build.js"
);
await writeBuildManifest(root);
