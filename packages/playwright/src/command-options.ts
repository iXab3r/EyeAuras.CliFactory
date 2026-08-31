import type { CommandContext, OptionDefinition } from "@eyeauras/cli-factory";
import type { BrowserOperationOptions } from "./index.js";

/** Opt-in leaf/auth-login options, not global flags in Core or an IPC protocol. */
export const browserCommandOptions: readonly OptionDefinition[] = [
  {
    flags: "--headed",
    description:
      "Show Chromium; wait for active browser operations before switching mode",
  },
  {
    flags: "--record-video",
    description:
      "Save sensitive browser video in profile AppData; report paths on stderr",
  },
];

export function browserOperationOptions(
  options: Record<string, unknown>,
  context: Pick<CommandContext, "io">,
): BrowserOperationOptions {
  return {
    headless: options.headed !== true,
    recordVideo: options.recordVideo === true,
    onVideo: (path) =>
      new Promise<void>((resolve, reject) => {
        context.io.error.write(
          "Browser video: " + JSON.stringify(path) + "\n",
          (error) => (error ? reject(error) : resolve()),
        );
      }),
  };
}
