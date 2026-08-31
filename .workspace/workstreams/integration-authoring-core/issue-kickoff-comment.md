P0 is prepared on branch `codex/integration-authoring-core` from exact main commit
`b5762f242ff1ea074e33a1c1739190ac4d0ee523`. The new workstream is
`.workspace/workstreams/integration-authoring-core/`; the Issue remains the F01–F08 scope authority.

The reproducible Git-blob baseline includes all eight current workspaces: 207 handwritten TS files,
**18,964 source / 22,585 tests-support / 535 proof lines**, with eight generated IPC files excluded.
It stores hashes and bounded representative excerpts, not another copy of the codebase. TeamCity
already uses real ProfileStore; current disposal/app-owned auth/resources, existing private storage,
RANDOM proof reuse and Core positional inference are reconciled before extraction.

Root baseline prerequisites passed and the local suite passed **1070/1070**, zero failures/skips.
However, existing [main CI run 33416848105](https://github.com/iXab3r/EyeAuras.CliFactory/actions/runs/33416848105)
failed macOS Node 22/24 while four other jobs passed. The observed failures involve IPC canonical
runtime-input test fixtures and RANDOM REST proof/process Unix-socket path length. Read-only diagnosis
confirmed this **three-file test prerequisite**: canonicalize the owned temporary root in
`packages/ipc/tests/build.test.ts` to match require.resolve and shorten its prefix `cli-build-` to
`b-`; shorten prefixes in `integrations/random-rest/tests/process.test.ts` (`random-cli-process-`
to `rr-`) and `proof.test.ts` (`random-live-runner-test-` to `rr-`) to remain within the existing
100-byte Unix-socket limit, including macOS `/private`. No production, CI-skip, fallback or permission
change is included. Local success is not a six-job CI PASS; actual platform verification remains required.

Execution follows P0→P1 fixtures/contracts→P2 proof→P3 parsers/inference→P4 files/responses→P5 option
experiment→P6 consolidation. Each retained extraction needs actual consumer adoption, full-cost
measurement and independent correctness/authoring review before acceptance. F07 may be rejected
with measured rationale and prototype removal. Path-based costs stay comparable; test/proof-only
Core helpers receive separate role attribution rather than manufacturing a runtime-code saving.

No endpoint expansion, real-service writes/downloads or npm release is included. The user authorized
PR, independent review/fixes and merge only when final review and required CI are clean. No acceptance
checkbox or outcome is changed by this kickoff note.
