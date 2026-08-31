# Block 100 — time metadata contract (seven ReadOnly operations)

Official reference refreshed 2026-08-30; reconciled with the seven existing P1/v1 rows in classification.json and Issue 6. No source, instance, profile, credential or live request was used in research. Root released the reviewed B100.4 manifest before implementation; the seven operations below are implemented and awaiting independent technical acceptance.

| Exact operation | Existing inventory CLI | Default projection |
|---|---|---|
| GET /api/admin/projects/{projectID}/timeTrackingSettings | project time-tracking get <project> | id,enabled,estimate(id,field(id,name)),timeSpent(id,field(id,name)),project(id,name,shortName) |
| GET /api/admin/projects/{projectID}/timeTrackingSettings/workItemTypes | project work-item-type list <project> | id,name,autoAttached |
| GET /api/admin/projects/{projectID}/timeTrackingSettings/workItemTypes/{typeID} | project work-item-type get <project> <type> | id,name,autoAttached |
| GET /api/admin/timeTrackingSettings | time-tracking settings get | id,workTimeSettings(id,minutesADay,workDays,firstDayOfWeek,daysAWeek) |
| GET /api/admin/timeTrackingSettings/workItemTypes | work-item-type list | id,name,autoAttached |
| GET /api/admin/timeTrackingSettings/workItemTypes/{typeID} | work-item-type get <type> | id,name,autoAttached |
| GET /api/admin/timeTrackingSettings/workTimeSettings | time-tracking work-time get | id,minutesADay,workDays,firstDayOfWeek,daysAWeek |

All seven methods document fields, therefore expose --fields and preserve sparse source-shaped objects/arrays. Only the two work-item-type collections document top/skip; reuse one-page defaults50/0, top1..100, skip nonnegative. Detail/settings leaves have no paging or search flags. Encode each project/type as one opaque segment. Use the current recursive declaration, shared connection/fields/page/readObject/readCollection helpers and ReadOnly gate. No settings mutation, lookup, fallback, implicit follow-up or generic schema.

## Official evidence and projection decisions

- [Project settings](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-projects-projectID-timeTrackingSettings.html): estimate, timeSpent and project may be null. Finite nested field/project identities are useful for choosing a period field. Exclude unbounded workItemTypes/attributes from defaults. Source describes timeSpent with the same estimation wording as estimate; preserve property names rather than infer alternate behavior. Read Project Basic is the remote requirement.
- [Project type list](https://www.jetbrains.com/help/youtrack/devportal/resource-api-admin-projects-projectID-timeTrackingSettings-workItemTypes.html) and [project type detail](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-projects-projectID-timeTrackingSettings-workItemTypes.html): id/name/autoAttached are documented, with no nullable annotation. Detail permits Read Work Item, Update Work Item or Create Work Item remotely; this remains a local ReadOnly operation.
- [Global settings](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-timeTrackingSettings.html): id, workTimeSettings and unbounded workItemTypes/attributePrototypes. Default includes only the finite schedule object, not the collections. No nullable annotation. Read Work Item required remotely.
- [Global type list](https://www.jetbrains.com/help/youtrack/devportal/resource-api-admin-timeTrackingSettings-workItemTypes.html) and [global type detail](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-timeTrackingSettings-workItemTypes.html): same WorkItemType fields and pagination distinction; detail requires Read Work Item remotely.
- [Work-time settings](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-timeTrackingSettings-workTimeSettings.html): minutesADay and daysAWeek are integers; workDays is an integer array with Sunday=0; firstDayOfWeek depends on server locale. Preserve server values without locally synthesizing a schedule. No nullable annotation.

The authoritative field tables omit name/url on schedule/type entities even though some sample URLs request them; do not copy those sample-only fields. Global settings sample misspells firstDayOfWeek as firstDatOfWeek; use the WorkTimeSettings attribute table spelling.

## Evidence gate

Offline MSW/client plus actual CLI tests will cover all seven exact methods/paths/defaults, explicit fields, context and encoded IDs, both list pages/empty/oversized output, wrong response envelope, safe remote errors, no extra calls, all seven ReadOnly denials, JSON/human parity and interleaved RPC profile/credential/AppData isolation. Administrative-looking paths do not imply a complete user's token can read them; denial is surfaced safely, never reclassified or treated as success.


## Implementation evidence

Owned source: integrations/youtrack/src/time-settings.ts and time-settings-commands.ts. Owned tests: integrations/youtrack/tests/time-settings.test.ts. The lead mounted the exported project/root command arrays in the actual CLI. Isolated TypeScript compilation and all eight focused tests PASS, covering all seven methods, on 2026-08-30. Output directory integrations/youtrack/dist/time-settings-check is ignored build output; no shared build was run by this author. Real profile/keyring/instance use remains zero. Independent technical acceptance and final repository checks are separate gates.
