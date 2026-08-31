# Block 50: issue links and tags

Refreshed 2026-08-30 from the official JetBrains resource and method references below.
Scope is the twelve B50.3 identities in `../block-50.json` (eight ReadOnly, four Update).
No live service, profile or credentials were used for this research.

## Link semantics

[Link types](https://www.jetbrains.com/help/youtrack/devportal/resource-api-issueLinkTypes.html)
and [link-type detail](https://www.jetbrains.com/help/youtrack/devportal/operations-api-issueLinkTypes.html)
support list/detail reads. Default projection: `id,name,directed,sourceToTarget,targetToSource`.

[Issue links](https://www.jetbrains.com/help/youtrack/devportal/resource-api-issues-issueID-links.html)
and [link detail](https://www.jetbrains.com/help/youtrack/devportal/operations-api-issues-issueID-links.html)
return link groups with `direction` and nullable `linkType`. Default projection:
`id,direction,linkType(id,name,directed,sourceToTarget,targetToSource)`.
The default excludes embedded issue collections; the explicit bounded child command reads their
identities. This prevents an implicit unbounded expansion while retaining the service structure.
Explicit `--fields` remains the existing source-shaped opt-in, with recursive secret scrubbing.

[Linked issues](https://www.jetbrains.com/help/youtrack/devportal/resource-api-issues-issueID-links-linkID-issues.html)
provides one-page GET and POST to add one existing target. POST accepts exactly `{ "id": "fixture-target" }`:
the target's database ID, not its readable display ID. Link IDs encode direction: append `s` for
outward, `t` for inward, and no marker for an undirected type. The CLI accepts that full opaque
link ID without inferring direction or doing discovery. Linked read/add results default to
`id,idReadable,summary`.

[Unlink](https://www.jetbrains.com/help/youtrack/devportal/operations-api-issues-issueID-links-linkID-issues.html)
uses DELETE `/api/issues/{issueID}/links/{linkID}/issues/{issueID}`. The final placeholder is the
*target* to unlink, so CLI arguments are separately named `issueID`, `linkID`, `targetIssueID`.
It removes a relationship, never either issue. The reference provides no response body sample;
empty successful responses normalize to JSON null under the existing CLI contract. A returned
object is sanitized. Failure, including 404, stays an error and is never automatically retried.

## Tag semantics

[Tag list](https://www.jetbrains.com/help/youtrack/devportal/resource-api-tags.html)
and [tag detail](https://www.jetbrains.com/help/youtrack/devportal/operations-api-tags.html)
read visible tags; the finite default is `id,name`, without users or tagged issue expansion.
List supports documented offset paging. Optional server tag-name query exists but is outside
this block's published command mapping; no inferred query is added.

[Issue tags](https://www.jetbrains.com/help/youtrack/devportal/resource-api-issues-issueID-tags.html)
provides paged GET and POST of an existing tag by database ID only: `{ "id": "fixture-tag" }`.
The CLI deliberately has no create-tag payload at this endpoint. Unsupported keys fail locally.
Read/add projections are `id,name`. Although the server method permission includes Read Issue,
assigning a tag has a side effect, so the CLI category is Update.

[Remove issue tag](https://www.jetbrains.com/help/youtrack/devportal/operations-api-issues-issueID-tags.html)
is DELETE `/api/issues/{issueID}/tags/{tagID}`. It removes that assignment and does not delete
the global tag. Empty/object/error treatment is the same as unlink. See also the official
[tag/untag workflow](https://www.jetbrains.com/help/youtrack/devportal/api-usecase-add-remove-tags.html).

## Shared local invariants and evidence

Every list uses one request, top 50/skip 0 defaults and accepted top 1-100/nonnegative safe skip.
Each path ID is a separately encoded opaque segment; reject raw dot/dotdot and control characters,
preserve literal percent text by encoding once. Reference bodies reject missing/empty IDs and
extra keys. Writes are Update, disabled by default and checked before fetch; no hidden discovery,
notification suppression, permission grants or retries. All validation uses synthetic MSW data.

Implementation and test evidence will be added after the contract and source review.

## Implementation evidence

Root accepted the pinned twelve-operation contract before source implementation. The direct
client lives in `integrations/youtrack/src/issue-relations.ts`; twelve leaves are declared in
`issue-relations-commands.ts` and mounted in the actual CLI by the lead author. Existing client
helpers provide encoding, projections, paging, request safety, mutation parsing and scrubbing;
DELETE uses the lead's shared `deleteObject` with no separate fetch path. No Core changes were
made by this domain author. Optional global tag-name query remains explicitly deferred.

Tests were authored first; initial compilation failed on the absent domain module. After source
and lead wiring, the YouTrack build and `node --test integrations/youtrack/dist/tests/issue-relations.test.js`
passed **19/19**. Tests cover eight exact GET routes, four exact write routes, independent opaque
selectors, default/explicit paging and projections, no hidden reads, sparse/null attributes,
empty lists, body validation, dot/control/invalid Unicode rejection, 204/null results, sanitization,
malformed responses, safe 400/401/403/404/409/429/500 failures and no retry. Actual CLI tests cover
all twelve leaves, all ReadOnly/Update gates before fetch, per-profile permissions/credentials,
normal JSON/human output and persistent RPC continuing after a denied mutation. Tests use the
shared injected AppData/MemorySecretStore fixture and synthetic MSW; no real writes occurred.

Independent review and final aggregate evidence belong to the block ledger/review records;
this domain record does not itself advance accepted-operation counters.
