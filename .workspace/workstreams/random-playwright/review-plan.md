# Reliability and integration authoring corrections

Owner-approved 2026-08-31 in the task. Parent scope: issue #11. Publishing the corrective
acceptance comment was attempted first but the GitHub connector returned 403; external sync pending.
Baseline: uncommitted runtime/observation slice over 40c265b, 125 offline tests.
No live service, commit, push, unrelated main-worktree edits or delegation.

| Phase | Scope | Gate |
|---|---|---|
| R1 | Checkpoint, parsed-command dispatch, bounded RPC input | Reproductions become regressions; Core/browser and affected integration pass |
| R2 | Flat owned resources and self-contained browser disposal | Direct dispose finalizes videos; profile invalidation and failure cleanup tested |
| R3 | Definition-based host and shared build manifest | No per-app built-ins/hash lists; dependency/partial-build and cross-build Stop tests |
| R4 | Cheap invocation-bound RANDOM clients and author docs | Preserve quota/state/output; compare actual boilerplate and total implementation cost |
| R5 | Reconcile acceptance | Full npm test, source/contract review, cleanup, measured authoring verdict |

Canonical changes are recorded as the accepted target in DESIGN before implementation;
the ledger is authoritative for which parts have actually passed. No backward compatibility shims.
Keep the same two service operations and explicit app-owned authentication.

Authoring rule: integrations describe the service, not factory implementation. Safe lifecycle,
input limits and scheduling are defaults, not glue each consumer must remember to copy.

Source baseline (nonblank handwritten TS, comments included, generated excluded):
Core 2289, IPC 869, browser 536, random-common 189, REST 285, PW 278 = 4446.
Tests/support 3999; generated TS 130; Windows patch 41 nonblank MJS (separate).
