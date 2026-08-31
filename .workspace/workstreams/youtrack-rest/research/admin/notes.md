# YouTrack non-issue REST domain research

Researched 2026-08-30 using JetBrains documentation only. This is research evidence, not a second feature specification. The GitHub issue owns final scope. No live YouTrack instance, credentials, customer payload, or production source was accessed.

## Coverage and priority judgement

`priorities.json` annotates 201 exact method/path records from the independently generated 281-operation census: all admin resources except project issue endpoints, agile boards/sprints, articles, assigned roles, groups, permissions, roles, users excluding user tags/saved queries (owned by issue researcher). Counts: P0 1; P1 73; P2 107; P3 20. Every P0/P1 record includes a proposed CLI mapping. All domain GET operations are ReadOnly; their documented POST/DELETE operations are Update. This classification is semantic, not a general assertion that every POST in the whole API mutates: issue count and suggestions are handled separately.

- P0: current identity for authentication validation.
- P1: projects, people/groups/teams, custom-field/type/bundle lookup needed to form valid issue edits; time-tracking settings/type lookup; agile/sprint reads and routine sprint creation/update; knowledge-base content reads and routine article/comment creation/update/attachment upload.
- P2: custom-field and bundle administration, project/team/group/user/role/organization administration, user preferences, field defaults and cross-project instances, board creation/settings/deletion, article restructuring/deletion/reactions/tag management.
- P3: database backup metadata/settings/status, global settings/license/CORS/locale/notification/system configuration, telemetry. These are specialized operations with lower daily utility.
- Priorities are product judgement, not vendor severity or permission levels. Every P0/P1 record belongs to v1; P2/P3 belongs to v2. Lower priority never weakens Update gating.
- Proposed CLI vocabulary uses singular nouns, `bundle owned` for the REST `ownedField` family, and separate parent/child positional arguments even where docs repeat a placeholder.

## Resource completeness checklist

The census owns individual methods; this checklist reviews domain shape and absent surfaces.

| Resource family | Coverage reviewed | Classification / suggested priority |
|---|---|---|
| Projects | collection/item; custom fields; articles; team, all/direct users and groups; time tracking/types | reads P1; writes P2; project issues owned by issue research |
| Custom-field definitions | collection/item, fieldDefaults, instances, types | lookup P1; defaults/instances and changes P2 |
| Bundles | build, enum, ownedField, state, user, version; values; user aggregatedUsers/groups/individuals | lookup P1; definition/value/membership changes P2 |
| Identities | users and current user; general/notifications/time-tracking profiles; groups, ownUsers, users, subGroups | current P0; directory/membership reads P1; preferences/admin mutations P2 |
| Access management | organizations, roles, assignedRoles, permissions | P2; permissions is a catalog, not an effective-access check |
| Planning | agile board collection/item; sprint collection/item | reads and sprint create/update P1; board administration and sprint delete P2 |
| Knowledge base | articles, attachments, children, parent, comments/reactions, tags, project articles | content workflow P1; structure/destruction/secondary metadata P2 |
| Instance operations | backup list/item, backup settings/status, global settings and six subresources, telemetry | P3 |
| Time tracking administration | global settings, workTimeSettings, global/project workItemTypes | lookup P1; changes P2 |

