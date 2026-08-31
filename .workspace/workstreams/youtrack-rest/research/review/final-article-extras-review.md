# Final article extras independent technical review

Reviewer: inventory_reviewer/relations_attachments_review. Date: 2026-08-30.
Worktree: EyeAuras.CliFactory-1 / feature/youtrack-v1. Scope authority: [Issue 6](https://github.com/iXab3r/EyeAuras.CliFactory/issues/6), block-118.json B118.2. Root release A3E0AB6 confirmed by the source owner before implementation.

## Verdict: PASS, six direct-implementation operations

Five ReadOnly operations and one Update operation are technically accepted at the hashes below. There are no unresolved production findings. Root/scope manager owns the accepted counter; this verdict does not accept the separately reviewed derived download or close AR118. A later upload-helper authoring trial must be reconciled separately.

| Exact REST identity | CLI | Category |
|---|---|---|
| GET /api/articles/{articleID}/attachments | article attachment list <article> | ReadOnly |
| POST /api/articles/{articleID}/attachments | article attachment upload <article> --file <path> | Update |
| GET /api/articles/{articleID}/attachments/{attachmentID} | article attachment get <article> <attachment> | ReadOnly |
| GET /api/articles/{articleID}/childArticles | article child list <article> | ReadOnly |
| GET /api/articles/{articleID}/childArticles/{articleID} | article child get <article> <child> | ReadOnly |
| GET /api/articles/{articleID}/parentArticle | article parent get <article> | ReadOnly |

## Contract and source review

Read article-extras.ts, article-extras-commands.ts, the existing articles-commands.ts child mount, article-extras.test.ts, shared nullable-object implementation/regression, manifest and official research. Independently checked [article attachment collection](https://www.jetbrains.com/help/youtrack/devportal/resource-api-articles-articleID-attachments.html), [child detail](https://www.jetbrains.com/help/youtrack/devportal/operations-api-articles-articleID-childArticles.html) and [parent detail](https://www.jetbrains.com/help/youtrack/devportal/operations-api-articles-articleID-parentArticle.html).

The repeated child route placeholder is preserved in the census but mapped to distinct article and child CLI arguments. Each is separately encoded once; no inferred child selection, recursive traversal, relation mutation, unlink or additional request exists. Collections use the documented bounded offset contract; detail requests expose fields only. Finite defaults retain existing article list/detail shapes and attachment id/name/size/mimeType without URLs or embedded collections.

The official parent endpoint has an object example but does not guarantee an absent-parent response. The implementation preserves literal JSON null only when a successful response actually contains it. It does not convert 403/404, malformed JSON, empty/204 response, arrays or scalars into null, and adds no discovery GET. Existing strict readers still reject literal null. Recursive response scrubbing applies to the nullable object before output.

Upload exposes documented --fields and the fixed metadata default. It sends one explicitly selected regular file as upload1 with native FormData/fetch, a generated multipart boundary, basename-only filename and unchanged bytes. openAsBlob avoids a whole-file application buffer and checkout copy. No base64 request, implicit file discovery, guessed upload cap, notification suppression, retry, verification GET or binary download is added. Missing/blank/control file syntax is checked before onboarding; actual stat/open happens after the factory Update gate and before HTTP. All local/remote errors are sanitized. Nonempty success is an object array, including empty or multi-item arrays; empty successful HTTP body is null. Signed URLs remain redacted even when explicitly projected.

## Independent verification

After the lead's coherent Core/TeamCity/YouTrack build, ran:

```text
node --test integrations/youtrack/dist/tests/article-extras.test.js integrations/youtrack/dist/tests/client.test.js
```

PASS **24/24**, zero failed/skipped: article extras 14 and shared client 10. The reviewer did not run a build.

Meaningful evidence includes all six actual command routes and native-fetch contracts; distinct encoded parent/child/attachment IDs; default and explicit fields, exact top/skip and one-page behavior; sparse/nullable metadata; parent object/null/error distinction and strict-reader regression; exact multipart bytes/name/type/part/boundary; default and explicit upload projections; array/null/malformed upload responses; safe 403/413/429/500/transport errors without retries or foreign-origin following; local file failures without private paths; all ReadOnly denials and Update denial before stat/open/HTTP; missing/syntax errors before keyring; human/JSON redaction and JSON null; and persistent RPC with two profile URLs/tokens, safe upload output and another profile's denied mutation.

Only synthetic MSW, temporary test files and injected AppData/MemorySecretStore were used. No reviewer production edits, service calls, real profile/keyring access, commits or publication occurred. Derived-download security remains owned by inventory_reviewer and is not claimed by this report.

## Reviewed SHA-256

Paths relative to integrations/youtrack/.

| File | SHA-256 |
|---|---|
| src/article-extras.ts | 391B1B68C434242B760851EBF555BAB6DB9BD17574BE45BF6245BDDF51E6A900 |
| src/article-extras-commands.ts | A0D072BE122F3877EBF5A1392577E0046C9DA7BB49D77AC58C924168034295CA |
| src/articles-commands.ts | 8D7F73456A0DAD685E9587DF88107CF134F89BCDEC288C4444089533F7372B1F |
| tests/article-extras.test.ts | C16889FC7370F9FE9A3C25B0417B33BC2566705D2BA9321630325B3008A20AF0 |
| src/client.ts (shared-dependency snapshot) | 5B4A2D04479F2D9E4B7634279FD6C5E9607635E70336BFC2CBACB78F1C3392A2 |
| tests/client.test.ts (shared-dependency snapshot) | 4770C19DE4C61EE8A61016118763C8E760C3B19BAB7245EB8A19ADF24B71E068 |

## AR118 multipart preparation trial: PASS

Reviewed the root-authorized trial against exact direct snapshot
`research/authoring-baseline/snapshots/ar118-direct.json`, SHA-256
9A671DD6714AA3FAAF34AAF3E318D65C5BA778CCD724FEB7E509C0911C127C36.
The earlier direct verdict is now reconciled with this accepted helper implementation.

Only the two upload callers and new integration-local attachment-form.ts participate. Independently compared snapshot source text with current source: both caller diffs are exactly the filesystem import replacement, removal of the requiredText import, and replacement of the existing preparation block with `await attachmentForm(filePath)`. The helper contains that preparation block verbatim; all remaining caller text is unchanged. The helper is not a Core API, HTTP abstraction, command factory or lifecycle policy. It takes one explicit path and returns native FormData, adding one local asynchronous preparation call per upload.

Issue/article IDs still validate before preparation; the article's explicit/default projection also validates before any filesystem access. CLI declarations and Update gates are unchanged, so the helper is reached only within the already-gated handler. File-text validation, stat/isFile, openAsBlob, static local error, sole upload1 part, basename, bytes and native Content-Type behavior remain identical. No new copy, discovery, retry or return conversion occurs. Existing request/response handling still owns headers, redirection, errors, scrubbing and array/null results.

Independent full local cost of affected production modules, including imports and the new helper: issue-attachments.ts 60 to 47 nonblank lines; article-extras.ts 101 to 88; attachment-form.ts adds 18. Total **161 to 153, minus 8**. This is a small concrete reduction shared by two existing consumers, without formatting compression or an uncounted helper. All tests remained unchanged.

After the lead's fresh coherent build, independently ran:

```text
node --test integrations/youtrack/dist/tests/issue-attachments.test.js integrations/youtrack/dist/tests/article-extras.test.js
```

PASS **29/29**, zero failed/skipped: issue attachments 15, article extras 14. Both consumer suites retain actual native multipart bytes/name/boundary/projection checks, denial before stat/open/HTTP, static file/remote error checks, arrays/null, no redirect following/retry, and profile-isolated CLI/RPC redaction. The reviewer ran no build and edited no production source. Overall final-snapshot verification and repository-wide authoring acceptance remain separately owned by the lead/repo_contract.

Trial SHA-256, relative to integrations/youtrack/:

| File | SHA-256 |
|---|---|
| src/attachment-form.ts | 20D74774675B5AD3B5E9029DA07A7D7B3839DCFE1093587F19AA803DC2D365BF |
| src/issue-attachments.ts | A21B7EAC17752247278514730303A4D2EA18C2B1406895AE23E6C73A28721004 |
| src/article-extras.ts | 1E3A0860DE97890DCBF15FFB621B359F11A0EF9B35065A4F50E4AC9E8946028B |
| tests/issue-attachments.test.ts (unchanged) | 75500B3337DC99E3B8F9C6DA74762786BB298131E7671F0E7F5D82110E031845 |
| tests/article-extras.test.ts (unchanged) | C16889FC7370F9FE9A3C25B0417B33BC2566705D2BA9321630325B3008A20AF0 |
