# Independent inventory review

Reviewer: `inventory_reviewer` (subagent), 2026-08-30.

## R1 — discovery and scope boundary

**Verdict: PASS for a documentation census, with explicit source discrepancies below.**
No production code was changed. No YouTrack instance, credential store, or private service
response was accessed. Documentation evidence is not runtime validation.

### Evidence checked

- Read repository `AGENTS.md`, `docs/DESIGN.md`, reconciliation role, workstream practice,
  and GitHub Issue practice.
- Independently opened the official Resources index and selected operation pages.
- Inspected `research/discovery/discovery.json` and its extraction script.
- Counted 169 indexed/fetched pages and 281 unique `METHOD + resource-table path` operations.
- Observed 136 GET, 101 POST, 44 DELETE operations; no duplicate identities, missing
  resource paths, fetch errors, or additional resource/operation links outside the index.
- Compared supported-method sets against request-syntax verbs on all 169 pages: no mismatch.
- Compared resource-table paths against syntax paths on all 169 pages: only the notification
  profile discrepancy recorded below.
- Of 25 pages without a methods table, 24 describe singleton landing resources whose
  operation page supplies the methods. The remaining `/api/issueTags` page is explicitly
  deprecated and declares no method. It is not an invented active GET endpoint.

### Source discrepancies and semantic traps

1. Notification profile GET and POST use `/api/users/{userID}/profiles/notifications`
   in the Resource table and samples, while request-syntax sections append `/{profileID}`.
   Preserve table identity in the census, record this discrepancy, and verify against
   version-local OAS before implementing. Do not count two extra routes or claim runtime proof.
   [Official reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-users-userID-profiles-notifications.html).
2. Child-article detail repeats `{articleID}` in the official path. The first position is
   the parent, the second the child. A future CLI needs distinct parameters without changing
   the documented inventory identity. DELETE removes the parent-child relationship and does
   not delete the child article.
   [Official reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-articles-articleID-childArticles.html).
