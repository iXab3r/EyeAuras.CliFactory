# B118 article extras contract refresh

Status: root released all six operations after the independently reviewed Issue 6 amendment was published and exactly read back (body SHA256 prefix A3E0AB6). Direct source and tests are frozen and all six operations passed independent technical review. Refreshed 2026-08-30. Six existing P1/v1 REST IDs; no article binary download or hierarchy mutation.

| REST operation | Frozen CLI mapping | Category |
|---|---|---|
| GET /api/articles/{articleID}/attachments | article attachment list <article> | ReadOnly |
| GET /api/articles/{articleID}/attachments/{attachmentID} | article attachment get <article> <attachment> | ReadOnly |
| POST /api/articles/{articleID}/attachments | article attachment upload <article> --file <path> | Update |
| GET /api/articles/{articleID}/childArticles | article child list <article> | ReadOnly |
| GET /api/articles/{articleID}/childArticles/{articleID} | article child get <article> <child> | ReadOnly |
| GET /api/articles/{articleID}/parentArticle | article parent get <article> | ReadOnly |

## Official endpoint evidence

[Attachment collection](https://www.jetbrains.com/help/youtrack/devportal/resource-api-articles-articleID-attachments.html) documents fields/$top/$skip for list and fields for POST. Its upload guidance links the same [multipart use case](https://www.jetbrains.com/help/youtrack/devportal/api-usecase-attach-files.html) used by issue uploads: separate part names, file bytes, array response. The CLI sends one explicit regular file as upload1 using native FormData/fetch. No JSON/base64 upload, implicit discovery, file copies, retry, verification GET, or notification suppression.

[Attachment detail](https://www.jetbrains.com/help/youtrack/devportal/operations-api-articles-articleID-attachments.html) accepts fields, not pagination. Defaults are id,name,size,mimeType for all attachment metadata responses. MIME and URL can be null; URL is omitted from defaults, and all credential-bearing URL selections are recursively scrubbed. No attachment URL is fetched by these commands.

[Child collection](https://www.jetbrains.com/help/youtrack/devportal/resource-api-articles-articleID-childArticles.html) supports fields/$top/$skip. [Child detail](https://www.jetbrains.com/help/youtrack/devportal/operations-api-articles-articleID-childArticles.html) repeats articleID in the documented resource template; its example establishes the first as parent and second as target child. The CLI keeps distinct article and child arguments and encodes both once. Only reads are scoped: no linking, unlinking, or recursive traversal.

[Parent detail](https://www.jetbrains.com/help/youtrack/devportal/operations-api-articles-articleID-parentArticle.html) documents one GET with fields and an object sample. Its Article entity lists parentArticle as nullable. The endpoint text does not explicitly define the response/status for an article without a parent.

## Reviewed result and safety contract

Collection defaults use existing top 50/skip 0, accept top 1-100 and nonnegative safe skip, and fetch only one page. Child-list fields match shipped article-list fields; child/parent detail fields match shipped article detail, including content and parent identity but no nested collections.

The published parent GET contract preserves a successful JSON null as an absent relationship, while malformed JSON, empty HTTP body, arrays, scalar values, 403 and 404 remain failures. Do not translate failures to null or add discovery requests. A concrete integration-local nullable-object reader keeps existing strict object readers unchanged.

Upload follows the accepted issue implementation: syntactic --file validation before onboarding, stat/open inside the Update handler before HTTP, file-backed openAsBlob, basename-only filename, static safe errors and no guessed server upload cap. Returned JSON must be an object array; an empty successful HTTP body becomes null under the existing mutation contract. Empty arrays are valid; no undocumented array-length restriction is added. Article upload supports --fields, validated before file inspection; its default remains id,name,size,mimeType.

## Verified evidence

The author and independent reviewer each passed all 14 compiled article-extra tests; the reviewer also passed 10 shared client tests, including nullable-parent versus strict-object behavior. The lead's coherent repository build passed before these runs. Native-fetch MSW and actual CLI/RPC tests cover all six methods/paths, distinct opaque parent/child IDs, fields/pagination, sparse and nullable metadata, parent object/null/error distinction, multipart bytes/name/upload1/boundary and response shape. Coverage includes ReadOnly and Update denials before HTTP, Update denial before stat/open, local-file error sanitization, signed-URL redaction in machine/human/RPC results, profile separation and no retries/downloads. No real profile, credentials, private fixtures, filesystem copies or service mutations.

DIRECT freeze hashes: article-extras.ts 391B1B68, article-extras-commands.ts A0D072BE, existing article branch mount 8D7F7345, article-extras.test.ts C16889FC (SHA256 prefixes). No production finding remained. The duplicated issue/article multipart setup is retained for the coherent DIRECT118 snapshot before any separately reviewed authoring reduction.
