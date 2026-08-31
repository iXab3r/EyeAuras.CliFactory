# First checkpoint — F01 fixture and F06 wrapper inference

Status: F01 and F06 accepted by root after independent technical and authoring PASS plus the
1081-test coherent suite. This is not all of P1/P3: F02 is now released; F05 remains unreleased.
Immutable baseline `b5762f242ff1ea074e33a1c1739190ac4d0ee523`, manifest SHA
`3522831f2ef9dbf1fd3fd5e56144d627a20d8661dbc4ff87b4f84576ef10b451` is unchanged.

## Evidence

Root built all eight workspaces and ran the coherent suite: **1081/1081 PASS**, zero failures/skips
(Core 90 / IPC 31 / Playwright 23 / random-pw 6 / random-rest 25 / TeamCity 571 / YouTrack 335).
Final technical review, including stream-type confirmation, passed. Independent
authoring review did not rerun builds/tests; it inspected and recounted actual source and samples.
The three baseline CI fixture corrections pass the local Windows suite; actual macOS CI remains
pending and the earlier main CI failure is not retroactively relabelled green.

## Separate authoring verdicts

| Finding | Independent verdict | Complete cost / behavior attribution |
|---|---|---|
| F01 | PASS, no simplification blocker | Shared testing mechanism +129 source-by-path lines; existing changed TC/YT tests 6,153→6,036 (-117). Mechanism/adoption net +12, plus 186 new fixture-test lines: total TS +198. Adapter subset 146→51 (-95) is included in -117, not another saving. |
| F06 | PASS, no simplification blocker | Measured production slice 3,193→3,194 (+1), plus 156 new compiler/runtime test lines. 253 checked positional reads converted across nine consumer modules; 51 remain deliberately broad (49 dynamic names / two broad validators). |

F01's 129 lines live under Core src for stable path counting but are functionally test-only, not
production-runtime expansion. Its accepted rationale is less duplicated lifecycle/setup knowledge
and stronger cleanup/isolation, not a LOC saving. Testing-source SHA reported by the independent
reviewer, including the typed-runtime intersection correction:
`fcb50cd4dd10b1703b819409d2859a8c02032228730ccbd6af5431e65f59d707`.

F06 preserves existing inference grammar and all six baseline command declarations; YouTrack direct
declarations remain unchanged. The reviewer matched every consumer edit to checked-read→direct-read
with line structure preserved. This is an authoring/type benefit, not a physical-line reduction.

Combined current path totals: **19,094 source / 22,810 tests-support / 535 proof**, versus baseline
18,964 / 22,585 / 535. Of the +130 source lines, 129 are the test-only fixture mechanism and one is
F06; tests/support net +225. No endpoint is added. F01/F06 attribution stays separate from the
three-file baseline fixture prerequisite and the temporary F07 experiment.

## Acceptance and remaining work

Root received final independent technical PASS and accepted F01/F06: **2/8 findings complete**.
F02 is released to `authoring_testing` as the next dependent extraction. P1 remains in progress;
P3 is partial because F05 is unreleased. Final platform CI, export/package checks and P6 closure
remain later gates. No commit, PR, merge or whole-phase completion is implied by this checkpoint.
