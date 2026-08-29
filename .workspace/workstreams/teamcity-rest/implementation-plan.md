# TeamCity REST expansion — implementation plan

**Lifecycle:** active
**Goal:** grow `teamcity-cli` from its foundation into the smallest high-value TeamCity REST
surface for humans and AI, with deterministic mocks and explicit permission gates.

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

## Phase 1 — projects and builds

Scope: add read-only project discovery and build list/show/status commands, including practical
locators, pagination limits, and stable minimal DTOs.

Gate: MSW proves request locators and parsing; commands return valid `--json`; all leaves require
`ReadOnly`; one explicit read-only smoke path is documented.

## Phase 2 — operational reads

Scope: add only the most useful queue, agent, artifact metadata, and bounded log access discovered
from real operator/agent workflows.

Gate: each subtree has a named consumer scenario, bounded payload behavior, sanitized fixtures,
and mocked empty/error/pagination cases. Unconsumed REST areas remain absent.

## Phase 3 — controlled updates

Scope: selected build trigger, queue removal/cancellation, or comment operations that current
consumers actually need.

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
