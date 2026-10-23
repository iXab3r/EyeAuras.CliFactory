# npm installation and release

Core, YouTrack CLI and TeamCity CLI are released together under one version. The C# release
driver in `build/` checks, packs, publishes (Core first) and verifies them. The same commands
run locally and in TeamCity. GitHub hosts the source, pull requests, tags and Release assets;
GitHub Actions does not build or publish this repository.

## Package and executable names

| npm package | Installed command |
|---|---|
| `@eyeauras/cli-factory` | Library only |
| `@eyeauras/youtrack-cli` | `youtrack-cli` |
| `@eyeauras/teamcity-cli` | `teamcity-cli` |

Users install either or both CLI packages:

```sh
npm install --global @eyeauras/youtrack-cli @eyeauras/teamcity-cli
youtrack-cli --help
teamcity-cli --help
```

Node.js 22+ is required. npm installs compiled JavaScript and the Core dependency;
users do not need this repository, TypeScript, .NET, IPC or Chromium. Authentication
uses the normal platform secret store (including an available system keyring on Linux).
On Windows this is DPAPI CurrentUser ciphertext under each profile's AppData `secrets/`
directory. After upgrading from Credential Manager, sign in again per CLI/profile and reimport
auxiliary secrets. There is no automatic migration or old-store fallback; old entries remain.
Configure a profile with `youtrack-cli profile configure` or
`teamcity-cli profile configure`; interactive terminals guide configuration and login.
Use the documented `--token-stdin` flow for noninteractive authentication.

The npm scope identifies the publisher; `bin` declares an independent command name.
An existing unscoped npm package does not reserve that executable name. A different
locally installed package with the same executable can conflict: choose which package
should own the command instead of overwriting it with `--force`.
The global npm executable directory must be on PATH. Profile data and credential
identities remain keyed by the existing `youtrack-cli`/`teamcity-cli` application IDs.

## Release driver

Requirements are .NET 10, Node.js 22+ and npm. Run every command from the repository root:

```text
dotnet run --project build -- --target <Target> [--release-version <x.y.z>] [--dry-run]
```

| Target | What it does |
|---|---|
| `Verify` | The bootstrap (`scripts/bootstrap.cs`: submodules, then `npm ci`), Playwright Chromium, `npm test` (under `xvfb-run` on Linux without a display) and `npm run test:packages`. TeamCity runs it on Linux with Node 24; Windows, macOS and Node 22 can run the same target locally. Linux with `CI=true` also installs Chromium's system dependencies. |
| `SetVersion` | Writes `--release-version` to the three package versions, both `CliDefinition.version` strings and every workspace's exact Core pin, then refreshes `package-lock.json`. |
| `Pack` | After `CheckRelease` and `Verify`, packs the three public packages into `output/release/` and writes `release-manifest.json` (version, commit, shasums, integrity). |
| `Publish` | Publishes those archives in dependency order and waits until the registry serves each version with the packed shasum. |
| `VerifyRegistry` | `npm run test:registry -- <version>`: installs the published packages into a temporary prefix and repeats the executable, JSON and JSON-RPC checks. |
| `Release` | All of the above, then GitHub Release `v<version>` (its tag at the packed commit) with the archives and the manifest. |

`--dry-run` runs every step without side effects: `npm publish --dry-run`, no registry check and
no GitHub Release. Cake's own `--dryrun` only prints the plan; `--tree` and `--description` list
the targets, and `--exclusive` runs one target without its dependencies (for resuming a failed run).
A live `Publish` still re-checks the clean `origin/main` tip and that the archives were packed from it.

Before any work, `CheckRelease` requires `--release-version` to match every version site and lists
each mismatch. A live release also requires a clean working tree whose `HEAD` is the current
`origin/main` tip. Publication is idempotent: a version
already published with the same shasum is skipped and the same version with different content is
refused. A dry run only warns about the latter, so changes can be checked before a release bumps
the version. An existing GitHub Release is skipped; a tag on another
commit is refused. Nothing is unpublished or retried: fix the cause and run the same command again.
Packed files use LF line endings on every OS, so the archives of a commit are byte-identical locally
and in Linux CI (0.3.1 packed identically on Windows and Linux), and a failed release can be resumed
through either path. A Windows clone made before `LICENSE` was forced to LF keeps CRLF copies that
Git still reports as clean; delete the four `LICENSE` files once and run
`git checkout -- LICENSE packages/core/LICENSE integrations/youtrack/LICENSE integrations/teamcity/LICENSE`.

## Releasing

1. Run `dotnet run --project build -- --target SetVersion --release-version <x.y.z>` and merge the
   change through a pull request. Run the TeamCity release dry run for the committed version.
2. Release from `main` in one of two ways:
   - **TeamCity:** run **CLI.Factory → npm release** with `env.RELEASE_MODE=--dry-run`, then
     `env.RELEASE_MODE=--publish`. The committed Core package version selects the version for
     all three packages. TeamCity uses its protected npm token and creates the GitHub Release.
   - **Locally:** run `npm login`, then
     `dotnet run --project build -- --target Release --release-version <x.y.z>`. npm asks for your
     2FA for each package (terminal prompt or browser confirmation). The GitHub Release uses your
     `gh` login. Local publication carries no provenance.
3. The run checks the published packages from the registry, then creates the GitHub Release, which
   lists each published shasum.

## TeamCity configuration

For a new server setup, run `pwsh -File build/configure-teamcity.ps1` with an authenticated
`@eyeauras/teamcity-cli` profile whose `Update` permission is enabled. The create-only script
stops on an existing identity rather than replacing its settings. It creates no credentials;
configure the protected release parameters separately. The script can be reviewed before use.
It leaves the Verify VCS trigger disabled: first run Verify and the release dry run manually on
the migration branch, merge the entry point to main, then enable that trigger. This avoids
building old main before it contains `build/teamcity.sh`. Use `teamcity-cli jobs triggers list
EyeAuras_CliFactory_Verify` to find its ID, then `teamcity-cli jobs triggers fields set
EyeAuras_CliFactory_Verify <trigger-id> disabled false` to enable it.

