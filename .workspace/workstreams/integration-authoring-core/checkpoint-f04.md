# F04 profile-owned file publication — accepted checkpoint

Before whole-PR review corrections, root reported all eight workspaces built and **1062/1062 affected tests PASS**
(Core 131 / TeamCity 586 / YouTrack 345), zero failures/skips. Independent technical/security review, final test audit and independent authoring/simplicity
review passed. Root accepted F04: all F01–F08 findings are accepted.

Two test-only correction cycles closed implicit-any/exclusive-flag coverage and replaced fake gzip
bytes with a synthetic encoding. No production change is attributed to those corrections.

Final current cost is production +152 and tests +623, total +775 handwritten TypeScript.
Direct service-local publication code remains 474→261 (-213).
Direct service-local publication reduction is accepted as a bounded simplification, not a whole-workstream LOC saving.
The candidate adds no dependency, framework or REST operation.

Final whole-PR review found and closed two F04 issues: async response inspection is now awaited,
and same-inode validation compares a stable snapshot. Adversarial regressions cover both. The
hashes below pin the corrected frozen F04 direct files and shared files changed after F08.

| Path | SHA-256 |
|---|---|
| packages/core/src/profile-file.ts | d4d8621101bd54a075f8f5beb683a76caddcf4360ca283a78268d9ae3b72dd42 |
| packages/core/src/response-body.ts | f97ee52791ab807d8a95acebfb3e121e8836e827cb88db46dcfecc8225357f9e |
| packages/core/src/index.ts | c915e0b91efc179e0b02c1ae06ca87353b868f81df819023494f27cea1046ac6 |
| packages/core/tests/profile-file.test.ts | 429add8d37001deaa7dab5c2f21c96033a3c4213a1681a1bcbc9238e98e16af0 |
| integrations/teamcity/src/downloads.ts | fd577a19b9e93cbde940aba8590399c6dab627ddb6228fa0f0ea7cd9fd810715 |
| integrations/teamcity/src/client.ts | 182a05304a7fc6f056e2c0dd2183cb237db03a08baabfd4064292ba82ba711bd |
| integrations/teamcity/tests/files.test.ts | cc10c48156b0367d16847fa5ec703e704012855f38f4e51306446401da86e4dd |
| integrations/youtrack/src/attachment-download.ts | c6db5a9dfbc9f592e2846e8e850a4c23692071619c6d1c14764f7c40906709c3 |
| integrations/youtrack/tests/attachment-download.test.ts | 5d32504749fbc78c9f6920b75a02c3729d04edae76e28baef503fc7d24bc37fc |
| docs/DESIGN.md | e0b86acae258b7d27a4c8a8fd678e50792708ff72827731a57d7cf905bfa79bc |
| docs/integrations.md | d8acf6ca507fb14c357da5c3c04a269e76130802415a2342d42d744c1965d3fb |
| docs/testing.md | 2258bf0cd580820d773f0dcb421c72478a0f29e1df8581b538e441f6c6056a8a |
| integrations/teamcity/README.md | 07178e90c4da65e666e47441e354ea7c463bfb3258b069d399b849a6a12820dc |
| integrations/youtrack/README.md | 6422e44e9c78561a7741f42f5802074df4dbf77e879a57adc7ae6b0a536842bb |

After both review fixes, cross-PR static review passed with no findings. Exact-head CI
[run 33507232691](https://github.com/iXab3r/EyeAuras.CliFactory/actions/runs/33507232691)
at `c8ab55da07dd117d6525c8d25a4f3ea58beda46c` passed four jobs but failed Ubuntu Node 22/24:
ext4 inode reuse exposed that path cleanup could remove a replacement after the original handle
closed. The accepted correction keeps the exclusive staging handle through validation/linking,
snapshots through the handle, closes successfully, rechecks the path and only then unlinks.
Root's corrected local `npm test` built all eight workspaces and passed **1149/1149 tests**
(Core 133 / IPC 31 / Playwright 23 / random-pw 6 / random-rest 25 / TeamCity 586 / YouTrack 345),
zero failures/skips.

Post-correction external package smoke passed with actual Core 0.1.0 and a 97-file tarball
(SHA-256 prefix `53c2bed6`; installed-file receipt prefix `8beed1`; marker SHA prefix `1369244`;
harness prefix `99A5`). Offline isolated installation, exact runtime 21 / proof 2 / testing 6
exports, strict installed declarations including F04/F08/parsers, synthetic CLI/JSON/RPC/disposal,
proof CI refusal, zero-effect file preflight and cleanup all passed. No live service or keyring was
used. New exact-head CI remains required.
