# YouTrack authoring baseline

Frozen source: `e0d4d1b8dc615a969a0160f69a5fb34968d9ab3d`
in worktree `EyeAuras.CliFactory-1`, branch `feature/youtrack-v1`.
The counted source matches that commit; the original worktree's parallel changes are not included.
No YouTrack implementation exists. Newly accepted YouTrack operations: **0**.

The governing authoring-review practice was supplied by the owner from
`D:\Work\EyeAuras.CliFactory\docs\practices\integration-authoring-reviews.md`
on 2026-08-30. Reading that policy does not import the original worktree's source or reset this baseline.

## Reproduce

From this worktree, run:

```powershell
& .workspace/workstreams/youtrack-rest/research/authoring-baseline/recount.ps1
```

The script reads tracked files from the immutable Git commit, not the working tree.
`baseline.json` contains every exact path and count. Count nonblank physical handwritten
TypeScript lines with comments included and formatting preserved. Exclude generated output,
dependencies, management scripts and non-TypeScript files. Tests, support and local proof are separate.
There are no separate non-TypeScript test fixtures in these frozen source roots.

| Surface | Files | Nonblank TS lines |
|---|---:|---:|
| Core source | 11 | 1,731 |
| TeamCity source | 6 | 1,100 |
| YouTrack source | 0 | 0 |
| Core + all integration source | 17 | 2,831 |
| Core tests | 4 | 753 |
| TeamCity tests, excluding support | 6 | 1,155 |
| TeamCity test support | 1 | 153 |
| TeamCity local profile proof | 1 | 330 |

TeamCity source breakdown: declaration/CLI 443, client 438, DTOs 126, locator/validation 62,
exports 28, executable 3. Core and all integration test/support total is 2,061; local proof
adds 330 separately. These are measurements, not targets for reducing line counts.

## Fixed representative components

All paths below are relative to the frozen repository root. Ranges are physical lines at the
exact commit; nonblank counts include comments. They are not total per-operation costs.

| Capability | CLI declaration | Client method |
|---|---|---|
| Detail: projects show | integrations/teamcity/src/cli.ts:213-218 = 6 | integrations/teamcity/src/client.ts:187-193 = 7 |
| Collection: projects list | integrations/teamcity/src/cli.ts:193-212 = 20 | integrations/teamcity/src/client.ts:168-185 = 18 |
| Mutation: jobs run | integrations/teamcity/src/cli.ts:251-269 = 19 | integrations/teamcity/src/client.ts:363-379 = 17 |

Shared cost remains visible: profile/client factory 16 lines; CLI validation and input adapters
58; page declarations 14; local HTTP helper 50; client fields/constructor 24; HTTP error type 8.
DTOs, endpoint fields, envelope types, tests and remaining source are included in the file totals.
Do not add overlapping sample costs together or divide these isolated fragments by operation count.

Related boundary evidence: client-foundation.test.ts:88 and :126 for collection/detail;
client-operations.test.ts:115 for mutation; cli.test.ts:145 for pre-fetch permission denial,
:187 for profile isolation, and :221 for interleaved JSON-RPC profiles.
These paths are under integrations/teamcity/tests and are reference tests, not a new test run.

Compare later YouTrack detail/list/mutation implementations before and after simplification
with the *same* request validation, response projection, pagination, help, gates and tests.
Cross-service examples establish shape; differences in domain behavior prevent a raw line-count
comparison from proving improvement.

## Observable complexity baseline

- Core exports 11 runtime names and 24 type names from packages/core/src/index.ts.
- TeamCity's CLI imports four Core runtime names (command, createCli, Permission, tokenAuth)
  and five Core types (CliApplication, CliRuntime, CommandContext, OptionDefinition, Profile).
- Core has two direct runtime package dependencies: commander and @napi-rs/keyring.
  TeamCity has one runtime dependency, the same @eyeauras/cli-factory; MSW is test-only.
- A representative service request has three integration stages after Core dispatch:
  leaf adapter, public client method, private request helper, then the native fetch boundary.
  The profile-aware client factory supplies configuration; locator helpers perform local validation.
  No registry, HTTP plugin layer, service-neutral CRUD DSL or generated schema participates.
- Record any added exported names, dependencies, construction concepts and call-path stages at review,
  not just shorter handlers.

## First-slice use and measurement

Reuse command construction, profile/configuration, token/keyring lifecycle, permissions,
output/JSON-RPC and injected runtime. Keep YouTrack routes, fields, DTOs and pagination local.
Start with direct representative operations. Candidates for later improvement to existing Core
surfaces are typed command input/option inference, simple handler binding, and less duplicated
contract-test setup. None is a promised abstraction or required extraction before evidence exists.

For every checkpoint report Core, YouTrack, every other affected integration, and their net
source delta; report tests, support, fixtures and local proof separately. Count setup cost fully.
Only an implemented and accepted batch can yield a net source-delta/new-operation metric.
A zero initial YouTrack codebase provides no reduction percentage. Existing TeamCity source is
a reference, not newly accepted YouTrack coverage.

Checkpoints at +50, +100, ... accepted unique REST method/path operations block the next batch
until review and corrective simplification finish. Review a final short batch too. The first
eight-operation slice receives its ordinary slice review; those eight remain progress toward
the +50 workstream boundary unless that slice ends the expansion.

## Known reference-test limitation

integrations/teamcity/tests/process.test.ts:18 injects CLI_FACTORY_HOME, but Core has no reader
for that removed override. This test does not provide its apparent AppData isolation and must
not be copied into YouTrack. Use design-conformant injected AppArguments/runtime. This baseline
records the discrepancy without changing source, declaring the tests fixed, or executing them.

