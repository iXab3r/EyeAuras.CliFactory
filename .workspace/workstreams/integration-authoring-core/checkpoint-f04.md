# F04 profile-owned file publication — accepted checkpoint

Before whole-PR review corrections, root reported all eight workspaces built and **1062/1062 affected tests PASS**
(Core 131 / TeamCity 586 / YouTrack 345), zero failures/skips. Independent technical/security review, final test audit and independent authoring/simplicity
review passed. Root accepted F04: all F01–F08 findings are accepted.

Two test-only correction cycles closed implicit-any/exclusive-flag coverage and replaced fake gzip
bytes with a synthetic encoding. No production change is attributed to those corrections.

Independent authoring review verified final production +138 and tests +590, total
+728 handwritten TypeScript. Direct service-local publication code is 474→261 (-213).
Direct service-local publication reduction is accepted as a bounded simplification, not a whole-workstream LOC saving.
The candidate adds no dependency, framework or REST operation.

Final whole-PR review found and closed two F04 issues: async response inspection is now awaited,
and same-inode validation compares a stable snapshot. Adversarial regressions cover both. The
hashes below pin the corrected frozen F04 direct files and shared files changed after F08.

| Path | SHA-256 |
|---|---|
| packages/core/src/profile-file.ts | 74c6ac29fdf3eb60ee29160349cd8e0969c865deb8811fec9274f3fc2977a423 |
| packages/core/src/response-body.ts | f97ee52791ab807d8a95acebfb3e121e8836e827cb88db46dcfecc8225357f9e |
| packages/core/src/index.ts | c915e0b91efc179e0b02c1ae06ca87353b868f81df819023494f27cea1046ac6 |
| packages/core/tests/profile-file.test.ts | 374a99cd4234b7b2a63b40b6a06cdbcd6a11de916b727692186dd32bf08ed04e |
| integrations/teamcity/src/downloads.ts | fd577a19b9e93cbde940aba8590399c6dab627ddb6228fa0f0ea7cd9fd810715 |
| integrations/teamcity/src/client.ts | 182a05304a7fc6f056e2c0dd2183cb237db03a08baabfd4064292ba82ba711bd |
| integrations/teamcity/tests/files.test.ts | cc10c48156b0367d16847fa5ec703e704012855f38f4e51306446401da86e4dd |
| integrations/youtrack/src/attachment-download.ts | c6db5a9dfbc9f592e2846e8e850a4c23692071619c6d1c14764f7c40906709c3 |
| integrations/youtrack/tests/attachment-download.test.ts | 5d32504749fbc78c9f6920b75a02c3729d04edae76e28baef503fc7d24bc37fc |
| docs/DESIGN.md | e43c8e82cc309c80dba833859dd2a2e9e42bff835e340e8b20304976a423d286 |
| docs/integrations.md | c0094ae219e9a07eb498a58b371b2b28db246af71b1fe97802c5a6d88c3e4fbf |
| docs/testing.md | 2258bf0cd580820d773f0dcb421c72478a0f29e1df8581b538e441f6c6056a8a |
| integrations/teamcity/README.md | 07178e90c4da65e666e47441e354ea7c463bfb3258b069d399b849a6a12820dc |
| integrations/youtrack/README.md | 6422e44e9c78561a7741f42f5802074df4dbf77e879a57adc7ae6b0a536842bb |

After both review fixes, final cross-PR static review passed with no findings. Root's exact
post-review `npm test` built all eight workspaces and passed **1148/1148 tests** (Core 132 / IPC 31 /
Playwright 23 / random-pw 6 / random-rest 25 / TeamCity 586 / YouTrack 345), zero failures/skips.

Corrected external package smoke passed with an actual Core 0.1.0, 97-file tarball
(SHA-256 `5030706b8cb6ef4be6e396664f58e08a46a8dfdf3673de0e27cd2f6846983105`).
It installed offline by real path without links/private paths. Exact runtime 21 / proof 2 /
testing 6 exports, strict TypeScript 7 declarations including awaited async `inspectResponse`,
F04/F08/parsers, synthetic CLI JSON /
two RPC / disposal, proof CI refusal, and file preflight with zero filesystem/network effects all
passed. Cleanup passed; build marker
`09cd57d41aedc4bfe9c228124c9877ca8b36b2bb5a8aca29ffbfbc6e4cf415db` was unchanged.
No live service, keyring or repository edit was used. Final platform CI remains pending.
