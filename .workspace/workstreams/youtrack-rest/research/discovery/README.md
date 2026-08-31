# Generated YouTrack REST reference census

Retrieved 2026-08-30 from public JetBrains documentation only. The generated JSON
contains structural facts, not real-service data or copied sample payloads.

## Universe and reproduction

- Index: https://www.jetbrains.com/help/youtrack/devportal/api-resources.html
- Meaning: current public generated YouTrack REST resources and supported methods.
- Command (from worktree): `python .workspace/workstreams/youtrack-rest/research/discovery/discover.py`
- Python standard library only; HTTP requests are limited to the public JetBrains
  documentation host. No authentication, service profile, or YouTrack instance is used.
- Discovery starts from every `resource-api-*.html` and `operations-api-*.html`
  link in the index, removes duplicate page URLs, and fetches all of them.
- Source identity: official page URL plus SHA-256 of fetched UTF-8 HTML. HTML is
  used in memory and never stored. SHA-256 changes may include template changes.
- Operation identity: uppercase HTTP method, a space, and the Resource-table path
  (preserve documented placeholder names and case; no query string).
- Method and operation title come only from the Supported methods table. Each
  operation links to its official method section. Methods are not inferred from
  examples, entity attributes, or general CRUD conventions.
- Every declared method/path is compared with Request syntax. Links to further
  resource/operations pages are compared with the index to check crawl closure.
- Human permission classification, priority, version, and source-resolution
  decisions intentionally live outside `discovery.json`.

## Verified counts

169 indexed and fetched pages; 0 failed pages; 0 additional resource/operations
page links outside the index; 281 unique declared operations across 144
method-bearing pages: 136 GET, 101 POST, and 44 DELETE.

25 resource-description pages do not declare methods. 24 have corresponding
specific-resource operation pages already included. The remaining page,
`resource-api-issueTags.html`, is explicitly deprecated, declares no methods,
and directs clients to `/api/tags`. No operation is fabricated for `/api/issueTags`.

## Source discrepancies requiring explicit decisions

1. Notification profiles: Resource table and request examples use
   `/api/users/{userID}/profiles/notifications`, while both GET and POST Request
   syntax append `/{profileID}`. The census preserves the Resource table path
   and records both conflicting syntax identities in `validation.syntaxDifferences`.
   Source: https://www.jetbrains.com/help/youtrack/devportal/operations-api-users-userID-profiles-notifications.html
2. Assigned roles: the specific-resource page declares POST
   `/api/assignedRoles/{roleID}`, but the role-assignment examples use the collection
   `/api/assignedRoles`; the collection page declares GET only. The generated
   census retains only declared operations. Collection POST is an unresolved
   sample-only candidate, not a silently invented 282nd operation.
   Sources: https://www.jetbrains.com/help/youtrack/devportal/operations-api-assignedRoles.html
   and https://www.jetbrains.com/help/youtrack/devportal/resource-api-assignedRoles.html

3. Direct group membership: POST table and syntax name
   `/api/groups/{groupID}/ownUsers/{userID}`, but the add-user example posts to
   `/api/groups/{groupID}/ownUsers` with a user ID in the body. Preserve declared
   item operation; do not add sample-only collection POST without reconciliation.
   Source: https://www.jetbrains.com/help/youtrack/devportal/operations-api-groups-groupID-ownUsers.html
4. User updates: user attributes still mark email read-only and refer to Hub-only
   changes, while the documented user POST operation includes an email update.
   This is a writable-field/version uncertainty, not a reason to omit declared POST.
   Source: https://www.jetbrains.com/help/youtrack/devportal/operations-api-users.html
5. Child-article detail uses repeated `{articleID}` placeholders for parent and
   child. Preserve the documented path in identity; a CLI must use distinct
   parent/child arguments. DELETE removes the parent-child relationship, not
   the article itself.
   Source: https://www.jetbrains.com/help/youtrack/devportal/operations-api-articles-articleID-childArticles.html

## Explicit boundaries and supplemental surfaces

- OpenAPI metadata is documented at `<service>/api/openapi.json` (ordinary HTTP GET).
  It is a supplemental metadata read, not part of the 281 business-operation
  census. Specification is instance/version-specific; no live instance was queried.
  Source: https://www.jetbrains.com/help/youtrack/devportal/youtrack-openapi-specification.html
- YouTrack 2026.1+ identity/access endpoints under `/api` are included because
  they are now in the YouTrack reference. Separate Hub REST `<HubServiceURL>/api/rest` operations are excluded; this is not a Hub API census.
  Sources: https://www.jetbrains.com/help/youtrack/devportal/rest-api-reference.html
  and https://www.jetbrains.com/help/youtrack/devportal/Hub-REST-API.html
