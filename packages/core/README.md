# AI CLI Factory Core

Shared TypeScript/Node.js primitives for consistent command-line tools used by humans and AI agents.
Requires Node.js 22 or newer. Licensed under MIT.

Core supplies recursive commands and help, human/JSON output, persistent JSON-RPC,
profile isolation, OS-keyring credentials, permission gates and resource disposal.
Service vocabulary and HTTP/browser behavior belong to integrations.

```ts
import { command, createCli } from "@eyeauras/cli-factory";

const app = createCli({
  name: "example-cli",
  description: "A small example CLI",
  commands: [command("echo <text>", "Return text", ({ args }) => ({ text: args.text }))],
});
try {
  process.exitCode = await app.run();
} finally {
  await app.dispose();
}
```

The default export surface is the runtime. Separate `@eyeauras/cli-factory/testing`
and `@eyeauras/cli-factory/proof` entries provide offline fixtures and bounded,
explicit local integration-proof helpers. IPC and Playwright are optional modules;
Core imports neither.

Standalone secrets use the OS credential store with no plaintext fallback.
Authenticated commands require an available macOS Keychain, Windows Credential Manager,
or Linux system keyring. Help does not need a configured service or stored credentials.

See the [integration authoring guide](https://github.com/iXab3r/EyeAuras.CliFactory/blob/main/docs/integrations.md),
[canonical design](https://github.com/iXab3r/EyeAuras.CliFactory/blob/main/docs/DESIGN.md),
and [release guide](https://github.com/iXab3r/EyeAuras.CliFactory/blob/main/docs/npm-release.md).
