import { createHash, randomUUID } from "node:crypto";
import { lstat, readFile, readdir, realpath, rename, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const marker = ".cli-package-build.json";
const readJson = async (path: string) => JSON.parse(await readFile(path, "utf8"));

async function packageRoot(entry: string | URL): Promise<string> {
  let directory = dirname(entry instanceof URL || String(entry).startsWith("file:")
    ? fileURLToPath(entry) : resolve(entry));
  for (;;) {
    try { await lstat(join(directory, "package.json")); return directory; }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    const parent = dirname(directory);
    if (parent === directory) throw new Error("Package root not found.");
    directory = parent;
  }
}

async function artifactHash(root: string): Promise<string> {
  const pkg = await readJson(join(root, "package.json"));
  if (!Array.isArray(pkg.files) || !pkg.files.length) throw new Error("Declare explicit package files before preparing a hosted artifact.");
  const files = new Set<string>(["package.json"]);
  const visit = async (path: string): Promise<void> => {
    const item = await lstat(join(root, path));
    if (item.isSymbolicLink()) throw new Error("Package artifacts must not contain symlinks.");
    if (item.isDirectory()) for (const name of await readdir(join(root, path))) await visit(join(path, name));
    else if (item.isFile()) files.add(path);
    else throw new Error("Unsupported package artifact.");
  };
  for (const input of pkg.files) {
    if (input === marker) continue;
    if (typeof input !== "string" || !input || isAbsolute(input) || /[*!?\[\]{}]/.test(input))
      throw new Error("Package files must be explicit relative paths without globs.");
    const path = relative(root, resolve(root, input));
    if (!path || path.startsWith("..") || path.split(/[\\/]/).includes("node_modules"))
      throw new Error("Package artifact path is outside the supported files contract.");
    let component = root;
    for (const part of path.split(/[\\/]/)) {
      component = join(component, part);
      if ((await lstat(component)).isSymbolicLink()) throw new Error("Package artifacts must not contain symlink ancestors.");
    }
    await visit(path);
  }
  const hash = createHash("sha256");
  for (const path of [...files].sort()) {
    const bytes = await readFile(join(root, path));
    hash.update(JSON.stringify([path.replaceAll("\\", "/"), bytes.length])).update(bytes);
  }
  return hash.digest("hex");
}

/** Build-only API. Run after compilation, before npm pack; include the returned marker in files. */
export async function writePackageBuildManifest(root: string): Promise<string> {
  root = resolve(root);
  const pkg = await readJson(join(root, "package.json"));
  // The marker is listed for npm distribution, but never hashes itself.
  if (!pkg.files?.includes(marker)) throw new Error("Include .cli-package-build.json in package files.");
  const build = await artifactHash(root);
  const temp = join(root, marker + "." + randomUUID() + ".tmp");
  try {
    await writeFile(temp, JSON.stringify({ version: 1, artifact: build }) + "\n");
    await rename(temp, join(root, marker));
  } finally { await rm(temp, { force: true }); }
  return build;
}

export async function readPackageBuildManifest(entry: string | URL): Promise<string | undefined> {
  const root = await realpath(await packageRoot(entry));
  let manifest: { version: number; artifact: string };
  try { manifest = await readJson(join(root, marker)); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined; throw error; }
  if (manifest.version !== 1 || !/^[a-f0-9]{64}$/.test(manifest.artifact) || manifest.artifact !== await artifactHash(root))
    throw new Error("Hosted package artifact is missing or stale. Rebuild and reinstall the package; ipc-server status/stop remain available.");
  // Installed dependencies are immutable artifacts. Include the resolved dependency graph's
  // deployed bytes in owner compatibility, independently of install paths or a parent workspace.
  const graph = new Map<string, { path: string; digest: string; dependencies: [string, string][] }>();
  const visit = async (directory: string): Promise<void> => {
    if (graph.has(directory)) return;
    const pkg = await readJson(join(directory, "package.json"));
    const runtime = createHash("sha256");
    const scan = async (folder: string): Promise<void> => {
      for (const item of (await readdir(folder, { withFileTypes: true })).sort((a, b) => a.name < b.name ? -1 : 1)) {
        if (["node_modules", ".git"].includes(item.name)) continue;
        const file = join(folder, item.name);
        if (item.isSymbolicLink()) throw new Error("Installed runtime inputs must not contain symlinks.");
        if (item.isDirectory()) await scan(file);
        else if (item.isFile()) {
          const bytes = await readFile(file);
          runtime.update(JSON.stringify([relative(directory, file).replaceAll("\\", "/"), bytes.length])).update(bytes);
        }
      }
    };
    if (directory === root) runtime.update(manifest.artifact);
    else await scan(directory);
    const node = {path: relative(root, directory).replaceAll("\\", "/"), digest: runtime.digest("hex"), dependencies: [] as [string,string][]};
    graph.set(directory,node); // Break cycles while retaining every resolution edge.
    const dependencyRoot = async (name: string): Promise<string> => {
      // Standard npm ancestry, including ESM-only packages. Custom global search paths
      // and loaders are intentionally outside the supported artifact contract.
      let parent = directory;
      for (;;) {
        const candidate = join(parent, "node_modules", ...name.split("/"));
        try { await lstat(join(candidate, "package.json")); return await realpath(candidate); }
        catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
        const next = dirname(parent); if (next === parent) break; parent = next;
      }
      throw Object.assign(new Error("Installed dependency is missing."), {code:"MODULE_NOT_FOUND"});
    };
    const required = new Set([...Object.keys(pkg.dependencies ?? {}).filter(name => !pkg.optionalDependencies?.[name]),
      ...Object.keys(pkg.peerDependencies ?? {}).filter(name => !pkg.peerDependenciesMeta?.[name]?.optional)]);
    const optional = new Set([...Object.keys(pkg.optionalDependencies ?? {}),
      ...Object.keys(pkg.peerDependencies ?? {}).filter(name => pkg.peerDependenciesMeta?.[name]?.optional)]);
    for (const name of [...new Set([...required,...optional])].sort()) {
      let dependency: string;
      try { dependency = await dependencyRoot(name); }
      catch (error) { if (!required.has(name) && (error as NodeJS.ErrnoException).code === "MODULE_NOT_FOUND") continue; throw error; }
      node.dependencies.push([name,relative(root,dependency).replaceAll("\\", "/")]);
      await visit(dependency);
    }
  };
  await visit(root);
  return createHash("sha256").update(JSON.stringify([manifest.artifact, process.version, process.platform, process.arch, [...graph.values()].sort((a,b) => a.path < b.path ? -1 : 1)])).digest("hex");
}