3. `/api/issueTags` is deprecated in favor of `/api/tags`. Exclude compatibility implementation.
   [Official reference](https://www.jetbrains.com/help/youtrack/devportal/resource-api-issueTags.html).
4. POST `/api/commands/assist`, `/api/search/assist`, and `/api/issuesGetter/count` are
   semantic reads. They must use `ReadOnly`; POST `/api/commands` executes mutations and
   must use `Update`, including commands that delete, move, change visibility, or run as
   another user. Do not claim that a command subset makes this a narrow permission category.
   [Command suggestions](https://www.jetbrains.com/help/youtrack/devportal/resource-api-commands-assist.html),
   [search suggestions](https://www.jetbrains.com/help/youtrack/devportal/resource-api-search-assist.html),
   [count](https://www.jetbrains.com/help/youtrack/devportal/resource-api-issuesGetter-count.html).

### Supplemental capability boundary

- GET `/api/openapi.json` is documented metadata outside the Resources index. Classify
  as `ReadOnly` in a supplemental row; do not add it to the 281 indexed operation count.
  [OAS](https://www.jetbrains.com/help/youtrack/devportal/youtrack-openapi-specification.html).
- Attachment binary download follows the returned attachment `url`. It is distinct from
  attachment metadata GET. Do not infer a stable static files endpoint from sample URLs.
  Classify download `ReadOnly`; never publish/store/log signed query credentials. Validate
  the profile's origin, context path, and redirects before following links; never forward
  bearer credentials across origins. Downloaded profile-owned files derive from
  `AppArguments.AppDataDirectory`.
  [Download use case](https://www.jetbrains.com/help/youtrack/devportal/api-usecase-download-issue-attachment.html).
- Custom app HTTP handlers expose variable routes in five scopes: global, issue, article,
  project, and user. Document these templates separately from finite core endpoints.
  Methods can be GET, POST, PUT, DELETE; behavior is app-defined. Do not infer `ReadOnly`
  for an arbitrary handler merely from GET. Any eventual exposed handler requires an
  explicit reviewed semantic category (conservative `Update` until reviewed).
  [URL templates](https://www.jetbrains.com/help/youtrack/devportal/api-url-and-endpoints.html),
  [handler contract](https://www.jetbrains.com/help/youtrack/devportal/apps-reference-http-handlers.html).
- Workflow API and Import API references describe JavaScript scripting APIs, not an
  additional finite list of public YouTrack REST routes. Do not invent endpoints for
  report management, workflow management, import jobs, or helpdesk administration solely
  from product feature names. Standard helpdesk issue operations can use documented
  issue/user resources when the target version and permissions support them.
  [Workflow API](https://www.jetbrains.com/help/youtrack/devportal/YouTrack-Api-Documentation.html),
  [Import API](https://www.jetbrains.com/help/youtrack/devportal/YouTrack-Import-Api-Documentation.html).
- Current YouTrack documentation includes access-management additions in 2026.1 and
  UserType in 2026.2. Hub remains a separate REST product; deprecated Hub project/team/
  organization routes must not become compatibility fallbacks. OAuth endpoints under
  the Hub service are an authentication-protocol dependency, not part of this resource
  census. A permanent-token v1 matches the existing factory helper.
  [Changelog](https://www.jetbrains.com/help/youtrack/devportal/api-changelog.html),
  [Hub migration](https://www.jetbrains.com/help/youtrack/devportal/hub-rest-api-deprecated-endpoints-2026-1.html),
  [OAuth](https://www.jetbrains.com/help/youtrack/devportal/OAuth-authorization-in-youtrack.html).
- The legacy `/rest` API was discontinued in YouTrack 2021.3; exclude it explicitly.
  [Legacy API status](https://www.jetbrains.com/help/youtrack/server/monitor-rest-api-traffic.html).

### R1 addendum — final discovery evidence

Reviewed `research/discovery/README.md` and `supplementary-surfaces.json` after
initial R1. They preserve the 281-operation main census and separate 13 supplemental
facts (metadata/download, five app scopes, Hub/OAuth boundaries, three report candidates).
Independently verified the following official pages:

- Assigned-role detail declares item POST while its assignment examples use collection
  POST, and the collection declares only GET. Keep the declared item operation and record
  collection POST as unresolved source ambiguity, not an additional proved operation.
  [Detail](https://www.jetbrains.com/help/youtrack/devportal/operations-api-assignedRoles.html),
  [collection](https://www.jetbrains.com/help/youtrack/devportal/resource-api-assignedRoles.html).
- Direct group membership has a matching table/syntax item POST but a collection POST
  example. The operation heading says add membership despite its generated update-user
  title. A future CLI must not mistake this for arbitrary user profile modification.
  [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-groups-groupID-ownUsers.html).
- A 2024 official JetBrains Support comment supports candidate report detail read,
  status read, and status POST recalculation. This is weaker, older evidence than the
  current generated reference; the candidates remain separate and require validation
  before implementation. Recalculation is Update. No collection CRUD can be inferred.
  [Official support](https://youtrack-support.jetbrains.com/hc/en-us/community/posts/17238863984402-Time-report-query).

**R1 verdict remains PASS** with these recorded uncertainties; no current runtime or
comprehensive Reports API guarantee is implied.
## R2 — integrated issue, classification, and release mapping

**Verdict: PASS — publication payload approved.** Reviewed the final body and all five
inventory payloads, plus `classification.json`, `scope.toml`, and ledger state.
Final reviewed issue-body SHA-256:
`56b67647b5f1f02623d97ebdf4490ad74762fba9c30d06ed9f1ae35523e780aa`.

Independent structured validation parsed the actual Markdown table rows (not merely a
reported count) and compared them with generated facts and human classifications:

- 281 rows and 281 distinct exact operation identities; no missing/extra/duplicate rows.
- Every table method/path/source/category/priority/release matches its classification;
  method/path/source also match the generated census.
- Permission policy checked for every operation: 139 ReadOnly and 142 Update, including
  exactly the three documented POST-read exceptions. No mutation classified ReadOnly.
- P0 9 + P1 109 = v1 118 endpoint operations; P2 140 + P3 23 = v2 163 endpoint operations.
  Every v1 row has a CLI signature with required routing IDs and applicable body/file/query
  inputs. Direct-membership variants are explicit flags; repeated source IDs use distinct
  parent/child or source/target arguments.
- The issue-attachment download is separately P1/v1, one derived CLI capability, without
  inflating the endpoint count. Metadata/OAS and historical report candidates remain
  separately P2/v2. Five dynamic templates and Hub/OAuth boundaries are explicit exclusions.
- Comment sizes are approximately 15–22 KB each; no single oversized inventory payload
  or row omission is hidden by splitting the inventory into five comments.

Reviewed shared factory/package integration, secure permanent-token profile contract,
category denial before fetch, projections/body/result families, encoded IDs, independent
offset/cursor behavior, mandatory activity categories, count pending state, no hidden
write retries, current CLI/RPC error behavior, and deterministic/mock-first acceptance.
The scope identity and snapshot-date claims match what the crawler actually records.

Publication security contract is explicit: the P0 command language can cause broad
mutations but always requires Update and explicit bounded targets; no arbitrary API path,
runAs, or silent payload passthrough is offered in v1. Signed attachment URLs are transient
secrets, redacted even from explicit nested metadata projections and normal JSON/RPC
results. Downloads use same-origin/context checks, no Authorization on binary requests,
redirect rejection, AppData-owned destinations, size limits, traversal protection,
no overwrite, and partial cleanup.

Previously reported issues are resolved: stale download-v2 prose, command naming,
unsupported cursor page-size promise, current-user name projection ambiguity, source
contradiction coverage, supplemental route visibility, per-page date overclaim, and the
final current-user Markdown escape typo. No unresolved R2 blocker remains.

This approval concerns a public-documentation inventory and proposed integration contract.
It does not claim endpoint runtime support, production implementation, tests passing, or
GitHub publication. R3 remains the orchestrator's privacy/publish/readback gate; all future
v1 implementation acceptance remains open.
