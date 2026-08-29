# AI CLI Factory

**Build the next service CLI faster than the previous one.**

AI CLI Factory is a TypeScript/Node.js workspace for creating consistent command-line
integrations. Each product describes a command tree and its service calls; the factory supplies
the repetitive parts: help, profiles, protected credentials, human and JSON output, and a
persistent JSON-RPC session for agents.

The repository name is `EyeAuras.CliFactory`. The human-facing project name is **AI CLI
Factory**.

> Status: foundation stage. The command tree, profiles, token authentication, JSON output,
> JSON-RPC transport, and the first TeamCity client are implemented as a narrow vertical slice.
> The APIs are not stable yet.

```mermaid
flowchart LR
    human["Human"] --> cli["Generated CLI surface"]
    agent["AI agent"] -->|"--json / --json-rpc"| cli
    cli --> tree["Command tree"]
    cli --> profiles["Profiles"]
    cli --> auth["OS credential store"]
    tree --> integration["Small service integration"]
    profiles --> integration
    auth --> integration
    integration --> service["TeamCity · future services"]
```

## Why a factory?

Service CLIs tend to repeat the same infrastructure and slowly drift apart. This project makes
those decisions once:

- Commands form a real tree: `teamcity-cli jobs list`, `teamcity-cli jobs show <id>`, and deeper
  branches use the same model. Help is generated at every level.
- Handlers return data. The framework owns human rendering and the mandatory `--json` form, so
  integration authors do not implement output twice.
- `auth login`, `auth status`, and `auth logout` are standard commands. Secrets live in the OS
  credential store (Windows Credential Manager/DPAPI, macOS Keychain, or the Linux keyring), not
  in profile JSON.
- `profile` commands isolate endpoints and configuration such as UAT and Production.
- `--json-rpc` keeps the process alive and accepts multiple commands over newline-delimited
  JSON-RPC 2.0, avoiding repeated Node startup for agent workflows.
- HTTP behavior is developed mock-first. Sanitized fixtures can be captured from a real service
  or derived from its documentation, then used for deterministic tests.

## The authoring surface

An integration describes commands once and returns ordinary objects:

```ts
const cli = createCli({
  name: "teamcity-cli",
  description: "TeamCity command line client",
  profile: {
    defaults: { url: "https://teamcity.example.com" },
    fields: [
      { name: "url", flags: "--url <url>", description: "TeamCity server URL" },
    ],
  },
  auth: tokenAuth({ env: "TEAMCITY_TOKEN", validate: validateToken }),
  commands: [
    command("jobs", "Work with TeamCity build configurations", [
      command("list", "List jobs", async (_input, context) =>
        createClient(context).listJobs()),
    ]),
  ],
});
```

That declaration produces the tree help and both output modes:

```text
teamcity-cli help
teamcity-cli jobs
teamcity-cli jobs list
teamcity-cli jobs list --json
```

It also adds the common commands:

```text
teamcity-cli profile list
teamcity-cli profile set production --url https://teamcity.example.com
teamcity-cli profile use production

teamcity-cli auth login --token-stdin
teamcity-cli auth status
teamcity-cli auth logout
```

For automation, prefer `--token-stdin` or the integration's environment variable. Supplying a
secret as a command-line argument can expose it through process inspection.

## Persistent JSON-RPC mode

Start a session:

```text
teamcity-cli --json-rpc
```

Then send one JSON object per line:

```json
{"jsonrpc":"2.0","id":1,"method":"cli.execute","params":{"argv":["jobs","list"]}}
{"jsonrpc":"2.0","id":2,"method":"cli.execute","params":{"argv":["jobs","show","MyBuild"]}}
```

Each request receives a JSON-RPC result or error on its own line. The same process and profile
state remain available for the whole session.

## Repository layout

| Path | Purpose |
|---|---|
| `packages/core` | Reusable CLI tree, output, profile, auth, and JSON-RPC primitives |
| `integrations/teamcity` | First in-house product and executable example |
| `docs/DESIGN.md` | Canonical architecture and invariants |
| `docs/testing.md` | Mock-first and opt-in integration-test workflow |
| `scripts/bootstrap.cs` | .NET 10 file-based bootstrap for submodules and npm dependencies |

`CliWrap.ts` is planned as a separate repository and will be connected as a Git submodule when
its first process-pipeline consumer is implemented. It is deliberately not represented by an
empty placeholder today.

## Getting started

Requirements: Node.js 22+ and npm 11+. .NET 10 is only needed for the one-command bootstrap.

```text
dotnet run --file scripts/bootstrap.cs
npm test
npm run teamcity -- --help
```

The TeamCity profile starts with `https://teamcity.example.com`. Configure a token before making a
real request:

```text
$env:TEAMCITY_TOKEN | npm run teamcity -- auth login --token-stdin
npm run teamcity -- jobs list --json
```

On bash/zsh, use `printf '%s' "$TEAMCITY_TOKEN" | npm run teamcity -- auth login --token-stdin`.

## Development principles

- Start from a real user command, then extract only the reusable mechanism it proves.
- Keep integrations thin and service-shaped; keep generic behavior in `packages/core`.
- Never store secrets in config, fixtures, logs, snapshots, or Git.
- Make mock tests the default and real-service tests explicit and opt-in.
- Prefer deletion and direct platform/library use over new abstraction layers.
- AI agents begin at [`AGENTS.md`](AGENTS.md) and treat [`docs/DESIGN.md`](docs/DESIGN.md) as the
  canonical specification.

See [the design](docs/DESIGN.md) and [testing workflow](docs/testing.md) for the detailed contract.
