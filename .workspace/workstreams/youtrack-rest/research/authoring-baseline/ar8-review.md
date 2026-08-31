# AR8 authoring and simplicity review

**Independent authoring verdict: PASS.** Reviewer: repo_contract, 2026-08-30.
Root has separately accepted the first eight REST operations after technical review. All required
AR8 corrections below are closed. This verdict closes the first-slice authoring review only;
it does not accept later scope, reset the counter, or waive AR50, AR100 or final AR118.

## Evidence and acceptance

Original source baseline: `e0d4d1b8dc615a969a0160f69a5fb34968d9ab3d`.
The target still has that HEAD plus reviewed working-tree changes; no commit/import is implied.
Policy: docs/practices/integration-authoring-reviews.md and Issue #6 first-slice/review contract.

Accepted identities, counted once each:

- GET /api/users/me
- GET /api/admin/projects
- GET /api/issues
- GET /api/issues/{issueID}
- GET /api/issues/{issueID}/comments
- POST /api/issues
- POST /api/issues/{issueID}
- POST /api/issues/{issueID}/comments

Counter: **8/118**, comprising five ReadOnly and three Update operations. Authentication and
user me share the identity operation. Derived download remains 0/1. No live mutation was run.

Technical evidence is separate: [read review](../review/read-context-review.md),
[proof review](../review/read-context-proof-review.md), and
[mutation review](../review/narrative-mutations-review.md).
Author and independent reviewer each reported final **114/114** tests passing
(Core 25, TeamCity 36, YouTrack 53). Root independently rebuilt and ran the fixed packaged
five-operation ReadOnly proof: all five passed, exit 0. This reviewer did not contact a service,
inspect credentials or rerun product tests; the checks personally performed are recorded below.

## Complete source and evidence cost

Metric: nonblank physical handwritten TypeScript lines, comments included, normal formatting.
Count every Core/integration source file, including untracked additions. Tests/support and local
proof remain separate. Generated output, management snapshots and non-TypeScript docs/manifests
are not production TypeScript; package manifests are captured separately. No standalone
non-TypeScript test fixture exists in the final measured roots.

| Surface | Frozen baseline | Pre-B | Final AR8 | Delta from frozen |
|---|---:|---:|---:|---:|
| Core source | 1731 | 1735 | 1741 | +10 |
| TeamCity source | 1100 | 1100 | 1100 | 0 |
| YouTrack source | 0 | 142 | 520 | +520 |
| All production source | 2831 | 2977 | 3361 | +530 |
| Core tests | 753 | 833 | 880 | +127 |
| TeamCity tests/support | 1308 | 1308 | 1355 | +47 |
| YouTrack tests/support | 0 | 283 | 943 | +943 |
| All tests/support | 2061 | 2424 | 3178 | +1117 |
| Local proof | 330 | 389 | 445 | +115 |

The seven operations after A add 384 production lines, 754 tests/support lines and 56 proof lines.
Final YouTrack source is CLI 173 + client 325 + exports 19 + executable 3. Core's +10 comprises
the earlier accepted prompt correction (+4) and C's required-option/recursive-error correction
(+6). TeamCity production remains unchanged; its new real-consumer RPC regression adds 47 test
lines. Local proof is TeamCity 330 + YouTrack 115.

The setup-included first-batch ratio is 530/8 = 66.25 added production lines per accepted
operation. This is descriptive cost, not productivity, a reduction percentage, or a comparison
between unlike workflows. The zero-YouTrack baseline cannot prove savings.

## Preserved actual chronology

All snapshots contain exact paths, full source text, byte hashes, counts and package manifests.
They are immutable management evidence, not generated product code. Source authors held edits
during capture. Earlier snapshot counters record acceptance at capture time, not today's counter.

| Snapshot | Production | Tests/support | Proof | Interpretation |
|---|---:|---:|---:|---|
| snapshots/pre-b.json | 2977 | 2424 | 389 | Accepted A + prompt fix; before B |
| snapshots/direct-b.json | 3222 | 2792 | 445 | First direct B; scrub corrections pending |
| snapshots/b-fixed.json | 3231 | 2808 | 445 | Correctness-fixed B, later technically accepted |
| snapshots/direct-c.json | 3357 | 2917 | 445 | First direct C; CLI preflight defect not yet discovered |
| snapshots/authoring-final.json | 3361 | 3178 | 445 | Final accepted eight, source/tests frozen |

The B +9 production/+16 test correction is security/contract work, not authoring regression or
savings. C's single-parser trial happened before the required-option defect surfaced. No artificial
intermediate revision was reconstructed. The exact request-only diff isolates the trial; the total
final delta includes the later correctness work.

Final snapshot SHA-256:
`9e38686726651b97964a689e130cfe2d90f5fbbae9e29d1a5d38c5a9d32269ce`.

## Equivalent examples and the small simplification

[ar8-equivalence.json](ar8-equivalence.json) retains exact before/after source spans and verified
comparisons. All paths below are under integrations/youtrack/src and refer to the final snapshot.

