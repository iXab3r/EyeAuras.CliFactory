# Integration authoring Core — implementation plan

**Lifecycle:** active. **Scope:** [Issue #14](https://github.com/iXab3r/EyeAuras.CliFactory/issues/14), F01–F08.
**Current phase:** F01/F02/F06 accepted and F07 completed by reviewed rejection (4/8); P1 done. First checkpoint awaits privacy/commit; F03/P2 remains pending release afterward. P3 partial and actual macOS CI pending.
Worktree `EyeAuras.CliFactory-1`, branch `codex/integration-authoring-core`, fixed baseline
`b5762f242ff1ea074e33a1c1739190ac4d0ee523`. This supersedes historical discovery measurements only;
previous workstreams and unrelated files remain untouched.

The user authorizes the full fix, PR, independent review/correction cycle and merge when clean.
Root owns orchestration/review, serialized dependency/browser/build/test operations and git/GitHub;
Core/integration agents own production and independent reviewers close gates. Scope manager writes
only this workstream. No real-service write/download, profile reset, credential migration or npm
release is authorized. No live proof is needed to establish these refactors; default evidence stays
offline, including actual IPC and routed browser regressions in current workspaces.

## Ordered phases and evidence gates

| Phase | Bounded work | Exit gate |
|---|---|---|
| P0 | Freeze exact current-main Git blob manifest and representative examples; reconcile F01–F08 and existing runtime/storage/proof helpers | Root accepts baseline, scout boundaries and prerequisite/suite evidence; no duplicate solved behavior |
| P1 | F01 common test fixture, then F02 composable contract assertions | Real TeamCity/YouTrack ordinary/profile/auth/RPC cases; disposal before owned cleanup; meaningful deliberately failing contract checks; separate full-cost authoring PASS |
| P2 | F03 shared bounded local proof mechanics | Both fixed inventories and TeamCity persistent RPC preserved; offline process failure/bounds/CI/refusal/prerequisite rehearsal; technical/security and authoring PASS |
| P3 | F05 small parsers and F06 existing inference through thin wrappers, measured separately | Both actual parser consumers keep syntax/domain distinctions; meaningful wrapper compiler tests and whole-declaration fallback; independent correctness/authoring PASS |
| P4 | F04 profile-owned file publication and F08 response-body bounds, separately identifiable | Preserve both service safety contracts; filesystem/stream/cancellation/MSW tests, explicit YouTrack response bound, actual platform evidence and authoring/security PASS |
| P5 | F07 bounded option-typing experiment | Same-capability costs/diagnostics; accept and integrate both consumers or reject and remove prototype, with independent verdict |
| P6 | Consolidate docs, exports/package checks, all-workspace tests, PR/review/fixes/CI | All F01–F08 acceptance evidenced; no abandoned local/shared duplicate; full privacy, final-head platform CI, linked PR and close-out before merge/closure |

Implementers may research in parallel, but shared source ownership and build/test operations stay
coordinated by root. F06/F07 may run independently only with isolated evidence and explicit release.
P0 is independently/root approved. F01/F02/F06 checkpoints passed and root accepted them; P1 is
done. F03/P2 awaits explicit release after the first checkpoint commit. No later phase is implicitly accepted.
Root independently released F06 under Issue #14's scheduling allowance: preserve TeamCity wrapper
inference with an existing Core type export and meaningful tests, measured separately from F01.
F07 is now complete by independently reviewed rejection accepted by root; `f07-experiment.md`
records measurements and safe prototype removal, with shared dependencies unchanged. No option
inference production change is retained. F05/F08 behavioral choices are published in the Issue
comment linked from the ledger; publication alone does not accept those findings. P2 and P4 remain unreleased. Baseline_ci owns the separate
three-file fixture prerequisite, now frozen (four insertions/four deletions) pending root/platform checks. Existing main
macOS CI fixture failures (run 33416848105) are a separately reviewed, minimal fixture-only
prerequisite under the Issue kickoff note; local 1070-test PASS does not waive platform verification. Each retained
extraction receives an authoring/simplicity checkpoint before acceptance or dependent work. Endpoint
counter remains zero new operations: this is not API expansion and does not reuse old counters.

## Measurement and review protocol

Use `baseline.json` and `capture-baseline.py` for exact Git blob evidence across all eight current
workspaces. Exclude generated output and old workstream snapshots; include all handwritten helpers,
types, imports/exports, setup and newly affected optional packages. Report source, tests/support and
local proof separately, with non-TypeScript setup/file hashes available for review. Preserve readable
formatting. Keep path classification immutable: future Core `src/testing` or proof helpers count as
source by path, with an additional functional-role breakdown; moving test work to Core is not a
runtime-code saving. `baseline.json` fixes complete list/detail/mutation declaration spans in each integration
and bounded fixture/proof/download/wrapper context excerpts; full file costs are always counted.

For each retained change, record exact baseline/current manifest, equivalent sample diffs, repeated
glue removed, new concepts/dependencies/call layers, unchanged controls and deliberate behavior
corrections. Do not call moving cost a saving or remove safety/domain validation for line counts.
Tests passing do not constitute authoring PASS. F07 may close by reviewed rejection; another finding
may be deferred only through Issue evidence and an explicit linked follow-up/approved scope decision.

## Current boundaries

- TeamCity already uses real ProfileStore. Share remaining fixture mechanics; do not reintroduce
  fake lifecycle or automatically grant Update. YouTrack keeps its natural ProfileStore validation;
  a shared preparation view must not inject a replacement that bypasses its validator. Current app-owned auth, per-invocation environment,
  dispose and flat resources govern setup/cleanup; no token-only factory assumption.
- Keep expectations independent of production routes. Preserve unusual service/security tests and
  enumerate specialized fixtures that remain. F01/F02 use the separate testing export; later proof mechanics use a separate proof export so
  proof consumers do not import test-assertion dependencies. Neither export may leak initialization
  or test-only dependencies into normal runtime imports.
- Keep fixed proof inventories/service diagnostics local; inspect RANDOM.ORG proof reuse without
  broad migration. No arbitrary argv/environment auth input or general process framework.
- Existing privateDirectory/privateEndpoint are access primitives, not complete bounded/no-clobber
  publication. Preserve stronger protections, service filenames/media/signatures/DTOs and no unsafe fallback.
- Preserve TeamCity signed integer syntax versus YouTrack unsigned policies unless an explicit
  documented correction is accepted. JSON parsing returns unknown; body schemas stay local.
- Reuse current positional inference; do not copy its parser or add a connection binder. F07's
  public option behavior must stay conservative and small, or reject the experiment.
- Existing argv/RPC bounds do not satisfy F08. Keep status/media/null/error semantics local; explicitly
  document the new YouTrack response bound and prove actual-byte/cancellation cleanup without deadlock.

Issue #14 remains scope authority. Amend behavioral decisions there before implementation when
material; public docs must match retained contracts. Use current root prerequisites and all-workspace
npm test, then exact final-head CI. No old test-count or three-workspace shortcut proves current main.
