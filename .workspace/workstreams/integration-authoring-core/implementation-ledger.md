# Integration authoring Core — implementation ledger

**Lifecycle:** active. **Issue:** [#14](https://github.com/iXab3r/EyeAuras.CliFactory/issues/14).
**Current phase:** P1/F02 accepted; first checkpoint ready for privacy/commit. P2/F03 pending release after that commit; P3 partial. **Accepted findings:** 4/8 (F01, F02, F06, F07).
**New REST operations:** 0; endpoint inventory is unchanged.

| Phase | Scope | Status | Agent | Review |
|---|---|---|---|---|
| P0 | Exact baseline, F01–F08 reconciliation and samples | done | scope_manager / four scouts / root | Independent/root PASS: all 234 file records and 15 samples exact; owned pre-existing macOS exception explicit |
| P1 | F01 fixtures then F02 contract helpers | done | authoring_testing / independent reviewer / root | F01/F02 independent technical/authoring PASS and root accepted; 1004 affected tests PASS for F02 |
| P2 | F03 proof mechanics | pending | proof owner / reviewer | Pending explicit release after first checkpoint commit; fixed inventories and bounded rehearsal required |
| P3 | F05 parsers / F06 wrapper inference | in progress | authoring_types / reviewer | F06 accepted technical/authoring/root PASS; F05 unreleased, so P3 remains partial |
| P4 | F04 file publication / F08 response bound | pending | stream/file owner / security reviewer | Separate security/behavior costs and platform evidence required |
| P5 | F07 option-typing experiment | done | option_experiment / independent reviewer / root | Reviewed rejection accepted; measured evidence retained; prototype removed safely and shared dependencies unchanged |
| P6 | Consolidation, exports, PR/review/CI and clean merge | pending | source owners / reviewers / root | All acceptance/privacy/final-head checks before close-out |

## Current handover

- Branch `codex/integration-authoring-core` uses immutable baseline `b5762f242ff1ea074e33a1c1739190ac4d0ee523`.
  `baseline.json` remains 207 handwritten TS / 234 included files across eight workspaces, with eight
  generated exclusions: 18,964 source / 22,585 tests-support / 535 proof. Older workstreams stay untouched.
- **F01, F02, F06 and F07 are accepted (4/8)**. `checkpoint-f01-f06.md` and `checkpoint-f02.md`
  hold independent technical/authoring and root verdicts. P1 is done; P3 remains partial (F05 open).
  F07 completed by reviewed rejection with safe prototype cleanup and shared dependencies unchanged;
  no option-typing production change was retained.
- F02's all-workspace build and affected suite passed 1004/1004 (95 Core / 574 TC / 335 YT),
  zero skips. Independent recount confirms +206 TS: 91 test-helper/export +84 Core tests +31 consumer
  lines; local decreases partly include reflow and are not pure savings. Root accepted F02.
  First checkpoint privacy/commit is next; F03/P2 is pending release afterward, not yet implemented.
- The [behavioral decision comment](https://github.com/iXab3r/EyeAuras.CliFactory/issues/14#issuecomment-5482554668)
  was published with exact readback: F05 YouTrack pre-onboarding integer rejection, F08 YouTrack
  8 MiB decoded response bound / TeamCity 2 MiB preserved, and profile-owned temp staging. This
  publication approves decisions before implementation; it does not accept F05/F08.
- The three baseline CI fixture fixes are implemented and included in the passing Windows suite.
  They canonicalize/shorten owned test paths only; production behavior is unchanged. Actual macOS
  CI remains pending, so existing main run 33416848105 is still historical failure evidence.
- Kickoff publication/readback and P0 independent recount passed. Root serializes builds/tests
  and owns git/GitHub; management edits only this workstream. Each retained extraction needs its
  own independent correctness and authoring gate; no new endpoint counter or speculative framework.

## 2026-08-31 — P0 reconciliation against current main

| Finding | Current assessment | Reconciliation / remaining work |
|---|---|---|
| F01 | Partially solved | TeamCity already has real ProfileStore. TC/YT still duplicate fixture mechanics and lack reliable application disposal before cleanup. Respect current app-owned auth/resources; share only mechanics. |
| F02 | Remaining | Contract assertions repeat; some TeamCity cases infer permission from HTTP verb. New helpers require independently supplied explicit permission/HTTP expectations and meaningful failure rehearsal. |
| F03 | Remaining | TC has 19 rows, unbounded output, two CI marker forms and inherited token input; YT has 24 rows, 64 KiB output bounds, six markers and token stripping. Preserve each service inventory/RPC. Existing RANDOM proof reuse stays service-owned. |
| F04 | Remaining | Two download mechanisms have different identity, format, publication and cleanup checks. Preserve both protections; existing private storage alone is insufficient. |
| F05 | Remaining | TeamCity signed digits allow -0 while YouTrack's policy is unsigned. Reuse parsers without silently normalizing accepted syntax/domain boundaries. |
| F06 | Partially solved | Core inference exists; TeamCity ClientLeaf widens it. Expose/reuse that inference minimally, no copied grammar or new YouTrack wrapper. |
| F07 | Experiment pending | Options are broad; only a measured small sound accept/reject trial is in scope. Rejection with prototype removal is valid completion. |
| F08 | Remaining | TeamCity response consumption is bounded (2 MiB text / 64 KiB discard); YouTrack text consumption is unbounded. New explicit response limit is a correctness behavior change, not argv/RPC reuse. |

These reconciled assessments are root/scout evidence, not implementation acceptance. Complete Issue
#14 and current DESIGN/testing/integration/practice docs were read; source/body hashes remain stable.
The manifest was generated from Git blobs rather than filesystem line endings. No old fake-store
removal, old token-only API, hidden live operation, broad optional-runtime migration or new feature
scope is assumed. P0 final source release remains with root; baseline local tests passed as recorded above.


## 2026-08-31 — baseline verification and existing CI exception

Root baseline evidence at b5762f2: npm ci/browser prerequisite PASS, npm test 1070/1070 PASS with zero
skips/failures. Existing [main CI run 33416848105](https://github.com/iXab3r/EyeAuras.CliFactory/actions/runs/33416848105)
failed the two macOS jobs in fixture behavior while the other four passed. This predates the new
branch and is not hidden by local green tests. `baseline_ci` diagnoses canonical runtime fixture
paths and Unix-socket path length; root must approve the minimal test-fixture correction and public
kickoff scope note before that code, with actual platform evidence required later. No optional-runtime
production rewrite is inferred. F01–F08 scout reconciliation is complete and P0 artifacts are ready.

Measurement remains fixed by path. A future `packages/core/src/testing` or proof helper still counts
under source in this baseline method; add a functional-role breakdown so test-helper lines are not
presented as production-runtime growth or shifting tests into Core as a saving. Never rewrite this
baseline with a new classification. All eight workspace totals remain visible.

`baseline_ci` completed read-only diagnosis: only three test files need changes. IPC `build.test.ts`
canonicalizes its owned root via realpath to match require.resolve and shortens `cli-build-` to `b-`.
RANDOM REST `process.test.ts` shortens `random-cli-process-` to `rr-`; `proof.test.ts` shortens
`random-live-runner-test-` to `rr-`, preserving the existing 100-byte Unix-socket bound including
macOS `/private`. No production/CI skip/fallback/permission change is proposed. Exact scope is in
`issue-kickoff-comment.md`; public posting and source release remain root-owned.


## 2026-08-31 — P0 approved; F01 and baseline fixture prerequisite released

Root accepted the exact frozen baseline and scout boundaries with the pre-existing macOS CI failure
explicitly owned. P0 is done; `authoring_review` independently cross-checks its evidence. Root released
F01 to `authoring_testing` and the exact three-test-file prerequisite to `baseline_ci`. F02 waits for
F01's independent technical/authoring checkpoint; no later-phase source is released.

Root posted the [Issue #14 kickoff](https://github.com/iXab3r/EyeAuras.CliFactory/issues/14#issuecomment-5482338014)
from frozen body SHA `6b684c31fcc0b1ec33de4c4ff75d8d5fd6c1613baf4b60da194a6e437009dabc`;
remote readback is pending root confirmation. Baseline fixture fixes and actual corrected platform
CI evidence remain pending; root acceptance does not convert the prior macOS failure to a pass.
F01/F02 use the separate testing surface; later proof helpers use a separate proof entry so proof
consumers do not import test assertions. Normal runtime imports remain independent of these helpers.
No immutable baseline, source, old workstream or GitHub payload was changed by management.


## 2026-08-31 — independent P0 PASS and isolated F06/F07 release

`authoring_review` independently recounted native Git blobs without overwriting the generator output:
all 234 included files, 207 TypeScript files, eight generated exclusions, eight workspaces and all
15 spans/excerpts match. Totals remain 18,964 / 22,585 / 535; baseline SHA
`3522831f2ef9dbf1fd3fd5e56144d627a20d8661dbc4ff87b4f84576ef10b451`, tree
`218880c2a37f32b9189641a4ae2649a3af3e939b`; capture script SHA
`e8d3152ec3421495a1e830af54d2c7cfd2bc2265f9276c142298ccbf77315b07`.
P0 PASS is baseline/scope only, not a finding implementation or savings verdict. Root confirmed exact
kickoff-comment readback. Baseline CI's three fixture files are frozen at four insertions/four deletions;
root build and actual macOS verification remain pending.

Root independently released F06 to `authoring_types` (TeamCity generic wrapper/eligible consumers,
existing Core type export and meaningful wrapper tests), with separate metrics and coordinated
canonical docs. F05 remains unreleased. Root released F07 only as a task-owned temporary compiler
prototype plus real TC/YT sample-cost experiment to `option_experiment`; no tracked production edits.
That agent owns `f07-experiment.md` after evidence. P5 acceptance still requires a measured independent
accept/reject verdict and prototype cleanup; an early experiment is not phase closure.

F01 remains active and must preserve YouTrack's natural ProfileStore validator when exposing a shared
preparation view. F02 waits for the F01 checkpoint. P2/P4 are not released. Accepted findings remain
0/8 and no new endpoint is added. Baseline and old workstreams were not changed.


## 2026-08-31 — coherent F01/F06 checkpoint evidence, acceptance pending

Root all-workspace build and npm test passed 1081/1081 (Core 90 / IPC 31 / PW 23 / random-pw 6 /
random-rest 25 / TC 571 / YT 335), zero failures/skips. `authoring_review` independently gave separate
F01 and F06 PASS with no simplification blockers. `checkpoint-f01-f06.md` records full costs and
attribution: F01 +129 test-mechanism source -117 adopted-test lines = +12, plus 186 new tests;
F06 +1 production and 156 tests, 253 converted reads / 51 deliberate broad reads. Adapter -95 is
only a subset of the -117 adoption delta, never counted twice.

Combined current path totals 19,094 / 22,810 / 535 preserve baseline classification, with 129 source
lines explicitly test-only. No LOC or runtime saving is claimed. Technical static PASS awaits the
final stream-type confirmation; accepted findings stay empty until root records that gate. The
three baseline CI fixture fixes pass Windows locally, while actual macOS CI remains pending.
F02 and F05 remain gated; neither P1 nor P3 is complete. No source or immutable baseline was edited.


Final technical confirmation arrived and root accepted F01/F06 after independent technical and
authoring PASS plus the coherent 1081/1081 suite. Accepted findings are now 2/8. F02 is released to
`authoring_testing`; P1 remains in progress and P3 partial (F05 unreleased). No commit is needed for
this checkpoint alone; later coherent batch/privacy/review gates remain root-owned.