| Capability | Declaration | Client function | Comparison |
|---|---|---|---|
| issues list | cli.ts:141-152, 12 lines | client.ts:251-259, 9 lines | Identical to fixed B |
| issues get | cli.ts:153-159, 7 lines | client.ts:261-269, 9 lines | Identical to fixed B |
| issues update | cli.ts:134-140, 7 lines | client.ts:327-340, 14 lines | Client identical to direct C; parsing moved to option metadata |

These fragments do not hide shared cost: the final CLI has body metadata (8 lines), parseBody
(7), connection (9), readOptions (8) and integer parsing (6), plus profile/auth/command setup.
The client retains URL validation (30), fields/page/ID validation (3/11/11), scrubUrl/scrub
(16/18), object validation (6), request (58), readObject/readCollection (7/14), mutation body
allowlist (10), narrative/description validation (6/6), and mutate (9), plus consumed types,
field constants and service functions. All are included in the complete file totals.

The selected simplification replaces separate read response.json and write response.text/JSON.parse
branches with one text/JSON.parse path. Explicit empty-write success and literal-JSON-null mutation
rejection remain; empty/malformed reads, strict identity validation, object checks, redaction and
failure behavior remain tested. request falls from **62 to 58** nonblank lines. Source comparison
proves this is the only client.ts change from direct C; list/detail/update function bodies are
byte-for-byte equivalent after newline normalization. No API, dependency or call layer was added.

Do not report the whole direct-C-to-final change as a pure reduction:
**+6 Core +2 YouTrack CLI correctness work -4 request simplification = +4 production lines net.**
The CLI change is not behavior-equivalent to the defective preflight baseline. Required --body
and safe JSON parsing now fail before onboarding; keeping those checks is more important than
making the total decrease.

## Simplicity and shared benefit

- Existing recursive commands, profiles, keyring, permissions, output and JSON-RPC remain shared.
  Core still exports 11 runtime names and 24 type names. Its one added public capability is the
  optional OptionDefinition.required flag; no new exported abstraction was introduced.
- Core maps that flag to the existing Commander mandatory-option facility. Existing parse metadata
  owns safe body JSON parsing. Recursive exitOverride prevents a nested parse error terminating
  persistent execution. These are small corrections to existing surfaces, not a validation framework.
- YouTrack intentionally exports ten runtime names and seven type names. Its three mutation entry
  points accept unknown JSON and explicitly validate local allowlists before constructing the body;
  no hidden schema/DSL, generic CRUD model or unsafe cast replaces validation.
- A service call has four integration stages after Core dispatch: leaf adapter, service function,
  local shape/mutation helper, request, then native fetch. This stayed unchanged through the
  simplification. The shape helpers enforce object/collection bounds and redaction; mutation
  helpers enforce the three actual endpoint contracts.
- Core still has two runtime dependencies, commander and @napi-rs/keyring. Both integrations
  depend only on the same @eyeauras/cli-factory at runtime; MSW remains test-only. Final package
  manifests are unchanged from the direct-C snapshot. No new production dependency or Core
  service-specific concept was added.
- Shared correctness is proven on actual products: YouTrack covers mandatory body/preflight/RPC
  continuation; TeamCity's new argument-errors.test.ts proves a missing jobs show ID returns an
  RPC error and the same session then handles help, with no fetch or real stores. This supplies
  concrete second-CLI benefit without inventing a synthetic product.
- A typed command redesign, generic binder or common HTTP layer has no demonstrated net benefit
  at eight operations. Existing local connection/readOptions helpers already centralize actual
  repetition. Keep this direct arrangement rather than add framework setup to shorten leaf syntax.

Read-only parallel inspection found ORIGINAL HEAD
`1d36395833101c920f74ecdf2749ef2f2f6a0575`; native Git reported no committed Core changes in
`e0d4d1b..HEAD`. Its newest Core-touch commit, 49027ff, is already baseline ancestry. Dirty
original changes were excluded. No merge/copy/rebase or imported savings are claimed.

One concrete deferred test/support candidate goes to the parallel TeamCity owner: consider
replacing its hand-written TestProfileStore with the already-used AppArguments + MemorySecretStore
and real Core persistence pattern in YouTrack tests. Require equivalent contract coverage and a
measured test/support delta. This is not an AR8 production saving, new task, or required correction;
the original worktree was not edited.

## Checks and closure

This reviewer reconstructed all **41** final source hashes and nonblank counts from saved content;
all matched. Exact comparisons in ar8-equivalence.json passed. Root and source author independently
recounted 3361/3178/445 and agreed. git diff --check passed (only existing newline warnings).
Package manifests and all shared setup are included; no fixture/test deletion earns credit.

Required corrections are closed:

1. B signed/credential URL scrubbing: fixed B snapshot and technical read acceptance.
2. C missing body/unsafe onboarding order and nested process exit: required-option metadata,
   early safe parsing, recursive exitOverride, actual YouTrack/TeamCity regressions and final
   independent 114-test PASS.
3. Parser simplification: isolated -4 request lines, unchanged safety/response contracts and
   final regression PASS; no further abstraction required.

**Technical verdict: PASS (independent technical reviewer and root).**
**Independent authoring/simplicity verdict: PASS.**
**Remaining required AR8 corrections: none.** The orchestrator may close AR8; this turn stops at
eight operations. Later work retains the mandatory 50/100/118 gates, including the final derived
download cost and separate acceptance.

