# TeamCity REST expansion — implementation plan

**Lifecycle:** active
**Goal:** grow `teamcity-cli` from its foundation into the smallest high-value TeamCity REST
surface for humans and AI, with deterministic mocks and explicit permission gates.
**Feature spec:** [GitHub Issue #1](https://github.com/iXab3r/EyeAuras.CliFactory/issues/1)

Issue #1 owns the bounded command/API/permission contract and acceptance checklist. This plan
orders that scope and must not grow an independent endpoint inventory.

## Universal constraints

- Order work by user value, not endpoint count or REST documentation order.
- Keep TeamCity vocabulary and DTOs in `integrations/teamcity`.
- Mock native `fetch` with MSW; real-server checks are opt-in and read-only by default.
- Every service leaf declares `ReadOnly` or `Update`; custom categories need an actual operator
  boundary.
- No credentials, internal build data, logs, or private identifiers enter fixtures.
- Each phase is independently useful and must pass `npm test` before review.

## Phase 0 — foundation baseline

Scope: profiles, token auth validation, `jobs list/show/status`, JSON output, JSON-RPC execution,
and mocked request/CLI proof.

Gate: the command tree is discoverable, credentials remain profile-scoped, important jobs reads
work through MSW, and repository CI is green across supported Node/platform combinations.

## Phase 1 — discovery and baseline correction

Scope: perform read-only target version/Swagger discovery, correct the operational latest-build
locator, and add the Issue #1 server/project/job reads with their frozen pagination and DTO rules.

Gate: the `jobs status` regression is proven; MSW verifies exact locators/fields and parsing;
commands return valid human/JSON output; all leaves require `ReadOnly`; discovery evidence is
sanitized and one explicit read-only smoke path is documented.

## Phase 2 — operational reads

Scope: add the Issue #1 build diagnostics, queue, and agent reads. Artifact/log access remains a
separate follow-up because it requires raw payload, streaming, and filesystem contracts.

Gate: each subtree has its named consumer scenario, frozen payload bounds, sanitized fixtures, and
mocked empty/error/pagination cases. Unconsumed REST areas remain absent.

## Phase 3 — controlled updates

Scope: implement the three Issue #1 side effects: `jobs run`, `builds cancel`, and `queue cancel`.

Gate: every side effect requires `Update`; denial is proven before `fetch`; confirmation/idempotency
semantics are documented per operation; mocked success and remote rejection are covered. Real
mutation tests require a dedicated disposable target and explicit opt-in.

## Phase 4 — delivery hardening

Scope: process-level CLI tests, compatibility review, usage examples, and measurement of startup
or persistent-session value. No new resource family enters this phase.

Gate: `npm test` and CI are green, public docs match the shipped tree, known gaps are recorded, and
the workstream receives a close-out verdict.

## Review protocol

The service integration author implements and records focused evidence, then moves the phase to
`awaiting review`. Reconciliation Lead audits record truth; the reviewer/orchestrator independently
checks the gate and alone marks `done`. Architecture or new foundational dependencies require an
explicit owner decision.
