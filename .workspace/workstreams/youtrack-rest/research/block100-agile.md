# Block 100 agile and sprint contract

Status: researched 2026-08-30; root released implementation after independently reviewed Issue publication.
Published Issue body SHA256: 4433757A320C1D6C30664A60ED493BDD403F89EE0A8357748C5F0A5454399C5E.
Six existing P1/v1 identities in classification.json and published inventory parts 1/2; acceptance remains in the block ledger.

| Method/path | CLI | Permission |
|---|---|---|
| GET /api/agiles | agile list | ReadOnly |
| GET /api/agiles/{agileID} | agile get <agile> | ReadOnly |
| GET /api/agiles/{agileID}/sprints | sprint list <agile> | ReadOnly |
| GET /api/agiles/{agileID}/sprints/{sprintID} | sprint get <agile> <sprint> | ReadOnly |
| POST /api/agiles/{agileID}/sprints | sprint create <agile> --body <json> | Update |
| POST /api/agiles/{agileID}/sprints/{sprintID} | sprint update <agile> <sprint> --body <json> | Update |

## Read contracts

Official [agile collection](https://www.jetbrains.com/help/youtrack/devportal/resource-api-agiles.html)
and [agile detail](https://www.jetbrains.com/help/youtrack/devportal/operations-api-agiles.html)
allow fields; the collection additionally documents top/skip. Default:
`id,name,currentSprint(id,name,start,finish,archived),status(valid,hasJobs)`.
Board identity is explicit. No default projects/sprints collection or follow-up requests. currentSprint
may be null. [AgileStatus](https://www.jetbrains.com/help/youtrack/devportal/api-entity-AgileStatus.html)
provides the finite valid/hasJobs booleans; error/warning arrays are not expanded by default.

Official [sprint collection](https://www.jetbrains.com/help/youtrack/devportal/resource-api-agiles-agileID-sprints.html)
and [sprint detail](https://www.jetbrains.com/help/youtrack/devportal/operations-api-agiles-agileID-sprints.html)
allow fields; the collection additionally documents top/skip. Default:
`id,name,goal,start,finish,archived,isDefault,agile(id,name)`.
Preserve nullable goal/start/finish/agile. No issues collection, carryover data or inferred current
sprint expansion. The literal sprint ID `current` is documented for GET and POST and goes directly
to the same endpoint; it is not a new operation or a hidden lookup.

Both list commands use the existing one-page top 50 / skip 0 defaults, top 1..100 and nonnegative
safe-integer skip. Explicit fields remains source-shaped and sparse. Details have no paging/query
flags. IDs remain separately encoded opaque path segments under the selected profile context path.

## Sprint write contract

Creation requires a nonempty name; update requires at least one allowed writable key. Only supplied
keys are sent, so omitted dates/goal/flags remain untouched. Mutation fields is explicit optional
projection; otherwise response uses the sprint default above. Empty success is null, with no retry.

| Key | Accepted value | Semantics |
|---|---|---|
| name | Nonempty single-line string | Required on create; optional on update |
| goal | String or null | Multiline/empty string preserved; explicit null clears |
| start, finish | Safe integer Unix milliseconds or null | No JS precision loss; explicit null clears |
| archived | Boolean | Explicit archive-state change |
| isDefault | Boolean | True makes matching new board issues enter this sprint |
| previousSprint | Object containing only nonempty id, create only | Explicit creation moves unresolved issues from this sprint; never defaulted/inferred |

`issues` appears as writable in the entity table, but the docs do not pin whether a supplied array
replaces/adds membership. Root explicitly deferred membership payloads for this block and
published that limitation in Issue 6 before source work; issues is rejected locally. previousSprint is only
specified for creation; reject it on update rather than inventing a carryover update contract.
Reject null previousSprint, issues, read-only id/agile/unresolvedIssuesCount, arbitrary nested keys, unsupported
body keys, invalid booleans/timestamps/references, and empty updates locally before fetch. No sprint
DELETE, agile mutation, implicit carryover, auto-pagination, notification-muting flags, or board/job
polling in this block. Both POST leaves remain Update even if the payload only changes text.

Evidence will use synthetic MSW fixtures and actual CLI declarations: methods/query/path/body,
null/omission, required bodies, each denied Update before fetch, current alias, one-page boundaries,
profile isolation, recursive credential scrub, safe errors/no retries and persistent RPC. No live
instance, real profile or auth store is part of this delegated work.


