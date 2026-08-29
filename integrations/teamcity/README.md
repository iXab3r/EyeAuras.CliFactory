# TeamCity CLI

`teamcity-cli` is the first executable integration built on the reusable
`@eyeauras/cli-factory` npm package. The package under this directory owns TeamCity REST paths,
locators, DTOs, and command vocabulary; generic command-tree, profile, credential, permission,
output, and JSON-RPC behavior stays in `packages/core`.

## Operational v1 command tree

| Command | Purpose | Permission |
|---|---|---|
| `server status` | Show server version, role, and clock | `ReadOnly` |
| `projects list`, `projects show <id>` | Discover projects | `ReadOnly` |
| `jobs list`, `jobs show <id>`, `jobs status <id>` | Discover build configurations and their latest operational build | `ReadOnly` |
| `jobs run <id>` | Queue a build, optionally with `--branch` and `--comment` | `Update` |
| `builds list`, `builds show <id>` | Inspect builds across all branches and states | `ReadOnly` |
| `builds tests/problems/changes <id>` | Diagnose a build | `ReadOnly` |
| `builds cancel <id>` | Cancel a running build | `Update` |
| `queue list` | Inspect queued builds | `ReadOnly` |
| `queue cancel <id>` | Cancel a queued build while preserving cancellation metadata | `Update` |
| `agents list`, `agents show <id>` | Inspect build agents | `ReadOnly` |

Collection commands accept `--limit <count>` from 1 to 100 and `--start <offset>` starting at
zero. They return one plain array page and never auto-page. Run a branch without a leaf, such as
`teamcity-cli builds`, to see its generated help and options.

`jobs status` and `builds list` deliberately disable TeamCity's implicit build filter and include
default and non-default branches. This keeps running, failed, canceled, personal, and branch
builds visible instead of reporting an older successful default-branch build.

## Profiles and authentication

The public CLI has no compiled-in TeamCity URL. The virtual `default` profile exists immediately,
but service commands cannot run until its required URL and authentication mode are configured.
Configure separate profiles whenever URLs or security realms differ:

```text
teamcity-cli profile configure uat --url https://teamcity-uat.example.com --token-stdin
teamcity-cli profile configure production --url https://teamcity.example.com --token-stdin
teamcity-cli profile set-default production
teamcity-cli auth status --profile production --json
```

In an ordinary terminal, running `teamcity-cli` or a service command with an incomplete profile
starts the same guided configuration. JSON, JSON-RPC, redirected/non-TTY input, and programmatic
execution never prompt; they fail before networking and print an actionable `profile configure`
command.

JetBrains currently exposes a public TeamCity server that supports guest REST reads. Create it as
an explicit demo profile; the CLI never selects it or contacts it automatically:

```text
teamcity-cli profile configure jetbrains-demo --url https://teamcity.jetbrains.com --guest
teamcity-cli server status --profile jetbrains-demo --json
```

Guest mode uses TeamCity's `/guestAuth/app/rest` path and sends no Authorization header. Its
available data and uptime are controlled by JetBrains. To convert a guest profile to token auth,
reconfigure it with `--no-guest --token-stdin`.

Use `profile set <name> --url <url>` to update an existing profile. A default profile always
exists. To remove one, make another profile default first and then run `profile delete <name>`;
the final remaining profile cannot be deleted.

For token profiles, configuration validates the token through the current-user REST endpoint before
the common package stores it in the platform credential store. `auth login` remains available for
credential rotation. Tokens never enter profile JSON. For automation, pipe the token to
`--token-stdin` or set `TEAMCITY_TOKEN`; do not put it in a command-line argument.

## Permission fail-safe

`ReadOnly` is enabled by default. The three side-effect commands require the profile-specific
`Update` gate:

```text
teamcity-cli permissions list --profile uat
teamcity-cli permissions grant Update --profile uat
teamcity-cli jobs run Example_Build --profile uat --branch main --json
teamcity-cli permissions revoke Update --profile uat
```

Granting `Update` in UAT does not grant it in Production. This local gate reduces accidental AI
actions; it does not replace TeamCity's own authorization.

## Machine-oriented output

Append `--json` to any leaf command for stable machine-readable output:

```text
teamcity-cli builds list --state running --limit 20 --json
teamcity-cli builds problems 12345 --json
```

For several calls in one Node process, start `teamcity-cli --json-rpc` and send one JSON-RPC 2.0
object per line:

```json
{"jsonrpc":"2.0","id":1,"method":"cli.execute","params":{"argv":["server","status","--profile","uat"]}}
{"jsonrpc":"2.0","id":2,"method":"cli.execute","params":{"argv":["jobs","list","--profile","production"]}}
```

## Tests and real-service smoke

The default suite is offline. MSW verifies the native `fetch` boundary, including exact REST
methods, paths, locators, requested fields, mutation bodies, permission denial before networking,
profile isolation, and credential-safe errors.

Run the integration suite through the repository command:

```text
npm test
```

The live smoke test is read-only and explicitly opt-in. It checks authentication, server status,
and one bounded page each of projects, jobs, builds, queue entries, and agents; it never queues or
cancels a build.

This current smoke is legacy: it injects URL/token environment variables into `TeamCityClient` and
does not prove the packaged CLI, persisted profile, or OS keyring. It remains available during the
migration but is not the pattern for new integrations. [Issue #4](https://github.com/iXab3r/EyeAuras.CliFactory/issues/4)
tracks its replacement with an explicit local profile-backed proof that stays outside `npm test` and
all CI/CD workflows.

PowerShell:

```text
$env:TEAMCITY_INTEGRATION = "1"
$env:TEAMCITY_URL = "https://teamcity.example.com"
$env:TEAMCITY_TOKEN = "<token supplied outside Git>"
npm test
```

Bash/zsh:

```text
TEAMCITY_INTEGRATION=1 TEAMCITY_URL=https://teamcity.example.com TEAMCITY_TOKEN="$TEAMCITY_TOKEN" npm test
```

See [the integration authoring guide](../../docs/integrations.md) for how this product references
the common package and how to start the next in-repo or external integration.
