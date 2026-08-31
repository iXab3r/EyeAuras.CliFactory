# TeamCity v2 — authoring baseline

Captured 2026-08-30 at source commit `1d36395833101c920f74ecdf2749ef2f2f6a0575`.
Planning evidence only: no production API or implementation change has been made.

## Measurement rule

Count nonblank physical lines in handwritten `.ts` files, including comments, recursively in the
listed directories. Exclude generated `dist` output, dependencies, docs and workstream records.
Do not compare differently formatted/minified code. Keep tests/proof code separate from production.
These are total footprints, not the marginal cost of a new endpoint.

| Surface | Files | Nonblank lines |
|---|---:|---:|
| `packages/core/src` | 11 | 1731 |
| `integrations/teamcity/src` | 6 | 1100 |
| `packages/core/tests` | 4 | 753 |
| `integrations/teamcity/tests` | 7 | 1308 |
| `integrations/teamcity/integration-tests` | 1 | 330 |

The TeamCity source includes 443 lines in `cli.ts`, 438 in `client.ts`, 126 in `models.ts`,
and 93 across its remaining source files. Shared Core plus TeamCity source totals 2831 lines.
Do not divide these totals by 17 and call that the cost of the next command: setup, authentication,
output and many shared behaviors have already been paid for.

## Qualitative baseline

Existing repetition to test against concrete examples:

- argument casts from `Record<string, unknown>`;
- string/number option extraction and optional-property object spreads;
- repeated client acquisition in command handlers;
- future project/job parameter symmetry;
- one integration-local HTTP path that currently only handles JSON GET/POST.

The first three are candidates for simplifying existing command/authoring surfaces. TeamCity
property/locator/HTTP behavior stays in the integration unless the repository's promotion evidence
is actually met. No helper or new public Core API is preapproved by this list.

## First implementation experiment

Choose detail-read, list and mutation examples from the S1 inventory; record exact source ranges
and before/after diffs with unchanged behavior. Include the cost of any helper and its tests,
then apply only the simplest successful pattern to the remaining S1 operations.

Record declaration/glue cost per example, total net Core/integration source changes, tests
separately, exported concepts/dependencies added and how many layers lead from declaration to
fetch. Preserve privacy, typing, generated help, profile/gate behavior and JSON/JSON-RPC contracts.

Reference: [authoring review practice](../../../docs/practices/integration-authoring-reviews.md).
