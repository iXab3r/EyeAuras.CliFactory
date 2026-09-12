# npm installation and release

The current release line is 0.2.0 for Core, YouTrack CLI and TeamCity CLI. Publish Core first,
then both integrations, using reviewed archives from the same tested tree. Registry publication
and registry installation must be verified before reporting release availability. Core and
YouTrack 0.1.0 were previously published; version 0.2.0 replaces their content-limit contract.

## Package and executable names

| npm package | Installed command |
|---|---|
| `@eyeauras/cli-factory` | Library only |
| `@eyeauras/youtrack-cli` | `youtrack-cli` |
| `@eyeauras/teamcity-cli` | `teamcity-cli` |

After publication, users install either or both CLI packages:

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

## Prepare and verify

Only the three packages above belong to this release. The root, IPC, Playwright and
RANDOM packages remain private. All released packages include the owner-approved MIT
notice, package metadata, README and built `dist/src` files; tests, fixtures, source
TypeScript and integration-proof runners are excluded. Core's existing public
`/testing` and `/proof` library exports remain included.

From the repository root:

```sh
npm ci
npm run browser:install
npm test
npm run test:packages
```

Use `xvfb-run --auto-servernum npm test` on Linux without a display. The browser is a
development-test dependency, not a requirement of the installed TeamCity/YouTrack CLIs.

`test:packages` builds the workspace, packs the three packages and checks the archive
allowlist and required entry points. It then installs those exact tarballs together
into a fresh temporary global prefix outside the checkout. npm may download public
production dependencies; this explicit packaging check is separate from offline
`npm test`. Its npm cache/config and global prefix are temporary, and it does not
change the developer's installed commands or log in to any service.

The check invokes npm's real executable links/shims for help, version and two successive
JSON-RPC help requests. It also imports each installed integration and exercises JSON
profile listing through Core's existing temporary fixture. It verifies that installed
dependencies do not resolve through workspace links. Executable help calls neither read
profiles nor use credentials; the JSON check uses synthetic AppData and memory secrets.
Root/help output remains human text even when `--json` is supplied.
CI runs this check on the same Node 22/24 and Linux/macOS/Windows matrix as the default suite.

Each package has a `prepack` build hook. During the package check hooks are suppressed
because the complete workspace has just been built; regular pack/publish rebuilds the
selected package. Always build/test the whole workspace first so Core is current.

## Review and publish

1. Verify publication rights to the npm `@eyeauras` scope. An npm organization and the
   GitHub repository are separate identities. Set up npm account 2FA for manual publication.
2. Choose the release versions. Keep each integration's Core dependency resolvable;
   when changing a CLI version, also update its `CliDefinition.version` and lockfile.
   The artifact check detects version mismatches.
3. Run the preparation checks above. Pack all three packages from the same reviewed tree:

   ```sh
   npm pack --workspace @eyeauras/cli-factory --workspace @eyeauras/youtrack-cli --workspace @eyeauras/teamcity-cli
   ```

   This writes three `.tgz` files in the current directory. Review `npm pack --dry-run`
   and archive contents for generated noise, secrets and private service data before
   uploading anything. Package allowlist checks are not a content privacy review.
4. Log in interactively with `npm login`. Publish the reviewed tarballs in dependency
   order; these filenames match the `0.2.0` manifests:

   ```sh
   npm publish ./eyeauras-cli-factory-0.2.0.tgz --access public --registry https://registry.npmjs.org/
   npm publish ./eyeauras-youtrack-cli-0.2.0.tgz --access public --registry https://registry.npmjs.org/
   npm publish ./eyeauras-teamcity-cli-0.2.0.tgz --access public --registry https://registry.npmjs.org/
   ```

   Wait for the Core version to be available before publishing the integrations.
   Publishing tarballs uploads the reviewed build rather than rebuilding it.
5. Verify `npm view <package>@0.2.0 version bin` for each package. In a clean environment,
   install the two CLI versions **from the registry**, then check `--help`, `--version`,
   JSON and JSON-RPC. Local tarball proof does not prove registry availability.
6. Record the published versions and registry-install evidence, update release status
   in the public docs, and close the linked Issue/workstream only after its acceptance gates pass.

No automatic publishing workflow is installed by this preparation. A later release
automation can use npm trusted publishing after the scope and packages are configured.

Official references: [npm bin](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#bin),
[scoped public packages](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/),
[publishing tarballs](https://docs.npmjs.com/cli/v11/commands/npm-publish/).
