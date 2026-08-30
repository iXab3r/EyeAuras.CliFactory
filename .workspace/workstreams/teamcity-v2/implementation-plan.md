# TeamCity v2 — implementation plan

Lifecycle: active. Implementation has not started.
Feature contract: [Issue #5](https://github.com/iXab3r/EyeAuras.CliFactory/issues/5).
Working branch: `feature/teamcity-v2`, based on `main` at `e0d4d1b`.

The Issue owns scope, the complete REST checklist, command/API/category decisions and acceptance.
This plan owns execution order and gates only. Do not copy another evolving REST specification here.

## Scope and baseline

[scope.toml](scope.toml) freezes the 449-operation TeamCity 2026.1 census.
The [audit](../teamcity-api-coverage-20260830/report.md) and its CSVs are immutable baseline
evidence: 17 exposed, 432 missing, 3.79% endpoint coverage. They are not a live progress table.

## Phases

| Phase | Issue scope | Execution order and gate |
|---|---|---|
| 0 | Baseline, metric semantics, tracker and branch | Publish the reviewed census and this workstream; verify Issue/branch links and privacy |
| 1 | P1 — Author a minimal working project/job | Agree exact leaf contracts in the Issue; deliver the smallest create/configure/inspect slice, then extend authoring; exact MSW payload/result/error/gate tests |
| 2 | P2 — Control builds and queue | Add advanced launch and queue controls; document duplicate-work/idempotency behavior; exact body and pre-HTTP denial tests |
| 3 | P3 — Inspect evidence and annotate builds | Settle bounded text/binary/file output safety before downloads; then diagnostics/annotations/triage with malformed/empty/error/profile tests |
| 4 | P4 — Infrastructure and extended configuration | Agent/pool/cloud/VCS/versioned settings; review operator categories and polling/cancellation boundaries |
| 5 | P5 — Administrative remainder and reconciliation | Explicit sensitive-operation design or linked owner-approved disposition for every remaining row; final actual coverage, tests/CI, docs and close-out |

A phase can contain several small independently useful slices. Do not wait for every endpoint in
one API family before delivering the first coherent consumer workflow.

## Invariants

- TeamCity concepts stay in `integrations/teamcity`; common profile/auth/permission/output
  mechanisms remain in `packages/core`. Do not invent a generator, DI layer or universal HTTP client.
- One command tree drives help, JSON and JSON-RPC. Reuse current-user AppArguments, normal profile
  configuration and OS keyring. No private default URLs, portable state or plaintext fallback.
- Every service leaf has an explicit category. Do not infer safe permission from HTTP method.
  Sensitive/admin categories and credential-handling behavior require decisions in the Issue first.
- Default evidence is offline MSW/TDD. Local service proof uses the built CLI, a real profile/keyring,
  a fixed bounded ReadOnly inventory, sanitized summaries and no CI execution.
- No real mutation is authorized by merely starting this workstream. Dedicated live Update testing
  needs explicit owner authorization and an appropriate target.
- Run the full tracked-tree/staged-diff privacy gate before every commit. Never publish credentials,
  private server addresses, raw service responses, logs or discovered private identifiers.
- No compatibility layer. Update changed contracts and all in-repo consumers/docs/tests together.

## Review and reconciliation

The implementing integration role records evidence and moves a slice/phase to `awaiting review`.
The reviewer/orchestrator checks the named gate and only then marks it `done`. Reconciliation Lead
keeps Issue, plan and ledger consistent; it never replaces integration-specific correctness review.

Before code for a new slice, put exact syntax/options, method/path, DTO/body, permission,
pagination/output/error rules and deterministic scenarios in the Issue or a linked design comment.
After acceptance, update its route checklist and publish a new qualified coverage snapshot.
Never relabel an excluded route as implemented or silently shrink the frozen denominator.

Partial commits reference #5; they must not use `Closes #5`.
Only the final gate satisfying the Issue's complete closure contract may close it.
