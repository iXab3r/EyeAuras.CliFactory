# AI CLI Factory Core

Shared TypeScript/Node.js primitives for consistent command-line tools used by humans and AI agents.
Requires Node.js 22 or newer. Licensed under MIT.

Core supplies recursive commands and help, human/JSON output, persistent JSON-RPC,
profile isolation, platform-protected credentials, permission gates and resource disposal.
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

Handlers can return `streamResult(async function* (signal) { ... })` for a finite sequence.
Acquire resources and create signal-bound clients inside the producer, pass its signal to pending
work and clean up in `finally`. Ordinary CLI `--json` writes each item as NDJSON with backpressure;
human output, `execute` and JSON-RPC receive an array. Streaming failures leave emitted lines on
stdout and report errors and failed-result metadata on stderr. Ordinary result output is unchanged.

Standalone secrets use `PlatformSecretStore` with no plaintext fallback: Windows DPAPI
CurrentUser encrypted files under each profile's AppData `secrets/` directory, macOS Keychain,
or Linux system keyring. Help does not need a configured service or stored credentials.
Windows Credential Manager is no longer used. Sign in again per CLI/profile and reimport
auxiliary secrets; existing profiles, permissions and old Credential Manager entries are retained.

See the [integration authoring guide](https://github.com/iXab3r/EyeAuras.CliFactory/blob/main/docs/integrations.md),
[canonical design](https://github.com/iXab3r/EyeAuras.CliFactory/blob/main/docs/DESIGN.md),
and [release guide](https://github.com/iXab3r/EyeAuras.CliFactory/blob/main/docs/npm-release.md).
