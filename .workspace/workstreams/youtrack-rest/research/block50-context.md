# Block 50 context contract

Refreshed 2026-08-30 from official JetBrains documentation. Seven planned method/path operations;
implementation evidence and acceptance remain owned by the block ledger, not this note.

- Activity pages: [global](https://www.jetbrains.com/help/youtrack/devportal/operations-api-activitiesPage.html)
  and [issue](https://www.jetbrains.com/help/youtrack/devportal/operations-api-issues-issueID-activitiesPage.html).
  Required categories accepts comma-separated category IDs. Both support cursor, reverse, start/end
  (UTC Unix milliseconds), author and activityId. Only global supports issueQuery. For this block,
  CLI exposes categories, cursor, reverse and fields only; all other optional filters are deferred.
  Each invocation performs one request and returns
  the page object, including beforeCursor/afterCursor, hasBefore/hasAfter and reverse by default.
  No top, skip, page-size, implicit traversal or client-imposed item cap. Examples in the docs mention
  offset parameters but the parameter tables and cursor rationale do not establish that contract;
  this CLI deliberately exposes only the listed cursor controls.
- [ActivityItem](https://www.jetbrains.com/help/youtrack/devportal/api-entity-ActivityItem.html) and
  [categories](https://www.jetbrains.com/help/youtrack/devportal/api-entity-ActivityCategory.html):
  default activity projection includes id, type, timestamp, author ID/login and category ID; no added,
  removed, target or other unbounded expansions. Categories remain service strings, not a frozen enum.
  Explicit fields is source-shaped and may select sparse data. Supplied cursor envelope members are
  type-checked; default requests require the complete cursor envelope, while explicit fields may
  return sparse projections. The client never invents missing cursors or discards metadata.
- [Specific comments](https://www.jetbrains.com/help/youtrack/devportal/operations-api-issues-issueID-comments.html):
  GET defaults to id,text,author(id,login),created,updated; nullable text/author/updated are preserved.
  POST is Update and accepts only nonempty text, including multiline text. This is a deliberate CLI
  slice limitation: the REST entity has additional writable attributes. No deleted, visibility,
  attachments, reactions, pinned or mute-notification control is exposed. Empty mutation success is
  JSON null, no retries; response projection matches existing comment commands.
- [Sprints](https://www.jetbrains.com/help/youtrack/devportal/resource-api-issues-issueID-sprints.html):
  one offset page with fields/top/skip only. Default fields id,name,goal,start,finish,archived,agile(id,name).
  Nullable goal/start/finish/agile remain unchanged; no nested issues collection.
- VCS [list](https://www.jetbrains.com/help/youtrack/devportal/resource-api-issues-issueID-vcsChanges.html)
  and [detail](https://www.jetbrains.com/help/youtrack/devportal/operations-api-issues-issueID-vcsChanges.html):
  list supports fields/top/skip; detail fields only. Both may return VcsChange or PullRequest. Default
  common projection id,$type,date,fetched,text,author(login) avoids incompatible subtype state shapes;
  explicit fields can select subtype details. Nullable fetched/text remain unchanged. There is no
  follow-up to repository URLs. Shared recursive scrub removes credential-bearing URLs and tokens.

All six reads declare ReadOnly; comment update declares Update. IDs are opaque encoded segments
under the selected profile URL/context path. No live instance or keyring was accessed for this work.

