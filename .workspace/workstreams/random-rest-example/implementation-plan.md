# RANDOM.ORG HTTP example

Status: complete locally, including live verification (not committed or published). Roles: Reconciliation Lead
and integration author. Owner/reviewer: root agent.
Scope: [feature issue #8](https://github.com/iXab3r/EyeAuras.CliFactory/issues/8).

Baseline: `1d36395`, isolated branch `codex/random-rest-cli`. Unrelated uncommitted TeamCity/Core
changes remain in the original checkout. Authoring baseline: zero commands; this slice adds two.
Review the whole example for size and clarity at close-out, rather than adding more operations.

| Phase | Scope | Gate |
|---|---|---|
| 1 | Bound the feature and prepare isolated workspace | Issue + plan/ledger, contracts read |
| 2 | Issue's HTTP/CLI contract and deterministic tests | Focused HTTP/CLI/process tests pass |
| 3 | Docs, packaged proof, repository verification | npm test; honest live-proof status; authoring review |
| 4 | Owner-requested live tests and actual service run | Four sequential cases; offline regression; actual outcome |

Use native fetch/MSW, synthetic fixtures and injected test AppData. Do not edit Core, add IPC or
Playwright, or coordinate unrelated processes. Commands/DTOs stay integration-local for reuse by
the later browser implementation. Review diff/evidence separately before marking phases done.
The owner subsequently requested a local commit of this completed HTTP slice. Push, publication,
and issue closure remain outside the request.
