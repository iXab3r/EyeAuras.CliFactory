# Writing an integration

This is the practical path from an API to an AI-friendly CLI. The canonical runtime contract
remains [`DESIGN.md`](DESIGN.md); fixture and real-service rules remain [`testing.md`](testing.md).

## Where the project lives

### Inside this repository

Put an in-house integration at `integrations/<service>/`. This is the preferred location while
the service is also proving or improving factory features.

```text
integrations/acme/
  package.json
  tsconfig.json
  src/
    bin.ts       executable entry point; only starts the CLI
    cli.ts       profile, auth, permissions, and command tree
    client.ts    service-shaped fetch calls and DTOs
    index.ts     intentional public exports
  tests/
    client.test.ts
    fixtures/    optional, sanitized, minimal API examples
```

Add the package to the root npm workspace through the existing `integrations/*` glob. Depend on
`@eyeauras/cli-factory` with the current workspace version. Do not add a factory-specific service
abstraction: endpoint paths, pagination, and DTOs belong to the integration.

A minimal package starts like this (replace `acme` and the executable name):

```json
{
  "name": "@eyeauras/acme-cli",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "bin": { "acme-cli": "./dist/src/bin.js" },
  "scripts": {
    "build": "tsc --project tsconfig.json",
    "start": "node dist/src/bin.js",
    "test:compiled": "node --test dist/tests/*.test.js"
  },
  "dependencies": { "@eyeauras/cli-factory": "0.1.0" },
  "devDependencies": { "msw": "^2.11.0" }
}
```

Reuse the TypeScript compiler wiring from `integrations/teamcity/tsconfig.json`; do not duplicate
TeamCity command/client code. Add the new workspace to root `build` until build orchestration is
made generic by a second real integration.

### In an external repository

An independently shipped product may own its repository. It should consume the core package,
not copy its sources.

Once `@eyeauras/cli-factory` is published, install a pinned compatible npm version:

```text
npm install @eyeauras/cli-factory
```

The package is not published during the foundation stage. Until it is, use one of these explicit
development arrangements:

1. For same-machine development, add a local file dependency:

   ```json
   {
     "dependencies": {
       "@eyeauras/cli-factory": "file:../EyeAuras.CliFactory/packages/core"
     }
   }
   ```

   Build core in the factory checkout before running the consumer:

   ```text
   npm run build --workspace @eyeauras/cli-factory
   ```

2. For a reproducible external checkout, pin this repository as a submodule of the product:

   ```text
   git submodule add https://github.com/iXab3r/EyeAuras.CliFactory.git vendor/EyeAuras.CliFactory
   git -C vendor/EyeAuras.CliFactory checkout <reviewed-commit>
   ```

   Point the dependency at `file:vendor/EyeAuras.CliFactory/packages/core`, initialize the
   submodule in the product's bootstrap, install the factory workspace, and build core. The
   external product owns that pin and its update reviews.

   A deterministic bootstrap sequence is:

   ```text
   git submodule update --init --recursive
   npm --prefix vendor/EyeAuras.CliFactory ci
   npm --prefix vendor/EyeAuras.CliFactory run build --workspace @eyeauras/cli-factory
   npm ci
   ```

Do not use a floating Git branch as a production dependency. If an external integration exposes
a generally useful factory feature, prove it in that consumer first and contribute the smallest
service-agnostic change back to `packages/core`.

## Start with a vertical slice

Do not begin by mapping the entire REST API. Begin with the smallest path that proves access and
one useful read:

1. Sketch the command tree in user vocabulary, including the permission category of every leaf.
2. Define profile fields for connection identity and mark service prerequisites `required`:
   usually URL plus tenant, organization, or project when those values select a different realm.
3. Implement authentication and validate it with the cheapest identity/status endpoint.
4. Call one high-value read-only endpoint against the real service explicitly.
5. Sanitize the response or derive a minimal fixture from official documentation.
6. Write a failing MSW test at the native `fetch` boundary.
7. Implement the client and command until the mocked test passes.
8. Keep the real smoke test opt-in; add the next command by value, not API order.

Authentication is discovery infrastructure, not a reason to postpone tests. Its purpose in the
first slice is to reveal the real contract so deterministic mocks can take over the daily loop.

## Profiles: more than one connection

Use profiles whenever one CLI may talk to more than one URL, tenant, account, or environment. A
profile owns non-secret connection values; its credentials and permission choices are isolated by
the same profile name.

Do not compile a private, organization-specific, or merely convenient live endpoint into a public
integration. Declare prerequisites and let the common configurator own onboarding:

```ts
profile: {
  fields: [{
    name: "url",
    flags: "--url <url>",
    description: "Acme server URL",
    required: true,
  }],
},
```

The virtual `default` profile always exists, but may initially be incomplete. In a normal terminal,
running the CLI root or a service command prompts for missing required fields and authentication.
Automation configures the same state explicitly without prompts:

```text
acme-cli profile configure uat --url https://uat.example.com --token-stdin
acme-cli profile configure production --url https://example.com --token-stdin

acme-cli resources list --profile uat --json
acme-cli resources list --profile production --json
```

`profile configure [name]` derives its options from the same profile-field declaration and reuses
the integration's auth validation before secure storage. `--token-stdin` is preferred for scripts.
JSON, JSON-RPC, non-TTY, and programmatic calls never ask questions: an incomplete service command
fails before its handler and reports the flags needed to configure the selected profile.

