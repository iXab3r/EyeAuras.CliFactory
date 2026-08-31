# S1 authoring and acceptance review

Date: 2026-08-30. Branch: `feature/teamcity-v2`.
Verdict: **pass for S1 in the local working tree**; not yet committed or pushed.
This is a slice review, **not** the +50 mandatory checkpoint. Counter: **32/50**; 18 remain.
P1 and the full v2 Issue stay open.

## Scope and evidence

The [S1 contract](https://github.com/iXab3r/EyeAuras.CliFactory/issues/5#issuecomment-5467757311)
selects 32 routes. [s1-coverage.csv](s1-coverage.csv) maps the 32 passing synthetic REST cases
back to 32 distinct frozen Swagger identities: 11 GET, 21 mutations, no baseline overlap.
Result in this working tree: **49/449 (10.91%)**, GET **25/235 (10.64%)**, updates
**24/214 (11.21%)**; **400 routes remain**. Route coverage does not imply all payload variants.

- `npm test`: 97 passing tests (20 Core, 77 TeamCity), including 42 authoring tests.
- Each new route: exact method/path/query/media type/body/result, unknown-option rejection and
  remote error evidence. All 21 mutations deny before HTTP, including metadata preflights.
- Stateful offline scenario: create project/job, plain parameter, step, attach existing root,
  inspect job, invoke existing launch/status, then explicitly detach/delete.
- Security review: parameter metadata/type redaction, unknown plugin-property suppression,
  credential-free VCS summaries, encoded literal identifiers, root-delete rejection, no retries.
- Built CLI nested help/version verified; required flags are labeled; JSON-RPC survives help,
  argument errors and denied updates while keeping two profiles' URL/token/permissions separate.
- Local real-profile packaged proof: **19 passed, 0 skipped, 0 failed**, with VCS root list/detail
  added to the existing fixed bounded inventory. No live mutations. Scoped unpaged lists remain
  mock-only; this review does not claim all 11 new reads were exercised live.
- No private URL, token, real entity ID or raw live payload was saved.

## Corrected evidence and bounded deviations

The first required-option RED test exposed missing Commander settings inheritance. A nested
help/error could call `process.exit`, ending JSON-RPC or a test worker early. The old “42 passed”
was the runner's actual report, **not full execution evidence**. Fixing inheritance ran 54 existing
tests successfully; the new Core test brought that to 55 before authoring tests were added.
The historical baseline stays frozen; this correction supersedes its completeness claim.

[Issue clarification](https://github.com/iXab3r/EyeAuras.CliFactory/issues/5#issuecomment-5467836179)
records the fix, `OptionDefinition.required`, metadata-only preflight for parameter writes,
and HTTP status-only error reporting before the expansion continued.
The preflight is defense-in-depth, not a transaction; plain parameters must never contain secrets.
Step replacement is a single PUT without read/merge. A stalled mock-stream cancellation experiment
was removed; error responses are drained without exposing their contents.

## Full footprint, including helpers

Same [baseline counting rule](authoring-baseline.md): nonblank handwritten TypeScript lines,
comments included; generated files excluded. Baseline source is `1d36395833101c920f74ecdf2749ef2f2f6a0575`;
after is this reviewed working tree. Normal formatting retained; a small formatting-only delta
in pre-existing files is included, not credited as semantic simplification.

| Surface | Before | After | Net |
|---|---:|---:|---:|
| Core production | 1731 | 1742 | +11 |
| TeamCity production | 1100 | 1811 | +711 |
| **Combined production** | **2831** | **3553** | **+722** |
| Core tests | 753 | 832 | +79 |
| TeamCity tests/fixtures | 1308 | 2202 | +894 |
| Local proof harness | 330 | 344 | +14 |

Amortized batch growth is **22.56 production lines per new route**, not a claimed percentage
improvement over v1. Safety checks, DTOs, binding and setup are included. New source files cost
310 lines (`authoring-commands.ts`) and 129 (`authoring-models.ts`); they are not hidden overhead.
The shared client grew by 264 lines, integration wiring/exports by 8.

## Equivalent authoring examples

Before snippets reconstruct the baseline's direct binding style for the **same S1 behavior**;
these routes did not exist at baseline. After snippets use current helpers and the same clients.
Counts cover declarations only, not validation/HTTP/DTOs; all helper cost is in the footprint above.
Line breaks are shown explicitly, not minified. Detail reads do not become shorter by line count.

### Detail read

Before (6 nonblank lines):

```ts
command(
  "show <id>",
  "Show a root identity without connection properties",
  async ({ args }, context) => (await client(context)).getVcsRoot(text(args, "id")),
  { permission: Permission.ReadOnly },
)
```

After (6 nonblank lines):

```ts
leaf(
  "show <id>",
  "Show a root identity without connection properties",
  Permission.ReadOnly,
  (c, { args }) => c.getVcsRoot(text(args, "id")),
)
```

### Bounded collection read

Before (15 nonblank lines):

```ts
command(
  "list",
  "List a bounded page of VCS roots",
  async ({ options }, context) => {
    const project = stringOption(options, "project");
    return (await client(context)).listVcsRoots({
      ...(project === undefined ? {} : { project }),
      ...pageValues(options),
    });
  },
  {
    permission: Permission.ReadOnly,
    options: [{ ...projectOption, required: false }, ...pageOptions],
  },
)
```

After (12 nonblank lines):

```ts
leaf(
  "list",
  "List a bounded page of VCS roots",
  Permission.ReadOnly,
  (c, { options }) =>
    c.listVcsRoots({
      ...optionalText(options, "project"),
      limit: Number(options.limit),
      start: Number(options.start),
    }),
  [{ ...projectOption, required: false }, ...pageOptions],
)
```

### Mutation with a required option

Before (13 nonblank lines):

```ts
command(
  "move <id>",
  "Move a project to a parent",
  async ({ args, options }, context) => {
    const parent = stringOption(options, "parent");
    if (parent === undefined) throw new Error("Missing --parent.");
    return (await client(context)).moveProject(text(args, "id"), parent);
  },
  {
    permission: Permission.Update,
    options: [{ flags: "--parent <id>", description: "Parent project ID" }],
  },
)
```

After (7 nonblank lines):

```ts
leaf(
  "move <id>",
  "Move a project to a parent",
  Permission.Update,
  (c, { args, options }) => c.moveProject(text(args, "id"), text(options, "parent")),
  [parentOption],
)
```

The three declarations total 34 → 25 lines. This alone is **not** a net win: the local `leaf`
binding costs 17 nonblank lines, and option/input helpers also cost code. It is retained because
all 32 new leaves use it, removing repeated async profile-client acquisition and permission/options
wrapping while keeping explicit categories and direct client calls. No handler renders output.

The strongest concrete reuse is project/job parameters: one five-leaf tree instantiated for two
owners, one five-method client surface and one write/preflight path. Routes remain visible in
`parametersPath`, and both owners have separate exact HTTP cases. A universal CRUD factory
would add concepts without another actual resource contract to justify it.

## Simplicity and common-code review

- Shared public change: one optional property on existing `OptionDefinition`; required checking,
  defaults and generated help now serve every CLI. The neutral Core test checks coupling; it is
  not represented as a second real integration.
- No new runtime dependency, generator, schema DSL, DI container or universal HTTP client.
- New intentional integration exports: create-project/job input types, parameter owner/plain
  property/step input and VCS root DTO. Raw REST DTOs stay internal to the package entry point.
- Trace: command declaration → local client binding → named TeamCity client method → existing
  local request helper → fetch. The JSON decoder shares that request helper; text/empty paths do
  not parse JSON. Parameter writes have the one explicit metadata-check helper described above.
- Locators, fields, paths, DTOs, property safety and request formats remain entirely in TeamCity.
  They were not moved into Core to make the integration look smaller.
- Direct leaf binding adds one visible helper hop. It reduces repeated ceremony, but does not
  eliminate `Record<string, unknown>` extraction. Do not introduce a generic typed command
  framework just for this slice. Reassess against real next operations at the +50 checkpoint.
- Scope is complete for S1; no required correctness/simplicity correction is left open.
  Remaining P1 families, VCS provisioning and the other phases require their next explicit slice.
