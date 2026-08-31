# B100.3 / B100.6 independent technical review

Reviewer: inventory_reviewer/relations_attachments_review. Date: 2026-08-30.
Scope: [Issue 6](https://github.com/iXab3r/EyeAuras.CliFactory/issues/6), block-100.json, in EyeAuras.CliFactory-1 / feature/youtrack-v1.

## B100.3 verdict: PASS

Nine ReadOnly REST identities are accepted technically. They map to seven CLI leaves; two boolean --direct selectors each choose between ownUsers and aggregate users paths. Count exact REST identities, not declarations. No unresolved findings.

| Exact identity | CLI |
|---|---|
| GET /api/admin/projects/{projectID}/team | project team get <project> |
| GET /api/admin/projects/{projectID}/team/groups | project team group list <project> |
| GET /api/admin/projects/{projectID}/team/ownUsers | project team user list <project> --direct |
| GET /api/admin/projects/{projectID}/team/users | project team user list <project> |
| GET /api/groups | group list |
| GET /api/groups/{groupID} | group get <group> |
| GET /api/groups/{groupID}/ownUsers | group member list <group> --direct |
| GET /api/groups/{groupID}/subGroups | group subgroup list <group> |
| GET /api/groups/{groupID}/users | group member list <group> |

Read the three frozen source/test files, mounted-tree behavior and refreshed group research. Independently checked official [ProjectTeam](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-projects-projectID-team.html), [NestedGroup](https://www.jetbrains.com/help/youtrack/devportal/resource-api-groups-groupID-subGroups.html), [team aggregate users](https://www.jetbrains.com/help/youtrack/devportal/resource-api-admin-projects-projectID-team-users.html) and [direct group users](https://www.jetbrains.com/help/youtrack/devportal/resource-api-groups-groupID-ownUsers.html) references. Group id/name/usersCount and user id/login/fullName are documented finite defaults; ProjectTeam is available since 2026.1, with newer userType intentionally absent. All collection routes document offset pagination. Direct selection chooses a path in one request, without filtering an aggregate response or traversing groups. Sparse/nullable objects stay source-shaped. Permission/version failures remain errors; no Hub fallback or effective-permission claim is made.

Independent command after the lead's coherent build:

```text
node --test integrations/youtrack/dist/tests/group-directory.test.js
```

PASS 15/15, zero failed/skipped. Nine native-fetch/MSW route cases assert exact opaque encoding, default/explicit projections, request count and paging. Tests cover empty and oversized pages, malformed response shapes, local bad IDs/pages, safe 401/403/404/429/500 errors without retries, recursive signed-URL/bearer redaction, all nine actual CLI route variants, ReadOnly denial before HTTP, malformed boolean flags, human/JSON output, and a persistent RPC sequence switching profile and direct/aggregate route. No production edits, builds, real service/profile/keyring access or mutation by the reviewer.

Reviewed SHA-256, relative to integrations/youtrack/:

| File | SHA-256 |
|---|---|
| src/group-directory.ts | DEF9F9332D369F0A84A3F572A62E8B17724EBDCB892F3B91A97EF4E8EAF1F087 |
| src/group-directory-commands.ts | 0880A46B0EF85812C511C1A1908B8138BCD3CBE5A5F307CDAA4FB88A27728CC4 |
| tests/group-directory.test.ts | BDEA5603EF3B3A0281866B0E964B0F311D5B89962B495EE936925677390669FC |

## B100.6 verdict: PASS (direct implementation)

Nine exact identities, five ReadOnly and four Update, are accepted technically at the frozen direct-implementation hashes below. No production findings remain. Article attachments, hierarchy, deletion, tags and derived download are not part of these nine operations.

| Exact identity | Category |
|---|---|
| GET /api/admin/projects/{projectID}/articles | ReadOnly |
| GET /api/articles | ReadOnly |
| GET /api/articles/{articleID} | ReadOnly |
| GET /api/articles/{articleID}/comments | ReadOnly |
| GET /api/articles/{articleID}/comments/{commentID} | ReadOnly |
| POST /api/articles | Update |
| POST /api/articles/{articleID} | Update |
| POST /api/articles/{articleID}/comments | Update |
| POST /api/articles/{articleID}/comments/{commentID} | Update |

Read research/block100-contract-amendment.md; root/author confirmed publication with exact Issue-body readback SHA-256 4433757A320C1D6C30664A60ED493BDD403F89EE0A8357748C5F0A5454399C5E before mutation implementation. The narrow article/comment body fields are explicitly published CLI restrictions. They do not claim complete REST writable-entity coverage.

Independently opened official [article collection](https://www.jetbrains.com/help/youtrack/devportal/resource-api-articles.html), [article operations](https://www.jetbrains.com/help/youtrack/devportal/operations-api-articles.html), [article-comment operations](https://www.jetbrains.com/help/youtrack/devportal/operations-api-articles-articleID-comments.html) and [project articles](https://www.jetbrains.com/help/youtrack/devportal/resource-api-admin-projects-projectID-articles.html). The creation example and draftId guidance require a project for creation from scratch, despite copied existing-id/subarticle prose. No extra existing ID or issue-style query is introduced. Nullable content and comment response fields are preserved. Parent metadata is a read projection only, not a hierarchy command.

Read actual articles.ts, articles-commands.ts and articles.test.ts. All nine bindings match their exact routes and categories. Four writes expose --fields, retain finite defaults, validate approved required/nonempty fields and reject extra root/nested keys. Article creation accepts project.id plus summary and optional content; article updates accept a nonempty summary/content subset. Omitted content stays omitted; empty string and explicit null are preserved. Comment writes accept nonblank multiline text only. There is no silent parent/visibility/project/reporter change, draft helper, mute option or readback request.

Every write has actual-tree denial-before-HTTP coverage. Missing required --body and malformed JSON fail before onboarding/keyring; semantic invalid bodies fail before HTTP after an explicit synthetic-profile grant. Native-fetch/MSW verifies all nine methods/paths, exact JSON, fields, default and explicit offset pagination, opaque ID encoding and sparse/nullable shapes. Tests also cover empty collections, oversized pages, malformed JSON/object shapes, empty successful mutations as null, static remote status/rate-limit errors with no retry, human/JSON signed-URL redaction, and persistent RPC with two profile URLs/tokens plus a denied production mutation. A fixture initially requested ArticleComment.content; the author corrected it to documented text before the reviewed build. Production source needed no correction.

Independent final command after the lead's frozen coherent build:

```text
node --test integrations/youtrack/dist/tests/group-directory.test.js integrations/youtrack/dist/tests/articles.test.js
```

PASS 31/31, zero failed/skipped: groups 15 and articles 16. This exact runner count supersedes an earlier author estimate of 17 article tests. Group source/test hashes are unchanged. No reviewer build, source edit, live request, real profile/keyring access or mutation occurred.

Reviewed article SHA-256, relative to integrations/youtrack/:

| File | SHA-256 |
|---|---|
| src/articles.ts | 835E080D4AC7C099D56198EBADC8C081760F1AEC186AAFAF470C16BB4E84B71B |
| src/articles-commands.ts | 8536D6B9EE14ED8D17196AC9221B410D6D89C11721216FC81E8D841FB1314F25 |
| tests/articles.test.ts | 4893A6E0568154D21D735333F6C40B25B03D58B3E72938FC15269BC3F6749A68 |

Counter advancement is owned by root/scope manager. Shared dependencies, full repository verification, live proof and AR100 remain separately owned. This direct-implementation verdict must be reconciled with any subsequent authoring-review source changes and never authorizes operation 101.