- Legacy `/rest` endpoints and deprecated `/api/issueTags` are not compatibility
  targets. Do not infer supported legacy methods.
- App-defined extension endpoints are unbounded by installed apps. Five
  documented scope patterns are `/api/issues/{issueID}/extensionEndpoints/{app}/{handler}/{endpoint}`,
  `/api/articles/{articleID}/extensionEndpoints/{app}/{handler}/{endpoint}`,
  `/api/admin/projects/{projectID}/extensionEndpoints/{app}/{handler}/{endpoint}`,
  `/api/users/{userID}/extensionEndpoints/{app}/{handler}/{endpoint}`, and
  `/api/extensionEndpoints/{app}/{handler}/{endpoint}`. Methods and side effects
  are application-defined and cannot be assigned ReadOnly from the URL alone.
  Source: https://www.jetbrains.com/help/youtrack/devportal/api-url-and-endpoints.html
- Tutorial/support-only paths, download URLs, authentication/OAuth endpoints, and
  undocumented frontend/internal endpoints are outside this generated-reference
  universe. Additional official supplemental paths must be recorded separately;
  do not claim the 281 rows cover every possible URL served by YouTrack.

## Supplemental inventory

`Supplementary surfaces` below are not additional generated-reference operations.
Their separation prevents overstating either finite coverage or supported runtime
behavior. Machine census remains 281. Human priorities belong to the issue.

| Surface | Documented shape | Permission conclusion | Treatment |
| --- | --- | --- | --- |
| OAS metadata | `GET /api/openapi.json` | ReadOnly | Supplemental metadata read; snapshot instance schema only when explicitly authorized |
| Attachment bytes | GET returned attachment `url`, examples `/api/files/{fileID}` with signed query | ReadOnly | Follow returned URL safely; do not construct signatures or invent arbitrary file listing |
| Custom app scopes | Five documented `extensionEndpoints` patterns listed above | Unknown until each installed handler is reviewed | Explicitly excluded; never label arbitrary GET handler ReadOnly, or permit arbitrary calls through the read gate |
| Hub REST | `<HubServiceURL>/api/rest/...` | Per Hub operation; not classified here | Separate product/API census excluded |
| OAuth authorization | `<HubServiceURL>/api/rest/oauth2/auth` | Authentication protocol, not ReadOnly service read | Boundary only; current integration uses existing permanent-token auth design |
| OAuth token issuance | `<HubServiceURL>/api/rest/oauth2/token` | Credential issuance, not ReadOnly service read | Boundary only; no new auth protocol planned |

The attachment tutorial explicitly requests `url` in attachment metadata and then
GETs that URL. It says the `sign` query parameter authenticates this download;
therefore signed URLs are credential-bearing. Do not print, log, snapshot, commit,
or paste actual signed URLs into the issue. Retain same-origin checks and prevent
credential forwarding to a different host during future implementation.
Source: https://www.jetbrains.com/help/youtrack/devportal/api-usecase-download-issue-attachment.html

OAuth endpoint source: https://www.jetbrains.com/help/youtrack/devportal/OAuth-authorization-in-youtrack.html
Hub REST base source: https://www.jetbrains.com/help/youtrack/devportal/Hub-Rest-Api-URL.html

All known generated-reference source coverage work is complete. Remaining
uncertainties are the explicitly recorded documentation contradictions and
instance/version-specific support, not unfetched index pages. No runtime claim
has been made and no production code was modified.

### Official-support report candidates outside the generated index

An official JetBrains Support reply (2024-02-26) describes reading
`/api/reports/{reportID}`, reading `/api/reports/{reportID}/status`, and POSTing
the status resource to trigger recalculation. These are supplemental candidates
for later research: first two are read operations, recalculation is Update.
The source is old, supplies no current comprehensive schema, and recommends
inspecting browser traffic for more detail. Therefore these three examples do
not establish a complete or stable Reports API and are not promoted into the
281-operation census. Merely naming `/api/reports` does not document a collection
method. Do not add report CRUD by analogy.
Source: https://youtrack-support.jetbrains.com/hc/en-us/community/posts/17238863984402-Time-report-query

### Version and non-REST notes

The current REST changelog assigns `UserType` and `User.userType` to 2026.2,
while identity/access resource additions are assigned to 2026.1. A version gate
must distinguish these, even if migration prose groups identity changes together.
Source: https://www.jetbrains.com/help/youtrack/devportal/api-changelog.html

The separately documented YouTrack Import API is a JavaScript API and is not part
of this REST census. App/workflow scripting APIs, MCP, and Hub protocols also do
not become REST operations just because they are part of the YouTrack product.
Source: https://www.jetbrains.com/help/youtrack/devportal/YouTrack-Import-Api-Documentation.html
