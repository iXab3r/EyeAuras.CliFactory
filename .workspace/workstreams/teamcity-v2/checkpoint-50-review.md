# TeamCity v2 — checkpoint +50 / S2 acceptance review

Date: 2026-08-30. Branch: `feature/teamcity-v2`.
Verdict: **pass, local working tree**. S1 +32 and S2 +18 close the first +50 checkpoint.
No operation +51 was started. Commit/push remain pending; Issue #5 and P1 remain open.
The next mandatory checkpoint is +100 new operations (117 total routes), not 100 total routes.

## Reconciliation and evidence

The [S2 Issue contract](https://github.com/iXab3r/EyeAuras.CliFactory/issues/5#issuecomment-5467992110)
was published before implementation. [s2-coverage.csv](s2-coverage.csv) maps 18 passing exact
synthetic cases back to distinct frozen Swagger identities; none overlap the 17 baseline or
[32 S1 routes](s1-coverage.csv). The immutable census files were not changed.

| Snapshot | All routes | GET / ReadOnly | Update-like |
|---|---:|---:|---:|
| Published baseline | 17/449 (3.79%) | 14/235 | 3/214 |
| S1 accepted locally | 49/449 (10.91%) | 25/235 | 24/214 |
| S1+S2 accepted locally | **67/449 (14.92%)** | **32/235 (13.62%)** | **35/214 (16.36%)** |

382 routes remain. These are method/path counts, not all payload variants, server editions,
plugin types or authorization scopes. S2 deliberately excludes bulk replacements, trigger
customization, artifact dependencies, template creation and credential provisioning.

- RED: all 18 new contract tests failed on missing commands before production changes.
- GREEN: `npm test` passed **124 tests** (20 Core, 104 TeamCity), both before and after the
  checkpoint refactor. 50 exact authoring route cases share one boundary harness; the S2 cases
  are independent synthetic fixtures, not copied production field constants.
- All 18 S2 leaves deny their category before HTTP. Every mutation sends one request, with
  exact method, path, query, headers, body and result assertions; no retry or read/merge.
- Extra tests prove disabled defaults and explicit enable, empty full replacements, protected
  and unknown property redaction, nested source/template DTO filtering, invalid inputs, literal
  locator rejection, empty collections, delete 404, malformed JSON and status-only errors.
- Two-profile JSON-RPC continues after help, required-option failure and denied Update, and
  uses the correct URL/token/gate for the following successful write and read.
- Stateful offline workflow creates, reads, replaces and removes extensions/dependencies and
  attaches/inspects/detaches a template. No build launch or unrelated route is contacted.
- Built CLI help checked for trigger replacement, dependency tree and template detach, including
  required options, activation/default behavior and Update labels; version is `0.1.0`.
- Full tracked/untracked privacy scan: 86 files plus working/staged diffs, no unresolved findings;
  only synthetic fixture matches. No files staged; `git diff --check` passed.
- Fixed packaged-CLI real-profile proof passed **19/19, zero skipped/failed**, before and after
  S2. Only ReadOnly service calls; no permission/configuration changes or raw response artifacts.
  New unpaged setting routes stay mock-verified: this is not a claim they were tested live.

The local profile configuration check can read the credential store before the permission gate;
the gate precedes the service client/HTTP call. Tests use configured synthetic profiles. No Core
ordering change was needed or made for S2.

## Correctness review

Read the actual tree, client and DTO code separately from passing tests. Official
[BuildTypeApi](https://www.jetbrains.com/help/teamcity/rest/buildtypeapi.html),
[configuration details](https://www.jetbrains.com/help/teamcity/rest/manage-build-configuration-details.html)
and [JetBrains REST source](https://github.com/JetBrains/teamcity-rest) establish the contracts.
DataProvider.getTrigger accepts a literal ID, not an id: dimension; PropEntitySnapshotDep uses
the upstream external ID. These two path arguments reject locator syntax. Job/template locators
are ID-qualified; features use a literal encoded path segment.

Triggers/features share their real TeamCity PropEntity shape but not snapshot/template semantics.
Both create and replace send disabled=true unless explicitly enabled. Snapshot bodies name
source-buildType and omit a meaningless activation field. Template attach posts one BuildType
identity, not a collection; optimizeSettings and inlineSettings are explicit false by default.
Output maps known identities/metadata and suppresses all new extension property values.
The CLI cannot identify arbitrary secrets under innocent property names: inputs must be non-secret.

Main agent performed integration-author and orchestrating review passes; no independent subagent
review is claimed. Unrelated pending browser/runtime design documents were preserved, not implemented.

## Whole-code footprint

Same [counting rule and source baseline](authoring-baseline.md): nonblank handwritten TypeScript,
comments included, generated files excluded, normal Prettier formatting at width 100. Count all
source under packages/core/src and integrations/teamcity/src, including helpers/DTOs. Test/proof
directories are separate. Baseline: `1d36395833101c920f74ecdf2749ef2f2f6a0575`; after: local tree.

| Surface | Baseline | After S1 | After S2 / +50 | S2 delta | Batch delta |
|---|---:|---:|---:|---:|---:|
| Core production | 1731 | 1742 | 1742 | 0 | +11 |
| TeamCity production | 1100 | 1811 | 2171 | +360 | +1071 |
| **Combined production** | **2831** | **3553** | **3913** | **+360** | **+1082** |
| Core tests | 753 | 832 | 832 | 0 | +79 |
| TeamCity tests/fixtures | 1308 | 2202 | 2731 | +529 | +1423 |
| Local proof harness | 330 | 344 | 344 | 0 | +14 |

S2 costs **20.00 net production lines/new route**; the full +50 batch costs **21.64**.
S1 cost 22.56. This is observed batch growth, not proof of an equivalent-work speedup: slices differ.
S2 production costs include authoring-commands +145, authoring-models +72, client +137, exports +6.
No source file, helper, new dependency or code generation is excluded from these totals.

## Equivalent authoring and corrective simplification

The [S1 equivalent examples](s1-review.md#equivalent-authoring-examples) remain the batch baseline
comparison. The same-capability detail/list/mutation declarations still apply at +50:

| Declaration only | Baseline direct binding | Current bound leaf |
|---|---:|---:|
| Safe detail read | 6 | 6 |
| Bounded collection read | 15 | 12 |
| Mutation with options | 13 | 7 |

These are reconstructed equivalent declarations, not routes that existed at baseline. They
are not a stand-alone net savings claim: the 17-line profile-scoped leaf helper and all client,
DTO and setup costs are counted in the full footprint. Help/output/gates still derive from the
same Core command tree; no per-operation rendering was added.

Concrete S2 reuse: one five-leaf `extensions(kind)` tree and five client methods serve the two
existing trigger/feature families. It is restricted to `"triggers" | "features"`, keeps the
literal-ID difference visible and reuses one safe DTO. Snapshot dependencies and templates keep
named methods and explicit bodies/options; no universal CRUD metadata table was introduced.

At the checkpoint, the fully working pre-refactor source measured 3918 lines (1742 Core +2176
TeamCity). Reviewed repetition was three equivalent property option declarations and duplicated
property-body validation. The corrective refactor:

```ts
const propertyOption: OptionDefinition = {
  flags: "--property <key=value>",
  description: "Repeat for each non-secret property; never credentials",
  parse: collectProperty,
};
```

Steps, extensions and snapshots now reference that one option instead of repeating its flags,
description and parser. A private `propertiesBody` validates plain values and duplicate keys once:

```ts
function propertiesBody(input: readonly PlainProperty[] = []) {
  const properties = input.map((p) => plainProperty(p.name, p.value));
  if (new Set(properties.map((p) => p.name)).size !== properties.length) {
    throw new Error("Duplicate property keys are not allowed.");
  }
  return { property: properties };
}
```

All three bodies call it. Snapshot construction no longer creates an extension body merely to
discard disabled. The refactor changes command source 462→455 and models 199→201: **net -5 lines**,
not a large reduction disguised by moving code. The two added model lines buy a clearer dependency
body and one validation path. No tests were deleted; all 124 still pass. Properties remain a
TeamCity REST concept and were not promoted into Core.

## Benefit to other CLIs and complexity verdict

S1's existing Core option API improvement (`required`) and inherited parser settings remain useful
to any integration: generated help, JSON and persistent JSON-RPC now share mandatory option
validation. S2 consumes that contract for type/source/template options without another framework
change. The neutral Core test remains evidence of the API's lack of TeamCity coupling, not a
pretend second real integration to justify extracting a new mechanism.

Call path remains command tree → profile/gate → thin client → HTTP → safe DTO → shared output.
No new runtime dependency, generator, registry, DI layer, compatibility alias or public Core
concept. A few explicit text/option reads remain longer than an opaque generic CRUD declaration;
retaining them keeps endpoint semantics inspectable. Further Core extraction needs a real second
consumer. No required corrective work remains for this checkpoint.

## Handoff

The next action is owner-directed publication or a new exact P1/P2 slice contract in Issue #5,
with the next checkpoint at +100. The Issue's published checklist stays at 17 until code is pushed;
local progress is tracked separately. Do not close the whole feature or quietly mark unimplemented
routes covered. Re-run the full-tree/staged privacy gate before any future commit.
