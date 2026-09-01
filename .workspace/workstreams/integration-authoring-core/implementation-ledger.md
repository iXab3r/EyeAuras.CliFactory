# Integration authoring Core — implementation ledger

**Lifecycle:** active. **Issue:** [#14](https://github.com/iXab3r/EyeAuras.CliFactory/issues/14).
**Current phase:** P4 complete: F01–F08 accepted (8/8). P6 active; final cross-PR review and post-fix 1148-suite passed; privacy, commit/push, final-head six-job CI and clean merge pending. Second checkpoint 6b2752cd passed all six CI jobs (1105 tests each); corrected final external package smoke passed. **Accepted findings:** 8/8 (F01–F08).
**New REST operations:** 0; endpoint inventory is unchanged.

| Phase | Scope | Status | Agent | Review |
|---|---|---|---|---|
| P0 | Exact baseline, F01–F08 reconciliation and samples | done | scope_manager / four scouts / root | Independent/root PASS: all 234 file records and 15 samples exact; owned pre-existing macOS exception explicit |
| P1 | F01 fixtures then F02 contract helpers | done | authoring_testing / independent reviewer / root | F01/F02 independent technical/authoring PASS and root accepted; 1004 affected tests PASS for F02 |
| P2 | F03 proof mechanics | done | authoring_proof / independent reviewer / root | Independent technical/security/authoring PASS; root accepted with all-workspace build and 1012 affected tests PASS |
| P3 | F05 parsers / F06 wrapper inference | done | authoring_types / reviewer / root | F05/F06 independently reviewed and root accepted; F05 all-workspace build and 1020 affected tests PASS |
| P4 | F08 response bound, then F04 file publication | done | authoring_streams / independent reviewers / root | F04/F08 technical/security/authoring PASS and root accepted |
| P5 | F07 option-typing experiment | done | option_experiment / independent reviewer / root | Reviewed rejection accepted; measured evidence retained; prototype removed safely and shared dependencies unchanged |
| P6 | Consolidation, exports, PR/review/CI and clean merge | active; final gates pending | source owners / reviewers / root | Functional8/8, final whole-PR review, 1148 suite and package PASS; privacy/commit-push/final-head CI/merge pending |

## Current handover

- Branch `codex/integration-authoring-core` uses immutable baseline `b5762f242ff1ea074e33a1c1739190ac4d0ee523`.
  `baseline.json` remains 207 handwritten TS / 234 included files across eight workspaces, with eight
  generated exclusions: 18,964 source / 22,585 tests-support / 535 proof. Older workstreams stay untouched.
- **F01–F08 are accepted (8/8)**. P1/P2/P3/P5 are done; F07 completed by
  reviewed rejection without retained production changes. F03/F05 are committed/pushed in
  `6b2752cdc0af5005832c55364266911761d76f44`. F08 is accepted; F04 is now released to authoring_streams. Preserve local decoding/BOM behavior and TC 2 MiB / YT 8 MiB limits.
- Accepted F04 evidence: independent technical/security/test-audit/authoring and final cross-PR
  review PASS. The review closed awaited async inspection and stable same-inode snapshots.
  Root post-fix `npm test` built all eight workspaces and passed 1148 tests, zero failures/skips.
  `checkpoint-f04.md` pins corrected hashes; +138 production / +590 tests, local 474→261.
  This is a bounded simplification, not a whole-workstream LOC saving.
- Accepted F08 evidence: all eight workspaces built and 1043 affected tests passed (115 Core / 584 TC /
  344 YT), zero failures/skips. Independent technical/security/authoring PASS and root acceptance.
  `checkpoint-f08.md` pins 12 source/test/doc hashes and +57 production / +372 tests; F04 released.
- Latest accepted F05 evidence: all eight workspaces built and 1020/1020 affected tests passed (105 Core /
  578 TeamCity / 337 YouTrack), zero failures/skips. Independent technical and authoring PASS;
  `checkpoint-f05.md` records isolated production +6, tests +231, total +237 TS, with no LOC saving.
- `checkpoint-f03.md` retains the F03 proof-cost and real-tarball consumer/exports/strict
  TypeScript/cleanup PASS receipt. Final external package verification passed after the later source changes.
- The [behavioral decision comment](https://github.com/iXab3r/EyeAuras.CliFactory/issues/14#issuecomment-5482554668)
  was published with exact readback: F05 YouTrack pre-onboarding integer rejection, F08 YouTrack
  8 MiB decoded response bound / TeamCity 2 MiB preserved, and profile-owned temp staging. This
  publication approved decisions before implementation; F05/F08 are now separately accepted.
- The three baseline CI fixture fixes passed actual macOS and all other checkpoint jobs:
  [run 33425122763](https://github.com/iXab3r/EyeAuras.CliFactory/actions/runs/33425122763), all six
  jobs SUCCESS / 1089 tests each at `952d621a`. This resolves that earlier fixture exception only;
  final-head platform CI is still required after subsequent changes.
- Second checkpoint CI [run 33427447060](https://github.com/iXab3r/EyeAuras.CliFactory/actions/runs/33427447060)
  passed all six Linux/macOS/Windows Node 22/24 jobs at exact head
  `6b2752cdc0af5005832c55364266911761d76f44`: 1105 tests each, zero failures/skips.
  All seven proof child-reaping tests passed. This does not accept the later F08 changes.
- Final external package smoke passed: actual Core 0.1.0 97-file tarball
  `5030706b8cb6ef4be6e396664f58e08a46a8dfdf3673de0e27cd2f6846983105`, offline real-path
  install without links/private paths; runtime 21 / proof 2 / testing 6 exports, strict TS 7,
  synthetic CLI/JSON/two-RPC/disposal, proof CI refusal, zero-effect file preflight and cleanup PASS.
  Build marker `09cd57d41aedc4bfe9c228124c9877ca8b36b2bb5a8aca29ffbfbc6e4cf415db`
  was unchanged. No live/keyring/repository edit. Final CI remains pending.
- [Draft PR #15](https://github.com/iXab3r/EyeAuras.CliFactory/pull/15) references Issue #14 and
  has a verified updated draft body recording six accepted findings, without closing Issue #14.
  It supplied successful fixture and second-checkpoint CI; P6/final-head checks remain pending.
  Kickoff readback and P0 recount passed. Root serializes builds/tests and owns git/GitHub;
  management edits only this workstream. Each retained extraction needs its
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


## 2026-08-31 — first checkpoint pushed; F03 released

Root committed/pushed `952d621a1f9db76ebe8d44aa57017438e9f886ab`, tree
`0d95088721b2a7bc7d0a0d4053c2d55afcbee58e`; final privacy PASS covered 464 files and 878 historical
decoded records, with a clean worktree afterward. Root trimmed only the extra EOF blank in
`checkpoint-f02.md` before commit; immutable baseline and experiment evidence were not changed.
Draft PR #15 is for early platform CI, References #14 (not Closes); actual CI and P6 review remain
pending. F03 is released to authoring_proof within the existing Core/proof + TC/YT boundaries,
not RANDOM migration. Accepted findings remain 4/8; F05 and P4 remain gated.

## 2026-08-31 — second checkpoint pushed; F08 released

Root committed and pushed `6b2752cdc0af5005832c55364266911761d76f44`, exact tree
`0cbaf1c71215a1e64df0a75d2439600ddd157ee1`; worktree was clean immediately afterward.
Privacy passed 473 full-tree files, 878 decoded historical records and the 28-file patch.
PR #15's draft body was updated and read back exactly. F08 alone is released to authoring_streams;
F04 waits for its accepted checkpoint. Accepted findings remain 6/8. New-head CI is starting,
not yet green; the previous six-job PASS applies only to checkpoint 952d621a.

## Independent PR review — partial P6 evidence

Independent non-author option_experiment reviewed F01/F02/F03/F05/F06 against baseline
`b5762f242ff1ea074e33a1c1739190ac4d0ee523`, with accepted source unchanged from `6b2752cd`.
Review covered shared source/exports, both adapters, proof/parser/runtime HTTP/RPC tests and
negative cleanup cases; no actionable findings. All nine F06 consumer files were mechanically
checked: only same-key `text(args, ...)` to direct reads plus whitespace.

F04/F08/F07 were excluded. This was read-only review, without fresh builds/tests, and does not
complete P6. Final F04 review, full tests, package verification and final-head CI remain required.
