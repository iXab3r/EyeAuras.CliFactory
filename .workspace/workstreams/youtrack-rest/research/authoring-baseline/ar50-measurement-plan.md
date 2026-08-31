# AR50 measurement and early-review plan

Status: active; independent reviewer: repo_contract. Target: **50 accepted operations**, starting
from accepted AR8 = 8. The next 42 identities belong to the Issue/ledger scope; this record does
not choose or duplicate them. Operation 51 stays blocked until AR50 PASS and corrections close.

## Fixed comparison points

- Original: e0d4d1b8dc615a969a0160f69a5fb34968d9ab3d; 2831 source / 2061 tests-support / 330 proof.
- Previous accepted checkpoint: snapshots/authoring-final.json, SHA-256
  9e38686726651b97964a689e130cfe2d90f5fbbae9e29d1a5d38c5a9d32269ce.
- AR8: Core 1741 + TeamCity 1100 + YouTrack 520 = **3361 source**;
  Core tests 880 + TeamCity tests/support 1355 + YouTrack tests 943 = **3178 tests/support**;
  TeamCity 330 + YouTrack 115 = **445 local-proof**.
- Reuse the exact accepted issues list/get/update examples in ar8-equivalence.json and their
  full setup, validators, projection, safety, error and permission contracts. Add one representative
  new family only when its behavior differs enough to need a separate comparison.

## Measurement and review sequence

1. Verify the 42-ID scope and source ownership supplied by scope_manager/root. Count only unique
   newly accepted METHOD PATH identities; flags, schemas, helpers and tests do not advance coverage.
2. During implementation, ask each source owner for a coherent direct-example snapshot before
   a proposed refactor. Preserve its source/hash and all helper/setup cost. Do not globally freeze
   unrelated work or stop the user at internal handoffs. Concurrent intermediate snapshots are
   provisional observations, not whole-milestone acceptance or a new baseline.
3. Review actual repetition early: request/response shaping, declaration input conversion,
   body/ID validation and test setup. Propose only a concrete small simplification whose equivalent
   behavior and complete cost can be measured. The existing direct pattern remains acceptable
   where another abstraction adds more API/setup than it removes.
4. If Core changes are justified, retain before/after evidence, explicit DESIGN reconciliation
   where required, and actual YouTrack plus TeamCity regression/use evidence. A new extracted
   shared mechanism needs both real consumers. Existing Core surfaces may be improved without
   creating a generic HTTP/CRUD/command schema system.
5. At 50, coordinate one final coherent source/test freeze with root. Use capture-working-tree.ps1
   for exact tracked/untracked paths, UTF-8 content hashes, nonblank TS counts, package manifests,
   and separate non-TS fixture accounting. Verify snapshot content, current-file hashes and totals.
6. Record full Core + every integration production deltas from both original baseline and AR8;
   list tests/support/fixtures/proof separately. Record exported API names/capabilities, dependency
   changes, request call stages and real shared benefit. Optional per-operation ratios describe
   setup-included cost, never productivity or improvement between unlike workflows.
7. Keep contract/security fixes separate from equivalent-behavior simplification. Show exact
   sample diffs and all setup/helper cost; do not reward minification, weaker validation/typing,
   omitted help/gates, raw unsafe DTOs, deleted tests, or moving code into uncounted helpers.
8. Authoring/simplicity PASS is independent from technical tests and local proof. Required
   corrections close before root closes AR50; no next-batch work starts before that gate.

## Accepted parallel Core check

On this milestone's initial check, ORIGINAL HEAD is still
1d36395833101c920f74ecdf2749ef2f2f6a0575. Native Git
log e0d4d1b8dc615a969a0160f69a5fb34968d9ab3d..HEAD -- packages/core
returns no commits. Therefore no newer committed Core improvement is available there.
Its dirty Core changes are excluded: no copy, merge, rebase or attributed savings.

The AR8 deferred TeamCity test-harness convergence remains a test/support-only candidate requiring
actual equivalent coverage and measurements; it is not a promised production saving or a reason
to modify the independently evolving original worktree. Typed inputs, option declarations or
binding changes likewise remain candidates until actual repeated code supports them.

