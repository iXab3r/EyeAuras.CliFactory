# Block 100: group and project-team directory

Official JetBrains references refreshed on 2026-08-30. Root released B100.3 in the reviewed
`block-100.json` before implementation. Nine existing P1 ReadOnly operation identities map to seven CLI leaves;
`--direct` selects an alternate documented method/path, rather than adding a second declaration.

## Exact routes and CLI

All rows use GET and ReadOnly. `G` is `id,name,usersCount`; `U` is `id,login,fullName`.
The field sets are finite defaults, not required response schemas: explicit projections preserve
sparse objects and documented nullable attributes. No nested membership collection is requested.

| Documented route | CLI | Default | Paging |
|---|---|---|---|
| `/api/groups` | `group list` | G | top/skip |
| `/api/groups/{groupID}` | `group get <group>` | G | none |
| `/api/groups/{groupID}/ownUsers` | `group member list <group> --direct` | U | top/skip |
| `/api/groups/{groupID}/subGroups` | `group subgroup list <group>` | G | top/skip |
| `/api/groups/{groupID}/users` | `group member list <group>` | U | top/skip |
| `/api/admin/projects/{projectID}/team` | `project team get <project>` | G | none |
| `/api/admin/projects/{projectID}/team/groups` | `project team group list <project>` | G | top/skip |
| `/api/admin/projects/{projectID}/team/ownUsers` | `project team user list <project> --direct` | U | top/skip |
| `/api/admin/projects/{projectID}/team/users` | `project team user list <project>` | U | top/skip |

All nine endpoints document `fields`. Each paged invocation makes one request: defaults top 50,
skip 0; top 1-100, nonnegative safe integer skip. Details offer no paging flags. IDs stay opaque,
encoded once with the existing dot/control/invalid Unicode safeguards. The server controls
visibility; 401/403/404 are safe errors, not empty directories or implicit fallbacks.

## Group reference findings

[Groups](https://www.jetbrains.com/help/youtrack/devportal/resource-api-groups.html) and
[group detail](https://www.jetbrains.com/help/youtrack/devportal/operations-api-groups.html)
provide group identity, name and user count. The collection also documents an optional search
query; this block defers that optional flag, matching the published `group list` mapping.
Group reads require server group-reading permission and visibility in the group's settings.

[Direct group users](https://www.jetbrains.com/help/youtrack/devportal/resource-api-groups-groupID-ownUsers.html)
are members added to the group itself.
[All group users](https://www.jetbrains.com/help/youtrack/devportal/resource-api-groups-groupID-users.html)
also include transitive members. The CLI must choose the path using `--direct`; it must not
fetch one list then infer/filter membership or enumerate child groups. User display uses the
entity table's `fullName`, not inconsistent older examples of `name`; no email/userType default.

[Subgroups](https://www.jetbrains.com/help/youtrack/devportal/resource-api-groups-groupID-subGroups.html)
returns NestedGroup objects. The inherited id/name/usersCount fields are sufficient for the
default. Do not expand parentGroup, subGroups, ownUsers or users, and do not recursively walk.
The separate direct-membership POST route/sample inconsistency remains outside this read slice.

## Project-team reference findings

[Project team](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-projects-projectID-team.html)
is available since YouTrack 2026.1 and inherits group identity/name/count fields. Detail does not
expand groups, users or ownUsers automatically. No Hub fallback is supported on older servers.

[Team groups](https://www.jetbrains.com/help/youtrack/devportal/resource-api-admin-projects-projectID-team-groups.html)
and [direct team users](https://www.jetbrains.com/help/youtrack/devportal/resource-api-admin-projects-projectID-team-ownUsers.html)
require Read Project or the documented alternative combination involving Read Project Basic and
group/admin privileges. These lists may be denied even when team detail or all users succeeds.

[All team users](https://www.jetbrains.com/help/youtrack/devportal/resource-api-admin-projects-projectID-team-users.html)
includes users from groups added to the team and requires Read Project Basic plus Read User Basic.
`--direct` selects ownUsers, which contains only individually added users. No automatic traversal
or membership editing occurs. The newer userType attribute requires 2026.2 and is not requested
by default. The owner's limited-rights token does not imply access to any of these endpoints.

## Planned implementation and evidence

Own only new `group-directory.ts`, `group-directory-commands.ts` and matching synthetic tests.
Reuse existing read/encoding/paging helpers and injected CLI fixture; no Core or authentication
changes. Export `groupDirectoryRootCommands` and `groupDirectoryProjectChildren` for lead mounting.
Test every exact route (both `--direct` variants), one-request bounds, explicit projections,
empty/sparse results, all ReadOnly gates, encoded selectors, safe errors/redaction, human/JSON/RPC
and cross-profile isolation. No real service calls, keyring use or live fixture collection.


## Implementation evidence

The nine exact routes are implemented in seven service functions and seven declarations under
`group-directory.ts` and `group-directory-commands.ts`. Both direct-member selectors use the
chosen path in a single request, preserving distinct method/path evidence. The lead mounted
both command arrays and exposed their named client exports; this author made no shared changes.

After the lead's serial YouTrack build passed, the focused command
`node --test integrations/youtrack/dist/tests/group-directory.test.js` passed **15/15** tests.
The nine-route table verifies exact encoding, default and explicit fields, paging and one request.
Additional tests prove local selector/bounds rejection, empty lists, sparse/nullable projections,
oversized response rejection, safe 401/403/404/429/500 errors without retry or Hub fallback,
recursive credential scrubbing, actual CLI ReadOnly gates before fetch, both direct variants,
normal human/JSON output and profile-isolated persistent RPC. Malformed boolean forms
`--direct=false`, `--direct false`, `--no-direct`, and `--direct true` all fail before fetch.

Only synthetic MSW and the injected AppData/MemorySecretStore fixture were used. No real service,
profile/keyring, shared build, Core change, or mutation occurred in this author's work.
Source is frozen for independent technical review; operation acceptance remains the root's ledger
responsibility, separate from this test result and the AR100 authoring checkpoint.
