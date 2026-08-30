# YouTrack REST integration — implementation plan

**Lifecycle:** active — v1 functionality and AR118 complete; formal release evidence pending.  
**Feature scope:** [GitHub Issue #6](https://github.com/iXab3r/EyeAuras.CliFactory/issues/6).  
**Current milestone:** functional v1 is committed as `10d7fee2cbce13d90bf59a82f9946962ea69218b`; independently review and fix that commit, then evaluate shared authoring improvements across actual YouTrack and TeamCity consumers. Keep Issue #6 and the workstream open until its formal close-out gates are satisfied.
**Accepted REST operations:** 118/118 (98 ReadOnly, 20 Update). **Accepted derived download:** 1/1, counted separately.

Issue #6 owns the v1 contract; this plan orders work and the ledger records evidence. The user
now explicitly authorizes the three post-v1 phases below, including local commits. Earlier
planning and no-commit restrictions remain historical. Root alone stages, commits and publishes
GitHub updates; domain agents implement source and independent agents review it. No push, merge,
live mutation or broader real-service crawl is authorized.

## Post-v1 phases — current execution order

PV1 receipt: commit `10d7fee2cbce13d90bf59a82f9946962ea69218b`, tree
`3accb6209f276e34cb80aecdc389bd1afe544026`; root reported a clean worktree immediately after
commit, fresh 400-test PASS and independent full-tree/staged privacy PASS. PV2 reviewers are
`review_core_v1`, `review_safety_v1` and `review_operations_v1`, inspecting that exact commit and parent.

PV2 profile-isolation contract is published as [Issue #9](https://github.com/iXab3r/EyeAuras.CliFactory/issues/9).
Its source owner is released, including configure collision preflight before authentication or secret
mutation. All four PV2 findings are independently closed and the root coherent suite passed
414/414. See `research/pv2-review-receipt.md`; final formatting is frozen; privacy and the fixing commit remain
pending. PV3 still awaits that exact corrected baseline.

1. **PV1 — commit the verified functional baseline (done).** Root reviews the intended
   source/docs diff, runs the full tracked-tree and staged-diff privacy gate, and commits current
   v1 plus these management records. Resolve findings before committing; record the resulting
   commit and verification evidence. Reference Issue #6 without claiming its formal closure.
2. **PV2 — independent commit review and fixes (review passed; fixing commit pending).** Review the exact PV1 commit against
   its parent, with bounded attention to Core, both integrations, safety and public contracts.
   Agents fix actionable findings; use focused regression evidence and the full suite for the
   final corrected tree. Repeat independent review until required corrections close. Root commits
   fixes after the same privacy gate and records the accepted commit/hash as the next baseline.
   If no fixes are needed, record that verdict without an empty commit.
3. **PV3 — shared authoring analysis and trials (pending).** Start only after PV2 passes. Inspect
   actual YouTrack and TeamCity duplication and accepted parallel Core changes. Before product
   implementation, root records a bounded candidate Issue or amendment with behavior, exclusions
   and acceptance; repository-only maintenance may use a complete reviewable commit record under
   the Issue practice. Preserve direct same-capability list/detail/mutation examples and trial the
   smallest useful existing-Core improvement or helper. New shared mechanisms need both real
   consumers, not a speculative service. Keep trials only with independent correctness and
   authoring/simplicity PASS; revert rejected trials and record why. Root owns subsequent commits.

The starting witness is `research/authoring-baseline/snapshots/ar118-final.json`, SHA
`594bc11c7802b24f287fabac0da278e3feef6bb3c753f888836ee379e89f1e32`: 99 TypeScript file hashes,
6,876 production lines (Core 1,760 / TeamCity 1,100 / YouTrack 4,016), 8,264 test/support lines and
513 proof lines; 400 offline tests and 24 bounded live GETs passed. Re-record the reviewed commit
and any changed costs after PV2; do not attribute correctness fixes or parallel changes as savings.
For PV3 count full Core + all integration source/setup/helper cost, tests/support/proof separately,
and new concepts, dependencies and call-path layers. Compare equivalent behavior with readable
formatting and unchanged safety. No generator, DSL, universal HTTP layer, abstraction quota or
promised reduction percentage. A simpler direct implementation may be the accepted result.
Endpoint coverage remains 118/118 plus the separate download; refactors do not advance it.

## Constraints and baseline

- Worktree `EyeAuras.CliFactory-1`, branch `feature/youtrack-v1`, source baseline
  `e0d4d1b8dc615a969a0160f69a5fb34968d9ab3d`. Preserve independent TeamCity work.
- Full research was explicitly requested; implementation stays in useful, small slices. The
  281-row census and P0/P1=v1, P2/P3=v2 priorities remain unchanged.
- Follow canonical design and [authoring review practice](../../../docs/practices/integration-authoring-reviews.md).
  The exact new law 13 and its practice were synchronized as docs only; no branch was imported.
- Frozen measurements and reproduction: `research/authoring-baseline/{baseline.json,README.md,recount.ps1}`.
  Core + all integration source is 2,831 nonblank handwritten TS lines; tests/support 2,061 and
  local proof 330 are separate. Baseline YouTrack source and accepted count were zero, not claimed savings.
- Count unique census METHOD PATH only after exposure, boundary tests and review acceptance.
  Flags, aliases, auth reuse, helpers, tests and the derived download do not inflate the counter.
- Count all Core + YouTrack + other integration source/setup/helper changes, with tests/fixtures/
  support/proof separate. Keep normal formatting, safety and typing. No abstraction quota, new
  generic HTTP/CRUD layer, generator, or speculative dependency.
- A new shared mechanism requires actual TeamCity and YouTrack consumers. Existing Core ergonomic
  improvements are candidates only. Inspect accepted parallel changes before proposing overlap;
  record any later reviewed baseline import and attribution without resetting the original counter.

## Live verification authorization and limited access

The owner permits real YouTrack data during development through the existing configured profile,
but its token has limited permissions. Identity success does not prove access to other resources.
Use explicit, bounded ReadOnly verification of implemented behavior only. The current fixed proof
inventory is twenty-four reviewed ReadOnly rows in the packaged profile proof; final root execution passed all24 with no skips or failures. Earlier five/thirteen/twenty-one-row proofs are historical.
extend it only for a relevant implemented consumer/test change
and review. This authorization does not permit a permission census, broad crawl, live mutation or CI networking.

Record live availability separately from product correctness. Investigate 401 authentication and
403 access failures without assuming their cause or treating them as automatic expected skips;
a required denied proof row is not PASS. A 404 may mean missing resource, wrong ID, hidden access,
or version differences. Other failures also need evidence before classifying a product bug.
Offline request/auth/permission/response contracts remain mandatory; limited live rights never
justify silently skipping correctness tests or weakening gates. Save no raw live payload, private
URL/identity or token in Git/GitHub; derive only minimal reviewed, sanitized synthetic fixtures.
## Completed preparation

R0 repository/worktree baseline; R1 official 169-page/281-operation census; R2 classification and
public contract; R3 Issue publication/readback are complete. The later first-slice/cadence amendment
was reviewed and published in Issue #6 before this plan was reconciled. No preparation completion
implies executable coverage.

## V1.0A — profile, authentication and identity (target cumulative 1)

Implement the Issue's A1 identity operation and minimal package/build/profile/token wiring using
existing Core. Gate: native-fetch MSW evidence for validation before storage, profile/AppData
isolation, missing noninteractive setup and sanitized failures; no hand-rolled standard commands.


Current readiness: the shared prompt correction passed offline review, the user configured and
authenticated through the ordinary CMD/npm pipeline, and the bounded packaged-CLI identity proof
passed through the normal profile/keyring. No mutations or raw service payloads were captured.
Use the user's current terminal for future login; no auxiliary windows. The earlier profile-visibility
discrepancy remains unexplained historical evidence and was not followed by a code change.

## V1.0B — project and issue context (target cumulative 5)

Add only the Issue's B1–B4 project/issue/comment reads. Gate: bounded single-page collections,
fixed defaults and opt-in fields, correct query/ID encoding, empty/error results, permission checks,
and the same handler behavior in human/JSON/RPC output. Review B before C starts.

## V1.0C — controlled narrative mutations (target cumulative 8)

Add only C1–C3 issue create/update/comment-add with the Issue's narrow bodies. Gate: each Update
leaf is denied before fetch; local unsupported/malformed payloads are rejected; omission/null,
remote required-field rejection, successful/empty responses and no mutation retry are proven.
No automatic custom-field discovery/defaulting; this slice does not assign or resolve issues.

## AR8 — ordinary first-slice and early authoring review

Gate: focused tests and `npm test`, complete slice acceptance, and separate technical and
simplicity verdicts. Capture actual direct issue list/detail/update source snapshots, whole helper/
setup cost and source/test deltas; compare actual before/after if simplified. TeamCity examples
are references, not assumed equivalent costs. Record revision or dirty-source hashes without
forcing a commit. Close required corrections before the next slice; cumulative target stays 8.
Optional future live evidence remains an explicit bounded ReadOnly packaged-CLI/profile/keyring
proof with CI refusal; official samples suffice without an instance. No live work ran in planning.

## V1.1 — later useful slices up to cumulative 50

Choose subsequent P0/P1 slices from Issue #6 by user value; their detailed order is not planned
here. Keep normal slice reviews and the fixed first-eight comparison capabilities. Split any slice
at the boundary. Gate: 50 unique operations accepted with concrete boundary evidence.

## AR50 — mandatory authoring checkpoint (complete)

Completed evidence: `research/authoring-baseline/ar50-review.md` (independent/root PASS), final 215/215 tests and thirteen-row live ReadOnly PASS. Required corrections are closed; snapshot `research/authoring-baseline/snapshots/ar50-final.json` records all costs.

Use `authoring-review-template.md` and the canonical practice. Gate: independent authoring PASS,
total code/complexity evidence, and all required corrections closed. **Do not implement operation
51 before this gate closes.** Tests alone do not close it.

## V1.2 / AR100 — useful slices to100 and review (complete)

Completed evidence: `research/authoring-baseline/ar100-review.md` records independent/root PASS, final312 tests and21 live ReadOnly PASS. Final snapshot `research/authoring-baseline/snapshots/ar100-final.json` includes all costs and the equivalent local helper saving of9 lines.

Continue normal slices only after AR50. At100 repeat the same evidence and independent verdict.
**Do not implement operation 101 until AR100 passes and its corrective work closes.** Neither
checkpoint resets the cumulative counter; imported parallel changes retain separate attribution.

## V1.3 / AR118 — final18 and derived capability (complete)

Completed:118/118 routes plus separate download1/1; independent/root AR118 PASS, final400 tests and24ReadOnly proof PASS. Evidence: `research/final-functional-acceptance.md` and `research/authoring-baseline/ar118-review.md`.
Gate: review the final shorter batch at 118, including all delivered download source cost even
though it is not operation 119. Reopen the final review if download code lands afterward.

## Delivery and v2 handoff

Gate: complete Issue v1 acceptance, command/docs agreement, focused and repository-wide evidence,
explicit linked v2 deferral, and workstream close-out. Keep Issue #6 open until those gates hold.
Functional acceptance and AR118 PASS are recorded; no delivery date, overall authoring reduction, closing commit/PR or CI result is invented.

## Review and handover protocol

The integration author records accepted IDs and evidence; the reviewer/orchestrator alone closes
phase rows and authoring gates. Use the compact template; leave unknown metrics pending. Correct
scope in Issue #6 first, then reconcile the ledger. Start future work by reading Issue #6, this
plan, the ledger, `integrations/AGENTS.md`, and the canonical integration/testing practices.
