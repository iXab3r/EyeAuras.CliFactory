import { copyFileSync, readFileSync, writeFileSync, globSync } from "node:fs";
copyFileSync("proto/cli-host.proto", "dist/cli-host.proto");
// The upstream generator emits trailing whitespace; keep committed output reproducible and clean.
for (const path of globSync("src/generated/**/*.ts")) {
  const text = readFileSync(path, "utf8");
  writeFileSync(path, text.replace(/[ \t]+$/gm, "").trimEnd() + "\n");
}
