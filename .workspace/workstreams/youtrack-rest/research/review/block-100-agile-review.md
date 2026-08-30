# Block 100 — agile and sprint technical review

Verdict: PASS for all six B100.5 operations: GET /api/agiles; GET /api/agiles/{agileID}; GET /api/agiles/{agileID}/sprints; POST /api/agiles/{agileID}/sprints; GET /api/agiles/{agileID}/sprints/{sprintID}; POST /api/agiles/{agileID}/sprints/{sprintID}. Four are ReadOnly and two Update. Current-sprint routing is a documented argument value, not another operation or a lookup.

Independently inspected the official agile/sprint resource and method documentation, the published amendment, actual client and mounted command declarations, and all native-fetch MSW tests. The source matches the explicitly narrowed body contract: create requires a nonblank single-line name; update requires an allowed writable field; goal permits empty/multiline text or null; dates permit safe-integer UTC milliseconds or null; flags are booleans. Only creation accepts an explicit previousSprint id. Neither carryover nor default-sprint behavior is inferred. Help explains both transfer of unresolved issues and automatic addition of newly matching issues. Issue-membership writes and notification muting are rejected/deferred.

Defaults are finite and source-shaped: no default project/sprint/issue collection expansion or follow-up. The two collections expose documented offset paging; details and writes expose fields only. Each route argument is independently encoded. Nullable response data and sparse explicit fields pass through shared scrubbing. Empty successful writes return null; malformed/wrong-shaped responses and remote errors remain static and safe. Required body/JSON syntax uses the existing pre-onboarding parser; semantic validation occurs before fetch. Both writes retain per-profile Update denial and no automatic retry.

Independent focused result: **12/12 PASS**, zero skips, from the final coherent build. The tests prove four read routes/default fields/gates, explicit paging/IDs, both writes with exact full and minimal bodies, omission/null/multiline values, invalid field checks, creation-only previousSprint, published help warnings, human/JSON output, credential scrubbing, HTTP 400/401/403/404/409/429/500 without retries, and persistent RPC profile/AppData separation after a denied mutation. Invalid creation-field cases include an otherwise valid name so they exercise the intended field validation. The complete direct-100 offline suites were also independently run: **312/312 PASS**.

| Reviewed file | SHA-256 |
|---|---|
| integrations/youtrack/src/agile.ts | 9E46E18AD652E7E754E3800D9E3DA0C3A9DC2CEEBAC409FAD8CEF4E5E11F47A5 |
| integrations/youtrack/src/agile-commands.ts | F99F2087B83A09B34F01745B550896FBE8EBC13414588AEA88632E7139C43D94 |
| integrations/youtrack/tests/agile.test.ts | 7212D9610AB83966B9067541C2A1DD1744D8CFEF18BAA094601F886A34FBB107 |
| integrations/youtrack/src/cli.ts | A98098075C2672BB10A2CB3CB1E9AE338D4BB98B80A58DF0D1358398B20BBA47 |
| integrations/youtrack/src/index.ts | 8CD38CA3550BED6995DD15D766E3BC4A35EC92F62102F2F8E4788D2704690F2D |

No real service/profile/credential was accessed and no source was edited by this reviewer. The orchestrator owns acceptance counters, live ReadOnly proof and source release. AR100 is separate; this verdict does not release operation 101.
