# AR50 independent authoring review

**PASS.** Reviewer: repo_contract. Accepted operations: **50 = 8 + 42**.
The Issue and block-50.json own the exact identities: 37 ReadOnly and 13 Update in total.
Required readability and Period-policy corrections are closed. No operation 51 was implemented.
This is the independent authoring verdict; root owns technical acceptance and the counter.

## Reproducible evidence and full cost

Rule: nonblank handwritten TypeScript physical lines, comments included, normal formatting;
generated output excluded. Exact paths, UTF-8 content, file hashes, manifests and count classes
are preserved by capture-working-tree.ps1. Tests/support and local proof are separate.
Target source base: e0d4d1b8dc615a969a0160f69a5fb34968d9ab3d plus the captured worktree files.
Do not describe the mutable branch tip alone as the implementation baseline.

| Scope | Original | AR8 | AR50 | Delta from AR8 |
|---|---:|---:|---:|---:|
| Core production | 1731 | 1741 | 1741 | 0 |
| TeamCity production | 1100 | 1100 | 1100 | 0 |
| YouTrack production | 0 | 520 | 2020 | +1500 |
| All production | 2831 | 3361 | 4861 | +1500 |
| Core tests | 753 | 880 | 880 | 0 |
| TeamCity tests/support | 1308 | 1355 | 1355 | 0 |
| YouTrack tests/support | 0 | 943 | 2787 | +1844 |
| All tests/support | 2061 | 3178 | 5022 | +1844 |
| Local proof | 330 | 445 | 482 | +37 |

From original: +2030 production, +2961 tests/support and +152 proof. Final YouTrack test cost
is 2752 test lines plus 35 fixture lines; TeamCity is 1202 tests plus 153 support. Proof is
TeamCity 330 plus YouTrack 152. No non-TypeScript test artifacts were found in the final capture.

- Original: baseline.json and fixed-commit recount.ps1.
- AR8: snapshots/authoring-final.json, SHA-256
  9e38686726651b97964a689e130cfe2d90f5fbbae9e29d1a5d38c5a9d32269ce.
- Direct mounted expansion: snapshots/ar50-direct-families.json, SHA-256
  bbc13305c3cb75dbae5bac07b6572034585fb2c125ada5c54b5bc085012fa5e6.
- Final coherent 50: snapshots/ar50-final.json, SHA-256
  1387dd12cef9c7f6a8f94e395d9b4696d798223e53ff346c02558de0f7334984.
- Exact sample/helper spans and 64-file verification: ar50-equivalence.json, SHA-256
  2a9aef2f4e3a5e78f1ba148c0309a943e8d4d0579e980797cd89d8d2ceeda125.

All 41 AR8 file hashes matched immediately before extraction. The intermediate foundation
snapshot records 3363 production: +2 net setup/organization, not a saving. The earlier query
direct snapshot contains concurrent provisional families; its aggregate is not query-only cost.

## Same-capability evidence and correction attribution

The original issues list/get/update declarations and service functions are byte-identical after
newline normalization. Their final spans are in integrations/youtrack/src/cli.ts and client.ts:

| Capability | Declaration lines | Service lines | Before to after |
|---|---|---|---|
| issues list | cli.ts 104-115: 12 | client.ts 266-274: 9 | 21 to 21 |
| issues get | cli.ts 116-122: 7 | client.ts 276-284: 9 | 16 to 16 |
| issues update | cli.ts 97-103: 7 | client.ts 366-379: 14 | 21 to 21 |

These are sample-local costs, not complete operation costs. Final shared/composition files cost
594 lines: client.ts 361, cli.ts 143, cli-support.ts 48, index.ts 39, bin.ts 3. Six new domain
pairs cost 1426 lines: query 291, fields 244, relations 262, context 268, time 245, attachments 116.
Together they account for all 2020 YouTrack source lines. No DTO/validator/schema/helper cost is
hidden outside the total. There is no demonstrated same-capability line reduction at AR50.

request grows 58 to 61 lines; readObject 7 to 9 and mutate 9 to 11. These changes support actual
POST reads, explicit empty-response policy, DELETE and multipart bodies. encodedID plus issuePath
cost 14 versus the old issuePath's 11. deleteObject costs 4 and uploadObjectCollection 17.
Export-only helper changes and moved CLI support are organization/reuse, not erased work.
The AR8 isolated parser saving remains prior-checkpoint history, not a new AR50 saving.

