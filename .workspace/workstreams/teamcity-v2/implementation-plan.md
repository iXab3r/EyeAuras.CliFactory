# TeamCity v2 — implementation plan

Lifecycle: complete for implementation/review acceptance. S1–S10 expose449/449 routes and are published
in [PR #13](https://github.com/iXab3r/EyeAuras.CliFactory/pull/13) as717b346.
[Follow-up review](pr-review-followup.md) records R1/R2 fixes and main/YouTrack reconciliation;
952 local tests and all six integrated-head CI jobs pass. Final documentation-head checks precede
the authorized GitHub merge and Issue closure.
Earlier slice sections below are historical local evidence; current readiness is owned by the ledger.
Final inventory evidence and limitations: [final-review.md](final-review.md).
Feature contract: [Issue #5](https://github.com/iXab3r/EyeAuras.CliFactory/issues/5).
Working branch: `feature/teamcity-v2`, based on `main` at `e0d4d1b`.

The Issue owns scope, the complete REST checklist, command/API/category decisions and acceptance.
This plan owns execution order and gates only. Do not copy another evolving REST specification here.

## Scope and baseline

[scope.toml](scope.toml) freezes the 449-operation TeamCity 2026.1 census.
The [audit](../teamcity-api-coverage-20260830/report.md) and its CSVs are immutable baseline
evidence: 17 exposed, 432 missing, 3.79% endpoint coverage. They are not a live progress table.

## First slice: S1

The [Issue planning comment](https://github.com/iXab3r/EyeAuras.CliFactory/issues/5#issuecomment-5467757311)
owns the exact S1 CLI/REST/gate and payload/safety contract. S1 selects **32 new operations**
(11 ReadOnly, 21 Update); [local implementation review passed](s1-review.md). Working-tree coverage
is 49/449 (10.91%); these changes are not yet committed/pushed. Existing VCS roots are reused; root/credential provisioning
and the remaining P1 families stay outside S1.

Before repeating new declarations, use the [authoring baseline](authoring-baseline.md) and three
representative operations to test a simpler authoring shape.

| S1 step | Scope | New operations | Gate |
|---|---|---:|---|
| A | Project/job lifecycle | 8 | Create/set/move/delete contracts, explicit gates, text/empty responses |
| B | Project/job parameters | 10 | Plain-property behavior, protected-value redaction, local reuse with clear paths |
| C | Build steps | 5 | Explicit full replacement, typed property input, safe result mapping |
| D | Existing VCS discovery and attachments | 9 | No connection secrets, checkout-rule text handling, full mocked scenario |

Gate for S1: all 32 rows reconciled, mocked tests and local ReadOnly proof evidence according to
the Issue, generated UX verified, before/after authoring examples and net code changes reviewed.
This closes S1 only, not all of P1.

## Next slice: S2

The [S2 execution contract](https://github.com/iXab3r/EyeAuras.CliFactory/issues/5#issuecomment-5467992110)
selects 18 more routes: triggers, features, snapshot dependencies and existing template attachments.
Implementation passed exact mock contracts and the [checkpoint +50 review](checkpoint-50-review.md).
Local coverage is 67/449; [s2-coverage.csv](s2-coverage.csv) adds 18 distinct routes to S1's 32.
The first batch is closed locally, not published. No live Update operation was performed.

## Mandatory authoring checkpoints

Follow [integration authoring reviews](../../../docs/practices/integration-authoring-reviews.md).
The v2 counter starts at **0 new operations**, above the 17-route baseline. Review after +50,
+100, +150, and so on, plus the final shorter batch. The first checkpoint is 67 total routes.
Do not begin the next batch while the checkpoint or its required corrective work is open.

S1 ends at +32/50; it does not reset the counter. Fifty is not a required slice size. Compare
same-capability examples and total Core-plus-integration cost, including helpers; seek improvements
usable by other CLIs without moving TeamCity concepts into Core or weakening its promotion rule.

S1–S10 closed checkpoints through +400 and the final+432 review. No next implementation batch
remains in the frozen inventory. Future expansion requires a new explicit scope, not denominator drift.

## Large slice: S3+S4

The owner requested the next ~100 operations in one delivery. The
[100-route execution contract](https://github.com/iXab3r/EyeAuras.CliFactory/issues/5#issuecomment-5468205768)
owns exact syntax, REST paths, DTOs, gates and exclusions. S3 adds 50 project/job configuration
routes; close checkpoint +100 (117 total) before S4 adds 50 build/queue/agent/pool routes.
Then close checkpoint +150 (167 total). S3 and [checkpoint +100](checkpoint-100-review.md) passed
locally with 181 tests. S4 and [checkpoint +150](checkpoint-150-review.md) then passed with 241 tests
and the fixed 19/19 local ReadOnly proof. Local coverage is **167/449**, including 86 reads and 81
updates; 282 routes remain. Both halves are reconciled in s3-coverage.csv and s4-coverage.csv.
The [source corrections](https://github.com/iXab3r/EyeAuras.CliFactory/issues/5#issuecomment-5468269661)
clarify agent fields and DTOs without changing route counts. All S1–S4 acceptance remains local;
no commit/push is authorized by this slice. The next step is publication after owner direction or
agreement of another exact slice, not automatic closure of P1 or the complete feature.

## Phases

Owner continuation (2026-08-30): finish the complete remaining inventory autonomously. The
[completion/S5 contract](https://github.com/iXab3r/EyeAuras.CliFactory/issues/5#issuecomment-5468407176)
authorized subsequent bounded slices without asking the owner again. S5–S10 and reviews at
+200/+250/+300/+350/+400/final+432 are now complete locally. No real Update calls or code
publication were implied. Sensitive surfaces retain explicit gated, credential-safe contracts.

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
