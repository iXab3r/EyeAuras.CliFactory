# Issue-domain research — 2026-08-30

This is source evidence and proposed classification for reconciliation, not a second feature specification. The eventual GitHub issue owns accepted scope. No service instance, credentials or production code were used.

## Coverage and identity

Read 51 official resource/reference pages linked from [Resources](https://www.jetbrains.com/help/youtrack/devportal/api-resources.html), plus official use cases and entity/command references. Found 80 unique HTTP method + path operations in this domain: 41 GET, 27 POST, 12 DELETE; semantic categories are 44 ReadOnly and 36 Update. Proposed priorities: p0 8, p1 36, p2 33, p3 3. This is a domain slice, not the entire YouTrack API.

operations.json preserves generated request-syntax facts independently from classifications.json human judgment. Query templates are source facts, not CLI syntax. Singleton resource overview pages without methods are not separate operations. The deprecated /api/issueTags overview has no declared method and is recorded below, not counted as an active operation.

## Priorities and proposed command surface

p0 supports the core issue loop: list/get/create/update issues; read/add comments; apply commands and inspect command suggestions. p1 adds common triage/context operations: field values, issue links and link-type discovery, attachment metadata/upload/download, comment editing, tags on issues, cursor history, saved-query lookup, count/search suggestions, work items, sprint and VCS context. p2 covers less frequent cleanup, reactions, saved-query/tag administration and redundant scoped operations. p3 covers global link-type schema mutation. Every active operation has an explicit priority, release, permission and command leaf in classifications.json.

All command names are proposals for review. Parent command arguments should identify the relevant issue, comment, field, link, tag or work item; list operations expose explicit bounded paging and fields. No separate command declarations for human, JSON and JSON-RPC paths.

Deferring a dedicated endpoint facade does not forbid an equivalent command-language operation. For example p0 commands apply can express delete, clone, move, watch or vote; it is always Update. This distinction must remain explicit in the feature issue.

## ReadOnly POST exceptions and command semantics

- [Command suggestions](https://www.jetbrains.com/help/youtrack/devportal/resource-api-commands-assist.html): POST /api/commands/assist parses a query and returns suggestions/parsed commands, using optional issue context and caret. Classify ReadOnly. It is not a documented full execution dry run or a promise that workflows and permissions will accept the later mutation. Prefer the leaf name commands assist over a misleading preview guarantee.
- [Search suggestions](https://www.jetbrains.com/help/youtrack/devportal/resource-api-search-assist.html): POST /api/search/assist returns search completions from query/caret/context, so ReadOnly.
- [Issue count](https://www.jetbrains.com/help/youtrack/devportal/resource-api-issuesGetter-count.html): POST /api/issuesGetter/count reads a search result count using a JSON body. Empty object means all issues. A count of -1 means calculation is pending, not negative cardinality; use bounded retry or report pending.
- [Command application](https://www.jetbrains.com/help/youtrack/devportal/resource-api-commands.html): POST /api/commands mutates one or more explicit issues. Keep Update even when a query looks harmless; it may execute custom workflow actions. Silent/mute options suppress notifications, not mutations. runAs is elevated impersonation, not normal profile switching.

## Derived capabilities, not extra REST resource rows

- [Attachment download](https://www.jetbrains.com/help/youtrack/devportal/api-usecase-download-issue-attachment.html): p1 ReadOnly issues attachments download obtains metadata url, then GETs that exact returned URL. It is a documented two-request use case, not an invented /download endpoint. The URL can contain a credential-bearing sign query, and the download request does not require Authorization. Never retain signed URLs in fixtures/logs; validate origin and redirects before any credential forwarding. Save profile-owned downloads under AppArguments.AppDataDirectory.
- [Issue voters](https://www.jetbrains.com/help/youtrack/devportal/api-entity-IssueVoters.html) and [watchers](https://www.jetbrains.com/help/youtrack/devportal/api-entity-IssueWatchers.html) can be requested through issue fields. Do not invent standalone REST routes from entity names.
- [Command reference](https://www.jetbrains.com/help/youtrack/cloud/command-reference.html) documents vote/unvote, star/unstar, clone, move, link, tag, board/sprint and Gantt assignment. Expose these through Update commands apply in v1; dedicated convenience leaves are optional v2. Removing Star does not guarantee a user stops watching, since another subscription source can remain. Command syntax differs from search-query syntax.

## Contract and edge cases for implementation

- [Issue list/create](https://www.jetbrains.com/help/youtrack/devportal/resource-api-issues.html): preserve YouTrack query and fields syntax; use explicit paging, because list defaults are capped by server settings. New issues require summary and project id. Report issues before uploading attachments.
- [Attachment upload](https://www.jetbrains.com/help/youtrack/devportal/api-usecase-attach-files.html): use multipart/form-data, with a distinct form field for each file. Creating an issue and attaching a file cannot be a single API request. A create-then-upload convenience flow must report partial success.
- [Attachment update](https://www.jetbrains.com/help/youtrack/devportal/operations-api-issues-issueID-attachments.html) permits name, visibility and applicable base64Content; this less common operation is p2.
- [Issue custom fields](https://www.jetbrains.com/help/youtrack/devportal/operations-api-issues-issueID-customFields.html): state-machine fields require event IDs from possibleEvents; do not assume every State is a simple enum. Important source discrepancy: the declared resource and request syntax use /customFields/{fieldID}, but some examples still use /fields/{fieldID}. Use the declared resource in the census; record the example inconsistency instead of inventing aliases. Type-specific serialization and null/multi-value handling need fixtures.
- [Comment update](https://www.jetbrains.com/help/youtrack/devportal/operations-api-issues-issueID-comments.html): text, visibility, pinned and deleted are entity properties; pin/unpin is an update, not a new endpoint. Preserve server permission/visibility failures.
- [Cursor history](https://www.jetbrains.com/help/youtrack/devportal/operations-api-issues-issueID-activitiesPage.html): categories are mandatory; preserve beforeCursor/afterCursor and hasBefore/hasAfter. Prefer cursor routes in v1 for changing activity collections. Do not substitute offset paging silently.
- [Issue link removal](https://www.jetbrains.com/help/youtrack/devportal/operations-api-issues-issueID-links-linkID-issues.html): official template repeats {issueID} twice; the last identifies the target issue to unlink. Keep the raw fact in operations.json; normalize to targetIssueID for explanation only. Link IDs carry direction; unlink removes a relation, not either issue.
- [Work items](https://www.jetbrains.com/help/youtrack/devportal/resource-api-workItems.html): the global endpoint supports query, date/created/updated ranges, repeated author and creator filters. Mutations use issue-scoped /timeTracking/workItems, not the global route. p1 read/add/update covers normal time logging; delete is p2.

## Deprecations and alternate routes

- [IssueTag](https://www.jetbrains.com/help/youtrack/devportal/resource-api-issueTags.html) and /api/issueTags are deprecated; use Tag and /api/tags. Do not implement a legacy alias.
- [Tags](https://www.jetbrains.com/help/youtrack/devportal/resource-api-tags.html) and [saved queries](https://www.jetbrains.com/help/youtrack/devportal/resource-api-savedQueries.html) deprecate visibleFor/updateableBy in favor of readSharingSettings/updateSharingSettings. Avoid promising generic writes to properties marked read-only; determine accepted payloads per operation.
- /api/admin/projects/{projectID}/issues and its item route are supported scoped alternatives, not deprecated. Keep in the complete v2 inventory; v1 normal issue routes already cover the common workflow.
- /api/users/{userID}/tags, /api/users/{userID}/savedQueries and /api/tags/{tagID}/issues are supported alternative views, deferred to p2.
- Global and issue-scoped activity list/get routes are supported, not deprecated; p1 cursor routes are selected for their practical behavior.

## Suggested deterministic evidence

Exercise list caps/explicit pagination, correct path escaping, visibility-denied responses, typed state-machine field transitions, ReadOnly POST permission acceptance, Update denial before HTTP, pending count handling, cursor continuation, multipart uploads and partial create/upload outcomes. Include empty successful command responses, profile switching, sanitized signed-download handling and missing/ambiguous IDs. Use mocked boundaries only by default.
