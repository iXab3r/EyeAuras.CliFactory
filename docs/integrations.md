# Writing an integration

This is the practical path from an API to an AI-friendly CLI. The canonical runtime contract
remains [`DESIGN.md`](DESIGN.md); fixture and real-service rules remain [`testing.md`](testing.md).

## Start with one definition and a standalone entry point

A normal CLI only needs Core. Define commands once; Core supplies help, profiles, human/JSON
output and JSON-RPC. Authentication, permission gates, IPC and a browser are explicit additions,
not prerequisites. A complete small example:

```ts
// src/cli.ts
import { command, type CliDefinition } from "@eyeauras/cli-factory";

export function createDefinition(): CliDefinition {
  return {
    name: "acme-cli",
    description: "Small example CLI",
    commands: [
      command("echo <text>", "Return the supplied text", ({ args }) => ({
        text: args.text,
      })),
    ],
  };
}
```

The standalone `src/bin.ts`:

```ts
#!/usr/bin/env node
import { createCli } from "@eyeauras/cli-factory";
import { createDefinition } from "./cli.js";

const app = createCli(createDefinition());
try {
  process.exitCode = await app.run();
} finally {
  await app.dispose();
}
```

After the package setup below, run `acme-cli echo hello --json`, `acme-cli --help`, or start
`acme-cli --json-rpc`. Handlers return data; they do not print JSON or select output formats.
Tests can use `createCli(createDefinition()).execute(argv)` and dispose their application afterward.

