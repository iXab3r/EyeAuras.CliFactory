# Core build and staged npm releases

Factory releases only **@eyeauras/cli-factory**. Product package names, bins, profiles and
credentials are owned by the independent [teamcity-cli](https://github.com/iXab3r/teamcity-cli)
and [youtrack-cli](https://github.com/iXab3r/youtrack-cli) repositories. Each product pins a
published Core version exactly and releases independently. Factory never publishes their archives.
Core 0.7.1 includes the merged closed-pipe output fix required by this extraction.

Optional IPC has packable public metadata but remains outside the authorized registry release
set. Playwright and the RANDOM examples remain private Factory-owned runtime/testing consumers.
They neither depend on nor build either extracted product. See [package boundaries](DESIGN.md#package-boundaries).

## Local driver

Requirements: .NET 10, Node 22+ and the exact root `packageManager` npm version.
TeamCity uses `node:24-bookworm` on Linux. Cake Frosting owns all release actions;
[build/NOTICE](../build/NOTICE) records the adapted staged-driver provenance.

```sh
dotnet run --project build -- --target Verify
dotnet run --project build -- --target SetVersion --release-version 0.7.1
RELEASE_REVISION=$(git rev-parse HEAD) dotnet run --project build -- --target DryRun --release-version 0.7.1 --dry-run
```

| Target | Behavior |
|---|---|
| Verify | Bootstrap submodules and `npm ci`; install Chromium; `npm test` (Xvfb on display-less Linux); Core installed-package check; offline release-safety tests. |
| SetVersion | Update Core's version and local consumer Core pins, refresh the lockfile. Product versions live in their own repositories. |
| Pack | Verify, check full release revision/version, pack Core, save hashes/source manifest and test that exact archive. |
| DryRun | Pack and `npm publish --dry-run`; no publishing credentials. |
| Stage / Release | Pack, then `npm stage publish`; download stage and compare SHA-512. Release with `--dry-run` follows DryRun. No owner approval is performed. |
| VerifyRegistry | Pack the selected source again, verify registry version/latest/integrity, install/test registry Core, then create the correctly pinned GitHub Release and compare any existing assets. |

Every release target requires `RELEASE_REVISION` to equal all 40 checkout SHA characters.
Live modes require a clean tree; Stage also requires the current remote main tip.
`Stage --dry-run` is rejected. Cake's `--dryrun` prints a plan only; `--exclusive` is for a
reviewed recovery and does not establish Verify/Pack evidence by itself.

The only direct `npm publish` invocation includes `--dry-run`. The live path only stages.
The driver isolates npm user/global configs and child environments; NPM_TOKEN is supplied only
to npm stage operations, and GITHUB_TOKEN only via a private temporary header file for the
GitHub Release. It never reads or changes token rights, approves stages or bypasses 2FA.

## TeamCity ownership and cutover

| Object | ID / setting |
|---|---|
| Project | `EyeAuras_CliFactory` |
| Existing public Git root | `EyeAuras_CliFactory_Repo` |
| Main Verify | `EyeAuras_CliFactory_Verify`, `--verify-only` |
| Manual Core staging | `EyeAuras_CliFactory_Release`, `--dry-run` by default |
| Exclusive release resource | `cli-factory-release writeLock` |

Both jobs run `bash build/teamcity.sh` in Linux Docker. The release job is paused during the
migration, preventing the old coupled direct-publish entry point from running. After review and
merge, set its plain `env.RELEASE_REVISION` default empty and retain protected `npm.token`,
`env.NPM_TOKEN=%npm.token%` and inherited protected `env.GITHUB_TOKEN`; do not resolve them.
Prove exact-head Verify and DryRun, then enable manual Core staging. Product jobs must use their
own repository roots, exclusive resources and entry points; no shared root is rewritten.
TeamCity is CI; there are no GitHub Actions workflows. The obsolete create-only PowerShell
setup that described coupled direct publication is removed; use the installed teamcity-cli
for scoped native configuration. Bootstrap never changes CI configuration.

```text
teamcity-cli jobs run EyeAuras_CliFactory_Verify --wait --timeout 30m
teamcity-cli jobs run EyeAuras_CliFactory_Release --param env.RELEASE_MODE=--dry-run --param env.RELEASE_REVISION=<sha>
teamcity-cli jobs run EyeAuras_CliFactory_Release --param env.RELEASE_MODE=--stage --param env.RELEASE_REVISION=<sha>
# Only after owner npm approval:
teamcity-cli jobs run EyeAuras_CliFactory_Release --param env.RELEASE_MODE=--verify-registry --param env.RELEASE_REVISION=<sha>
```

`RELEASE_REVISION` guards a checkout; it does not select it. If main advances, choose the
original revision in TeamCity custom build settings for registry verification.

## Stage approval and recovery

`output/release/release-manifest.json` binds name/version/source to the archive, SHA-1 and
SHA-512. `release.json` records `dry-run-verified`, `staged-unverified`,
`awaiting-2fa-approval` or `published-verified`. Stage saves its stage ID **before** metadata
and download verification; a later failure keeps a reviewable receipt. TeamCity retains
`output/release/* => npm-release.zip`, including on failure. Keep this artifact.

Only the owner approves the exact stage with status `awaiting-2fa-approval` in npm Staged
Packages using 2FA. Never approve `staged-unverified`, the `0.0.0-stage` placeholder or a
different ID. VerifyRegistry checks version, latest, SHA-512 and installed behavior before
creating GitHub Release `v<version>` at the packed revision with archive and manifest.
It rejects existing tags or assets with different content. No npm OIDC provenance is claimed.

After a lost stage response, inspect `npm stage list @eyeauras/cli-factory --json` before
retrying. Existing stages are refused. On E403/E404 stop for owner access diagnosis; do not
widen token permissions, disable 2FA or switch to direct publication.

## Installed Core checks

`npm run test:packages` packs Core only, checks its archive allowlist/license/exports and installs
the exact tarball outside the checkout. `-- --tarball /absolute/archive.tgz` checks supplied
bytes. `npm run test:registry -- <version>` tests the registry archive instead. Tests use synthetic
AppData, memory secrets and a small service-neutral command tree. Human help, NDJSON, profiles,
persistent RPC and closed pipes use real subprocesses against the installed Core; Windows also
exercises the installed DPAPI binding. No service, real profile or product source is used.

Release safety tests use stubbed npm/curl and a synthetic Git repository. They verify no direct
publish path, full revision guards, environment isolation, receipt-before-download ordering,
stage download integrity and owner approval separation.

Official reference: [npm staged publishing](https://docs.npmjs.com/staged-publishing/).
