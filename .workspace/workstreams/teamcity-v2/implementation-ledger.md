# TeamCity v2 — implementation ledger

Lifecycle: active for PR corrections/CI closure. S1–S10 expose449/449 frozen routes;
implementation717b346 is published in [PR #13](https://github.com/iXab3r/EyeAuras.CliFactory/pull/13).
[Follow-up review](pr-review-followup.md): R1/R2 fixed, main/YouTrack integrated,952 local tests pass;
actual CI on the integrated PR head remains the merge gate.
Feature contract: [Issue #5](https://github.com/iXab3r/EyeAuras.CliFactory/issues/5).
Working branch: `feature/teamcity-v2`.

| Phase | Scope | Status | Agent | Review |
|---|---|---|---|---|
| 0 | Census, Issue and branch setup | done | Main agent / Reconciliation Lead | Pass: Issue body, linked branch, nine published blobs, privacy gate and 42 tests verified |
| 1 | Project/job authoring | done | Main agent / integration author | Local contracts/tests and checkpoints S1–S5 passed; final route reconciliation passed |
| 2 | Advanced launch and queue | done | Main agent / integration author | Local S4/S5/S6 contracts and safety checks passed |
| 3 | Build evidence, annotations and triage | done | Main agent / integration author | Local S6/S10 contracts, real saved-byte tests and final review passed |
| 4 | Infrastructure and configuration | done | Main agent / integration author | Local S7/S8/S9 gates and contract evidence passed; native reset limitation explicit |
| 5 | Administration and final reconciliation | awaiting review | Main agent / Reconciliation Lead | R1/R2 and main reconciliation pass local review;952 tests pass; integrated CI pending |

## 2026-08-30 — phase 0

Owner request: create a separate GitHub Issue containing the complete API inventory and current
state; implement follow-ups on `feature/teamcity-v2`. This turn sets up tracking and branch only.

- Confirmed there was no open TeamCity v2 Issue or existing `feature/teamcity-v2` branch.
- Baseline local and remote `main`: `e0d4d1b8dc615a969a0160f69a5fb34968d9ab3d`.
- Reused the completed [449-operation audit](../teamcity-api-coverage-20260830/report.md):
  17 exposed, 432 missing; read-like 14/235, update-like 3/214.
- Created Issue #5 with all 449 method/path checklist rows (17 checked, 432 unchecked),
  existing CLI mapping, metric limitations, future slices, permission review and closure contract.
- Created the branch through `gh issue develop 5 --base main --name feature/teamcity-v2 --checkout`.
  GitHub reports it linked to the Issue; the local checkout is on that branch.
- Before Issue publication, scanned all tracked and pending files (71 at that point): no unresolved
  privacy findings; credential-shaped literals were synthetic fixtures. Published no private URL,
  real ID, credential or raw service payload.
- No API implementation, user-profile change, permission grant or real service mutation occurred.
- Retrieved the published Issue and compared its complete body with the reviewed draft: exact
  match, all 449 rows present, Issue open and labeled enhancement. Verified the linked branch.
- Re-ran `npm test` on the feature branch: 42 passed (14 Core + 28 TeamCity).
- Published the frozen audit and workstream in commit `1b59539` on `feature/teamcity-v2`.
  GitHub's remote ref matched local HEAD; all nine published artifact blob hashes matched the
  committed tree. The existing `main` ref remained unchanged.
- Before that commit, the privacy gate scanned the full 73-file tracked tree and the staged
  nine-file diff: no unresolved findings. `git diff --cached --check` passed; no generated build
  output or unrelated files were staged.

Phase 0 review verdict: passed. The requested tracker and linked feature branch are published.
Phases 1–5 remain pending; no new TeamCity API operation has been implemented by this setup.

## 2026-08-30 — S1 planning and authoring-review cadence

Owner requested the first slice and a mandatory review after every 50 operations to reduce
integration authoring code while retaining simplicity and seeking benefit for other CLIs.

- Recorded the [S1 contract](https://github.com/iXab3r/EyeAuras.CliFactory/issues/5#issuecomment-5467757311)
  in Issue #5 and linked it from the Issue body; the 17 baseline checked rows remain unchanged.
- S1 selects 32 unique unimplemented Swagger routes: 11 reads and 21 updates. Its 8/10/5/9
  substeps cover lifecycle, parameters, steps and existing-root discovery/attachments.
- Reviewed official contracts, including job move's targetProjectId query parameter and the
  text/plain and empty response cases. No real endpoint was called for this planning step.
- Captured the [authoring baseline](authoring-baseline.md): 1731 Core source lines and 1100
  TeamCity source lines, with test/proof footprints separate and a fixed counting rule.
- Persisted the review policy in AGENTS and the linked practice: +50/+100/... new accepted
  operations, first checkpoint at 67 total routes; no next batch before a closed review verdict.
- Current v2 progress remains **0 new operations**. S1's projected 49/449 is a target only.
- Verified the published Issue body and planning comment against the reviewed drafts: exact
  matches, 32 planned rows, and unchanged baseline counts of 17 exposed / 432 missing.
- Planning verification: `npm test` passed all 42 tests; `git diff --check` passed. Production
  source remains unchanged. Repository planning/rule changes are local and not yet committed.

| Authoring checkpoint | New operations accepted | Status | Evidence required |
|---|---:|---|---|
| First batch: +50 (67 total routes) | 50/50 | done (local) | S1+S2 and [checkpoint review](checkpoint-50-review.md) passed; publication pending |
| Second batch: +100 (117 total routes) | 50/50 | done (local) | S3 and [checkpoint review](checkpoint-100-review.md) passed before S4 |
| Third batch: +150 (167 total routes) | 50/50 | done (local) | S4 and [checkpoint review](checkpoint-150-review.md) passed; publication pending |
| Fourth batch: +200 (217 total routes) | 50/50 | done (local) | S5 and [checkpoint review](checkpoint-200-review.md) passed |
| Fifth batch: +250 (267 total routes) | 50/50 | done (local) | S6 and [checkpoint review](checkpoint-250-review.md) passed |
| Sixth batch: +300 (317 total routes) | 50/50 | done (local) | S7 and [checkpoint review](checkpoint-300-review.md) passed |

## 2026-08-30 — S1 implementation and review

Owner approved continuing with implementation. Main agent acted as integration author, Core
maintainer, and orchestrating reviewer; no subagent or real service mutation was used.

- Baseline packaged-CLI proof through the real current-user profile/keyring: 17 passed, none skipped
  or failed; captured no private payloads or endpoint identifiers.
- Required-option test failed before implementation; the first lifecycle MSW test failed on the
  missing command, and all 11 new read contracts failed before their implementation.
- Added 32 S1 operations. Exact passing mock cases reconcile one-to-one to the selected Swagger
  identities in [s1-coverage.csv](s1-coverage.csv). Working-tree coverage: 49/449 (10.91%),
  25/235 GET and 24/214 update-like; 400 remain. Frozen baseline CSVs were not modified.
- Core gained required options/help and corrected inherited parser settings. Important evidence
  correction: old nested help/errors could exit test workers early, so the old 42-pass report did
  not prove every test ran. After correction, all 54 pre-existing tests ran; the new Core test made
  55 before adding 42 authoring tests. Details and Issue link are in [s1-review.md](s1-review.md).
- Full `npm test`: **97 passed** (20 Core + 77 TeamCity). All 21 new mutations deny before HTTP;
  exact request/result/error cases, privacy/validation, two-profile JSON-RPC and a stateful offline
  create/configure/inspect/launch/cleanup scenario passed.
- Expanded real-profile proof: **19 passed, 0 skipped, 0 failed**, adding only bounded VCS root
  list/detail. Unpaged scoped lists remain mock-only; no Update calls, local permission grants,
  profile changes, private fixtures or raw response artifacts were made on the real profile.
- Built process help, nested required options, permission hints and version checked. README,
  TeamCity usage and authoring/testing docs updated; HTTP failures now omit remote response bodies.
- Production footprint: Core +11 and TeamCity +711 nonblank lines, all helper/DTO costs included;
  22.56 added lines per new route. Tests/proof and equivalent examples are recorded separately.
- S1 moved through awaiting review to **done (local)** after orchestration review of the actual
  command/client/model code and tests. Verdict: pass; no required S1 correction remains.
- Privacy scan covered the full tracked/untracked tree and working/staged diffs with no unresolved
  findings; only explicitly synthetic credential-shaped fixtures were allowed. No files staged,
  commits created or pushes performed. Re-run the mandatory privacy gate before a future commit.
- Published and re-read the [S1 progress comment](https://github.com/iXab3r/EyeAuras.CliFactory/issues/5#issuecomment-5467927484):
  it explicitly distinguishes local 49-route support from the unpublished changes. Verified Issue #5
  remains open and its full published body/checklist is unchanged (17 baseline checked routes).

## 2026-08-30 — S2 implementation and mandatory checkpoint +50

Owner requested continuation. Main agent performed integration authoring and Reconciliation Lead
work; no subagent delegation, commit/push or real mutation was performed.

- Published the [18-route S2 contract](https://github.com/iXab3r/EyeAuras.CliFactory/issues/5#issuecomment-5467992110)
  before code: triggers/features/snapshot dependencies plus existing template attachments.
- Verified official payloads and literal-ID semantics, including triggerLocator not accepting
  an id: dimension, upstream IDs for snapshot dependencies and explicit template query flags.
- All 18 exact boundary cases failed before commands existed, then passed with implementation.
  All new mutations remain Update-gated and no live Update call was authorized or attempted.
- [s2-coverage.csv](s2-coverage.csv) reconciles 18 distinct frozen routes (7 reads, 11 updates),
  with no overlap against S1/baseline. Local total: 67/449 (14.92%); 382 remain. S1+S2 accepted
  counter is exactly +50, not the number of tests, aliases or commands added.
- Full `npm test`: 124 passed (20 Core, 104 TeamCity), before and after the review refactor.
  Exact URL/query/body/results, all gates, status-only errors, invalid/secret property inputs,
  default/explicit activation, full replacements, template flags, redaction, empty/malformed
  responses, two-profile JSON-RPC and a stateful offline settings workflow are covered.
- Real-profile packaged proof passed 19/19 before and after S2. Fixed ReadOnly inventory only;
  new unpaged scoped reads remain mock-verified. No raw payloads, private identifiers, profile
  changes, local permission grants or remote mutations were recorded/performed on the real profile.
- The [checkpoint review](checkpoint-50-review.md) passed after measuring all production code,
  retaining equivalent detail/list/mutation comparisons and simplifying repeated property options
  and body validation. S2 net production +360 lines (20.00/route), cumulative +1082 (21.64/route).
  The corrective refactor itself reduces the normally formatted source by 5 lines including
  helper costs; no new Core concept/dependency/DSL. Do not overstate that small improvement.
- Built help/version verified. Root and TeamCity usage docs updated. Other pending browser/runtime
  design edits were preserved and remain outside this implementation slice.
- Privacy gate scanned all 86 tracked/untracked files and working/staged diffs: no unresolved
  findings, only synthetic fixture matches. `git diff --check` passed. No files staged.
- Mandatory review gate is closed locally. Operation +51 and the rest of P1 are not started.
- Published and re-read the [S2 progress comment](https://github.com/iXab3r/EyeAuras.CliFactory/issues/5#issuecomment-5468051549).
  Both S2 comments match the reviewed drafts; Issue #5 remains open and its baseline checklist
  remains unchanged at 17 checked routes. Local acceptance is explicitly not publication.

## 2026-08-30 — large S3+S4 delivery and checkpoints +100/+150

Owner requested the next 100+ operations as a large slice. Delivered exactly 100 new routes with
the required review after each 50; no subagent, code publication or real mutation was performed.

- Published the [100-route execution contract](https://github.com/iXab3r/EyeAuras.CliFactory/issues/5#issuecomment-5468205768)
  before implementation, with a bounded S3/S4 split. The [source correction](https://github.com/iXab3r/EyeAuras.CliFactory/issues/5#issuecomment-5468269661)
  settled agent field restrictions and response projections before S4 production work.
- S3's 50 exact mock cases failed first, then passed with implementation. Requirements/artifact
  dependencies, project features/templates/defaults, plugin fields/parameters, output parameters
  and scoped metadata added 26 ReadOnly and 24 Update routes. S3 finished at 117/449, with 181 tests.
- Closed [checkpoint +100](checkpoint-100-review.md) before starting S4. Retained the small local
  client/option helpers; rejected a property-access helper that added 11 lines and another lookup.
  Core stayed unchanged; S3 cost +696 production lines, 13.92/route, all helper/DTO costs included.
- S4's 50 exact route tests likewise failed before the tree was connected and passed after
  implementation. Added 28 reads and 22 updates for pools, agent eligibility/policy, queue controls,
  build annotations/statistics and change metadata. Ten additional S4 tests cover safety and UX.
- Closed [checkpoint +150](checkpoint-150-review.md): transport JSON decoding stays by transport,
  public policy types match projected output, and tag POST ACKs discard successful response bodies.
  Official BuildRequest can return Tags, so the original empty-response note is not a server constraint.
  Both empty and nonempty successful replies are covered, without version/compatibility branches.
- [s3-coverage.csv](s3-coverage.csv) and [s4-coverage.csv](s4-coverage.csv) reconcile one-to-one to
  compiled boundary fixtures and the unchanged frozen census. Total local support: **167/449
  (37.19%)**, 86/235 reads (36.60%), 81/214 updates (37.85%); 282 remain. v2 counter is +150.
- Full final `npm test`: **241 passed (20 Core, 221 TeamCity)**, zero failures/skips. Each gate,
  unknown option, request body/query/media/result and status-only error is exercised. Additional
  tests cover two-profile RPC, unknown nested private fields, strict booleans/allowlists, false/empty
  mutations, numeric precision and explicit stateful mock workflows. AuthToken reads are forbidden.
- Real current-user profile/keyring proof: **19 passed, 0 skipped, 0 failed**, before/after the
  large slice, through our compiled CLI. Fixed bounded ReadOnly inventory only; new S3/S4 routes
  remain mock-verified. No profile changes, real permission grants, Update calls or raw artifacts.
- Combined S3+S4 production delta +1559 lines / 100 routes = 15.59; S4 alone +863 / 50 = 17.26.
  Core remains unchanged in this delivery; no new runtime dependency, universal HTTP/CRUD layer,
  raw-body escape hatch or backward-compatibility path. Other pending runtime/browser design
  edits are preserved. Root and TeamCity README usage/coverage updated, built help/version checked.
- Privacy scan over **99 tracked/untracked files**, plus working/staged diffs: zero unresolved
  findings, 26 clearly synthetic fixture matches. `git diff --check` passed. Nothing staged,
  committed or pushed; rerun the full pre-commit gate before future publication.
- Re-read both published scope comments: exact normalized matches to reviewed drafts. Issue #5
  remains open with an unchanged complete body and 17 baseline checked routes, matching the earlier
  published snapshot. Implementation progress is reported separately while code is local.
- Published and re-read the [S3+S4 completion comment](https://github.com/iXab3r/EyeAuras.CliFactory/issues/5#issuecomment-5468376863):
  exact normalized match; Issue body/checklist unchanged and feature still open.

## Next executable step

Implementation is complete locally. On publication authorization: preserve unrelated dirty
browser/runtime design work; re-run `npm test`, the privacy gate and `git diff --check`; review
the exact staging scope, commit/push on feature/teamcity-v2 without history rewriting, link CI
and the closing reference, then reconcile Issue publication checkboxes and close the workstream.
Do not infer commit/push authority or claim unperformed live mutations. The feature stays open.

## 2026-08-30 — owner authorizes autonomous inventory completion

The owner now explicitly requested finishing the full remaining inventory without per-slice
questions. This supersedes the earlier pause-before-next-scope instruction, not the review/safety
gates. Published the [completion direction and exact S5 contract](https://github.com/iXab3r/EyeAuras.CliFactory/issues/5#issuecomment-5468407176).
S5 is in progress: 50 new configuration/queue routes, targeting checkpoint +200 (217 total).
Subsequent batches must still have exact Issue contracts before code and close reviews every 50.
This paragraph records the start of S5; acceptance follows below.

## 2026-08-30 — S5 accepted at checkpoint +200

All 50 exact mock cases first failed, then passed; eight safety/workflow tests added. Full suite
299/299 passed, fixed packaged-CLI current-profile ReadOnly proof 19/19 passed. S5 mapping matches
the frozen census and compiled cases without overlap. Local total 217/449 (100 GET, 117 Update),
232 remain. [Checkpoint review](checkpoint-200-review.md) passed after concrete collection mapping
and boolean/empty-value corrections. +767 production lines; Core unchanged. Privacy scan of
105 files plus working/staged diffs had no unresolved findings. No staging, publication, real
Update, permission grant or profile changes. Research agent supplied S6 official-source evidence.

## 2026-08-30 — S6 accepted at checkpoint +250

The [S6 contract](https://github.com/iXab3r/EyeAuras.CliFactory/issues/5#issuecomment-5468511277)
preceded production code. Exact 50 cases first failed, then passed; eight safety tests added.
Full suite 357/357 passed. [Mapping](s6-coverage.csv) reconciles all50 identities with no overlap;
267/449 local support (128 GET, 139 Update), 182 remain. [Review](checkpoint-250-review.md)
closed after bounded response disposal, malformed-result and duplicate-target corrections.
Core unchanged; +1059 production lines including all helpers. No live new routes or publication.

## 2026-08-30 — S7 accepted at checkpoint +300

[Contract](https://github.com/iXab3r/EyeAuras.CliFactory/issues/5#issuecomment-5468584039),
[mapping](s7-coverage.csv) and [review](checkpoint-300-review.md) reconcile 50 exact new routes.
419/419 offline tests passed, including 12 administrative/token safety tests. Fixed ReadOnly proof
passed19/19. Local317/449:151 GET,166 mutations;132 remain. Custom Admin/Credentials categories
default off and are independent of Update. One-time tokens go only into profile-scoped keyring,
with explicit ownership/cleanup and non-atomic failure reporting. Core unchanged; +884 production
lines. Privacy scan118files+diffs: no unresolved findings; all current scope comments read back
and verified. No commit/push or live mutation/profile change.

## 2026-08-30 — S8/S9 checkpoints +350/+400 accepted

[S8 contract](https://github.com/iXab3r/EyeAuras.CliFactory/issues/5#issuecomment-5468677667)
and [review](checkpoint-350-review.md):50 routes, local367/449,479 tests, Core unchanged.
Credential input aliases, cloud composite IDs, VCS state and versioned settings have explicit
gates and safe projections. Native config reset's unverified postcondition is documented.

[S9 contract](https://github.com/iXab3r/EyeAuras.CliFactory/issues/5#issuecomment-5468778016)
and [review](checkpoint-400-review.md):50 more routes, local417/449,536 tests. Administration,
roles/deployments, XML/multipart, registration tokens and native bulk unmute received independent
wire/security evidence. Current schema corrected healthCategory naming; official source corrected
the REST landing message. Both checkpoints closed before the next batch. Privacy gates were clean.

## 2026-08-30 — final S10/+432 local close-out

[S10 contract](https://github.com/iXab3r/EyeAuras.CliFactory/issues/5#issuecomment-5468860932)
preceded implementation; all32 exact cases first failed then passed. Actual profile-owned byte
downloads, hashes, no-clobber/link/traversal/redirect/bound/cancellation defenses and keyring-only
secure values are verified offline. Final full suite **581/581 passed**, fixed current-user
packaged-CLI ReadOnly proof **19/19 passed**. The final privacy audit scanned142 files plus working/
staged diffs,56 synthetic matches, zero unresolved findings; diff whitespace check passed.

Fresh reconciliation of actual CSV files against compiled cases: baseline17 +432 distinct new
identities = **449/449**, GET235/235, mutation214/214, zero duplicates/missing rows. All432 new
CLI/path/method matches are one-to-one. [Final review](final-review.md) passed and describes native
config-reset/bulk-unmute postcondition limitations, file ACL assumptions and exact code costs.
Durable contracts are in the integration README and shared authoring guide.

[Final Issue report](https://github.com/iXab3r/EyeAuras.CliFactory/issues/5#issuecomment-5468967837)
separates100% local route exposure from publication and live proof. Issue body is unchanged,
still open with17 published-route checkboxes; no premature feature closure. Branch remains
feature/teamcity-v2, HEAD1d36395833101c920f74ecdf2749ef2f2f6a0575, staged diff empty. No commit,
push, real Update, permission/profile change or private response artifact. Unrelated dirty
browser/runtime design edits were preserved. No implementation batch remains; publication/CI
closure follows only with the appropriate authority and evidence, as specified above.

## 2026-08-30 — publication and PR review

Owner authorized commit, push, PR and review, including Core/Common reuse opportunities.
Implementation717b346 was committed after581 passing local tests and a clean full-tree/staged-diff
privacy gate, then pushed to feature/teamcity-v2 and published as PR #13. Unrelated browser/IPC/auth
design hunks remained unstaged. No merge or history rewrite.

[Focused review](pr-review.md) supersedes the local-only readiness verdict: CI passes both Linux
jobs but fails both macOS and Windows jobs; path handling of test-owned roots prevents download
tests from exercising their intended assertions (R1/P1). An offline compiled-command reproduction
also saves a206 partial response as a normal successful download (R2/P2). Findings are not fixed
in this review-only phase. Route exposure stays449/449, but acceptance/closure is not satisfied.

Existing YouTrack and RANDOM.ORG work provides concrete reuse evidence for typed command binding,
bounded private file output, option parsing and test setup. Multi-secret lifecycle remains a
candidate, not an authorized new Core framework. Core/DESIGN overlaps with YouTrack PR #12 need
reconciliation before combining the changes. Next: implement R1/R2 when requested, rerun local
tests and the six-job matrix, then re-review; do not merge or close Issue #5 yet.

## 2026-08-31 — corrections and main reconciliation

Owner authorized P1/P2 fixes, repeat review and merge when green. Both new regressions failed first,
then passed with the minimal corrections in ee73fdd. Full local pre-integration suite583/583;
file-safety suite46/46. No live endpoints or user profile/keyring changes were used.

YouTrack PR #12 then merged into main as adfc2c3. Resolved Core/DESIGN conflicts and silent duplicate
required-option/rule13 additions while preserving both integrations' behavior and all tests.
Fresh combined suite952/952 passed (48Core/569TeamCity/335YouTrack). Full combined privacy scan:
344 files plus working/staged diffs, no unresolved findings. The [follow-up review](pr-review-followup.md)
passes locally; integrated CI must be green before merging PR #13. Browser/auth/IPC working edits
were temporarily preserved in a named stash for the merge, excluded from publication.
