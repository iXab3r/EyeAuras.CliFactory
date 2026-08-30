# TeamCity v2 — checkpoint +200 / S5 review

Date: 2026-08-30. Verdict: **pass, local working tree**. S5 adds 50 routes (14 GET,
36 Update) for **217/449 (48.33%)**: 100/235 GET, 117/214 Update; 232 remain.
Authority: [owner completion and S5 contract](https://github.com/iXab3r/EyeAuras.CliFactory/issues/5#issuecomment-5468407176).
[s5-coverage.csv](s5-coverage.csv) matches 50 compiled mock cases and distinct frozen census
identities, without baseline/S1–S4 overlap. No commit/push or real Update was performed.

## Correctness

All 50 exact cases failed before implementation, then passed. Full `npm test`: **299 passed
(20 Core, 279 TeamCity)**, no failures/skips. The shared 200-case harness checks exact method,
path, query, body/media, projection, denied gates before HTTP and payload-free remote failures.
Eight extra S5 tests cover strict typed items, empty collections, explicit confirmation, protected
parameter preflights, false flags, unsolicited nested values, two-profile RPC and a stateful
parameter workflow. Real evidence remains the previously completed fixed 19/19 ReadOnly proof;
new mutations are mock-verified, not live-verified.

Source review settled project ordering's singular `field`, explicit template flags, queue approval
with `approveAll=false`, bounded single-job queue deletion and JSON paused-state bodies. Parameter
value/type operations preflight metadata; protected reads return redacted metadata without fetching
the scalar, protected writes fail. This check is not an atomic server-side concurrency guarantee.
Bulk replacement removes omitted settings; parameter clear explicitly includes protected settings.
No raw JSON/HTTP passthrough is exposed. Typed items reject unknown keys before HTTP.

## Authoring and simplicity

Nonblank handwritten TypeScript, normally formatted at width 100, including all helper/DTO costs:

| Surface | At +150 | At +200 | Delta |
|---|---:|---:|---:|
| Core production | 1742 | 1742 | 0 |
| TeamCity production | 3730 | 4497 | +767 |
| Combined production | 5472 | 6239 | +767 |
| Core tests | 832 | 832 | 0 |
| TeamCity tests | 4242 | 4977 | +735 |
| Local proof | 344 | 344 | 0 |

S5 costs **15.34 production lines/route**; cumulative v2 +3408/200 = 17.04. API mixes
differ; these are not equivalent-feature productivity percentages. Existing equivalent
detail/list/mutation comparisons (6/15/13 direct versus 6/12/7 bound) remain the reference.

Actual reuse: the existing body builders, protected-property projection, profile-bound leaves and
independent boundary harness support the new families. Repeat-option parsing moved into the existing
63-line command-support module for two actual consumers. The new collection validator is 172 lines
and commands 269 lines; both are included above. Declarations remain ordinary tree leaves calling
named client methods. No Core concept, dependency, registry, generator or universal HTTP layer.

Review corrections: replaced collection plural-name slicing with explicit native collection keys;
preserved valid empty optional rule values and explicit false booleans. Corrected two independent
fixture expectations to existing source behavior (artifact clean defaults false; public VCS entry
projection names checkout rules `rules`). Core remains service-agnostic; no second real integration
justifies promoting these TeamCity rules. Main agent performed code/reconciliation review; the
research subagent supplies sources, not an independent code-review verdict.

Privacy scan: 105 tracked/untracked files plus working/staged diffs, 32 synthetic fixture matches,
zero unresolved findings. Nothing staged. Re-run before any future commit. The owner authorizes
autonomous continuation, so the next exact S6 contract can proceed after this closed checkpoint.
