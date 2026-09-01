# Exact authoring baseline

Revision: `b5762f242ff1ea074e33a1c1739190ac4d0ee523`; tree `218880c2a37f32b9189641a4ae2649a3af3e939b`. Baseline JSON SHA-256 `3522831f2ef9dbf1fd3fd5e56144d627a20d8661dbc4ff87b4f84576ef10b451`.
This is the P0 current-main baseline, not Issue #14's historical f7a482f discovery table.

| Workspace | Source TS lines | Tests/support TS lines | Local proof TS lines | TS files |
|---|---:|---:|---:|---:|
| integrations/random-common | 511 | 0 | 0 | 9 |
| integrations/random-pw | 178 | 459 | 4 | 10 |
| integrations/random-rest | 215 | 733 | 4 | 12 |
| integrations/teamcity | 9,636 | 9,694 | 344 | 58 |
| integrations/youtrack | 4,030 | 5,980 | 183 | 67 |
| packages/core | 2,521 | 3,088 | 0 | 31 |
| packages/ipc | 1,299 | 1,420 | 0 | 14 |
| packages/playwright | 574 | 1,211 | 0 | 6 |
| Total | 18,964 | 22,585 | 535 | 207 |

Native Git `ls-tree` enumerates committed files and `cat-file --batch` reads exact blobs. The manifest
stores Git blob IDs, SHA-256, byte counts and nonblank handwritten TypeScript lines including comments.
BOM/LF normalization affects only supplementary character metrics, not blob hashes. All eight npm
workspaces are included. Eight `packages/ipc/src/generated/**` files are excluded explicitly;
workstreams, dist and dependencies are excluded. No build output or old source snapshot is counted.

234 non-generated workspace files are hash-manifested: 207 TypeScript and 27 other setup/config/fixture
files. TypeScript source/tests/proof are classified by `src/`, `tests/` and `integration-tests/` paths;
RANDOM service proof under `random-common/src/proof.ts` remains production and is not double-counted.
Non-TypeScript setup cost is visible through file hashes/bytes but not misrepresented as TS LOC.

Fifteen fixed samples include complete list/detail/mutation declaration spans for both target
integrations, plus bounded fixture/proof/download/wrapper excerpts. Span hashes and line locations
allow reconstruction from the fixed commit; only short excerpts are saved, not another codebase.
Full helper/setup files remain in total costs. After each retained extraction, compare equivalent
samples and full Core plus changed consumers; report tests/support/proof and conceptual cost separately.

Reproduce without editing the frozen baseline:

```text
python .workspace/workstreams/integration-authoring-core/capture-baseline.py --stdout
```

The script intentionally pins the revision; it cannot silently relabel another commit as this
baseline. Compare parsed output with `baseline.json` (ordering/line endings are not metrics).
A future after-manifest must be separately named and state its actual source provenance.

Refreshed occurrence leads: TC `text(args, ...)` 304, YT `readOptions(options)` 104, YT
`await connection(context)` 117, and TC/YT tests `setupServer(` 42. These are occurrence counts,
not removable lines or quotas. P0 source build/test results are supplied by root, not this script.

Functional-role attribution is supplementary to these immutable path totals. Future Core test/proof
entry points under src remain in the source count; separately identify their test/proof-only role.
Do not reclassify this baseline or call moving test code into Core a production saving.
