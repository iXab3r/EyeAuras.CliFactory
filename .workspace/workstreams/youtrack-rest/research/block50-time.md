# B50.5 — work items and time tracking contract refresh

Research date: 2026-08-30. Official documentation only; no instance or credentials used.
This schedules seven existing v1 operation identities; it does not accept them.

## Authoritative methods

- [Time tracking detail](https://www.jetbrains.com/help/youtrack/devportal/operations-api-issues-issueID-timeTracking.html): GET `/api/issues/{issueID}/timeTracking` with fields; default `id,enabled`, deliberately omit embedded workItems.
- [Issue work-item collection/create](https://www.jetbrains.com/help/youtrack/devportal/resource-api-issues-issueID-timeTracking-workItems.html): GET collection uses fields, top, skip; POST requires duration expressed in minutes or presentation.
- [Issue work-item detail/update](https://www.jetbrains.com/help/youtrack/devportal/operations-api-issues-issueID-timeTracking-workItems.html): GET and POST `/api/issues/{issueID}/timeTracking/workItems/{itemID}`. DELETE is documented but outside this seven-operation group.
- [Global work-item list](https://www.jetbrains.com/help/youtrack/devportal/resource-api-workItems.html): GET `/api/workItems`; fields/top/skip plus query, date interval strings, date/creation/update timestamp intervals, and repeated author/creator parameters are documented. These filters are not documented on the issue-local list.
- [Global detail](https://www.jetbrains.com/help/youtrack/devportal/operations-api-workItems.html): GET `/api/workItems/{itemID}` with fields.

Default work-item projection proposal: `id,date,duration(minutes,presentation),text,type(id,name),author(id,login),issue(id,idReadable)`. Explicit projection retains sparse/nullable source fields. Nullable attributes include author, type, text and updated. No eager nested collection or follow-up fetch. Offset collections use the existing one-page top50/skip0 policy, max100.

## Mutation details and ambiguities requiring explicit reconciliation

The create method specifically accepts duration.minutes or duration.presentation. The [DurationValue entity](https://www.jetbrains.com/help/youtrack/devportal/api-entity-DurationValue.html) labels both read-only; the more specific work-item method takes precedence for the writable input. The method gives no precedence when both are supplied. Do not invent conversion from presentation: server locale/settings determine its interpretation.

The work-item table lists duration, date, text, author, type, created and updated without read-only flags. Read-only fields include id, creator, textPreview, issue and attributes. Null is documented for author/type/text/updated, not duration/date/created. Dates are milliseconds UTC; the server normalizes the work-item date's time part. Preserve supplied timestamps and omit absent date/author; never manufacture current time or user identity. Preserve multiline narrative.

Reconciliation questions resolved before affected implementation: duration dual-field ambiguity, exact optional body scope, and global filter subset. The approved decisions are recorded below. The manifest's phrase excluding global search flags is inaccurate if read as a documentation claim: global query is documented. No speculative work-type discovery endpoint is added.

## Approved implementation decisions

The orchestrator approved the exact seven operations. Global list exposes documented query plus fields/top/skip; date/timestamp and repeated author/creator filters remain optional future flags. Issue-local lists expose no search flag. Create/update accept duration, date, author, type, text, created and updated. Duration requires at least one of minutes/presentation and accepts both without inventing precedence; each supplied field is validated. Minutes are nonnegative Int32 values, timestamps safe integer milliseconds, and text preserves multiline/empty values. Null is accepted only for the documented nullable fields. Identity selectors use explicit id objects (or nullable references), with no name lookup or implicit user/date default. All writes retain fixed finite default fields and explicit --fields. No silent notification option or API fallback is added. These choices fit the published Issue contract; no scope amendment was required.

