// Reproducible, fail-closed workaround for microsoft/playwright#41630 and #40741.
// Playwright's public launch options do not expose windowsHide. Hide only its two
// console-subsystem helpers; applying SW_HIDE to chrome.exe would break --headed.
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const playwrightRequire = createRequire(
  require.resolve("playwright/package.json"),
);
const coreRequire = createRequire(
  playwrightRequire.resolve("playwright-core/package.json"),
);
const version = coreRequire("./package.json").version;
if (version !== "1.62.1")
  throw new Error(
    "Review the Windows console workaround before changing Playwright 1.62.1.",
  );
const path = playwrightRequire.resolve("playwright-core/lib/coreBundle");
const before = [
  "    shell: options.shell,",
  "    stdio",
  "  };",
  "  const spawnedProcess = childProcess.spawn(",
].join("\n");
const hidden = String.raw`    // CliFactory: hide console helpers, never the explicitly headed browser.
    windowsHide: process.platform === "win32" && /(?:^|[\\/])(?:chrome-headless-shell|ffmpeg-win64)\.exe$/i.test(options.command),
`;
const after = before.replace("    stdio", hidden + "    stdio");
const source = readFileSync(path, "utf8");
if (source.includes(after)) {
  if (source.split(after).length !== 2)
    throw new Error(
      "Ambiguous patched Playwright launcher; review dependency contents.",
    );
} else {
  if (source.split(before).length !== 2)
    throw new Error(
      "Unexpected Playwright launcher; Windows console workaround was not applied.",
    );
  writeFileSync(path, source.replace(before, after));
}
