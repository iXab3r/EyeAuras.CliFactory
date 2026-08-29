# Workstreams

> **Status: binding practice.** Adapted from the proven EyeAuras.Vizor Reconciliation Lead model.

Use a workstream for work that has multiple useful phases, must close a declared inventory, spans
several agent turns, or needs a reliable handover. A localized fix does not need one.

## Location and authority

Tracked coordination lives under `.workspace/workstreams/<id>/`. It is not product documentation
and never overrides code, `docs/DESIGN.md`, practices, or role guides. Durable contracts and
decisions graduate to `docs/`.

## Relationship to GitHub Issues

For product work, a linked GitHub Issue owns the feature or bug contract: outcome, bounded scope,
behavioral decisions, and acceptance criteria. The workstream owns execution order, status, and
evidence. Link them in both directions and point plan phases to Issue sections instead of copying
endpoint inventories or command tables. Scope changes happen in the Issue first; the ledger records
the resulting deviation and link. Full rules are in [`github-issues.md`](github-issues.md).

## Minimum contract

Create two files:

- `implementation-plan.md`: goal, constraints, ordered phases, scope of each phase, explicit gate,
  and review protocol.
- `implementation-ledger.md`: a status table at the top and chronological per-phase evidence.

The ledger table has one row per phase:

```text
Phase | Scope | Status | Agent | Review
```

Statuses are `pending → in progress → awaiting review → done`, or `blocked` with the blocker named.
The implementing role moves a row to `awaiting review` and appends evidence. Only the reviewer or
orchestrator moves it to `done` and records the verdict.

Evidence includes focused verification output, changed-surface maps where useful, deviations with
one-line reasons, and escalations. If a table and its evidence disagree, correct the table
immediately.

## Census-style additions

When a workstream closes a universe, add `scope.toml` with a stable ID, status, roots/versions,
discovery command, and identity rule. Keep generated inventory separate from human classification.
A finding maps to an inventory item or records a census correction; it never exists only in chat.

## Lifecycle

The explicit lifecycle is `active`, `blocked`, `complete`, or `archived`. On pause, make the ledger
resumable; add `handover.md` only when the ledger cannot carry the necessary commands and context.
On completion, record delivered outcomes, the known-failure set, deferred candidates, final
verification, and final status. A linked Issue closes only after this close-out and its own
acceptance checklist are complete.

## Phase design for integrations

Order phases by user/agent value, not by REST documentation order. Keep each phase independently
useful. Start with auth/profile proof and high-value reads; introduce side effects only after
`ReadOnly` behavior is stable and the `Update` gate is tested. Each phase should add the smallest
coherent command subtree and its MSW evidence.
