# AR100 independent authoring review

**PASS.** Reviewer: repo_contract. Root accepted **100 operations: 81 ReadOnly, 19 Update**.
All required corrections are closed. No operation 101 was added. Exact IDs belong to
block-100.json and the Issue; 98 CLI leaves expose 100 routes through two explicit --direct variants.

## Baselines and complete costs

Before this batch, all 64 current source/test/proof files matched AR50 snapshot
1387dd12cef9c7f6a8f94e395d9b4696d798223e53ff346c02558de0f7334984.
Rule: nonblank handwritten TypeScript physical lines, comments included, normal formatting;
exclude generated code and report tests/support/proof separately. Exact paths, content, hashes,
manifests and counting classes are in capture-working-tree.ps1 snapshots.

| Scope | AR50 | Direct 100 | Final 100 | Delta from AR50 |
|---|---:|---:|---:|---:|
| Core production | 1741 | 1741 | 1741 | 0 |
| TeamCity production | 1100 | 1100 | 1100 | 0 |
| YouTrack production | 2020 | 3226 | 3217 | +1197 |
| All production | 4861 | 6067 | 6058 | +1197 |
| Tests/support | 5022 | 6687 | 6687 | +1665 |
| Local proof | 482 | 507 | 507 | +25 |

Final tests/support: Core 880, TeamCity 1355 (1202 tests +153 support), YouTrack 4452
(4417 tests +35 fixture). Proof: TeamCity 330, YouTrack 177. No non-TS test artifacts.
From original e0d4d1b8dc615a969a0160f69a5fb34968d9ab3d (2831/2061/330), deltas are
+3227 production, +4626 tests/support and +177 proof. All helper/import/export/DTO/body costs count.

- Direct: snapshots/ar100-direct.json, SHA-256
  523ebcdd9013bfcb5ca316529cca082d4fbfc68ec6998f9422dab3c7226ea144.
  This correctly retains accepted85/candidate100 while the last technical reviews were pending.
- Trial: snapshots/ar100-nullable-trial.json, SHA-256
  1066e7599d43181b23c1470afdde7ee47b04618aca4de17f3d0fc1d783e5d945.
- Final accepted100: snapshots/ar100-final.json, SHA-256
  2e84c55765941e663f5bc2b0f0e4e7d3ff5aee0e0d092f2d67b9348f32339033.
- Exact sample/function comparisons and 84-file verification: ar100-equivalence.json, SHA-256
  0604b3550273e0d0c2fc9cc2b1098b537e16047a1cac61c65fa6b92970168c95.

## Same behavior, measured simplification

Issues list/get/update retain declaration-plus-service costs **21/16/21 lines** from AR50.
All three declarations and list/get functions are identical. The update function differs only
by the expected equivalent nullableText(description, label) call; its allowlist/hasOwn guards,
projection and permission remain unchanged. The JSON evidence retains exact before/after spans.
These sample costs exclude shared setup; the complete table above includes it.

The retained trial changes exactly four production files, with no test/Core/TeamCity/index delta:

| File under integrations/youtrack/src | Direct | Final | Net |
|---|---:|---:|---:|
| client.ts | 361 | 361 | 0 |
| articles.ts | 143 | 138 | -5 |
| issue-time.ts | 159 | 157 | -2 |
| agile.ts | 123 | 121 | -2 |
| Whole repository production | 6067 | 6058 | **-9** |

One six-line internal nullableText(value,label) replaces the existing description helper,
article-content helper and duplicate work-item/sprint predicates. Six call sites in four modules
preserve exactly these error labels: description, article content, work-item text, sprint goal.
Null, empty/whitespace/multiline/control-containing strings remain valid; other types including
undefined still fail. Caller hasOwn checks and body allowlists remain local and unchanged.
Imports, helper and call wrapping are included in the nine-line saving. This is a small actual
YouTrack-local simplification, not a Core improvement or claimed cross-CLI production reduction.
TextIssueCustomField's different error and the distinct Period/Duration contracts stay untouched.

## Simplicity decisions and checks

No bundle CRUD/command generator was added: enum/state path repetition alone did not justify
replacing explicit operation functions with another parameterized API. Typed Core inputs/binding
also lacked a demonstrated net benefit; occurrence counts alone do not justify public inference
machinery. Existing CLI options, connection, response helpers and test fixture provide actual reuse.

YouTrack source modules grow 17 to 29 for six actual domain pairs. Its barrel grows 52 to 100
runtime names and 10 to 11 type names (MemberOptions); nullableText is internal, not a barrel API.
Core stays at 11 runtime/24 type exports, with no service concepts added. All four package
manifests match AR50: no dependency change. Ordinary request stages remain leaf, service,
shape/mutation helper, request, then fetch. Nullable validation adds a direct local helper call
inside two existing body validators, with no extra request/dispatch layer or hidden schema.

Original checkout HEAD remains 1d36395833101c920f74ecdf2749ef2f2f6a0575; native Git
log e0d4d1b..HEAD -- packages/core found no newer committed Core improvement. Dirty original work
was excluded and never imported. Prior TeamCity test-harness convergence remains a deferred
support-only candidate, not part of this saving or a required correction.

This reviewer verified all 84 final saved-content/current-file hashes and nonblank counts,
exactly four direct-to-final changed files, exact sample substitutions and unchanged manifests.
Root and author independently agree on 6058/6687/507. The technical reviewer independently
reran **312/312 tests** (Core25/TeamCity36/YouTrack251), checked all four replacement predicates,
exact error messages, preserved guards and final hashes: PASS. Root reports fixed packaged
ReadOnly proof **21 PASS, zero SKIP, exit0**, plus privacy/diff checks PASS. No live mutation,
credential inspection or private response storage was performed by this reviewer.

**Independent authoring/simplicity PASS; required corrections remaining: none.**
Root may close AR100 before operation101. The final shorter-batch review and separate derived
attachment-download accounting remain required; later scope is not accepted by this verdict.
