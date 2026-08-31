# TeamCity v2 — checkpoint +100 / S3 review

Date: 2026-08-30. Branch: feature/teamcity-v2. Verdict: **pass, local working tree**.
S3 adds 50 routes (26 ReadOnly, 24 Update) to the 67-route local baseline: **117/449 (26.06%)**,
GET 58/235 (24.68%), Update 59/214 (27.57%). 332 remain. Endpoint counts do not imply all payloads.
S4 production work had not started when this review closed. No commit/push or real mutation.

Scope: [large-slice Issue contract](https://github.com/iXab3r/EyeAuras.CliFactory/issues/5#issuecomment-5468205768).
[s3-coverage.csv](s3-coverage.csv) reconciles one-to-one against the compiled synthetic fixtures and
frozen census, without baseline/S1/S2 overlap. Gates, request URLs, content types, query/body/result,
unknown options and HTTP status-only errors are tested for all 50 routes. The 50 new route cases
failed before implementation; the retained implementation passes **181 tests (20 Core, 161 TeamCity)**.
Additional evidence: all gates denied before HTTP, invalid inputs and strict field/boolean policy,
artifact flags/requirement bodies, protected output-parameter preflight, full property clearing,
empty/malformed/404 responses, two-profile JSON-RPC and a stateful template/default workflow.
The fixed packaged-CLI ReadOnly proof passed 19/19 before this large slice. New scoped reads are
mock-verified; final live proof follows S4. No raw private responses or identifiers were recorded.

## Authoring and simplicity evidence

Counting follows [authoring-baseline.md](authoring-baseline.md): normally formatted nonblank
handwritten TypeScript including comments, all helper/DTO costs, generated output excluded.

| Surface | At +50 | At +100 | S3 delta |
|---|---:|---:|---:|
| Core production | 1742 | 1742 | 0 |
| TeamCity production | 2171 | 2867 | +696 |
| **Combined production** | **3913** | **4609** | **+696** |
| Core tests | 832 | 832 | 0 |
| TeamCity tests/fixtures | 2731 | 3438 | +707 |
| Local proof | 344 | 344 | 0 |

S3 observed cost: **13.92 production lines/new route**. Full v2 since source baseline
1d36395833101c920f74ecdf2749ef2f2f6a0575: +1778/100 = 17.78 lines/new route.
Different endpoint mixes prevent treating these metrics as equivalent-work speedup percentages.
Source by file: advanced-authoring-commands 305, advanced-authoring-models 59, authoring-commands
432, authoring-models 201, bin 3, cli 448, client 1142, command-support 51, index 38, locator 62,
models 126. No helper is omitted from the footprint.

Same-capability detail/list/mutation baseline examples in [S1 review](s1-review.md) still compare
6/15/13 direct declaration lines with 6/12/7 bound-leaf lines. They are reconstructed equivalents,
not counts for routes that existed before v2. Helpers and option setup are counted above.
S3 still declares a detail read, for example:

```ts
leaf("show <project-id> <feature-id>", "Show a redacted feature", Permission.ReadOnly,
  (c, { args }) => c.getProjectFeature(text(args, "project-id"), text(args, "feature-id")))
```

Equivalent collection and mutation use the same leaf with listProjectFeatures/createProjectFeature;
no custom renderer, permission dispatch, JSON-RPC branch or another command model is introduced.
Normal source formatting, not this compact illustration, determines the counts.

Concrete repetition removed/avoided:

- Existing profile-client binding, property option/parser and option helpers now live once in
  the 51-line TeamCity command-support module, shared by the two command files. This is relocation
  with a real second command consumer, not a new Core or HTTP abstraction.
- Existing five-leaf plain-parameter tree/client now also owns output-parameters; the path and
  owner type are extended explicitly. Protected metadata preflight remains one implementation.
- One settings tree handles five actual PropEntity families while retaining the official name-only
  exception for steps. Plugin parameter operations share only the two real step/feature contracts.
- Requirement/artifact CRUD uses a discriminated RuleInput; body construction remains explicit
  and service-shaped. It does not accept arbitrary JSON or a generic CRUD descriptor.

Checkpoint experiment: centralizing six already-parsed property casts behind propertyValues
increased total production code 4609→4620, adding import/helper cost and a new lookup hop. Rejected
and removed it; retained straightforward casts. All 181 tests re-run after removal. There is no
required corrective work left before S4. Do not create abstractions just to report a refactor.

Core remains unchanged for S3. Its existing required-option, profile, auth, gate and persistent
parser mechanisms are reused; promoting TeamCity property/locator semantics would harm other CLIs.
No new dependencies, code generation, compatibility paths, hidden retry/merge or output dumping.
The larger client remains direct named methods with one existing request helper; splitting HTTP
into a speculative framework was deliberately not part of this slice.

Technical review was performed by the main agent as integration author and orchestrator; no
independent subagent review is claimed. Official source established disabled-only fields, literal
versus ID-qualified locators, project-template JSON bodies and singular buildTags field query.
Final handoff: S4 may now start; close checkpoint +150 after its next 50 routes and full verification.
