# Block 50: project/user context and typed issue fields

Reviewed 2026-08-30 from official JetBrains references. This note covers exactly B50.2's seven method/path identities; root approved this compatible pinning of the existing Issue contract before source implementation.

## Read contracts

- `GET /api/admin/projects/{projectID}` accepts database ID or short name. Default projection: `id,name,shortName,description,archived`; description can be null.
- `GET /api/admin/projects/{projectID}/customFields` and its `/{fieldID}` detail inspect project settings. Default: `id,field(id,name,fieldType(id,valueType,isMultiValue)),canBeEmpty,emptyFieldText,isPublic`. `field` and empty text can be null. Cardinality belongs to `field.fieldType.isMultiValue`; no invented direct `multi` property. No automatic bundle/value crawl.
- `GET /api/users` defaults to `id,login,fullName`; no email in defaults.
- `GET /api/issues/{issueID}/customFields` and its `/{fieldID}` detail default to `id,name,$type,value(id,name,login,minutes,presentation,text),projectCustomField(id)`. Values retain primitive, object, array and null shapes. State-machine transitions are requested explicitly with `--fields 'id,name,$type,value(id,name),possibleEvents(id,presentation)'`, without a hidden lookup.
- Collection commands use one bounded page: top 1..100, default 50; skip nonnegative safe integer, default 0. Detail commands have projection only. All identifiers are one encoded opaque segment under the configured context path. Explicit projections retain sparse source shapes.

## Approved update contract

`POST /api/issues/{issueID}/customFields/{fieldID}` (`issues fields set`) requires `--body` with `$type` and a value, except state-machine fields use an event. Only the named properties below are accepted. No `muteUpdateNotifications`, read-only root metadata, unknown types, arbitrary nested payloads, retries or automatic identity resolution.

| Issue `$type` | Body value |
|---|---|
| SingleEnum, SingleBuild, SingleVersion, SingleOwned, SingleGroup (each suffixed IssueCustomField), and StateIssueCustomField | null, or a reference containing one or more nonempty `id` or `name` |
| SingleUserIssueCustomField | null, or a reference containing one or more nonempty `id`, `login` or `name` |
| MultiEnum, MultiBuild, MultiVersion, MultiOwned, MultiGroup (each suffixed IssueCustomField) | array of the corresponding references; `[]` clears |
| MultiUserIssueCustomField | array of user references; `[]` clears |
| SimpleIssueCustomField | null, string, or finite number; server enforces the project's string/integer/float/date-time subtype |
| DateIssueCustomField | null or safe integer timestamp in milliseconds; caller supplies the documented UTC-midday date representation, no implicit conversion |
| PeriodIssueCustomField | null, one or both `minutes` (integer 0..2147483647) or nonempty `presentation` |
| TextIssueCustomField | null, or `{ "text": string-or-null }`, preserving empty and multiline text |
| StateMachineIssueCustomField | `event: { "id": nonempty-string }`; `value` is rejected |

All 18 documented concrete classes are supported, with a narrow writable projection for each value object. Nested response-only attributes and unsupported selectors are rejected locally. Multiple documented identity selectors and both period representations are preserved as given; the client does not invent precedence or prohibit combinations that the docs permit. Empty success returns null; nonempty success is a scrubbed source-shaped object. Read-only field metadata can remain unavailable under a limited-rights token; errors remain errors.

## Reference reconciliation

The operation tables and syntax specify `/customFields/`; some samples still show `/fields/`. Use the declared route only. The base field prose and current type-mapping guide require `$type` although one enum example omits it. State-machine `event` is marked read-only in the entity table but its prose and update example explicitly require it for writes; follow the explicit operation contract. Period/text value entity tables likewise describe read shapes, while the custom-field concept guide supplies their writable value forms. Multi-value subclass tables specify arrays, without nullable annotation; use `[]`, not null, to clear them.

## Official sources

- [Project detail](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-projects.html)
- [Project fields](https://www.jetbrains.com/help/youtrack/devportal/resource-api-admin-projects-projectID-customFields.html)
- [Project field detail](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-projects-projectID-customFields.html)
- [Users](https://www.jetbrains.com/help/youtrack/devportal/resource-api-users.html)
- [Issue fields](https://www.jetbrains.com/help/youtrack/devportal/resource-api-issues-issueID-customFields.html)
- [Issue field read/update and event example](https://www.jetbrains.com/help/youtrack/devportal/operations-api-issues-issueID-customFields.html)
- [Current type mapping and writable value examples](https://www.jetbrains.com/help/youtrack/devportal/api-concept-custom-fields.html)
- [State machine](https://www.jetbrains.com/help/youtrack/devportal/api-entity-StateMachineIssueCustomField.html)
- [Multi-value](https://www.jetbrains.com/help/youtrack/devportal/api-entity-MultiValueIssueCustomField.html)
- [Date](https://www.jetbrains.com/help/youtrack/devportal/api-entity-DateIssueCustomField.html)
- [Period](https://www.jetbrains.com/help/youtrack/devportal/api-entity-PeriodIssueCustomField.html)
- [Text](https://www.jetbrains.com/help/youtrack/devportal/api-entity-TextIssueCustomField.html)
- [Text value](https://www.jetbrains.com/help/youtrack/devportal/api-entity-TextFieldValue.html)
- [Event identity](https://www.jetbrains.com/help/youtrack/devportal/api-entity-Event.html)


## AR50 correction

After the direct snapshot, period minutes gained an explicit nonnegative Int32 CLI validation policy (0..2147483647), inferred from the official PeriodValue Int declaration and aligned with the time-tracking CLI policy. The entity page does not state the numeric server limit. A boundary regression covers accepted zero/maximum and local rejection above it. This is a correctness correction, not equivalent-behavior authoring savings. Presentation validation remains unchanged; PeriodValue and time-tracking DurationValue have not been merged into an abstraction. Production formatting was expanded to the readable baseline independently of the behavior correction.


Source for the type declaration: [PeriodValue](https://www.jetbrains.com/help/youtrack/devportal/api-entity-PeriodValue.html).

