# B100 articles contract refresh

Status: released and technically accepted. Root published the independently reviewed body contract in Issue 6 and verified exact readback (SHA256 4433757A320C1D6C30664A60ED493BDD403F89EE0A8357748C5F0A5454399C5E) before implementation. Independent source/boundary review accepted all nine operation IDs.
Refreshed 2026-08-30. Nine existing P1/v1 inventory IDs; no article attachments, hierarchy operations, deletion, tag management, or derived download in this block.

| REST operation | Frozen CLI mapping | Category |
|---|---|---|
| GET /api/articles | article list | ReadOnly |
| GET /api/articles/{articleID} | article get <article> | ReadOnly |
| POST /api/articles | article create --body <json> | Update |
| POST /api/articles/{articleID} | article update <article> --body <json> | Update |
| GET /api/articles/{articleID}/comments | article comment list <article> | ReadOnly |
| GET /api/articles/{articleID}/comments/{commentID} | article comment get <article> <comment> | ReadOnly |
| POST /api/articles/{articleID}/comments | article comment add <article> --body <json> | Update |
| POST /api/articles/{articleID}/comments/{commentID} | article comment update <article> <comment> --body <json> | Update |
| GET /api/admin/projects/{projectID}/articles | project article list <project> | ReadOnly |

## Request and result evidence

[Articles](https://www.jetbrains.com/help/youtrack/devportal/resource-api-articles.html) documents fields, $top and $skip for listing, without query. Creation from scratch requires a project, despite the copied sub-article/id sentence; its example supplies project, summary and content. The existing Issue already reconciles this discrepancy. No draft publishing or notification suppression is proposed.

[Article detail](https://www.jetbrains.com/help/youtrack/devportal/operations-api-articles.html) accepts database or readable IDs and fields. Attributes include nullable summary, content, parentArticle, reporter and visibility. Project is read-only on an existing article. Read defaults proposed: id,idReadable,summary,project(id,shortName),updated; detail adds content,parentArticle(id,idReadable),created. Write results use id,idReadable,summary,updated. Parent metadata is read only by this slice; no implied hierarchy mutation.

[Project articles](https://www.jetbrains.com/help/youtrack/devportal/resource-api-admin-projects-projectID-articles.html) lists articles via fields/$top/$skip, without query. It uses the same finite article-list projection.

[Comment collection](https://www.jetbrains.com/help/youtrack/devportal/resource-api-articles-articleID-comments.html) supports fields/$top/$skip and requires text to add a comment. [Comment detail](https://www.jetbrains.com/help/youtrack/devportal/operations-api-articles-articleID-comments.html) supports fields; its update sample changes text. Text, author and updated can be null in responses. Default comment projection: id,text,author(id,login),created,updated. Lists return arrays; detail and nonempty mutation results return objects. Empty successful mutation bodies follow the accepted CLI convention and return null.

## Published bounded write contract

- Article create: project containing only a nonblank id, nonblank summary, optional content string or null.
- Article update: nonempty subset of summary and content; nonblank summary when supplied; content string or null.
- Comment add/update: text only, nonblank and multiline-safe.
- Read and write commands expose --fields; mutation defaults stay finite, and explicit projections retain source-shaped sparse responses.
- Preserve omitted fields; never infer parent/visibility/project changes or clear omitted content.
- Reject extra body keys locally. This is a deliberate initial body restriction requiring explicit Issue reconciliation, not a claim that the REST entity has no other writable fields.

ParentArticle is writable and nullable. Visibility can be nullable and polymorphic: [LimitedVisibility](https://www.jetbrains.com/help/youtrack/devportal/api-entity-LimitedVisibility.html) contains permittedUsers/permittedGroups; [UnlimitedVisibility](https://www.jetbrains.com/help/youtrack/devportal/api-entity-UnlimitedVisibility.html) has no additional attributes. The proposed narrative slice excludes both, together with reporter, hasStar, tags, nested attachments/children/comments, and comment pinned/reactions/attachments. Later reviewed body expansion does not add REST operation counts.

## Verified evidence

The direct implementation reuses integration-local body/fields/page/encodedID/mutate/read helpers, existing narrative validation, and the actual CLI fixture. The focused articles.test suite passed 16/16 for the author and independently for the reviewer. Native-fetch MSW covers nine method/path/query contracts, exact body omission/null/multiline behavior, malformed local input, sparse nullable results and recursive secret URL scrubbing. All four Update denials and five ReadOnly gates are tested before HTTP, alongside machine/human output, persistent RPC/profile isolation, safe errors and no retries. The reviewer corrected one synthetic comment-projection example from content to its documented text field; no production finding remained. Lead reported the coherent repository suite PASS 312 (Core 25, TeamCity 36, YouTrack 251). No real profile, keyring, service mutation, or private fixture data was used. Direct source remains frozen for the AR100 snapshot before any optional nullable-text simplification.

