# PV3 independent authoring baseline

Status: baseline captured; no trial accepted. Reviewer: inventory_reviewer.

Immutable accepted PV2 commit: 3df5066f8d3cc1038570bf6005db32aa4ff47655 on feature/youtrack-v1. This supersedes the proposal's earlier discovery counts; PV2 correctness repairs are already included and must not be attributed to PV3. Existing118 REST operations plus separate download remain unchanged; the trial adds no endpoint.

Companion pv3-authoring-baseline.json SHA256 3CE3705D1387DB6ADEB928A219607CF5E6822BD31AE252453202570C5CADF8D7 records104 committed TypeScript files with Git blob IDs, raw byte SHA256, metrics and exact sample spans. It stores no duplicated source. Reproduce any file with native Git: git show 3df5066f8d3cc1038570bf6005db32aa4ff47655:path. Enumerate the same surface with git ls-tree -r at that commit under packages/core and integrations, retain .ts files outside dist; /src/ is production, /integration-tests/ is local proof, remaining test/fixture paths are tests/support. All current104 paths follow these conventions.

## Whole committed cost

| Surface | Production nonblank TS | Tests/support nonblank TS | Local proof nonblank TS | Production LF characters |
|---|---:|---:|---:|---:|
| Core |1779|1435|0|63862|
| TeamCity |1100|1556|330|35550|
| YouTrack |4025|5876|183|141609|
| Total |6904|8867|513|241021|

Nonblank physical TypeScript lines are primary, include comments, and exclude generated output. Character counts remove an initial BOM and normalize CRLF to LF; the unit is UTF-16 code units, with LF UTF-8 byte counts also stored. Production LF UTF-8 bytes total241033. Raw Git blob hashes remain separate from normalization, so CRLF checkout differences cannot manufacture a saving.

There are129 exact String(args.<name>) wrappers in production:118 YouTrack and11 TeamCity. Removing just their syntax removes1032 ASCII characters (eight each), not necessarily any physical line. Report this separately from the net whole-source character/line delta after all Core types, exports and assertions are counted. No source reduction is promised.

## Fixed same-capability samples

Each span includes the complete declaration (help, permission and options) or complete client function. Shared setup/client/helper/type costs are counted in the whole-source totals; these local sample sums do not pretend that shared setup is free. All line ranges below refer to the immutable commit, not the current checkout.

| Sample | Declaration span | Lines | Client span | Lines | Local total |
|---|---|---:|---|---:|---:|
| YT collection unchanged control |integrations/youtrack/src/cli.ts:125-136|12|integrations/youtrack/src/client.ts:310-318 listIssues|9|21|
| YT detail |integrations/youtrack/src/cli.ts:137-143|7|integrations/youtrack/src/client.ts:320-328 getIssue|9|16|
| YT positional mutation |integrations/youtrack/src/cli.ts:118-124|7|integrations/youtrack/src/client.ts:410-423 updateIssue|14|21|
| YT create unchanged control |integrations/youtrack/src/cli.ts:111-117|7|integrations/youtrack/src/client.ts:397-408 createIssue|12|19|
| TC collection unchanged control |integrations/teamcity/src/cli.ts:193-212|20|integrations/teamcity/src/client.ts:168-185 listProjects|18|38|
| TC detail |integrations/teamcity/src/cli.ts:213-218|6|integrations/teamcity/src/client.ts:187-193 getProject|7|13|
| TC positional mutation |integrations/teamcity/src/cli.ts:251-269|19|integrations/teamcity/src/client.ts:363-379 runJob|17|36|

The JSON stores independent LF hashes and character counts for each span. Proposal YouTrack client anchors were reidentified after PV2 changes; declaration and TeamCity anchors remain the same. Preserve list/create unchanged controls rather than imply every operation becomes cheaper. TeamCity numeric domain validation must remain; this is not a request to weaken positiveInteger or service ID validation.

## Simplicity review contract

Read current root/Core/integration AGENTS, DESIGN, authoring-review practice and the proposal before capturing evidence. Judge the final trial on the existing command literal and both actual products, not hypothetical future consumers. No new binder, HTTP layer, runtime dispatch/parser, consumer DSL or duplicated argument schema is justified. Options stay unknown; unsupported/dynamic declarations should remain conservative.

A few private type helpers and one localized stored-handler erasure may be acceptable if technical review proves soundness, existing annotations/command arrays remain usable and normal consumer callbacks require no extra annotations. Inspect actual public concepts, generic/type recursion, assertions and diagnostics rather than using a line threshold alone. Full production cost can grow while the existing authoring surface becomes simpler and catches misspelled positional names; label that outcome honestly. Reject a substantial type parser, assertion scaffolding or new runtime layer introduced to remove simple conversions.

No builds, production edits, live calls, profile/keyring access, GitHub publication or commits by this authoring reviewer. Technical type/runtime correctness and default-suite execution belong to review_common_types/root; their exact evidence will be attributed in the final authoring verdict.
