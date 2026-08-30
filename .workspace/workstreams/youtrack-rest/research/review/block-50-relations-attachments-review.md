# B50.3 / B50.6 independent technical review

Reviewer: inventory_reviewer/relations_attachments_review. Date: 2026-08-30.
Worktree: EyeAuras.CliFactory-1, feature/youtrack-v1. Scope authority: [Issue 6](https://github.com/iXab3r/EyeAuras.CliFactory/issues/6), scheduled by block-50.json.

## Verdict

- B50.3 PASS: twelve scheduled operations, eight ReadOnly and four Update.
- B50.6 PASS: three scheduled operations, two ReadOnly and one Update.

This is technical acceptance for these fifteen identities at the hashes below. The root/scope owner advances the accepted counter. Shared-client acceptance, repository-wide verification, live proof and AR50 remain separately owned. Operation 51 is not authorized by this review. Derived attachment download remains outside this block and contributes no accepted endpoint.

## Exact accepted identities

| Group | Identity | Category |
|---|---|---|
| B50.3 | GET /api/issueLinkTypes | ReadOnly |
| B50.3 | GET /api/issueLinkTypes/{typeID} | ReadOnly |
| B50.3 | GET /api/issues/{issueID}/links | ReadOnly |
| B50.3 | GET /api/issues/{issueID}/links/{linkID} | ReadOnly |
| B50.3 | GET /api/issues/{issueID}/links/{linkID}/issues | ReadOnly |
| B50.3 | POST /api/issues/{issueID}/links/{linkID}/issues | Update |
| B50.3 | DELETE /api/issues/{issueID}/links/{linkID}/issues/{issueID} | Update |
| B50.3 | GET /api/tags | ReadOnly |
| B50.3 | GET /api/tags/{tagID} | ReadOnly |
| B50.3 | GET /api/issues/{issueID}/tags | ReadOnly |
| B50.3 | POST /api/issues/{issueID}/tags | Update |
| B50.3 | DELETE /api/issues/{issueID}/tags/{tagID} | Update |
| B50.6 | GET /api/issues/{issueID}/attachments | ReadOnly |
| B50.6 | GET /api/issues/{issueID}/attachments/{attachmentID} | ReadOnly |
| B50.6 | POST /api/issues/{issueID}/attachments | Update |

## Independent evidence and findings

Read the actual family clients, command declarations, tests, mounted main tree, shared-helper interfaces, Issue contract and refreshed official-resource notes. Independently opened the official link/type/group/add/unlink/tag/add/untag and attachment collection/upload references. The [link-add method](https://www.jetbrains.com/help/youtrack/devportal/resource-api-issues-issueID-links-linkID-issues.html) and [tag-add method](https://www.jetbrains.com/help/youtrack/devportal/resource-api-issues-issueID-tags.html) explicitly require the target database id. Their id-only bodies do not invent a name/readable-ID selector. Direction markers s/t/no-marker remain opaque caller input, without hidden discovery. The repeated unlink placeholder maps to a separate targetIssueID argument; exact-path tests prove neither source nor target issue deletion. Tag removal addresses the issue assignment, never the global tag.

Lists issue exactly one bounded request using documented top/skip; finite defaults omit embedded issue collections and attachment URLs. Detail projections remain sparse/source-shaped and preserve nullable fields. Each of the four relationship mutations has its own actual-tree denial-before-fetch assertion, enabled-profile request, other-profile denial, exact method/path/body checks, empty-body null, malformed-result rejection and remote-error/no-retry evidence.

The [official upload use case](https://www.jetbrains.com/help/youtrack/devportal/api-usecase-attach-files.html) documents multipart upload fields and an array response. Actual tests inspect native multipart boundary, sole upload1 part, basename, octet-stream MIME and exact binary bytes. The explicit selected regular file uses openAsBlob without a copied file or whole-file application buffer. File stat/open happen inside the Update-gated handler; parser checks only required argument presence/text syntax before onboarding. Instrumented denial tests see zero stat/open and HTTP calls. Missing/directory/open-failure cases produce static diagnostics without local paths. No arbitrary client byte cap or metadata-driven download is introduced; server 413 remains an error. Native redirects fail without another-origin request, writes never retry, and malformed JSON/non-array/non-object elements fail.

Upload preserves the documented array, including empty or multi-item returned arrays; an empty successful HTTP body is null. A stale research sentence initially promised an unsupported one-result cap. The author corrected the research note to match source and tests; no production change was necessary. Attachment RPC tests exercise two isolated profile URLs/tokens and an upload, with signed URL redaction in returned metadata. Recursive scrubbing occurs before all presentation paths. Actual CLI tests cover JSON/human results; shared output logic is unchanged.

Independent offline command, after the lead's coherent build:

```text
node --test integrations/youtrack/dist/tests/issue-relations.test.js integrations/youtrack/dist/tests/issue-attachments.test.js
```

PASS 34/34, zero failed/skipped: relations 19, attachments 15. Final test-only additions were independently read and re-run after the first 32/32 pass; they add all eight ReadOnly denials, malformed/missing body CLI failures, JSON DELETE null and persistent RPC successful mutation/redaction/denial/continuation. No build was launched by this reviewer. No source edits, real service/profile/keyring access, live mutations, commits or publication occurred.

## Reviewed SHA-256

Paths below are relative to integrations/youtrack/.

| File | SHA-256 |
|---|---|
| src/issue-relations.ts | 7D61D0D514EA1D356FA8DDB779D6BD837EA7686089A5FA50B6A4C7A7D751D439 |
| src/issue-relations-commands.ts | D43419D003344C77C76F9A73F9E2955F3B4ACDE21FA132FCCFC8DB6914C2EC9C |
| tests/issue-relations.test.ts | DDAEAD4BF9C9FF84E589354D7E1C13447BD8357C093F2022A8663CEE3C91F556 |
| src/issue-attachments.ts | 164E6D2CF6F294A6B3C0CC02958C2AF635A65DFE9E9AD1CA97731ABF3E1E029D |
| src/issue-attachments-commands.ts | 1A2C6B38E470DAE7984E65BA376A781723A49F0F6344754922AD08D3055EA31C |
| tests/issue-attachments.test.ts | 75500B3337DC99E3B8F9C6DA74762786BB298131E7671F0E7F5D82110E031845 |
| src/cli.ts (mounted-tree snapshot) | DB99EF8A5350391B6657830E235FB3093A8F65C5297D35021FB45F56EBC8F54E |
| src/client.ts (shared-dependency snapshot) | 14450CD5A9896935CFB352373AEE1F10C6946CC77DF5B773B320DA0F62E233F7 |
| src/cli-support.ts (shared-dependency snapshot) | 14013884F0F830CE78C460CC4B5E0A792EBB2363AE7C07DADC6F9979D99B9C35 |

