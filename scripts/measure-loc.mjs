import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { glob, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const argv = process.argv.slice(2);
const json = argv.includes("--json");
const refIndex = argv.indexOf("--ref");
const ref = refIndex < 0 ? undefined : argv[refIndex + 1];
if (refIndex >= 0 && (!ref || ref.startsWith("--"))) {
  throw new Error("--ref requires a Git revision.");
}
const unknown = argv.filter((value, index) =>
  value !== "--json" && value !== "--ref" && index !== refIndex + 1,
);
if (unknown.length) throw new Error(`Unknown argument: ${unknown[0]}`);

const windowsGit = "C:\\Program Files\\Git\\cmd\\git.exe";
const git = process.platform === "win32" && existsSync(windowsGit) ? windowsGit : "git";
function runGit(args, encoding = "utf8") {
  const result = spawnSync(git, args, {
    cwd: root,
    encoding,
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.status !== 0) {
    const detail = typeof result.stderr === "string" ? result.stderr.trim() : "";
    throw new Error(detail || `Git failed: ${args.join(" ")}`);
  }
  return result.stdout;
}

const codeExtension = /\.(?:ts|mjs|js|cs|proto)$/i;
const excluded = ["**/.git/**", "**/node_modules/**", "**/dist/**"];
let paths;
if (ref) {
  paths = runGit(["ls-tree", "-r", "-z", "--name-only", ref])
    .split("\0")
    .filter((path) => codeExtension.test(path));
} else {
  const found = new Set();
  for (const pattern of ["**/*.{ts,mjs,js,cs,proto}", ".workspace/**/*.{ts,mjs,js,cs,proto}"]) {
    for await (const path of glob(pattern, { cwd: root, exclude: excluded })) {
      found.add(path.replaceAll("\\", "/"));
    }
  }
  paths = [...found];
}
paths.sort();

function workspace(path) {
  const parts = path.split("/");
  if ((parts[0] === "packages" || parts[0] === "integrations") && parts[1]) {
    return `${parts[0]}/${parts[1]}`;
  }
  if (parts[0] === "scripts") return "repository";
  if (parts[0] === ".workspace") return "workstreams";
  return parts[0] || "repository";
}

function category(path) {
  if (path.includes("/generated/")) return "generated";
  if (path.includes("/integration-tests/")) return "proof";
  if (path.includes("/tests/")) return "tests-support";
  if (path.includes("/src/")) return "production";
  if (path.includes("/scripts/") || path.startsWith("scripts/")) return "tooling";
  if (path.endsWith(".proto")) return "protocol-source";
  if (path.startsWith(".workspace/")) return "historical-workstream";
  return "other";
}

function role(path, primary) {
  if (primary !== "production") return primary;
  if (
    path === "packages/core/src/testing.ts" ||
    path === "packages/core/src/testing-contracts.ts"
  ) return "authoring-testing";
  if (
    path === "packages/core/src/proof.ts" ||
    path === "integrations/random-common/src/proof.ts" ||
    path === "integrations/random-common/src/live-cases.ts"
  ) return "authoring-proof";
  return "runtime";
}

function add(target, key, lines) {
  const item = target[key] ??= { files: 0, physical: 0, nonblank: 0, bytes: 0 };
  item.files++;
  item.physical += lines.physical;
  item.nonblank += lines.nonblank;
  item.bytes += lines.bytes;
}

const categories = {};
const roles = {};
const workspaces = {};
for (const path of paths) {
  const content = ref
    ? runGit(["show", `${ref}:${path}`], null)
    : await readFile(join(root, path));
  const text = Buffer.from(content).toString("utf8").replaceAll("\r\n", "\n");
  const split = text.length === 0 ? [] : text.split("\n");
  if (split.at(-1) === "") split.pop();
  const lines = {
    physical: split.length,
    nonblank: split.filter((line) => line.trim().length > 0).length,
    bytes: Buffer.byteLength(text),
  };
  const primary = category(path);
  add(categories, primary, lines);
  add(roles, role(path, primary), lines);
  const byCategory = workspaces[workspace(path)] ??= {};
  add(byCategory, primary, lines);
}

const revision = ref
  ? runGit(["rev-parse", ref]).trim()
  : runGit(["rev-parse", "HEAD"]).trim();
const report = {
  revision,
  source: ref ? `git:${ref}` : "working-tree",
  method: "Nonblank handwritten code lines include comments; generated output is separate.",
  categories,
  functionalRoles: roles,
  workspaces,
};

if (json) {
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
} else {
  console.log(`Revision: ${revision}`);
  console.log(`Source: ${report.source}`);
  console.log("\nCategory                    Files   Physical   Nonblank");
  for (const [name, value] of Object.entries(categories)) {
    console.log(
      name.padEnd(27) +
      String(value.files).padStart(7) +
      String(value.physical).padStart(11) +
      String(value.nonblank).padStart(11),
    );
  }
  console.log("\nWorkspace / category         Files   Nonblank");
  for (const [name, values] of Object.entries(workspaces)) {
    for (const [kind, value] of Object.entries(values)) {
      console.log(
        `${name} / ${kind}`.padEnd(30) +
        String(value.files).padStart(7) +
        String(value.nonblank).padStart(11),
      );
    }
  }
  console.log("\nFunctional role              Files   Nonblank");
  for (const [name, value] of Object.entries(roles)) {
    console.log(name.padEnd(27) + String(value.files).padStart(7) + String(value.nonblank).padStart(11));
  }
}
