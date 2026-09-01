# F05 parsers — accepted checkpoint

Root accepted F05/P3 after independent technical and authoring PASS. All eight workspaces built;
**1020/1020 affected tests passed** (Core 105 / TeamCity 578 / YouTrack 337), zero failures/skips.
This does not claim a fresh final-head platform run or live proof.

Costs isolated from F03:

| Cost | Evidence |
|---|---|
| Production slice | 668→674 (+6): Core parser 29 + export 1; TeamCity CLI -20 / support -3; YouTrack support -1 |
| New tests | +231: Core 77 / TeamCity 93 / YouTrack 61 |
| Existing test edits | Two YouTrack regex updates, zero LOC delta |
| Total handwritten TypeScript | +237; no net LOC saving |

Two small parser factories reuse existing option parsing, with no DSL or dependency. Both real
consumers preserve their service grammars, defaults, domain checks and repeated validation.
TeamCity static error normalization and YouTrack rejection before onboarding are explicit
published decisions, not hidden behavior changes.

The initial test assumption about null was corrected: the pure JSON parser preserves JSON null,
while Commander's existing required-option boundary converts top-level null to an empty string.
Regression tests and docs now distinguish those paths; no production workaround or shim was added.
The corrected Core test SHA is
`d2c906a21f7e7293a582ef627bc2b2c6bee8cb5b962bd09ac984c66ae135c682`.

P3 is complete, with six findings accepted. F03/F05 are ready for the second checkpoint commit;
that commit is not yet claimed. P4 remains gated until root releases F08 first, then F04.
Final package verification, full-workspace tests and final-head platform CI remain P6 obligations.
