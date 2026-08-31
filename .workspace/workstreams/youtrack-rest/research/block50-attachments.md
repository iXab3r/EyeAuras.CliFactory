# B50 attachment contract refresh

Refreshed 2026-08-30 from official JetBrains documentation. Scope: three inventory operations; derived binary download remains outside this block.

| Operation | CLI | Permission | Result |
|---|---|---|---|
| GET /api/issues/{issueID}/attachments | issues attachments list <issueID> | ReadOnly | Object array, one bounded page |
| GET /api/issues/{issueID}/attachments/{attachmentID} | issues attachments get <issueID> <attachmentID> | ReadOnly | One object |
| POST /api/issues/{issueID}/attachments | issues attachments upload <issueID> --file <path> | Update | Object array or null for empty success |

The [collection reference](https://www.jetbrains.com/help/youtrack/devportal/resource-api-issues-issueID-attachments.html) documents list fields/$top/$skip and upload fields. Default projection: id,name,size,mimeType. Name/id are strings, size is bytes; mimeType may be null. URL is optional and nullable, and is never selected by default. The [detail reference](https://www.jetbrains.com/help/youtrack/devportal/operations-api-issues-issueID-attachments.html) supports fields without pagination. Explicit projections preserve sparse objects and documented nullable fields.

The [upload use case](https://www.jetbrains.com/help/youtrack/devportal/api-usecase-attach-files.html) uses separate multipart fields for each file and returns an array. This CLI accepts exactly one file, uses part name upload1, and preserves its basename. It does not create an issue, set notification suppression, follow returned URLs, or fetch a settings endpoint. The [multipart troubleshooting guide](https://www.jetbrains.com/help/youtrack/devportal/api-troubleshoot-attachment-boundary.html) requires a boundary matching the body: native FormData/fetch owns Content-Type.

[Cloud settings](https://www.jetbrains.com/help/youtrack/cloud/server-configuration-settings.html) and [Server settings](https://www.jetbrains.com/help/youtrack/server/server-configuration-settings.html) make the upload limit configurable. There is no guessed client limit or automatic administrator read. A regular file is passed through [Node openAsBlob](https://nodejs.org/api/fs.html#fsopenasblobpath-options), without a copied file or an application-sized in-memory buffer. Stat and opening are both inside the Update handler. Failure messages contain neither local path/content nor raw remote diagnostics. Changing a file during reading can fail the upload safely.

The endpoint documentation does not promise an exact success status or empty-success response. The integration follows its existing mutation contract: nonempty JSON must have the documented array shape; empty successful HTTP body becomes null. The documented response is an array; no undocumented result-count cap is added, and an empty array remains valid. No retry or automatic verification GET occurs. All response strings, including explicit signed URL projections, pass through the existing recursive scrubber.

Evidence: YouTrack workspace build PASS; focused issue-attachments.test suite PASS 15/15. MSW at native fetch validates methods, context and opaque IDs, fields/paging, multipart field/boundary/name/binary bytes, source arrays/empty success, recursive redaction, malformed results, permission/size/rate/transport errors, no retries or cross-origin following. Actual CLI verifies JSON/human reads, upload result, denial before stat/open/fetch, missing or syntactically invalid file before keyring, and persistent RPC with two profiles plus upload. Both local stat/open errors use static messages. No real service, profile, keyring, mutation, or private data used by this author.
