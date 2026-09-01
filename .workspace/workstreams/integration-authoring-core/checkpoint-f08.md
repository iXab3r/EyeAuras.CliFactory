# F08 bounded response reader — accepted checkpoint

Root reports all eight workspaces built and **1043/1043 affected tests PASS** (Core 115 /
TeamCity 584 / YouTrack 344), zero failures/skips. Independent technical/security review passed.
Independent authoring/simplicity review also passed, and root accepted F08: 7/8 findings are
accepted. F04 is released to authoring_streams; final package, full-suite, review and final-head CI
gates remain pending. No final-head platform or package verification is claimed.

Relative to `6b2752cdc0af5005832c55364266911761d76f44`:

| Cost | Evidence |
|---|---|
| Production | +57: Core helper 54 + index export 1; TeamCity client -10; YouTrack client +12 |
| New tests | +372: Core 163 / TeamCity 101 / YouTrack 108 |
| Total handwritten TypeScript | +429; no net LOC saving |

Independent authoring review verified production 4286→4343 (+57), the separate +372 tests,
and the seven TypeScript hashes below. One byte-reader API and the growth/copy logic are justified
by both real consumers and reused-buffer/empty-chunk tests; no new dependency or framework.

The reader bounds actual decoded bytes while service-local decoding preserves existing BOM,
status, error and empty/null behavior. TeamCity keeps its 2 MiB bound; YouTrack adopts the
published 8 MiB bound. Encoded Content-Length is not treated as decoded length. Review corrections
closed owned-buffer retention/reuse and compressed-header coverage. Six initial TeamCity test
constructions omitted the required token; tests were fixed without production changes.

The following SHA-256 values pin current filesystem bytes before F04 touches shared exports/docs.
They supplement, and do not replace or reclassify, the immutable Git-blob measurement baseline.

| Path | SHA-256 |
|---|---|
| packages/core/src/response-body.ts | c7ee4672b1a351c4c4c7aa58267c0a5e786a44916f24daa427080063cb7b7e79 |
| packages/core/src/index.ts | 3c8ce16af14921057495e2b02ddfdcd13004ce7f0b3063f296b42f730b31cdb2 |
| integrations/teamcity/src/client.ts | dc6ce4ea4685a76a74c2377ffc4dcd725ce15e1be04efcf06714651b7598bebf |
| integrations/youtrack/src/client.ts | ef76f3cda66ee304dc27fc7fc1b29632eaad5b96dcdb8ba2bcff90310b579699 |
| packages/core/tests/response-body.test.ts | 01597fe7e82c84ed93d181c8729f493f120b2d903f283416b7e7a2fd3cbf567c |
| integrations/teamcity/tests/response-body.test.ts | b980512adde080a7187e0edbb1c62bdec21841122b95de88dfaa1025b5a00406 |
| integrations/youtrack/tests/response-body.test.ts | 9acf12b106896366e563681a63f808aa851cab07c23d0402dc2dbecae6714020 |
| docs/DESIGN.md | cf5d76a268ef3295748b5816c7d66e8b404bed6ac2648e6888f77c81d23cc790 |
| docs/integrations.md | 0411fdfdaddcaa0bf7681333fae39807eae2b7ee599c77eeff252e4575cf87fd |
| docs/testing.md | b33bc23468cee174c4f896c0cf83cc30c569f7c633a2083f93b5124ea10e045b |
| integrations/teamcity/README.md | fc0e5e1a1527b6667deb6e5c8fe52f206ec9348835c7700e8ce94301fe51f117 |
| integrations/youtrack/README.md | a3b0d89c4be703d7c176f1c181d44ed129f927babfb243a41fa5079aafcc2001 |
