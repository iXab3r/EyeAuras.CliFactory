import { createHash, randomUUID } from "node:crypto";
import {
  glob,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

export const manifestName = ".cli-build.json";
interface Package {
  workspaces?: string[];
  main?: string;
  bin?: string | Record<string, string>;
  cliFactory?: { runtimeInputs?: string[] };
}
const readJson = async (path: string) =>
  JSON.parse(await readFile(path, "utf8"));
const relativePath = (root: string, path: string) =>
  relative(root, path).replaceAll("\\", "/");

export async function buildRoot(entryPoint: URL | string): Promise<string> {
  const path =
    entryPoint instanceof URL || entryPoint.startsWith("file:")
      ? fileURLToPath(entryPoint)
      : entryPoint;
  let directory = dirname(resolve(path));
  for (;;) {
    try {
      await stat(join(directory, "package-lock.json"));
      return directory;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    const parent = dirname(directory);
    if (parent === directory)
      throw new Error(
        "CLI build requires a locked npm project. Run npm run build from its root.",
      );
    directory = parent;
  }
}

/** Conservative whole-workspace fingerprint: no hand-maintained application dependency lists. */
export async function buildFingerprint(root: string): Promise<string> {
  const files = new Set<string>([
    join(root, "package.json"),
    join(root, "package-lock.json"),
  ]);
  const rootPackage = (await readJson(join(root, "package.json"))) as Package;
  const directories = new Set([root]);
  for (const pattern of rootPackage.workspaces ?? []) {
    for await (const path of glob(pattern + "/package.json", {
      cwd: root,
      exclude: ["**/node_modules/**"],
    })) {
      const directory = dirname(resolve(root, path));
      if (relativePath(root, directory).startsWith("../"))
        throw new Error("Workspace must belong to the build root.");
      directories.add(directory);
    }
  }
  const visit = async (path: string): Promise<void> => {
    for (const item of await readdir(path, { withFileTypes: true })) {
      if (["tests", "integration-tests"].includes(item.name)) continue;
      const child = join(path, item.name);
      if (item.isSymbolicLink())
        throw new Error(
          "Runtime artifact directories must not contain symlinks.",
        );
      if (item.isDirectory()) await visit(child);
      else if (/\.(?:[cm]?js|json|proto|node|wasm)$/.test(item.name))
        files.add(child);
    }
  };
  for (const directory of directories) {
    const manifest = join(directory, "package.json");
    files.add(manifest);
    const pkg = (await readJson(manifest)) as Package;
    const entries = [
      pkg.main,
      ...(typeof pkg.bin === "string"
        ? [pkg.bin]
        : Object.values(pkg.bin ?? {})),
    ].filter((p): p is string => !!p);
    for (const entry of entries) await stat(resolve(directory, entry));
    for (const folder of ["dist", "scripts"]) {
      try {
        await visit(join(directory, folder));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        if (
          folder === "dist" &&
          entries.some((p) => p.startsWith("./dist/") || p.startsWith("dist/"))
        )
          throw error;
      }
    }
    // Runtime package maintainers declare patched dependency files here; app authors do not.
    const require = createRequire(manifest);
    for (const input of pkg.cliFactory?.runtimeInputs ?? [])
      files.add(require.resolve(input));
  }
  // Detect installs made without updating the root lockfile too.
  try {
    await stat(join(root, "node_modules", ".package-lock.json"));
    files.add(join(root, "node_modules", ".package-lock.json"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const hash = createHash("sha256").update(
    JSON.stringify([process.version, process.platform, process.arch]),
  );
  for (const file of [...files].sort((a, b) =>
    relativePath(root, a) < relativePath(root, b) ? -1 : 1,
  )) {
    const key = relativePath(root, file);
    if (key.startsWith("../") || isAbsolute(key))
      throw new Error("Runtime inputs must belong to the npm build root.");
    const contents = await readFile(file);
    hash.update(JSON.stringify([key, contents.length]));
    hash.update(contents);
  }
  return hash.digest("hex");
}

export async function writeBuildManifest(root: string): Promise<string> {
  const build = await buildFingerprint(root);
  const temporary = join(root, manifestName + "." + randomUUID() + ".tmp");
  try {
    await writeFile(temporary, JSON.stringify({ version: 1, build }) + "\n");
    await rename(temporary, join(root, manifestName));
  } finally {
    await rm(temporary, { force: true });
  }
  return build;
}

export async function readBuildManifest(
  entryPoint: URL | string,
): Promise<string> {
  try {
    const root = await buildRoot(entryPoint);
    const manifest = (await readJson(join(root, manifestName))) as {
      version: number;
      build: string;
    };
    if (
      manifest.version !== 1 ||
      !/^[a-f0-9]{64}$/.test(manifest.build) ||
      manifest.build !== (await buildFingerprint(root))
    )
      throw new Error("Stale build.");
    return manifest.build;
  } catch {
    throw new Error(
      "CLI build is missing, stale or incomplete. Run npm run build from the project root. Server status/stop remain available.",
    );
  }
}