`profile create <name>` remains available for deliberately creating an incomplete or pre-seeded
profile. `profile set <name>` updates an existing profile and `profile set-default <name>` changes
the default. `profile delete <name>` removes a non-default profile and its stored authentication
credential; the default and final remaining profile cannot be deleted. `--profile <name>` selects
one connection for only that invocation—or for one `cli.execute` request inside a persistent
JSON-RPC session. This lets one long-lived process interleave UAT and Production commands without
sharing config or credentials.

If the service can host multiple logical resources behind one login, do not automatically make
each resource a profile. A profile represents a connection/security realm; ordinary command
arguments represent resources inside that realm.

## Profile-owned files through AppArguments

Every handler receives the familiar PoeShared-style `AppArguments` view for the selected profile:

```ts
import { join } from "node:path";

const snapshotPath = join(
  context.appArguments.AppDataDirectory,
  "snapshots",
  "latest.json",
);
const logDirectory = context.appArguments.LogDirectory();
```

Use these paths for integration-owned configuration, logs, caches, downloaded metadata, session
state, and other non-secret local files. `AppDataDirectory` already includes `AppName` and the
profile name; do not append the profile again. A command executed with `--profile production`
receives a different `AppDataDirectory` from the same command executed with `--profile uat`, even
inside one JSON-RPC process.

Do not derive application state from `process.cwd()`, the source checkout, the executable directory,
or a custom `--data-folder`. CliFactory CLIs are bound to the current OS user and are not portable.
Do not place credentials in AppData: use `context.secrets` so the OS credential store and profile
namespace remain authoritative. Sanitized fixtures intended for Git remain in `tests/fixtures`;
runtime captures and unsanitized service data do not.

## Permission gates

Enable the gate on an agent-facing integration and classify every service leaf:

```ts
import { command, createCli, Permission, tokenAuth } from "@eyeauras/cli-factory";

const cli = createCli({
  name: "acme-cli",
  description: "Acme CLI",
  permissions: {},
  profile: {
    fields: [{
      name: "url",
      flags: "--url <url>",
      description: "API URL",
      required: true,
    }],
  },
  auth: tokenAuth({ env: "ACME_TOKEN", validate: validateToken }),
  commands: [
    command("resources", "Work with resources", [
      command("list", "List resources", listResources, {
        permission: Permission.ReadOnly,
      }),
      command("create <name>", "Create a resource", createResource, {
        permission: Permission.Update,
      }),
    ]),
  ],
});
```

The standard categories are:

| Category | Default | Use for |
|---|---:|---|
| `ReadOnly` | Enabled | list, get, status, search, download, inspect |
| `Update` | Disabled | create, trigger, cancel, comment, upload, edit, delete |

Add a custom category only when it communicates a materially useful boundary such as
`DeployProduction` or `ManageUsers`. Custom categories default to disabled unless the integration
explicitly says otherwise:

```ts
permissions: {
  categories: [{
    name: "DeployProduction",
    description: "Deploy releases to Production",
  }],
},
```

Users inspect and change the active profile's gate through the standard tree:

```text
acme-cli permissions list
acme-cli permissions grant Update
acme-cli permissions revoke Update
acme-cli permissions grant DeployProduction --profile production
```

Permission state is profile-specific. Granting `Update` in UAT does not grant it in Production.
The gate is a deliberate fail-safe against accidental AI actions; it is not an authentication or
authorization system. The remote service must still enforce the user's real rights. An AI that is
explicitly instructed to grant a category can do so, so operator policy and review still matter.

When the gate is enabled, startup fails if any service leaf lacks a permission or names an unknown
category. Built-in `profile`, `auth`, and `permissions` commands remain available so a user can
recover configuration.

## Grow by useful phases

Use the **Reconciliation Lead** function role when the useful path contains multiple phases or a
large API surface. First make the GitHub feature Issue implementation-ready with its user outcome,
selected REST inventory, CLI mapping, permission category per leaf, explicit exclusions, and
acceptance criteria. Then open or reconcile a tracked workstream before broad implementation; each
phase needs a user outcome and an evidence gate. The Issue owns scope while the workstream owns
execution status. Do not use endpoint count as the ordering principle. See
[`practices/github-issues.md`](practices/github-issues.md).

A typical REST sequence is:

1. profiles + authentication + one identity call;
2. highest-value read-only resource tree;
3. operational reads, pagination, logs, or artifacts;
4. narrowly selected `Update` operations with explicit tests;
5. streaming, bulk work, or administrative surfaces only when consumers need them.

The live TeamCity example is [`.workspace/workstreams/teamcity-rest/`](../.workspace/workstreams/teamcity-rest/).
It orders TeamCity REST work by user/agent value and keeps update operations behind `Update`.

## Test the declaration, not a parallel implementation

For each command, prefer a test that runs the real client and, when useful, the real CLI command
tree against MSW. Assert:

- request method, path, locator/query, and required headers;
- the minimal parsed domain result;
- `--json` validity for an important CLI path;
- permission denial before the HTTP boundary for side-effecting commands;
- profile isolation when connection, secret, or permission behavior changes;
- absence of credentials and private data from errors and fixtures.

The default suite never calls the real service. Real smoke tests are opt-in, read-only by default,
and use credentials supplied outside Git.

## Ready-for-review checklist

- The command tree reads naturally at every help level.
- Every handler returns domain data and contains no output-format branch.
- Profiles represent real connection realms and contain no secrets.
- Profile-owned files derive from `context.appArguments.AppDataDirectory`.
- Authentication validates before storing a credential.
- Every service leaf has the correct permission category.
- Side-effect tests prove the permission check happens before `fetch`.
- MSW covers the actual network boundary; fixtures are minimal and sanitized.
- Public docs name shipped behavior honestly; planned behavior is marked planned.
- Focused tests and `npm test` are green.
