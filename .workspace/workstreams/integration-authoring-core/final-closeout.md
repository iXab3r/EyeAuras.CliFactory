# F01–F08 implementation and acceptance closeout

**Finding status:** 8/8 accepted by root after independent technical and authoring review.
**Workstream status:** implementation/acceptance complete, P6 done. Exact-head CI first exposed an
ext4 inode-reuse cleanup defect; the accepted correction, 1149-test local suite and post-correction
package smoke passed. Corrected exact head `1c4cb3e47634d8156d5a2bf4bd79bc415cb9434b` then passed all
six CI jobs. Merge PR #15 is the immediate external next action; this is not a release or Issue closure receipt.

## Fixed-method all-workspace measurement

The final candidate uses the immutable baseline's same eight workspace roots, exclusions, path
categories and nonblank handwritten-TypeScript method. New and deleted files are included.
Core/src testing and proof mechanisms remain source by path, with their functional roles also
shown so moving code cannot be reported as runtime savings.

| Workspace | Source baseline→final | Tests/support baseline→final | Proof baseline→final |
|---|---:|---:|---:|
| Core | 2,521→3,294 (+773) | 3,088→4,230 (+1,142) | 0→0 |
| IPC | 1,299→1,299 | 1,420→1,420 | 0→0 |
| Playwright | 574→574 | 1,211→1,211 | 0→0 |
| TeamCity | 9,636→9,512 (-124) | 9,694→10,106 (+412) | 344→274 (-70) |
| YouTrack | 4,030→3,920 (-110) | 5,980→6,151 (+171) | 183→161 (-22) |
| random-common | 511→511 | 0→0 | 0→0 |
| random-pw | 178→178 | 459→459 | 4→4 |
| random-rest | 215→215 | 733→733 | 4→4 |
| **Total** | **18,964→19,503 (+539)** | **22,585→24,310 (+1,725)** | **535→443 (-92)** |

Total handwritten TypeScript is 42,084→44,256 (**+2,172**), with 207→225 TS files and
234→252 included workspace files. Of Core's source growth, 219 implementation lines are
functionally testing (`testing.ts` 129 + `testing-contracts.ts` 90) and 103 are functionally proof;
one additional testing-subpath export is public wiring. Excluding the 219/103 functional-role
implementation lines, ordinary runtime source grows by 217 overall. The proof consolidation adds
103 Core source while removing 92 integration-proof
lines: net proof implementation +11. No whole-workstream LOC saving is claimed.

`final-measurement.json` contains all 252 candidate file records, per-workspace deltas and the 15
fixed samples. It is reproducible with `capture-final.py`; unlike the immutable baseline, this is
a filesystem candidate, not yet a commit/tree/CI receipt.

## Finding decisions and full cost

| Finding | Decision and preserved value | Isolated handwritten TS cost |
|---|---|---:|
| F01 | Retain real-store fixture lifecycle; disposal precedes owned cleanup | source +129; tests/support +69; total +198 |
| F02 | Retain five ordinary testing-contract helpers used by TC and YT | source +91; tests/support +115; total +206 |
| F03 | Retain bounded proof mechanics; TC19/YT24 inventories stay service-owned | source +103; proof -92; tests/support +159; total +170 |
| F04 | Retain one publication operation/error/three types; keep the staging handle through link/cleanup | source +152; tests/support +623; total +775 |
| F05 | Retain two small parsers; service syntax/domain checks stay local | source +6; tests/support +231; total +237 |
| F06 | Reuse existing inference and remove checked-read wrappers in nine files | source +1; tests/support +156; total +157 |
| F07 | Reject broader option inference after measured experiment; prototype removed | 0 retained |
| F08 | Retain one decoded-byte reader; TC/YT policies and decoding stay local | source +57; tests/support +372; total +429 |

The eight costs sum exactly to source +539, tests/support +1,725 and proof -92.

## Same-capability samples and retained specialization

All six fixed TeamCity/YouTrack list/detail/mutation declarations remain byte-identical spans.
The TeamCity fixture sample remains identical; the YouTrack fixture changes internally while its
12-line bounded sample shape remains. TC/YT proof samples change while retaining their 19/24 fixed
inventories. Both download samples change while retaining service identity, naming, media,
signature and error rules. The wrapper sample changes only for F06 typing; 51 checked reads remain
where names are dynamic or validation is deliberately broad. The old YouTrack `parseBody` anchor
is absent because F05 adopts `jsonParser`; service body validation remains local. RANDOM proof
and its fixed sample remain unchanged.

Also retained: specialized TeamCity verb-inferred test loops outside F02 adoption; TeamCity
persistent two-frame RPC proof; different TC/YT response limits and empty/error/null semantics;
attachment/download size, signature, DTO and filename policies; and the RANDOM service-owned proof.

## Public surface, dependencies and call layers

No dependency was added and no REST operation was added. Core's main export gains
`InferredCommandHandler`, `integerParser`, `jsonParser`, `readBoundedResponseBody`,
`ProfileFileError`, `publishProfileFile` and the three profile-file types. New package subpaths
`./testing` and `./proof` expose the bounded fixture/contract and proof functions/types; the
external package smoke verified exact runtime 21 / proof 2 / testing 6 exports and declarations.

The retained call layers are concrete and shallow:

- integration tests → Core testing helper → actual CLI/profile/store and owned server lifecycle;
- integration proof runner → Core proof invoker → packaged child process/RPC;
- option declaration → Core parser → service-local domain validation;
- service client → Core decoded-byte reader → service-local decoding/status handling;
- service download → Core profile-file publisher → private staging/exclusive publication;
- F06 changes compile-time input typing and adds no runtime layer.

## Accepted functional and final P6 evidence

F04 technical/security/test-audit and independent authoring review passed. Final whole-PR review
closed awaited async inspection and stable same-inode snapshot gaps. Exact-head CI run 33507232691
then passed four jobs but failed Ubuntu 22/24 on one cleanup test because ext4 reused an inode for a
replacement path. The accepted correction retains the original exclusive staging handle through
validation/linking, closes it before identity-checked cleanup, and retains staging if close fails.
Root's corrected local `npm test` built all eight workspaces and passed 1149 tests with zero skips.
Post-correction Core 0.1.0 package smoke also passed from a 97-file tarball (SHA-256 prefix
`53c2bed6`) with exact exports/declarations, synthetic invocation, CI refusal, zero-effect preflight
and cleanup checks.

Final CI [run 33509317357](https://github.com/iXab3r/EyeAuras.CliFactory/actions/runs/33509317357)
passed all six Linux/macOS/Windows Node 22/24 jobs at exact head
`1c4cb3e47634d8156d5a2bf4bd79bc415cb9434b`: 1149 passed, zero failed/skipped per job, aggregate
6894 passed. Implementation/acceptance is complete. Clean merge of PR #15 is the immediate external
action, and Issue #14 remains open until merge.
