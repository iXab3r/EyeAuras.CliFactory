# F03 proof mechanics — accepted checkpoint

Root accepted F03/P2 after independent technical/security and authoring PASS. Root built all eight
workspaces and ran **1012/1012 affected tests PASS** (Core 102 / TeamCity 575 / YouTrack 335), zero
failures/skips. This is not a live proof or a fresh final-head platform result.

Relative to checkpoint `952d621a1f9db76ebe8d44aa57017438e9f886ab`:

| Cost | Delta / evidence |
|---|---|
| Core proof mechanism | +103 source-by-path lines, functionally proof-only |
| TeamCity runner | 344→274 (-70) |
| YouTrack runner | 183→161 (-22) |
| Complete proof implementation | 527→538 (+11), no LOC saving |
| Tests/support | +159: Core tests 101 + fixture 37 + TeamCity 21; YouTrack tests unchanged |
| Total handwritten TypeScript | +170 |

Independent review confirmed the fixed 19 TeamCity / 24 YouTrack inventories, TeamCity's two-frame
RPC proof and malformed-reply checks, stronger zero-success/prerequisite handling and service-local
validation/reporting. The shared mechanism is two functions/three types, no framework or dependency;
actual child bounds/reaping/CI/env/privacy tests were examined. Helper SHA at review:
`f87ec38500b5c8e9f2943e62e8eaa7bdf429cbc926c038567e9908ba0a6ce7ce`.
Path counting stays comparable: +103 source, -92 proof scripts, +159 tests; the Core source addition
is not production-runtime growth. External package verification passed for this F03 snapshot: an actual 85-file tarball, SHA
`a036aa4f150d18a22792919fa364ecfa364e60e5b4115fc40a37ad9bc689b8f9`, was installed by real path in a
standalone consumer without links. Default 16 exports and proof two exports loaded no assertions;
proof CI refusal passed. Testing six exports exercised synthetic JSON/two RPC requests/disposal;
strict NodeNext with skipLibCheck false on TypeScript 7 passed. Cleanup passed; build marker
`31824b5ccb1276b90085f3208ea873380939d16d697ffacfd2e1e1fd83bb61a6` remained unchanged.
No network/live/keyring was used; two temporary harness bugs were fixed outside product code.
Final package verification must be repeated after F05/F04/F08 changes.

Separately, the earlier checkpoint `952d621a` passed all six platform jobs in CI run 33425122763,
1089 tests per job, including macOS and the three former fixture failures. This resolves the owned
baseline CI exception for that checkpoint only. Final-head CI and P6 review remain required.
F05 is now released to authoring_types; F04/F08 remain gated. Accepted findings: 5/8.
