# Integration authoring v2 — implementation ledger

**Lifecycle:** complete. **Issue:** [#16](https://github.com/iXab3r/EyeAuras.CliFactory/issues/16).
**Current phase:** complete; PR #17 open. **Baseline:** `c06efe9bcd27199776e6124122247e09685210d8`.

| Phase | Scope | Status | Agent | Review |
|---|---|---|---|---|
| P0 | Metric, baseline and exact candidate inventory | done | Reconciliation Lead / repository tooling | root PASS: exact all-workspace reconciliation |
| P1 | Existing leaf reuse and proof-only export | done | integration author | root PASS: smaller declaration surface, no behavior change |
| P2 | TeamCity text-response helper | done | integration author | root PASS: one local mechanism, all special cases remain explicit |
| P3 | TeamCity/YouTrack test-authoring pilot | done | integration author / Core testing | root PASS: reuse beats another test DSL |
| P4 | Residual family trials | done | integration author | root PASS: speculative abstractions rejected |
| P5 | Original generation decision and close-out | done, superseded | Reconciliation Lead / reviewers | technically valid narrow trial; owner rejected its scale |
| P6 | Owner correction and scope reconciliation | done | Reconciliation Lead | root PASS: Issue/plan/exclusions now agree |
| P7 | Core invocation-target binder, two consumers | done | factory-core / integration author | root PASS: focused gate/profile/RPC/type evidence |
| P8a | First 50 YouTrack command declarations | done | integration author | root PASS: direct exceptions and full-cost sample reviewed |
| P8b | 102 command + 85 resource declarations | done | integration author | root PASS: full YouTrack suite preserves 118/118 behavior |
| P9 | Configured fixture adoption | done | integration author / Core testing | root PASS: auth/profile tests remain real; suite unchanged |
| P10 | Final metrics, privacy and publication | done | Reconciliation Lead / reviewers | root PASS: local/privacy + 6/6 implementation-head CI |

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

## 2026-09-02 — P6 owner correction

- Owner review rejected the original -141 product/test-line result as too small. The old P5 final
  verdict and the P4 connection-binder rejection are retained as historical evidence but marked
  superseded; no pushed history was rewritten.
- Updated Issue #16 before broad implementation. The revised contract permits one target-only Core
  binder plus proven YouTrack-local command/resource vocabularies, while keeping universal HTTP,
  route schemas, generated expectations and service policy in the exclusion set.
- Rebased the phase plan to P6-P10 and retained the immutable baseline and REST counters.

## 2026-09-02 — P7 shared invocation target

- Added `targetCommands(resolve)` to Core with `command`, `read`, `update` and custom `gated`
  declarations. It preserves literal positional inference and resolves only inside the admitted
  handler, so denied commands never create an authenticated client.
- Resolution is fresh for every ordinary/RPC invocation. Focused Core evidence covers ReadOnly,
  Update and custom denial, two profiles, AppData selection, successive RPC requests and a
  compile-time positional typo.
- TeamCity's existing `clientLeaf` now delegates to this API; YouTrack's connection-bound leaves
  consume `readCommand`/`updateCommand`. Core remains service-neutral.

## 2026-09-02 — P8a/P8b authoring checkpoints

- P8a reviewed the first 50 migrated YouTrack leaves. The retained local vocabulary has four
  shapes only: paged read, projected read, body update and projected body update. It maps literal
  positional syntax in order, supplies the already-existing option sets and keeps permission at
  the declaration. Custom query options and exceptional operations stay direct.
- P8b completed **102 command declarations across 15 command/root modules**. No handler still
  repeats `connection(context)` or a local `Permission.ReadOnly/Update` wrapper.
- Added two YouTrack-local resource helpers for ordinary bounded collection GET and projected
  object GET, then migrated **85 resource declarations across 15 modules**. Mutations,
  upload/download, nullable responses, custom queries/bodies, acknowledgements and service
  sanitization remain explicit.
- Review caught and fixed a prototype type regression: a static path initially inferred a broad
  rest parameter. Conditional path arguments now emit exact zero/fixed positional signatures;
  compile-only regressions prove static paths reject extra IDs and dynamic paths require theirs.
- Full YouTrack suite passes 345/345, including independent MSW path/query/header/body contracts,
  all gates, profiles, RPC, sanitization, uploads/downloads and response bounds. REST coverage is
  unchanged at 118/118 plus the derived download.

## 2026-09-02 — P9 configured fixture adoption

- YouTrack's adapter now exposes a configured synthetic-profile fixture by preparing Core's
  existing `createCliFixture`; it adds no service-aware Core option and performs no real login.
- Repeated service-command tests use the prepared profile. Auth/configuration/profile-isolation
  tests still drive the real CLI commands when those transitions are the behavior under test.
- YouTrack test/support source is 6,151 -> 6,121 (-30) despite added resource type regressions.

## 2026-09-02 — expanded local final gate

- `npm test` passed **1,150/1,150** tests across all seven test-bearing workspaces, zero failures
  and zero skips: Core 134, IPC 31, Playwright 23, RANDOM Playwright 6, RANDOM REST 25,
  TeamCity 586 and YouTrack 345.
- Current exact nonblank metrics versus the frozen baseline: production 19,503 -> 18,517
  (**-986**), tests/support 24,310 -> 24,346 (+36), proof unchanged at 443. Product + tests +
  proof is **-950**. Tooling remains +149, so all measured code including the reusable metric is
  **801 lines smaller**.
- Workspace production deltas: Core +70, TeamCity -138, YouTrack -918. Test/support deltas: Core
  +77, TeamCity -11, YouTrack -30. The common API and its tests are fully charged rather than
  hidden inside the integration saving.
- `git diff --check` passes. P10 still requires the new full-tree/staged privacy gate, commit,
  push, revised PR and exact-head CI evidence.

## 2026-09-02 — expanded pre-commit privacy gate

- Scanned all 494 tracked files, both new untracked Core files, and the complete 58-file staged
  change without printing candidate values. Private-key blocks, known credential prefixes, JWTs,
  the private build host, private IPs, personal filesystem paths, non-reserved emails and staged
  credential-bearing URLs/literal secret assignments: zero findings.
- Existing credential-shaped URLs in the full tree resolve only to reserved example/test hosts;
  existing emails resolve only to reserved example/test or GitHub noreply domains. No exception or
  owner waiver is needed for this change.
- `git diff --cached --check` passes. Commit, push, revised PR and exact-head CI remain.

## 2026-09-02 — P10 publication and close-out

- Committed the expanded implementation as `5d2b8d6` (`refactor: unify integration operation
  authoring`) and pushed it to `origin/codex/integration-authoring-v2` without rewriting history.
- Updated [PR #17](https://github.com/iXab3r/EyeAuras.CliFactory/pull/17) and Issue #16 to the
  expanded scope, explicit exception boundary and full-cost result.
- GitHub Actions run
  [33571869210](https://github.com/iXab3r/EyeAuras.CliFactory/actions/runs/33571869210) passed all
  six implementation-head jobs: Ubuntu, macOS and Windows on Node 22 and 24.
- Delivered outcome: one two-consumer Core target lifecycle, 102 YouTrack command declarations,
  85 typed read resources, repeated configured-fixture removal, and a net -950 product/test/proof
  result with no endpoint or public behavior change. Known failure set: empty. Deferred boundary:
  universal HTTP/CRUD/generation remains rejected until a future concrete service proves it.
- This close-out commit changes tracked coordination records only. PR checks on its exact head are
  the authoritative final publication evidence; the workstream does not require another code or
  scope change.
