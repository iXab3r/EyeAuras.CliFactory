# Outcome and inherited scope

This follow-up owns the v2 REST backlog deferred by [YouTrack integration v1, Issue #6](https://github.com/iXab3r/EyeAuras.CliFactory/issues/6).
It preserves **163 current-reference endpoint operations: 140 P2 and 23 P3**, with **41 ReadOnly and 122 Update**.
V1 retains 118 P0/P1 operations and the separately counted issue-attachment download; this follow-up
neither claims v1 is already delivered nor transfers unresolved v1 acceptance defects silently.

The inventory is frozen from the official public YouTrack resource index retrieved 2026-08-30
(index updated 2026-08-12), not a runtime authorization/capability guarantee. Existing Issue6 inventory
comments remain decision history: [v2 part1](https://github.com/iXab3r/EyeAuras.CliFactory/issues/6#issuecomment-5467744211),
[v2 part2](https://github.com/iXab3r/EyeAuras.CliFactory/issues/6#issuecomment-5467744292),
[v2 part3](https://github.com/iXab3r/EyeAuras.CliFactory/issues/6#issuecomment-5467744398).
The complete 163-ID table below is this follow-up's backlog, with each original priority, semantic
permission category and official reference preserved. It is not an implementation-ready CLI contract
for all 163 operations at once.

# Priorities and implementation gate

Work on useful P2 workflows before P3 diagnostics/administration. Select small coherent families and
refresh their official/version evidence before code. Exact command names/positional arguments,
allowed body fields, default/explicit projections, returned shapes, errors, pagination and observable
mocked acceptance must be recorded in this Issue or an explicitly linked slice Issue first. No
placeholder command binding, generic raw REST escape hatch or auto-generated facade is implied.

Retain one CliFactory declaration tree, permanent-token profiles/keyring/AppData isolation, explicit
ReadOnly/Update gates, native-fetch mock evidence, secret-safe human/JSON/RPC output, and no automatic
mutation retries. Observation can use POST; state changes always use Update. Real writes are not
part of proof. Live checks remain explicit, bounded ReadOnly and outside CI, with limited rights
reported separately from product correctness; access-denied required rows are not successful skips.

Dedicated P2/P3 wrappers being deferred is not a policy ban on equivalent effects through v1
`commands apply`, whose documented language may move/delete/clone or invoke workflow behavior and
is always Update. Advanced optional payload fields deferred by v1 (for example runAs/suppression,
article visibility/draft controls or sprint membership) require their own explicit public contract;
they do not create extra endpoint counts and are not silently enabled by this backlog.

A v2 implementation workstream must pin its source baseline and accepted counter, review each 50
newly accepted unique METHOD PATH operations and the final remainder, and close required authoring
corrections before continuing beyond a checkpoint. Existing v1 operations, aliases, helpers, extra
flags and derived binary operations never inflate this counter. Count full Core + all integrations
and setup cost, tests/support/proof separately; prefer actual simple reuse without a new framework.

# Complete deferred reference inventory

| Priority | Permission | Operation | Official source |
|---|---|---|---|
| P2 | ReadOnly | `GET /api/activities` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/resource-api-activities.html#get_all-ActivityItem-method) |
| P2 | ReadOnly | `GET /api/activities/{itemID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-activities.html#get-ActivityItem-method) |
| P2 | Update | `POST /api/admin/customFieldSettings/bundles/build` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/resource-api-admin-customFieldSettings-bundles-build.html#create-BuildBundle-method) |
| P2 | Update | `DELETE /api/admin/customFieldSettings/bundles/build/{bundleID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-customFieldSettings-bundles-build.html#delete-BuildBundle-method) |
| P2 | Update | `POST /api/admin/customFieldSettings/bundles/build/{bundleID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-customFieldSettings-bundles-build.html#update-BuildBundle-method) |
| P2 | Update | `POST /api/admin/customFieldSettings/bundles/build/{bundleID}/values` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/resource-api-admin-customFieldSettings-bundles-build-bundleID-values.html#create-BuildBundleElement-method) |
| P2 | Update | `DELETE /api/admin/customFieldSettings/bundles/build/{bundleID}/values/{elementID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-customFieldSettings-bundles-build-bundleID-values.html#delete-BuildBundleElement-method) |
| P2 | Update | `POST /api/admin/customFieldSettings/bundles/build/{bundleID}/values/{elementID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-customFieldSettings-bundles-build-bundleID-values.html#update-BuildBundleElement-method) |
| P2 | Update | `POST /api/admin/customFieldSettings/bundles/enum` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/resource-api-admin-customFieldSettings-bundles-enum.html#create-EnumBundle-method) |
| P2 | Update | `DELETE /api/admin/customFieldSettings/bundles/enum/{bundleID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-customFieldSettings-bundles-enum.html#delete-EnumBundle-method) |
| P2 | Update | `POST /api/admin/customFieldSettings/bundles/enum/{bundleID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-customFieldSettings-bundles-enum.html#update-EnumBundle-method) |
| P2 | Update | `POST /api/admin/customFieldSettings/bundles/enum/{bundleID}/values` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/resource-api-admin-customFieldSettings-bundles-enum-bundleID-values.html#create-EnumBundleElement-method) |
| P2 | Update | `DELETE /api/admin/customFieldSettings/bundles/enum/{bundleID}/values/{elementID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-customFieldSettings-bundles-enum-bundleID-values.html#delete-EnumBundleElement-method) |
| P2 | Update | `POST /api/admin/customFieldSettings/bundles/enum/{bundleID}/values/{elementID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-customFieldSettings-bundles-enum-bundleID-values.html#update-EnumBundleElement-method) |
| P2 | Update | `POST /api/admin/customFieldSettings/bundles/ownedField` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/resource-api-admin-customFieldSettings-bundles-ownedField.html#create-OwnedBundle-method) |
| P2 | Update | `DELETE /api/admin/customFieldSettings/bundles/ownedField/{bundleID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-customFieldSettings-bundles-ownedField.html#delete-OwnedBundle-method) |
| P2 | Update | `POST /api/admin/customFieldSettings/bundles/ownedField/{bundleID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-customFieldSettings-bundles-ownedField.html#update-OwnedBundle-method) |
| P2 | Update | `POST /api/admin/customFieldSettings/bundles/ownedField/{bundleID}/values` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/resource-api-admin-customFieldSettings-bundles-ownedField-bundleID-values.html#create-OwnedBundleElement-method) |
| P2 | Update | `DELETE /api/admin/customFieldSettings/bundles/ownedField/{bundleID}/values/{elementID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-customFieldSettings-bundles-ownedField-bundleID-values.html#delete-OwnedBundleElement-method) |
| P2 | Update | `POST /api/admin/customFieldSettings/bundles/ownedField/{bundleID}/values/{elementID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-customFieldSettings-bundles-ownedField-bundleID-values.html#update-OwnedBundleElement-method) |
| P2 | Update | `POST /api/admin/customFieldSettings/bundles/state` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/resource-api-admin-customFieldSettings-bundles-state.html#create-StateBundle-method) |
| P2 | Update | `DELETE /api/admin/customFieldSettings/bundles/state/{bundleID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-customFieldSettings-bundles-state.html#delete-StateBundle-method) |
| P2 | Update | `POST /api/admin/customFieldSettings/bundles/state/{bundleID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-customFieldSettings-bundles-state.html#update-StateBundle-method) |
| P2 | Update | `POST /api/admin/customFieldSettings/bundles/state/{bundleID}/values` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/resource-api-admin-customFieldSettings-bundles-state-bundleID-values.html#create-StateBundleElement-method) |
| P2 | Update | `DELETE /api/admin/customFieldSettings/bundles/state/{bundleID}/values/{elementID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-customFieldSettings-bundles-state-bundleID-values.html#delete-StateBundleElement-method) |
| P2 | Update | `POST /api/admin/customFieldSettings/bundles/state/{bundleID}/values/{elementID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-customFieldSettings-bundles-state-bundleID-values.html#update-StateBundleElement-method) |
| P2 | Update | `POST /api/admin/customFieldSettings/bundles/user` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/resource-api-admin-customFieldSettings-bundles-user.html#create-UserBundle-method) |
| P2 | Update | `DELETE /api/admin/customFieldSettings/bundles/user/{bundleID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-customFieldSettings-bundles-user.html#delete-UserBundle-method) |
| P2 | Update | `POST /api/admin/customFieldSettings/bundles/user/{bundleID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-customFieldSettings-bundles-user.html#update-UserBundle-method) |
| P2 | Update | `POST /api/admin/customFieldSettings/bundles/user/{bundleID}/groups` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/resource-api-admin-customFieldSettings-bundles-user-bundleID-groups.html#create-UserGroup-method) |
| P2 | Update | `DELETE /api/admin/customFieldSettings/bundles/user/{bundleID}/groups/{groupID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-customFieldSettings-bundles-user-bundleID-groups.html#delete-UserGroup-method) |
| P2 | Update | `POST /api/admin/customFieldSettings/bundles/user/{bundleID}/individuals` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/resource-api-admin-customFieldSettings-bundles-user-bundleID-individuals.html#create-User-method) |
| P2 | Update | `DELETE /api/admin/customFieldSettings/bundles/user/{bundleID}/individuals/{userID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-customFieldSettings-bundles-user-bundleID-individuals.html#delete-User-method) |
| P2 | Update | `POST /api/admin/customFieldSettings/bundles/version` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/resource-api-admin-customFieldSettings-bundles-version.html#create-VersionBundle-method) |
| P2 | Update | `DELETE /api/admin/customFieldSettings/bundles/version/{bundleID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-customFieldSettings-bundles-version.html#delete-VersionBundle-method) |
| P2 | Update | `POST /api/admin/customFieldSettings/bundles/version/{bundleID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-customFieldSettings-bundles-version.html#update-VersionBundle-method) |
| P2 | Update | `POST /api/admin/customFieldSettings/bundles/version/{bundleID}/values` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/resource-api-admin-customFieldSettings-bundles-version-bundleID-values.html#create-VersionBundleElement-method) |
| P2 | Update | `DELETE /api/admin/customFieldSettings/bundles/version/{bundleID}/values/{elementID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-customFieldSettings-bundles-version-bundleID-values.html#delete-VersionBundleElement-method) |
| P2 | Update | `POST /api/admin/customFieldSettings/bundles/version/{bundleID}/values/{elementID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-customFieldSettings-bundles-version-bundleID-values.html#update-VersionBundleElement-method) |
| P2 | Update | `POST /api/admin/customFieldSettings/customFields` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/resource-api-admin-customFieldSettings-customFields.html#create-CustomField-method) |
| P2 | Update | `DELETE /api/admin/customFieldSettings/customFields/{fieldID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-customFieldSettings-customFields.html#delete-CustomField-method) |
| P2 | Update | `POST /api/admin/customFieldSettings/customFields/{fieldID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-customFieldSettings-customFields.html#update-CustomField-method) |
| P2 | ReadOnly | `GET /api/admin/customFieldSettings/customFields/{fieldID}/fieldDefaults` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-customFieldSettings-customFields-fieldID-fieldDefaults.html#get-CustomFieldDefaults-method) |
| P2 | Update | `POST /api/admin/customFieldSettings/customFields/{fieldID}/fieldDefaults` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-customFieldSettings-customFields-fieldID-fieldDefaults.html#update-CustomFieldDefaults-method) |
| P2 | ReadOnly | `GET /api/admin/customFieldSettings/customFields/{fieldID}/instances` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/resource-api-admin-customFieldSettings-customFields-fieldID-instances.html#get_all-ProjectCustomField-method) |
| P2 | ReadOnly | `GET /api/admin/organizations` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/resource-api-admin-organizations.html#get_all-Organization-method) |
| P2 | Update | `POST /api/admin/organizations` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/resource-api-admin-organizations.html#create-Organization-method) |
| P2 | Update | `DELETE /api/admin/organizations/{organizationID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-organizations.html#delete-Organization-method) |
| P2 | ReadOnly | `GET /api/admin/organizations/{organizationID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-organizations.html#get-Organization-method) |
| P2 | Update | `POST /api/admin/organizations/{organizationID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-organizations.html#update-Organization-method) |
| P2 | Update | `POST /api/admin/projects` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/resource-api-admin-projects.html#create-Project-method) |
| P2 | Update | `DELETE /api/admin/projects/{projectID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-projects.html#delete-Project-method) |
| P2 | Update | `POST /api/admin/projects/{projectID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-projects.html#update-Project-method) |
| P2 | Update | `POST /api/admin/projects/{projectID}/customFields` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/resource-api-admin-projects-projectID-customFields.html#create-ProjectCustomField-method) |
| P2 | Update | `DELETE /api/admin/projects/{projectID}/customFields/{fieldID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-projects-projectID-customFields.html#delete-ProjectCustomField-method) |
| P2 | Update | `POST /api/admin/projects/{projectID}/customFields/{fieldID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-projects-projectID-customFields.html#update-ProjectCustomField-method) |
| P2 | ReadOnly | `GET /api/admin/projects/{projectID}/issues` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/resource-api-admin-projects-projectID-issues.html#get_all-Issue-method) |
| P2 | Update | `POST /api/admin/projects/{projectID}/issues` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/resource-api-admin-projects-projectID-issues.html#create-Issue-method) |
| P2 | Update | `DELETE /api/admin/projects/{projectID}/issues/{issueID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-projects-projectID-issues.html#delete-Issue-method) |
| P2 | ReadOnly | `GET /api/admin/projects/{projectID}/issues/{issueID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-projects-projectID-issues.html#get-Issue-method) |
| P2 | Update | `POST /api/admin/projects/{projectID}/issues/{issueID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-projects-projectID-issues.html#update-Issue-method) |
| P2 | Update | `POST /api/admin/projects/{projectID}/team` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-projects-projectID-team.html#update-ProjectTeam-method) |
| P2 | Update | `POST /api/admin/projects/{projectID}/team/groups` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/resource-api-admin-projects-projectID-team-groups.html#create-UserGroup-method) |
| P2 | Update | `DELETE /api/admin/projects/{projectID}/team/groups/{groupID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-projects-projectID-team-groups.html#delete-UserGroup-method) |
| P2 | Update | `POST /api/admin/projects/{projectID}/team/ownUsers` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/resource-api-admin-projects-projectID-team-ownUsers.html#create-User-method) |
| P2 | Update | `DELETE /api/admin/projects/{projectID}/team/ownUsers/{userID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-projects-projectID-team-ownUsers.html#delete-User-method) |
| P2 | Update | `POST /api/admin/projects/{projectID}/timeTrackingSettings` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-projects-projectID-timeTrackingSettings.html#update-ProjectTimeTrackingSettings-method) |
| P2 | Update | `POST /api/admin/projects/{projectID}/timeTrackingSettings/workItemTypes` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/resource-api-admin-projects-projectID-timeTrackingSettings-workItemTypes.html#create-WorkItemType-method) |
| P2 | Update | `DELETE /api/admin/projects/{projectID}/timeTrackingSettings/workItemTypes/{typeID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-projects-projectID-timeTrackingSettings-workItemTypes.html#delete-WorkItemType-method) |
| P2 | Update | `POST /api/admin/timeTrackingSettings/workItemTypes` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/resource-api-admin-timeTrackingSettings-workItemTypes.html#create-WorkItemType-method) |
| P2 | Update | `DELETE /api/admin/timeTrackingSettings/workItemTypes/{typeID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-timeTrackingSettings-workItemTypes.html#delete-WorkItemType-method) |
| P2 | Update | `POST /api/admin/timeTrackingSettings/workItemTypes/{typeID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-timeTrackingSettings-workItemTypes.html#update-WorkItemType-method) |
| P2 | Update | `POST /api/admin/timeTrackingSettings/workTimeSettings` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-timeTrackingSettings-workTimeSettings.html#update-WorkTimeSettings-method) |
| P2 | Update | `POST /api/agiles` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/resource-api-agiles.html#create-Agile-method) |
| P2 | Update | `DELETE /api/agiles/{agileID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-agiles.html#delete-Agile-method) |
| P2 | Update | `POST /api/agiles/{agileID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-agiles.html#update-Agile-method) |
| P2 | Update | `DELETE /api/agiles/{agileID}/sprints/{sprintID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-agiles-agileID-sprints.html#delete-Sprint-method) |
| P2 | Update | `DELETE /api/articles/{articleID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-articles.html#delete-Article-method) |
| P2 | Update | `DELETE /api/articles/{articleID}/attachments/{attachmentID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-articles-articleID-attachments.html#delete-ArticleAttachment-method) |
| P2 | Update | `POST /api/articles/{articleID}/attachments/{attachmentID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-articles-articleID-attachments.html#update-ArticleAttachment-method) |
| P2 | Update | `POST /api/articles/{articleID}/childArticles` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/resource-api-articles-articleID-childArticles.html#create-Article-method) |
| P2 | Update | `DELETE /api/articles/{articleID}/childArticles/{articleID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-articles-articleID-childArticles.html#delete-Article-method) |
| P2 | Update | `POST /api/articles/{articleID}/childArticles/{articleID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-articles-articleID-childArticles.html#update-Article-method) |
| P2 | Update | `DELETE /api/articles/{articleID}/comments/{commentID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-articles-articleID-comments.html#delete-ArticleComment-method) |
| P2 | ReadOnly | `GET /api/articles/{articleID}/comments/{commentID}/reactions` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/resource-api-articles-articleID-comments-commentID-reactions.html#get_all-Reaction-method) |
| P2 | Update | `POST /api/articles/{articleID}/comments/{commentID}/reactions` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/resource-api-articles-articleID-comments-commentID-reactions.html#create-Reaction-method) |
| P2 | Update | `DELETE /api/articles/{articleID}/comments/{commentID}/reactions/{reactionID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-articles-articleID-comments-commentID-reactions.html#delete-Reaction-method) |
| P2 | ReadOnly | `GET /api/articles/{articleID}/comments/{commentID}/reactions/{reactionID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-articles-articleID-comments-commentID-reactions.html#get-Reaction-method) |
| P2 | ReadOnly | `GET /api/articles/{articleID}/tags` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/resource-api-articles-articleID-tags.html#get_all-Tag-method) |
| P2 | Update | `POST /api/articles/{articleID}/tags` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/resource-api-articles-articleID-tags.html#create-Tag-method) |
| P2 | Update | `DELETE /api/articles/{articleID}/tags/{tagID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-articles-articleID-tags.html#delete-Tag-method) |
| P2 | ReadOnly | `GET /api/articles/{articleID}/tags/{tagID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-articles-articleID-tags.html#get-Tag-method) |
| P2 | ReadOnly | `GET /api/assignedRoles` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/resource-api-assignedRoles.html#get_all-AssignedRole-method) |
| P2 | Update | `DELETE /api/assignedRoles/{roleID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-assignedRoles.html#delete-AssignedRole-method) |
| P2 | ReadOnly | `GET /api/assignedRoles/{roleID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-assignedRoles.html#get-AssignedRole-method) |
| P2 | Update | `POST /api/assignedRoles/{roleID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-assignedRoles.html#update-AssignedRole-method) |
| P2 | Update | `POST /api/groups` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/resource-api-groups.html#create-UserGroup-method) |
| P2 | Update | `DELETE /api/groups/{groupID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-groups.html#delete-UserGroup-method) |
| P2 | Update | `POST /api/groups/{groupID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-groups.html#update-UserGroup-method) |
| P2 | Update | `POST /api/groups/{groupID}/ownUsers/{userID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-groups-groupID-ownUsers.html#update-User-method) |
| P2 | Update | `DELETE /api/issues/{issueID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-issues.html#delete-Issue-method) |
| P2 | ReadOnly | `GET /api/issues/{issueID}/activities` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/resource-api-issues-issueID-activities.html#get_all-ActivityItem-method) |
| P2 | ReadOnly | `GET /api/issues/{issueID}/activities/{itemID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-issues-issueID-activities.html#get-ActivityItem-method) |
| P2 | Update | `DELETE /api/issues/{issueID}/attachments/{attachmentID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-issues-issueID-attachments.html#delete-IssueAttachment-method) |
| P2 | Update | `POST /api/issues/{issueID}/attachments/{attachmentID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-issues-issueID-attachments.html#update-IssueAttachment-method) |
| P2 | Update | `DELETE /api/issues/{issueID}/comments/{commentID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-issues-issueID-comments.html#delete-IssueComment-method) |
| P2 | ReadOnly | `GET /api/issues/{issueID}/comments/{commentID}/reactions` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/resource-api-issues-issueID-comments-commentID-reactions.html#get_all-Reaction-method) |
| P2 | Update | `POST /api/issues/{issueID}/comments/{commentID}/reactions` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/resource-api-issues-issueID-comments-commentID-reactions.html#create-Reaction-method) |
| P2 | Update | `DELETE /api/issues/{issueID}/comments/{commentID}/reactions/{reactionID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-issues-issueID-comments-commentID-reactions.html#delete-Reaction-method) |
| P2 | ReadOnly | `GET /api/issues/{issueID}/comments/{commentID}/reactions/{reactionID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-issues-issueID-comments-commentID-reactions.html#get-Reaction-method) |
| P2 | ReadOnly | `GET /api/issues/{issueID}/project` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-issues-issueID-project.html#get-Project-method) |
| P2 | Update | `POST /api/issues/{issueID}/project` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-issues-issueID-project.html#update-Project-method) |
| P2 | ReadOnly | `GET /api/issues/{issueID}/tags/{tagID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-issues-issueID-tags.html#get-Tag-method) |
| P2 | Update | `DELETE /api/issues/{issueID}/timeTracking/workItems/{itemID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-issues-issueID-timeTracking-workItems.html#delete-IssueWorkItem-method) |
| P2 | Update | `POST /api/issues/{issueID}/vcsChanges` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/resource-api-issues-issueID-vcsChanges.html#create-VcsChange-method) |
| P2 | Update | `DELETE /api/issues/{issueID}/vcsChanges/{changeID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-issues-issueID-vcsChanges.html#delete-VcsChange-method) |
| P2 | Update | `POST /api/issues/{issueID}/vcsChanges/{changeID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-issues-issueID-vcsChanges.html#update-VcsChange-method) |
| P2 | ReadOnly | `GET /api/permissions` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/resource-api-permissions.html#get_all-Permission-method) |
| P2 | ReadOnly | `GET /api/roles` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/resource-api-roles.html#get_all-Role-method) |
| P2 | Update | `POST /api/roles` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/resource-api-roles.html#create-Role-method) |
| P2 | Update | `DELETE /api/roles/{roleID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-roles.html#delete-Role-method) |
| P2 | ReadOnly | `GET /api/roles/{roleID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-roles.html#get-Role-method) |
| P2 | Update | `POST /api/roles/{roleID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-roles.html#update-Role-method) |
| P2 | Update | `POST /api/savedQueries` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/resource-api-savedQueries.html#create-SavedQuery-method) |
| P2 | Update | `DELETE /api/savedQueries/{queryID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-savedQueries.html#delete-SavedQuery-method) |
| P2 | Update | `POST /api/savedQueries/{queryID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-savedQueries.html#update-SavedQuery-method) |
| P2 | Update | `POST /api/tags` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/resource-api-tags.html#create-Tag-method) |
| P2 | Update | `DELETE /api/tags/{tagID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-tags.html#delete-Tag-method) |
| P2 | Update | `POST /api/tags/{tagID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-tags.html#update-Tag-method) |
| P2 | ReadOnly | `GET /api/tags/{tagID}/issues` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/resource-api-tags-tagID-issues.html#get_all-Issue-method) |
| P2 | Update | `POST /api/users` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/resource-api-users.html#create-User-method) |
| P2 | Update | `POST /api/users/{userID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-users.html#update-User-method) |
| P2 | ReadOnly | `GET /api/users/{userID}/profiles/general` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-users-userID-profiles-general.html#get-GeneralUserProfile-method) |
| P2 | Update | `POST /api/users/{userID}/profiles/general` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-users-userID-profiles-general.html#update-GeneralUserProfile-method) |
| P2 | ReadOnly | `GET /api/users/{userID}/profiles/notifications` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-users-userID-profiles-notifications.html#get-NotificationsUserProfile-method) |
| P2 | Update | `POST /api/users/{userID}/profiles/notifications` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-users-userID-profiles-notifications.html#update-NotificationsUserProfile-method) |
| P2 | ReadOnly | `GET /api/users/{userID}/profiles/timetracking` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-users-userID-profiles-timetracking.html#get-TimeTrackingUserProfile-method) |
| P2 | Update | `POST /api/users/{userID}/profiles/timetracking` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-users-userID-profiles-timetracking.html#update-TimeTrackingUserProfile-method) |
| P2 | ReadOnly | `GET /api/users/{userID}/savedQueries` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/resource-api-users-userID-savedQueries.html#get_all-SavedQuery-method) |
| P2 | ReadOnly | `GET /api/users/{userID}/tags` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/resource-api-users-userID-tags.html#get_all-Tag-method) |
| P3 | ReadOnly | `GET /api/admin/databaseBackup/backups` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/resource-api-admin-databaseBackup-backups.html#get_all-BackupFile-method) |
| P3 | ReadOnly | `GET /api/admin/databaseBackup/backups/{fileID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-databaseBackup-backups.html#get-BackupFile-method) |
| P3 | ReadOnly | `GET /api/admin/databaseBackup/settings` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-databaseBackup-settings.html#get-DatabaseBackupSettings-method) |
| P3 | Update | `POST /api/admin/databaseBackup/settings` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-databaseBackup-settings.html#update-DatabaseBackupSettings-method) |
| P3 | ReadOnly | `GET /api/admin/databaseBackup/settings/backupStatus` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-databaseBackup-settings-backupStatus.html#get-BackupStatus-method) |
| P3 | ReadOnly | `GET /api/admin/globalSettings` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-globalSettings.html#get-GlobalSettings-method) |
| P3 | Update | `POST /api/admin/globalSettings` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-globalSettings.html#update-GlobalSettings-method) |
| P3 | ReadOnly | `GET /api/admin/globalSettings/appearanceSettings` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-globalSettings-appearanceSettings.html#get-AppearanceSettings-method) |
| P3 | Update | `POST /api/admin/globalSettings/appearanceSettings` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-globalSettings-appearanceSettings.html#update-AppearanceSettings-method) |
| P3 | ReadOnly | `GET /api/admin/globalSettings/license` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-globalSettings-license.html#get-License-method) |
| P3 | Update | `POST /api/admin/globalSettings/license` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-globalSettings-license.html#update-License-method) |
| P3 | ReadOnly | `GET /api/admin/globalSettings/localeSettings` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-globalSettings-localeSettings.html#get-LocaleSettings-method) |
| P3 | Update | `POST /api/admin/globalSettings/localeSettings` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-globalSettings-localeSettings.html#update-LocaleSettings-method) |
| P3 | ReadOnly | `GET /api/admin/globalSettings/notificationSettings` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-globalSettings-notificationSettings.html#get-NotificationSettings-method) |
| P3 | Update | `POST /api/admin/globalSettings/notificationSettings` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-globalSettings-notificationSettings.html#update-NotificationSettings-method) |
| P3 | ReadOnly | `GET /api/admin/globalSettings/restSettings` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-globalSettings-restSettings.html#get-RestCorsSettings-method) |
| P3 | Update | `POST /api/admin/globalSettings/restSettings` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-globalSettings-restSettings.html#update-RestCorsSettings-method) |
| P3 | ReadOnly | `GET /api/admin/globalSettings/systemSettings` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-globalSettings-systemSettings.html#get-SystemSettings-method) |
| P3 | Update | `POST /api/admin/globalSettings/systemSettings` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-globalSettings-systemSettings.html#update-SystemSettings-method) |
| P3 | ReadOnly | `GET /api/admin/telemetry` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-telemetry.html#get-Telemetry-method) |
| P3 | Update | `POST /api/issueLinkTypes` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/resource-api-issueLinkTypes.html#create-IssueLinkType-method) |
| P3 | Update | `DELETE /api/issueLinkTypes/{typeID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-issueLinkTypes.html#delete-IssueLinkType-method) |
| P3 | Update | `POST /api/issueLinkTypes/{typeID}` | [Reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-issueLinkTypes.html#update-IssueLinkType-method) |

# Supplementary v2 candidates — outside the 163 endpoint count

| Candidate | Category | Priority | Gate |
|---|---|---|---|
|`GET /api/openapi.json`|ReadOnly|P2|Instance-specific metadata; design a finite schema command before implementation, sanitize and do not replace frozen reference evidence with a broad live crawl.|
|`GET /api/reports/{reportID}`|ReadOnly|P2|Historical official-support candidate; not a current-reference guarantee.|
|`GET /api/reports/{reportID}/status`|ReadOnly|P2|Historical official-support candidate; do not imply unbounded polling.|
|`POST /api/reports/{reportID}/status`|Update|P2|Triggers recalculation; verify supported current schema/version before any implementation.|

Sources: [official OpenAPI documentation](https://www.jetbrains.com/help/youtrack/devportal/youtrack-openapi-specification.html)
and [JetBrains support example, 2024-02-26](https://youtrack-support.jetbrains.com/hc/en-us/community/posts/17238863984402-Time-report-query).
All three Reports candidates remain excluded from implementation until current official/version
support is established. Supplemental approval and implementation must be recorded separately;
there are no invented 164th–167th census rows.

# Excluded boundaries and source contradictions

Dynamic app handlers have five documented scopes, but no finite built-in inventory or safe generic
ReadOnly assumption. Future concrete per-handler integration requires explicit review; unknown
side effects are conservatively Update. These templates remain excluded, not planned v2 wrappers:

```text
/api/extensionEndpoints/{app}/{handler}/{endpoint}
/api/issues/{issueID}/extensionEndpoints/{app}/{handler}/{endpoint}
/api/articles/{articleID}/extensionEndpoints/{app}/{handler}/{endpoint}
/api/admin/projects/{projectID}/extensionEndpoints/{app}/{handler}/{endpoint}
/api/users/{userID}/extensionEndpoints/{app}/{handler}/{endpoint}
```

See [official endpoint scopes](https://www.jetbrains.com/help/youtrack/devportal/api-url-and-endpoints.html)
and [app HTTP handlers](https://www.jetbrains.com/help/youtrack/devportal/apps-reference-http-handlers.html).
Separate Hub REST (`<HubServiceURL>/api/rest/...`), OAuth protocol routes
`<HubServiceURL>/api/rest/oauth2/auth` and `<HubServiceURL>/api/rest/oauth2/token`, deprecated YouTrack
`/rest`, internal/UI endpoints and Workflow/Import JavaScript APIs remain out of scope. Deprecated
`/api/issueTags` has no declared operation in this census; do not invent one or a compatibility alias.
The v1 signed issue-attachment download remains with v1, not this supplemental backlog.

Before affected v2 code, resolve the documented notifications collection/profile-ID discrepancy,
assigned-role and ownUsers POST table-versus-sample differences, and User email writability conflict
against current official/version-local evidence. Preserve the original METHOD PATH identity in
research; any corrected operational route needs explicit Issue reconciliation rather than a hidden
alias. Identity/team endpoints appeared in 2026.1; some fields need 2026.2. Do not promise cross-version
or global permission support from the snapshot.

# Acceptance and closure

- [ ] Every 163-ID row remains owned here or explicitly transferred to a linked slice; no silent drop.
- [ ] Each implemented slice has exact public CLI/permission/body/return/projection/pagination/error
      contracts, current official evidence and synthetic native-fetch tests before acceptance.
- [ ] Disabled Update never reaches the service; profile/auth/AppData isolation, error redaction,
      CLI/process/JSON/RPC and any file behavior meet current durable design.
- [ ] Supplemental candidates have explicit independent decisions and counts; excluded boundaries
      are not accidentally exposed as generic proxy commands.
- [ ] Authoring review every 50 and final remainder includes all helper/setup/source/test/proof costs,
      actual same-capability comparisons and required corrections closed before the next batch.
- [ ] Final tests, current public docs, linked commit/PR+CI, required privacy gate and workstream
      close-out support any eventual delivery/closure claim. No release date or completion is implied.

The local source evidence is `.workspace/workstreams/youtrack-rest/classification.json` and its
research sources in the `EyeAuras.CliFactory-1` worktree on `feature/youtrack-v1`; no unpushed remote
blob link is implied. This planning follow-up contains only public official facts and synthetic
contracts, with no live instance address, identity, token or unsanitized response.