The project is `EyeAuras_CliFactory`, with the repository's `refs/heads/main` as its default
VCS branch. Two command-line configurations run `bash build/teamcity.sh` in the official
`node:24-bookworm` Docker image on Linux agents with Docker:

| Configuration ID | Mode | Trigger |
|---|---|---|
| `EyeAuras_CliFactory_Verify` | `env.RELEASE_MODE=--verify-only` | VCS changes on main; branches can be checked manually |
| `EyeAuras_CliFactory_Release` | `env.RELEASE_MODE=--dry-run` by default | Manual only; use `--publish` for a live release |

The entry point installs xauth, .NET 10 and the root `packageManager` npm version, then calls the same
Cake targets used locally. Linux CI installs Chromium's system libraries and runs headed fixture
tests under Xvfb. It never runs profile-backed integration proofs. The release job must acquire
the project's exclusive `cli-factory-release` Shared Resource lock so release runs are serialized.
Release archives and the manifest are retained as `npm-release.zip`, including after a later
publication or registry verification failure.

```text
teamcity-cli jobs run EyeAuras_CliFactory_Verify --wait --timeout 30m
teamcity-cli jobs run EyeAuras_CliFactory_Release --wait --timeout 30m
teamcity-cli jobs run EyeAuras_CliFactory_Release --param env.RELEASE_MODE=--publish --wait --timeout 30m
```

Configure `env.NPM_TOKEN` as a **password** parameter on the release configuration, or use
`env.NPM_TOKEN=%npm.token%` backed by a protected `npm.token` parameter.
It needs granular read/write access to the three public
packages and permission to bypass interactive 2FA. `env.GITHUB_TOKEN` is a protected TeamCity
parameter with repository contents write access for the GitHub Release and tag. Neither token
belongs in source, command arguments or build artifacts. The temporary npm configuration contains
only the literal `${NPM_TOKEN}` reference, is outside the checkout, and is removed on exit.
Verify and dry-run modes clear publishing token variables before invoking Cake.

TeamCity is not an npm trusted publishing provider, so publication uses a token and carries no
npm OIDC provenance. The former GitHub trusted publisher for `release.yml` is no longer used;
remove it in each package's npm settings after confirming the TeamCity path. Packages configured
to disallow tokens must allow the granular publishing token before the first live release.
Removing the workflow files does not remove or revoke existing npm trust or user credentials.
Rotate the protected token before it expires. TeamCity project administrators control who can
start a live release.

To rotate an existing job-owned password through the CLI, import the new value from a named
environment variable with `credentials import <alias> --env <variable>`, then run
`jobs parameters set-password <job-id> npm.token --value-secret <alias>` and
`credentials forget <alias>`. These operations require `Credentials`. The replacement retains
the parameter's password specification; inherited, plain and unknown types are refused.
The npm token must grant read/write publishing access to all three packages or their scope;
successful `npm whoami` alone does not prove package publishing rights.

For reuse of an existing release configuration, `jobs copy <source-id> <new-id> --name <name>
--project <project-id>` uses TeamCity's native server-side copy, including protected parameters.
It requires `Credentials` and returns identity fields only. The copy also includes steps, VCS
roots, triggers and dependencies: inspect and configure those for the new product before use.
TeamCity's parameter-resolution API can return masked password values; `builds resolve-parameter`
rejects those instead of saving a mask as a usable credential. A server-side copy preserves the
actual password without reading it into the CLI. CLI Factory and Workbench now share an
`@eyeauras` scope publishing token; rotate both jobs with `set-password`. An inactive Migration validation job retains the migration's earlier
build evidence; it is not a release entry point.

## Package contents and checks

Only the three packages above are published. The root, Playwright and RANDOM packages remain private. IPC has public-package metadata
and can be packed for external consumers, but remains outside this authorized registry release set. Released packages include the MIT notice, package metadata, README and built `dist/src`
files. Tests, fixtures, source TypeScript and integration-proof runners are excluded. Core's
public `/testing` and `/proof` library exports remain included.

`test:packages` builds the workspace, packs the three packages and checks the archive allowlist
and required entry points. It then installs those exact tarballs together into a fresh temporary
global prefix outside the checkout. `test:registry <version>` performs the same installed checks
against the published packages instead. Both use a temporary npm cache, configuration and prefix,
never change the developer's installed commands and never log in to any service.

The installed checks invoke npm's real executable links/shims for help, version and two successive
JSON-RPC help requests. They also import each installed integration and exercise JSON profile
listing through Core's temporary fixture, and verify that dependencies do not resolve through
workspace links. Executable help reads no profiles or credentials; the JSON check uses synthetic
AppData and memory secrets. Root/help output remains human text even when `--json` is supplied.
On Windows, installed Core also encrypts, reloads and deletes a synthetic DPAPI credential under
an injected temporary AppData root, proving the packaged native dependency works without a keyring.
Packing suppresses the `prepack` build hooks because `Verify` has just built the whole workspace.

Official references: [npm bin](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#bin),
[scoped public packages](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/),
[publishing tarballs](https://docs.npmjs.com/cli/v11/commands/npm-publish/),
[trusted publishing](https://docs.npmjs.com/trusted-publishers),
[`npm trust`](https://docs.npmjs.com/cli/v11/commands/npm-trust),
[Cake Frosting](https://cakebuild.net/docs/running-builds/runners/cake-frosting).
