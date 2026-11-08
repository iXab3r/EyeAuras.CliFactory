# AI CLI Factory

Build service CLIs from one recursive command declaration. Core supplies generated help,
human/JSON output, persistent JSON-RPC, profiles, protected credentials, permission gates and
resource disposal. Handlers return domain data; service paths, DTOs, pagination and authentication
protocols stay in the product.

```ts
import { command, createCli } from "@eyeauras/cli-factory";

const app = createCli({
  name: "acme-cli",
  description: "Small example CLI",
  commands: [command("echo <text>", "Return text", ({ args }) => ({ text: args.text }))],
});
try {
  process.exitCode = await app.run();
} finally {
  await app.dispose();
}
```

Node.js 22+ is required. Install `@eyeauras/cli-factory` as an exact published dependency for
an independent product. [Integration authoring](docs/integrations.md) explains profiles, auth,
permissions, views, paging and optional runtimes. The APIs are still early and change cleanly.

## Ownership

| Surface | Owner |
|---|---|
| Core command/runtime library | `packages/core`, published as `@eyeauras/cli-factory` |
| Optional local gRPC host | `packages/ipc`; packable, registry publication separately authorized |
| Optional browser ownership | `packages/playwright`, private |
| RANDOM HTTP/browser examples and their shared service contract | `integrations/random-*`, private concrete runtime/test consumers |
| TeamCity product | [iXab3r/teamcity-cli](https://github.com/iXab3r/teamcity-cli), independent build/tests/releases |
| YouTrack product | [iXab3r/youtrack-cli](https://github.com/iXab3r/youtrack-cli), independent build/tests/releases |

Factory has no product runtime, build or test dependency on either extracted CLI.
Their npm package names, executable/application IDs, profiles, permissions and credentials are
unchanged. Product repositories own their command guides and backlog. Historical release notes
remain in [CHANGELOG.md](CHANGELOG.md); current package ownership is defined here and in
[DESIGN.md](docs/DESIGN.md#package-boundaries).

## Development

```text
dotnet run --file scripts/bootstrap.cs
npm run browser:install
npm test
npm run test:packages
```

Use Node 22+, the root `packageManager` npm version and .NET 10. Headed synthetic browser tests
on display-less Linux run with `xvfb-run --auto-servernum npm test`. Default tests are offline;
real-profile proofs are separate explicit local ReadOnly runs and never run in CI.

The [HTTP](integrations/random-rest/README.md) and
[browser](integrations/random-pw/README.md) examples implement the same two RANDOM commands.
Both exercise optional IPC; only the browser example starts Chromium. They remain deliberately
small, use synthetic routed pages/MSW by default and give the shared runtimes real consumers.
See [runtime modules](docs/runtime-modules.md) and [browser observation](docs/browser-observation.md).

## Releases and agent guidance

TeamCity builds main through the Cake driver and `build/teamcity.sh`; no GitHub Actions workflow
publishes packages. Factory releases Core only. The [release guide](docs/npm-release.md) describes
clean exact-revision packing, credential-free dry runs, npm stage/download integrity receipts,
owner approval with 2FA and registry/GitHub Release verification. Publication is a separate
owner approval step after the exact stage has been verified.

Agents begin at [AGENTS.md](AGENTS.md). [DESIGN.md](docs/DESIGN.md) is canonical;
[testing](docs/testing.md), [role index](docs/roles/README.md) and
[issue lifecycle](docs/practices/github-issues.md) govern delivery. Transient coordination stays
Git-ignored under `.workspace/workstreams/`. `CliWrap.ts` remains planned until a first real
process-pipeline consumer exists; no empty submodule placeholder is added.
