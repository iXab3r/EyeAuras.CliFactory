# npm installation and release

Core, YouTrack CLI and TeamCity CLI are released together under one version. The C# release
driver in `build/` checks, packs, publishes (Core first) and verifies them. The same commands
run locally and in the manually started GitHub Actions **Release** workflow.

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
uses the normal OS credential store (including an available system keyring on Linux).
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
| `Verify` | The bootstrap (`scripts/bootstrap.cs`: submodules, then `npm ci`), Playwright Chromium, `npm test` (under `xvfb-run` on Linux without a display) and `npm run test:packages`. CI runs it on the Linux/macOS/Windows × Node 22/24 matrix. |
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
`origin/main` tip and, in GitHub Actions, npm 11.5.1 or later. Publication is idempotent: a version
already published with the same shasum is skipped and the same version with different content is
refused. A dry run only warns about the latter, so ordinary pull requests pass the CI release dry
run until a release bumps the version. An existing GitHub Release is skipped; a tag on another
commit is refused. Nothing is unpublished or retried: fix the cause and run the same command again.
Packed files use LF line endings on every OS, so the archives of a commit are byte-identical locally
and in Actions (0.3.1 packed identically on Windows and Linux), and a failed release can be resumed
through either path. A Windows clone made before `LICENSE` was forced to LF keeps CRLF copies that
Git still reports as clean; delete the four `LICENSE` files once and run
`git checkout -- LICENSE packages/core/LICENSE integrations/youtrack/LICENSE integrations/teamcity/LICENSE`.

## Releasing

1. Run `dotnet run --project build -- --target SetVersion --release-version <x.y.z>` and merge the
   change through a pull request. CI dry-runs the release of the committed version.
2. Release from `main` in one of two ways:
   - **GitHub Actions:** Actions → **Release** → *Run workflow* with the version, first with
     *dry-run* checked, then unchecked. The workflow publishes through npm trusted publishing
     (no npm token, provenance attached) and creates the GitHub Release.
   - **Locally:** run `npm login`, then
     `dotnet run --project build -- --target Release --release-version <x.y.z>`. npm asks for your
     2FA for each package (terminal prompt or browser confirmation). The GitHub Release uses your
     `gh` login. Local publication carries no provenance.
3. The run checks the published packages from the registry, then creates the GitHub Release, which
   lists each published shasum.

## Trusted publishing setup

The Release workflow authenticates to npm through OIDC, so GitHub stores no npm secret. Each
package trusts exactly `iXab3r/EyeAuras.CliFactory` with `.github/workflows/release.yml`; renaming
the workflow file breaks publication until the trust is updated. The configuration is created once
with npm 11.15+ (`npx -y npm@11 trust ...` works with an older npm) and the owner's interactive 2FA:

```text
npm trust github @eyeauras/cli-factory  --repo iXab3r/EyeAuras.CliFactory --file release.yml --allow-publish --yes
npm trust github @eyeauras/youtrack-cli --repo iXab3r/EyeAuras.CliFactory --file release.yml --allow-publish --yes
npm trust github @eyeauras/teamcity-cli --repo iXab3r/EyeAuras.CliFactory --file release.yml --allow-publish --yes
```

Anyone who can run the workflow (repository write access) can publish; no further approval is
required by design. Optional later hardening on npmjs.com: package → Settings → Publishing access →
"Require two-factor authentication and disallow tokens". OIDC and interactive 2FA publishing keep
working with that setting.

## Package contents and checks

Only the three packages above are published. The root, IPC, Playwright and RANDOM packages remain
private. Released packages include the MIT notice, package metadata, README and built `dist/src`
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
Packing suppresses the `prepack` build hooks because `Verify` has just built the whole workspace.

Official references: [npm bin](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#bin),
[scoped public packages](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/),
[publishing tarballs](https://docs.npmjs.com/cli/v11/commands/npm-publish/),
[trusted publishing](https://docs.npmjs.com/trusted-publishers),
[`npm trust`](https://docs.npmjs.com/cli/v11/commands/npm-trust),
[Cake Frosting](https://cakebuild.net/docs/running-builds/runners/cake-frosting).
