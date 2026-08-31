// Test-only browser boundary for the actual packaged entry point and its spawned host.
import { AppArguments } from "@eyeauras/cli-factory";
import { chromium } from "playwright";
import { join } from "node:path";
import { appendFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { site } from "./fixture.js";

const root = process.env.RANDOM_PW_TEST_ROOT;
if (!root) throw new Error("Missing synthetic browser AppData root.");
AppArguments.CurrentEnvironment = () => ({
  AppDomainDirectory: root,
  ApplicationExecutablePath: join(root, "fixture.js"),
  EnvironmentAppData: root,
  EnvironmentLocalAppData: root,
  ProcessId: process.pid,
});
const trace = join(root, "runtime-proof.jsonl");
const launch = chromium.launch.bind(chromium);
chromium.launch = async (options) => {
  const browser = await launch(options),
    identity = randomUUID();
  const session = await browser.newBrowserCDPSession();
  const processes = await session.send("SystemInfo.getProcessInfo");
  await session.detach();
  const browserPid = processes.processInfo.find(
    (item) => item.type === "browser",
  )?.id;
  await appendFile(
    trace,
    JSON.stringify({
      event: "launch",
      identity,
      hostPid: process.pid,
      browserPid,
      headless: options?.headless,
    }) + "\n",
  );
  const newContext = browser.newContext.bind(browser);
  browser.newContext = async (options) => {
    const context = await newContext(options);
    await site({ quota: 1000, requests: [], submits: 0 })(context);
    return context;
  };
  const close = browser.close.bind(browser);
  browser.close = async (options) => {
    await close(options);
    await appendFile(
      trace,
      JSON.stringify({ event: "close", identity }) + "\n",
    );
  };
  return browser;
};