Resource index: [current generated REST resources](https://www.jetbrains.com/help/youtrack/devportal/api-resources.html). Every annotation has its own resource/method source link copied from the census.

## Version and API boundaries

YouTrack's current public REST API is rooted at the service URL plus `/api`; the configured service URL may itself include a context path. HTTP handler endpoints are separate, installation-defined extensions with issue/article/project/user/global scopes; a finite vendor resource inventory cannot enumerate their arbitrary methods or behavior. Do not grant arbitrary extension calls ReadOnly merely because their transport is GET. [API URLs and extension endpoints](https://www.jetbrains.com/help/youtrack/devportal/api-url-and-endpoints.html).

Since 2026.1, YouTrack directly exposes user/group/access management and adds teams, organizations, roles, assignments, permissions. Hub remains relevant for authentication infrastructure and secrets (credentials, tokens, 2FA credentials, keys/certificates), and older servers. Group policy settings may still be YouTrack properties, so do not equate a policy field with Hub credential-management APIs. No automatic legacy Hub fallback is proposed. [YouTrack versus Hub](https://www.jetbrains.com/help/youtrack/devportal/api-users-yt-vs-hub.html).

Hub project/team/organization endpoints no longer return or modify YouTrack's corresponding data in 2026.1+. Include that boundary in scope rather than importing Hub's entire independent API as YouTrack resources. [Hub deprecations](https://www.jetbrains.com/help/youtrack/devportal/hub-rest-api-deprecated-endpoints-2026-1.html).

The changelog specifically places UserType and User.userType in 2026.2, while the Hub migration page associates migration away from its UserType with 2026.1. Avoid requesting 2026.2-only fields for a 2026.1 baseline without an explicit version contract. [REST changelog](https://www.jetbrains.com/help/youtrack/devportal/api-changelog.html).

Legacy `/rest` was discontinued in 2021.3, not a planned v2 implementation target. Inventory historical/excluded surfaces explicitly; do not build compatibility shims. [Legacy REST traffic monitoring](https://www.jetbrains.com/help/youtrack/server/monitor-rest-api-traffic.html).

## Documentation discrepancies and semantic traps

1. **A1 Assigned roles:** resource collection lists GET only; detail method declares POST /api/assignedRoles/{roleID}, yet both assignment samples use POST /api/assignedRoles. Keep the documented operation in the census and flag the collection POST as a candidate discrepancy, not an extra proven endpoint. All assignment writes P2 pending contract verification. [Collection](https://www.jetbrains.com/help/youtrack/devportal/resource-api-assignedRoles.html), [detail](https://www.jetbrains.com/help/youtrack/devportal/operations-api-assignedRoles.html).
2. **A2 User writes:** generated User attributes label email and other fields read-only and retain a Hub-only warning, while documented POST user update demonstrates changing email. User creation also exists and requires secret password input. Do not infer an unrestricted field schema from either table or sample; resolve before v2 and prevent secrets entering config/output. [Users](https://www.jetbrains.com/help/youtrack/devportal/resource-api-users.html), [user operations](https://www.jetbrains.com/help/youtrack/devportal/operations-api-users.html).
3. **A3 Notification profiles:** discovery found resource-table versus request-syntax path disagreement involving profileID. Keep P2 with explicit unresolved contract; do not silently invent a route. [Profile operations](https://www.jetbrains.com/help/youtrack/devportal/operations-api-users-userID-profiles-notifications.html).
4. **A4 Group direct members:** item page and request syntax declare POST /api/groups/{groupID}/ownUsers/{userID}; sample instead posts to collection ownUsers with id in the body. Do not add sample-only collection POST to confirmed census. [Group membership operations](https://www.jetbrains.com/help/youtrack/devportal/operations-api-groups-groupID-ownUsers.html).
5. **A5 Child articles:** first articleID is parent and second articleID is child. DELETE unlinks the parent-child relation; it does not delete the child article. POST collection links an existing article. ParentArticle endpoint itself is GET only. [Child operations](https://www.jetbrains.com/help/youtrack/devportal/operations-api-articles-articleID-childArticles.html), [parent](https://www.jetbrains.com/help/youtrack/devportal/operations-api-articles-articleID-parentArticle.html).
6. Project team users includes membership inherited from groups; ownUsers contains direct members only. Team membership removal does not delete the underlying user/group. Team group and ownUser item resources document DELETE only, not assumed CRUD. [Project team](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-projects-projectID-team.html).
7. Group deletion requires a successor group and can synchronize asynchronously with Hub. Immutable roles cannot be updated/deleted. [Groups](https://www.jetbrains.com/help/youtrack/devportal/operations-api-groups.html), [roles](https://www.jetbrains.com/help/youtrack/devportal/operations-api-roles.html).
8. Sprint GET/POST supports current instead of sprintID; this is a selector, not another operation. Creating with previousSprint moves unresolved issues; expose that side effect explicitly. Board deprecated sharing fields should not become new CLI defaults. [Sprint operations](https://www.jetbrains.com/help/youtrack/devportal/operations-api-agiles-agileID-sprints.html), [sprint creation](https://www.jetbrains.com/help/youtrack/devportal/resource-api-agiles-agileID-sprints.html), [boards](https://www.jetbrains.com/help/youtrack/devportal/resource-api-agiles.html).
9. Article list's documented parameters do not include an issue-like search query; avoid promising unrestricted server search without evidence. Attachment metadata may return signed URLs; do not place real signed URLs in fixtures/logs/issues. Attachment download is a follow-up file-resource request, not the metadata GET itself. [Articles](https://www.jetbrains.com/help/youtrack/devportal/resource-api-articles.html), [article attachments](https://www.jetbrains.com/help/youtrack/devportal/resource-api-articles-articleID-attachments.html).
10. Backup resource supports metadata reads and settings changes; do not infer create/cancel/download/delete endpoints from old sample attributes. Telemetry fields vary across Cloud and Server and may be null. [Backup status](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-databaseBackup-settings-backupStatus.html), [telemetry](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-telemetry.html).

## Supplementary and excluded surfaces

| Surface | Evidence and disposition |
|---|---|
| Reports | A JetBrains support official reply documents GET /api/reports/{reportId}, GET /api/reports/{reportId}/status and POST status to request recalculation. Reads ReadOnly; recalculation Update. Absent current generated resource index; P3 supplemental research, not asserted stable API coverage. /api/reports family mentioned without full collection method contract. |
| Imports | Current Import API describes JavaScript import scripts and entity mappings, not another REST inventory. Migration can consume already-inventoried REST operations. No invented /api/import endpoints. |
| Dashboards | Imported-entities guide directs dashboard imports to Hub REST. Separate Hub surface, not current YouTrack resource census. |
| Helpdesk | Tickets/articles/users share documented YouTrack surfaces. No dedicated SLA, channel, online-form configuration resource appears in the generated index. Do not infer such routes from UI features. Public/internal comment semantics depend on author role. |
| Integrations/workflows/apps | Product UI and script APIs exist, but do not imply a public REST resource family in this index. VCS links on issues are inventoried by issue researcher. Custom HTTP handlers remain installation-defined. |
| Legacy REST | Historical /rest endpoints are excluded from implementation; current deprecated documented entries remain visible in the inventory with exclusion rationale. |

Sources: [official reports reply](https://youtrack-support.jetbrains.com/hc/en-us/community/posts/17238863984402-Time-report-query), [Import API](https://www.jetbrains.com/help/youtrack/devportal/YouTrack-Import-Api-Documentation.html), [imported entities and Hub dashboards](https://www.jetbrains.com/help/youtrack/devportal/imported-entities.html), [helpdesk import comment visibility](https://youtrack.jetbrains.com/projects/WI/articles/SUPPORT-A-4080/Comments-imported-into-a-Helpdesk-project-appear-as-internal).

All unresolved surfaces are research gates, not permission bypasses or commitments to unsupported/private endpoints.