Use a factory so the same definition can run standalone, embedded, or in an optional IPC server.
Construction must be cheap: create lazy resource owners, not browser processes or network requests.
If your app owns long-lived resources, list them in `resources`; Core handles disposal and profile
invalidation. Do not write forwarding wrappers or use process-global current-profile state.
Add profile/auth/permission settings only when the service needs them; the sections below explain
each. For IPC, change only the entry point as shown in [Optional IPC](#optional-ipc); service
handlers and their declaration remain unchanged.

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
TeamCity command/client code. Run `npm install` to register the workspace, then the root
`npm run build`: the build script discovers workspaces and orders local dependencies automatically.
No root build-command edit or application hash list is needed.

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
4. Build the CLI, configure a real current-user profile, and call one high-value read-only endpoint
   through the packaged CLI process.
5. Add or extend the integration's explicit local profile-backed proof inventory.
6. Sanitize the response or derive a minimal fixture from official documentation.
7. Write a failing MSW test at the native `fetch` boundary.
8. Implement the client and command until the mocked test passes.
9. Re-run the local proof while debugging; add the next command by value, not API order.

Authentication is discovery infrastructure, not a reason to postpone tests. Its purpose in the
first slice is to reveal the real contract so deterministic mocks can take over the daily loop.

## Keep a local real-profile proof

Once the authentication skeleton works, an integration owns a separate development proof that
invokes its compiled executable with a required profile name. The profile comes from the current
user's normal AppData and the credential comes from the OS keyring; do not add test-only URL/token
inputs. This catches packaging, profile, authentication, command-tree, and rendering failures that a
direct client smoke cannot see.

The proof is not part of `npm test` and must refuse CI before it spawns the CLI. Its command inventory
is fixed in source, bounded, and exclusively `ReadOnly`; it never forwards arbitrary user argv or
trusts an enabled profile permission as its only safety boundary. It prints compact pass/count/skip
evidence instead of service payloads and never records fixtures automatically. See
[`testing.md`](testing.md) for the binding safety and evidence contract.

Do not extract this into Core after the first integration. Let a second real integration prove which
process-runner and summary mechanics are genuinely reusable.

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
For standalone credentials use `context.secrets` so the OS credential store and profile
namespace remain authoritative. Explicit browser auth snapshots and user-requested sensitive
videos are the narrow protected-AppData exceptions described in [DESIGN](DESIGN.md). Sanitized fixtures intended for Git remain in `tests/fixtures`;
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

### Bind the profile-scoped client once

Most authenticated integrations should not repeat profile/secret-to-client plumbing in every
leaf. Bind that invocation-owned target once with Core, then keep each declaration focused on its
service operation:

```ts
import { targetCommands } from "@eyeauras/cli-factory";

const targets = targetCommands(async (context) => new AcmeClient({
  baseUrl: String(context.profile.values.url),
  token: await context.secrets.require("token"),
  fetch: context.fetch,
  signal: context.signal,
}));

const commands = [
  targets.read("list", "List resources", (client) => client.list()),
  targets.update("create <name>", "Create a resource", (client, { args }) =>
    client.create(args.name)),
  targets.gated("DeployProduction")(
    "deploy <id>", "Deploy a release", (client, { args }) => client.deploy(args.id),
  ),
];
```

Core resolves the target only after selecting and validating the profile and admitting the leaf's
permission. A denied command therefore never reads credentials or creates a client. Resolution is
fresh for every ordinary invocation and every request in a persistent JSON-RPC session; the binder
is not a client cache. Literal positional argument inference remains the same as with `command`.

Keep connection construction in the integration. If many operations later prove an identical
service dialect, add the smallest local declaration helper around these bound leaves. Do not move
paths, projections, paging, request bodies, response policy or service validation into Core.

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

Declare mandatory options once with `required: true` in the existing command settings:

```ts
command("create <id>", "Create a resource", createResource, {
  permission: Permission.Update,
  options: [{ flags: "--name <name>", description: "Display name", required: true }],
});
```

The parser owns missing-option validation and the generated `(required)` help hint; the same
behavior applies in JSON-RPC. A declared default satisfies the requirement. Service-specific
validation (non-empty names, allowed fields, safe properties) remains in the integration.
Use `targetCommands` for profile-scoped target binding and small local functions for proven service
repetition, such as TeamCity's project/job parameter tree. Do not promote HTTP or property
semantics into Core.
For expansion work, follow the [50-operation authoring review practice](practices/integration-authoring-reviews.md).

Use the small Core parser factories when an option needs decimal integer bounds or JSON syntax:

```ts
import { integerParser, jsonParser } from "@eyeauras/cli-factory";

const options = [
  {
    flags: "--count <number>", description: "Maximum results", defaultValue: 50,
    parse: integerParser({
      min: 1, max: 100, signed: false,
      errorMessage: "Count must be a decimal integer between 1 and 100.",
    }),
  },
  {
    flags: "--body <json>", description: "Supported service fields", required: true,
    parse: jsonParser("Body must be valid JSON."),
  },
];
```

Pass these options through the existing command settings. Keep defaults, bounds and signed syntax
service-owned; `signed: true` permits a minus, never a plus. Neither parser trims input, and numeric
parsing rejects decimals, exponents and unsafe values. Choose valid defaults: Commander does not
parse them. Use literal, non-secret error messages rather than interpolated input. JSON values are
`unknown`, so the service still validates objects, fields and null/omitted semantics. Repeat handling
also remains local, as in TeamCity's `jsonOption`. Keep validation in directly callable clients.
The JSON parser returns `null` for the JSON literal `null`, but Commander's existing required-value
option handling converts a null callback result to `""`. Nested null fields and array items survive;
do not treat a top-level option value as proof of a validated JSON body.

For each command, prefer a test that runs the real client and, when useful, the real CLI command
tree against MSW. Assert:

- request method, path, locator/query, and required headers;
- the minimal parsed domain result;
- `--json` validity for an important CLI path;
- permission denial before the HTTP boundary for side-effecting commands;
- profile isolation when connection, secret, or permission behavior changes;
- absence of credentials and private data from errors and fixtures.

The default suite never calls the real service. Local proof is opt-in, uses the packaged CLI and
an explicit real current-user profile/keyring, and executes only a fixed bounded ReadOnly inventory.
It refuses CI. New sensitive/expensive reads do not automatically join that inventory.

### A shared offline fixture

Use the separate testing entry point for synthetic state and application ownership:

```ts
import { createCliFixture } from "@eyeauras/cli-factory/testing";

const fixture = await createCliFixture(t, {
  applicationId: "acme-cli",
  profiles: [{
    name: "default",
    values: { url: "https://acme.example.com" },
    secrets: { token: "synthetic-test-token" },
  }],
});
const app = fixture.createApplication(runtime =>
  createCli({ ...createDefinition(), runtime }),
);
const value = await fixture.json(app, ["resources", "list"]);
```

The test installs its own MSW handlers before invoking the app and independently asserts the
request and result. Omit `profiles` to test unconfigured onboarding, and declare permission changes
explicitly. The fixture does not assume token authentication; credential names belong to the
integration. Every created app is disposed before the fixture deletes its temporary AppData.
See [the testing guide](testing.md#shared-offline-cli-fixture) for invocation and cleanup details.
## Bounded response consumption

Use Core's byte reader after your own status handling instead of an unbounded `response.text()`:

```ts
import { readBoundedResponseBody } from "@eyeauras/cli-factory";

const bytes = await readBoundedResponseBody(response, {
  maxBytes: 8 * 1024 * 1024,
  signal: context.signal,
});
const text = new TextDecoder().decode(bytes); // Response.text-compatible UTF-8/BOM behavior
```

Choose the limit for the service's actual response shape. TeamCity uses 2 MiB; YouTrack uses 8 MiB
for its bounded pages and text-rich projections. Keep status, media, empty/null mutation semantics,
JSON/DTO parsing and safe public errors local. Cancel rejected HTTP bodies without awaiting tee
consumers, and pass the invocation signal to fetch as well as the reader.
Actual decoded bytes are bounded; Content-Length is syntax-checked and, for unencoded/identity
bodies, checked against both the limit and completed length. Compressed wire length is not the
decoded size. Decoding stays explicit: `Buffer.from(bytes).toString("utf8")` retains an initial BOM,
whereas `TextDecoder` removes it by default. No HTTP wrapper, retry or automatic decoding is added.

## Native wire formats and private results

CLI output format is independent of REST media. A text/XML/multipart/binary service contract does
not require another help/JSON/RPC implementation: validate and project domain data in the integration,
then return it through the existing tree. A native void action can return acknowledgement only after
actual success; do not invent completion, atomicity or verified postconditions.

For files, keep filename, URL/auth, status/media, compressed wire-length, format and result policy in
the integration, then give Core ownership of the raw response and local publication:

```ts
const saved = await publishProfileFile({
  appDataDirectory: context.appArguments.AppDataDirectory,
  name,
  maxBytes,
  signal: context.signal,
  openResponse: () => fetch(url, { signal: context.signal }),
  inspectResponse(response) {
    if (!response.ok || response.status === 206) {
      throw new ProfileFileError("Download failed or was partial.");
    }
  },
  validateFile: ({ path, prefix }) => validateNativeFile(path, prefix),
});
return { ...saved, contentType };
```

Both callbacks may be asynchronous and are awaited before Core continues past their gate. Callers
must use static, non-sensitive `ProfileFileError` messages in the two callbacks. Errors
from response acquisition, streaming, filesystem operations and abort reasons are sanitized.
Core computes `published` and `cleanupFailed`; do not construct those flags in callbacks.
Successful publication returns the real path, byte count and SHA-256 only after complete writes,
sync, exclusive no-overwrite linking, identity verification and safe staging cleanup. Do not open,
execute, extract or retry the result. Staged validation is read-only; Core rejects detected size,
modification-time or change-time mutations instead of publishing transformed bytes with stale metadata.
Core retains its exclusive staging handle through validation and publication, then closes it before
identity-checked path cleanup; a close failure retains staging for inspection.

The integration still validates its own basename convention and limit. Core also rejects path,
device and unsafe cross-platform basename forms. Staging is in a private fresh directory under the
active profile's `temp`; the destination is under `downloads`. Never call `privateDirectory` on
user-selected or AppData ancestor directories. TeamCity and YouTrack are the two consumers;
TeamCity retains PNG/ZIP/SVG validation and hashes in its DTO, while YouTrack retains signed-URL,
no-bearer download and sanitized metadata rules. Credentials remain in the keyring, never files.
Measure helper/security costs at every authoring checkpoint.

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


## Optional IPC

Install/use `@eyeauras/cli-factory-ipc` only when repeated CLI processes should share state or
expensive resources. Replace the standalone bin.ts above with:

```ts
#!/usr/bin/env node
import { runHosted } from "@eyeauras/cli-factory-ipc";
import { createDefinition } from "./cli.js";

process.exitCode = await runHosted({ entryPoint: import.meta.url, createDefinition });
```

The runner adds `ipc-server status` and `ipc-server stop`, starts the IPC server on demand, forwards
stdio/exit code and owns cleanup in both processes. These commands never start a server themselves.
A service may still declare its own `server` commands. Ordinary Core applications have no IPC
commands or dependency; there is no runtime registration API. Keep the same definition for tests.

Set `concurrency` in the definition only if the application's handlers cannot safely overlap:
`1` serializes logical commands, a positive integer allows that many, and omission adds no limit.
The transport supports multiple clients; an idle JSON-RPC client consumes no command slot.
Profile/auth/permission mutations coordinate automatically. Handler state still belongs to the app;
the transport cannot make a service client thread-safe.

Run the **root** `npm run build` before invoking an IPC app; individual tsc builds do not publish
the whole-workspace compatibility manifest. Changed builds require `ipc-server stop` before
service work can resume. No manual forwarding, dispose/profile-change adapter, or dependency hash
list belongs in the integration. See [IPC lifecycle and limits](runtime-modules.md).
When upgrading from the old management name, see the migration note there; do not delete AppData.

## Optional browser automation

Use `@eyeauras/cli-factory-playwright` when the service requires actual browser interaction.
It does not require IPC. For a standalone app the browser lives until that run's finally/dispose;
with IPC the same browser can be reused across shell calls. A complete browser definition can
replace the echo definition above without changing either entry point:

```ts
import { command, Permission, type CliDefinition } from "@eyeauras/cli-factory";
import {
  BrowserRuntime,
  browserCommandOptions,
  browserOperationOptions,
} from "@eyeauras/cli-factory-playwright";

export function createDefinition(): CliDefinition {
  const browser = new BrowserRuntime(); // lazy: construction does not launch Chromium
  return {
    name: "acme-cli",
    description: "Read a page through a browser",
    permissions: {},
    resources: [browser],
    profile: {
      fields: [{
        name: "url", flags: "--url <url>", description: "Service URL", required: true,
      }],
    },
    commands: [
      command("title", "Read the page title", (input, context) =>
        browser.withPage(
          { appArguments: context.appArguments, baseURL: String(context.profile.values.url) },
          context.signal,
          async page => {
            await page.goto("/");
            return { title: await page.title() };
          },
          browserOperationOptions(input.options, context),
        ),
        { permission: Permission.ReadOnly, options: browserCommandOptions },
      ),
    ],
  };
}
```

The browser defaults to headless. The shared options add `--headed` and `--record-video`; compatible
calls reuse resources, conflicting settings switch only between browser operations. The helper
reports finalized video paths on stderr, never in the domain DTO. See [browser observation](browser-observation.md)
for mode changes, profile/auth persistence, concurrency and sensitive-artifact handling.

The integration owns selectors, login completion and service postconditions. Anonymous apps do
not need fake auth commands. Authenticated apps implement `AuthDefinition` and explicitly opt into
browser auth persistence; Core does not infer a universal browser login protocol.
The two RANDOM.ORG definitions ([HTTP](../integrations/random-rest/src/cli.ts),
[PW](../integrations/random-pw/src/cli.ts)) are working examples with the same two service commands.
They create cheap clients per invocation; only browser resources and service-specific quota/backoff
persist. Do not extract a generic client cache from this service-specific state.
