# Integration authoring v2 — implementation ledger

**Lifecycle:** active. **Issue:** [#16](https://github.com/iXab3r/EyeAuras.CliFactory/issues/16).
**Current phase:** P5 commit/publication. **Baseline:** `c06efe9bcd27199776e6124122247e09685210d8`.

| Phase | Scope | Status | Agent | Review |
|---|---|---|---|---|
| P0 | Metric, baseline and exact candidate inventory | done | Reconciliation Lead / repository tooling | root PASS: exact all-workspace reconciliation |
| P1 | Existing leaf reuse and proof-only export | done | integration author | root PASS: smaller declaration surface, no behavior change |
| P2 | TeamCity text-response helper | done | integration author | root PASS: one local mechanism, all special cases remain explicit |
| P3 | TeamCity/YouTrack test-authoring pilot | done | integration author / Core testing | root PASS: reuse beats another test DSL |
| P4 | Residual family trials | done | integration author | root PASS: speculative abstractions rejected |
| P5 | Generation decision and close-out | awaiting publication | Reconciliation Lead / reviewers | local/privacy PASS; commit/remote CI pending |

## 2026-09-02 — kickoff

- Verified the only checkout was clean `main`, exactly synchronized with `origin/main` at
  `c06efe9bcd27199776e6124122247e09685210d8`; retained the unrelated safety stash untouched.
- Created public Issue #16 and branch `codex/integration-authoring-v2`. The Issue declares zero
  endpoint/public-behavior growth, full-cost measurement and the forbidden abstraction set.
- Frozen baseline from the prior audited method: production 19,503; tests/support 24,310; proof
  443; TeamCity production 9,512 at 449/449; YouTrack production 3,920 at 118/118 plus download.
- P0 adds one dependency-free repository measurement command. Its exact reconciliation and
  candidate inventory are in `baseline.md`; no product source changed in P0.
- `npm run measure:loc -- --ref c06efe9... --json` reproduced production 19,503,
  tests/support 24,310, proof 443 and every workspace row exactly. Functional roles report
  runtime 18,964, authoring-testing 220 and authoring-proof 319. Generated, tooling, protocol and
  historical workstream code remain separate.
- The working-tree run identifies the measurement implementation as repository tooling. P0 adds
  no dependency, Core/integration API or runtime layer. Root accepts P0; P1 is released.

## 2026-09-02 — P1 existing-mechanism reuse

- Replaced TeamCity's 17 remaining hand-written service-leaf closures with its existing
  `clientLeaf` adapter. Branch declarations remain ordinary recursive `command(...)` nodes, and
  handlers still return data through the same permission-aware command tree.
- Removed the RANDOM live inventory from the runtime barrel and exposed it only through the
  existing `@eyeauras/random-common/proof` entry point. Runtime consumers no longer learn a
  proof-only concept.
- Cost from the frozen baseline: production 19,503 -> 19,481 (-22); runtime 18,964 -> 18,941
  (-23); authoring-proof 319 -> 320 (+1 explicit proof export). Core stayed at 3,294 and all test
  source stayed unchanged.
- Evidence: repository build PASS; TeamCity 586/586, RANDOM REST 25/25 and RANDOM Playwright 6/6
  compiled tests PASS. Root accepts P1; no new abstraction was introduced.

## 2026-09-02 — P2 TeamCity text-response family

- Added one private TeamCity-local `#requestText` specialization over the existing bounded
  transport. Migrated only the repeated no-query text reads/writes; JSON-with-text-body, batch
  JSON acceptance, query-bearing backup/commit-hook calls and transport encoding stay explicit.
- Cost after P2: TeamCity production 9,512 -> 9,385 (-127 from baseline, -105 in P2); total
  production 19,503 -> 19,376; runtime 18,964 -> 18,836. Tests/proof/Core are unchanged from P1.
- Evidence: repository build PASS and all 586 TeamCity compiled tests PASS. The helper changes no
  URL, method, query, body, media type, response limit, projection or public API. Root accepts P2.

## 2026-09-02 — P3 two-integration testing pilot

- Reused Core's existing `trackRequests`, `assertHttpRequest` and `assertPermissionDenied` in one
  TeamCity family and one YouTrack family. No new test DSL or Core API was necessary.
- TeamCity's 50-gate and invalid-input checks now inherit the shared no-network invariant.
  YouTrack relation reads/writes now compare the complete independently-authored URL, query,
  headers and body contract instead of repeating partial `URLSearchParams` assertions.
- Cost: TeamCity tests/support 10,106 -> 10,095 (-11); YouTrack tests/support 6,151 -> 6,148
  (-3); repository tests/support 24,310 -> 24,296 (-14). Core authoring-testing stays 220.
- Evidence: repository build PASS and the two affected files pass 30/30 tests. Root accepts the
  pilot: the existing narrow contracts reduce glue while strengthening assertions; expanding
  Core would add concepts without a missing capability.

## 2026-09-02 — P4 residual audit

- Recounted the remaining TeamCity transport/list/option families and compared them with YouTrack.
  Exact counts, candidate shapes and verdicts are in `residual-review.md`.
- No candidate survived full-concept review. Dynamic envelope projection would trade typed local
  schemas for string keys; acknowledgement helpers would hide response policy; shared option or
  connection binding would generalize only superficial similarity. No rejected prototype remains
  in production or Core.
- Root accepts P4 with zero source/test delta. A client file split is explicitly separated as a
  possible navigation task, not claimed as an authoring improvement.

## 2026-09-02 — P5 generation decision

- `generation-decision.md` rejects a production generator for the completed corpus. The frozen
  inventories do not contain the command, validation, safety and response decisions a useful
  schema would require, and independent tests cannot derive expectations from production data.
- Reopen only for a new coherent batch of at least 25 same-shape operations with under 20% planned
  overrides, using a direct-versus-generated full-cost trial. A service-neutral CRUD/HTTP generator
  stays out of scope.

## 2026-09-02 — local final gate

- `npm test` passed 1,149/1,149 tests across all seven test-bearing workspaces, with zero failures
  and zero skips. `git diff --check` passed.
- Final exact metrics and root review are in `final-review.md`: production -127, tests/support -14,
  proof unchanged, reusable repository metric +149; product + tests/proof is -141 and full measured
  code including tooling is +8. Core production remains unchanged.
- P5 local technical review is PASS. Privacy/staging, commit, push, PR and exact-head remote CI are
  publication gates and must be appended from actual evidence.

## 2026-09-02 — pre-commit privacy gate

- Scanned all 492 tracked files and the complete 17-file staged diff without printing candidate
  values. High-confidence private keys/tokens/JWTs, the private build host, private IP ranges,
  personal paths and staged emails/credential URLs/literal secrets: zero findings.
- Existing full-tree credential-shaped URLs and emails occur only under reserved
  `example.com`/`example.test`/`random.test`/`youtrack.example.com` fixtures. Three broad literal
  candidates were manually classified as a policy sentence, a public response-field list and a
  synthetic test contract. No unresolved privacy finding remains; staged diff check passes.
