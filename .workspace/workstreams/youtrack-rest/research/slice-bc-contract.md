# B/C first-slice contract refresh — 2026-08-30

Scope: official-document refresh for four reads and three writes already mapped in Issue #6.
A1 is already accepted. This note does not accept B/C, expand the census, change GitHub, or
replace the Issue. No production files were changed; no service instance or credentials were accessed.

## Published local contract

Read issue-body.md first-slice and common-contract sections. The exact CLI paging flags are
--top and --skip, not --limit. Defaults are 50/0; top is an integer 1–100 and skip is a
nonnegative integer. Each collection invocation sends exactly one request. Explicit read
--fields remains source-shaped. Defaults have no custom-field or nested-collection expansion.

| Row | Method/path | Supported first-slice query | Default fields |
|---|---|---|---|
| B1 | GET /api/admin/projects | fields,$top,$skip | id,name,shortName |
| B2 | GET /api/issues | fields,$top,$skip,query | id,idReadable,summary,project(id,name,shortName),updated,resolved |
| B3 | GET /api/issues/{issueID} | fields | id,idReadable,summary,project(id,name,shortName),updated,resolved,description,created |
| B4 | GET /api/issues/{issueID}/comments | fields,$top,$skip | id,text,author(id,login),created,updated |
| C1 | POST /api/issues | fixed result fields | id,idReadable,summary,updated |
| C2 | POST /api/issues/{issueID} | fixed result fields | id,idReadable,summary,updated |
| C3 | POST /api/issues/{issueID}/comments | fixed result fields | id,text,author(id,login),created,updated |

Project-list reference documents no issue-style query parameter. The issue-list customFields
query parameter exists officially but is not needed by this initial CLI slice.

## Body scope and nullable data

The source requires summary and project.id for creation from scratch, and text for comment
creation. First-slice nonempty validation and strict allowlists are deliberate CLI constraints:
create accepts only project.id, summary and optional description; update accepts a nonempty
subset of summary/description; comment add accepts text only. Reject unknown keys also inside
project, instead of silently forwarding nested extra fields. Null description clears an update;
omission leaves it untouched. Description can be null according to the Issue entity.

Do not require nonnull response values merely because corresponding request inputs are strict.
Issue summary, description, project and resolved can be null. Comment text, author and updated
can be null. Preserve optional $type and timestamps as returned. A project-specific required
field/workflow can reject minimal creation: report safe failure without guessing values.

Collections must be arrays; detail reads must be objects. Explicit fields may omit default
properties, so do not validate an explicit projection as the entire default DTO. Successful
empty write bodies map to null under the Issue contract. Empty read body is malformed, not an
empty list. Keep auth candidate validation strict on fixed id,login separately from public
user me --fields.

## Encoding and secret output

Keep readable and database issue IDs as opaque single path-segment values; issue detail/update
officially support both forms. Encode once rather than concatenating raw IDs or decoding
pre-escaped input. Reject raw dot-segment IDs before URL joining; URL normalization must not
turn an issue ID into a different endpoint. Preserve configured context paths. Use encoded
query parameters so query/fields text cannot introduce another query key.

Nested projection data remains untrusted. Explicit attachments(url) may return a credential
in a signed URL; replace that entire string with [redacted] even deep inside arrays/objects.
The official documentation shows two signature forms:

- The download use case shows a sign query parameter.
- The attachment resource sample shows a /sign=fake path segment.

A query-only scrub misses the second documented form. Detect credential-bearing URL values,
not only an object key literally named url. Preserve ordinary unsigned links. Explicit
projection never triggers attachment downloading or another REST call. Never echo the bearer,
raw exception text, request body, signed URL or unfiltered remote response in errors.

## Evidence to require

MSW tests must exercise actual declaration/client/native-fetch paths. Verify exact method/path,
default and explicit projection/query, one-page limit, empty arrays, nullable values and sparse
projection results; test encoded IDs/query and both synthetic signed-URL forms. ReadOnly gates
apply before HTTP. Each C mutation needs its own default-denial-before-fetch assertion, allowed
payload/omission/null checks, unsupported-field rejection, successful and empty responses,
safe remote rejection and no write retry. Profiles remain isolated in URL/token/categories
and interleaved RPC execution. Focused tests and npm test are implementation acceptance gates;
no tests were run for this documentation-only refresh.

## Official sources refreshed

- [Projects](https://www.jetbrains.com/help/youtrack/devportal/resource-api-admin-projects.html)
- [Issues list/create](https://www.jetbrains.com/help/youtrack/devportal/resource-api-issues.html)
- [Issue detail/update](https://www.jetbrains.com/help/youtrack/devportal/operations-api-issues.html)
- [Issue comments list/add](https://www.jetbrains.com/help/youtrack/devportal/resource-api-issues-issueID-comments.html)
- [Fields syntax](https://www.jetbrains.com/help/youtrack/devportal/api-fields-syntax.html)
- [Attachment fields and path-signature example](https://www.jetbrains.com/help/youtrack/devportal/resource-api-issues-issueID-attachments.html)
- [Download URL credentials](https://www.jetbrains.com/help/youtrack/devportal/api-usecase-download-issue-attachment.html)