Direct expansion measured 4216 production / 5001 tests-support / 482 proof. Final is +645
production and +21 tests. The source increase closes the compressed-formatting problem and adds
the narrow Period upper-bound check; it is not a regression in capability or abandoned savings.
The independent technical reviewer compared transformed code and manually checked all remaining
changes: braces/readable structure, the Period Int32 bound and its safe error only. Presentation
behavior is unchanged. The new boundary test covers zero, maximum and maximum-plus-one.

PeriodValue and DurationValue are distinct entities. Their minutes fields share the documented
Int type, but presentation semantics are not established as equivalent. The 0..2147483647 Period
limit is documented local CLI policy inferred from Int, not a claim that official docs state a
numeric server limit. Retaining separate validators avoids changing behavior to create reuse.
A scalar-only helper did not justify its function/import/label setup at two callers.

## Simplicity and shared benefit

Core and TeamCity source remain unchanged from AR8. Existing command declarations, required-option
metadata, parse callbacks, profile/keyring, permission gates, output, JSON-RPC and runtime injection
support the expansion. No newer committed Core change exists in the original checkout after e0d4d1b;
its HEAD was 1d36395833101c920f74ecdf2749ef2f2f6a0575. Dirty parallel work was excluded and not imported.
The prior actual TeamCity/YouTrack nested-argument regression evidence remains applicable; no new
cross-CLI improvement or production saving is claimed in this batch.

YouTrack source modules grow from 4 to 17: six service/command pairs and one local CLI support file.
This partitions actual domains; it adds module coupling, not a second declaration system.
Its package barrel grows from 10 runtime / 7 type names to 52 runtime / 10 type names: the 42 actual
service entry points and three query/cursor option types. Core still has 11 runtime / 24 type exports.
Private RequestOptions expresses actual fetch method/body/empty-response choices, with no public
transport passthrough, schema, generator, generic CRUD or new Core framework.

Ordinary calls retain four integration stages after Core dispatch: leaf adapter, service function,
shape/mutation helper, request, then native fetch. Cursor calls have one extra activityPage wrapper
shared by two endpoints to validate cursor envelopes. Upload adds explicit local-file/FormData work;
field/time body validation stays visible beside its service functions. These are actual contracts.

The shared CLI support is used by 50 leaves; the shared fixture is imported by seven test files
(original CLI plus the six new domains). Count its actual 35 lines, not hypothetical duplicated
copies. Direct bindings contain 50 connection resolutions, 51 String(args.*) and 38 readOptions
calls; TeamCity has 17 client resolutions and 11 String(args.*). Occurrences alone do not prove
that generic binding/type inference would remove net work. Keep the explicit handlers and avoid
another public API/debugging layer without an equivalent measured improvement.

All four package manifests are byte-identical to AR8. Core retains commander and @napi-rs/keyring;
both integrations depend only on the same @eyeauras/cli-factory at runtime. No new dependency.
The earlier possible TeamCity test-harness convergence stays a deferred support-only follow-up
for its parallel owner, not a required correction or a claimed AR50 production saving.

## Checks and closure

This reviewer independently reproduced all 64 final content hashes and nonblank counts, checked
all current-file hashes, and verified the exact sample comparisons. All matched. Root and author
independently recounted 4861/5022/482. The technical reviewer independently reran **215 passing
tests** (Core 25, TeamCity 36, YouTrack 154), checked the final hashes and the post-direct semantic
diff. The author reports compiled help checks and git diff --check PASS.

Root reports the final fixed packaged ReadOnly proof: **13 PASS, zero SKIP, exit 0**. Empty tag
and work-item results are valid successful rows, not omitted evidence. No live mutation or
broad traversal was performed. This reviewer did not inspect private service output or credentials.

**Independent authoring/simplicity verdict: PASS. Required AR50 corrections: none remain.**
Root may close the gate before later operation 51. Later 100 and final shorter-batch reviews
remain mandatory; this verdict does not silently authorize or accept later scope.
