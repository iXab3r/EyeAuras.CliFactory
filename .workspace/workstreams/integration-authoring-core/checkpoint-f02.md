# F02 contract helpers — accepted checkpoint

Status: independent technical and authoring PASS; root accepted F02. P1 is complete.
Root built all eight workspaces successfully and ran **1004 affected tests PASS** (Core 95 /
TeamCity 574 / YouTrack 335), zero failures/skips. This is not a fresh all-workspace test or CI claim.
The fixture prerequisite's actual macOS CI evidence remains pending.

Independently verified incremental cost versus accepted F01 is **206 TypeScript lines**: 90 helper
lines plus one export, 84 new Core test lines and 31 consumer lines. No line saving is claimed. Test-only helper code remains source
by the frozen path method, with its functional test role reported separately. Do not add F01's
fixture cost again or confuse total branch growth with this extraction.

Five ordinary assertion helpers are used by both actual consumers without an MSW dependency in the
helper surface. Independent review confirmed explicit permissions, exact per-mode request counts,
RPC/profile/security expectations and meaningful wrong-expectation/extra-request/denial evidence,
including the actual TeamCity swallowed-MSW-assertion rehearsal.

Consumer slice: 1,337→1,368 (+31): TeamCity authoring 636→626 (-10), operator 421→480 (+59),
YouTrack catalog 132→121 (-11), work-time 148→141 (-7). Minor expected-object reflow contributes
to local decreases and is not credited as pure removed glue. Older TeamCity verb-inferred loops
outside the selected adoption remain unchanged and explicitly specialized/deferred, not falsely
represented as converted by this checkpoint. All 91 Core src lines are functionally test-only.

Root accepted F02 after the separate independent verdicts: **4/8 findings complete** (F01, F02,
F06, F07), with P1 done. F03/P2 awaits explicit release after the first checkpoint commit; it is
not yet implementation work. Actual platform CI and remaining P6 gates stay open. Management
changed no source or immutable baseline.
