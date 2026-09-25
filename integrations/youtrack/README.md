# YouTrack CLI

The scoped package provides the `youtrack-cli` command:

```sh
npm install --global @eyeauras/youtrack-cli
youtrack-cli --help
youtrack-cli profile configure
```

Requires Node.js 22+ and npm. Compiled JavaScript and the Core dependency are installed
automatically; no repository checkout, .NET, TypeScript compiler or browser is needed.
Interactive profile configuration guides endpoint/authentication setup; secrets use the
OS credential store. Existing `youtrack-cli` profiles and permissions are unchanged.
Licensed under MIT. See the [release guide](https://github.com/iXab3r/EyeAuras.CliFactory/blob/main/docs/npm-release.md).

YouTrack uses the same `@eyeauras/cli-factory` workspace as TeamCity. The CLI
provides standard profiles/auth/permissions and 118 REST operations: 98 ReadOnly and 20 Update.
Five workflow leaves reuse those operations instead of adding REST operations: issue and article
attachment download, article export, and `issues batch validate/apply`. There are 121 service
leaves: 116 for REST operations plus these five. Two `--direct` selectors each select a second
REST endpoint without adding another leaf.
The foundational read projections are:

| Command | Default fields |
|---|---|
| `user me` | `id,login` |
| `project list` | `id,name,shortName` |
| `issues list [--query <query>]` | `id,idReadable,summary,project(id,name,shortName),updated,resolved` |
| `issues get <issueID>` | Issue-list fields plus `description,created` |
| `issues comments list <issueID>` | `id,text,author(id,login),created,updated` |

REST reads support explicit `--fields <projection>`. Projection results retain the server's
field names, `$type` and nullable values; authentication always validates fixed `id,login`.
Offset collections use `--top 50 --skip 0` by default; top is a positive safe integer and skip a nonnegative safe integer.
Paging accepts unsigned decimal digits, including leading zeros; signs (including `-0`), whitespace,
fractions, exponents and unsafe integers reject. Invalid syntax, range and overflow now fail before
onboarding or credential access on CLI, execute and RPC. The static errors are
`YouTrack top must be a positive safe decimal integer.` and
`YouTrack skip must be a nonnegative safe decimal integer.`; they never include the supplied input.
Directly callable service methods retain their own range validation.
Each collection command makes one request, and rejects an oversized server page. Multi-page reads
happen only for the explicit `issues list --all` described below and for field `name` selectors in
issue writes (their field list is read completely; cancellable); no other nested follow-up requests
are made. Issue IDs are encoded as opaque path segments, including readable IDs such as `DEMO-1`.

`issues list --all --max-results <n>` reads every page (`--top` is the page size, `--skip` the start)
with the same query and projection. Success means the selection is complete: the result is the
same JSON array in server order, with repeated `id`s removed. More than `n` issues, responses over
the optional `--max-bytes <n>` (total decoded bytes; also valid without `--all`) or any failed page
fail the whole command without partial output or retries. `--all` and `--max-results` require each
other. Offset paging is not a snapshot: concurrent changes can still omit issues.

```powershell
npm run youtrack -- project list --top 3 --profile youtrack-dev
npm run youtrack -- issues list --query "project: DEMO #Unresolved" --profile youtrack-dev
npm run youtrack -- issues get DEMO-1 --fields "id,summary,description" --profile youtrack-dev
npm run youtrack -- issues comments list DEMO-1 --top 3 --profile youtrack-dev
```

Handlers return domain values for human, `--json` and persistent `--json-rpc` output.
Empty collections are `[]`. Signed/credential-bearing URLs and the active bearer token are
scrubbed recursively, including explicitly projected nested fields. Unsigned URLs remain
unchanged. Failures expose HTTP status and safe Retry-After information, never raw server
errors or authentication material. Remote mutations require the Update gate, described below.
The ReadOnly download and export commands write only their explicitly requested local file beneath
profile AppData.

JSON responses have no CLI byte ceiling. Invalid/truncated identity transfer lengths, stream failure
or cancellation fail with `YouTrack response stream failed or was cancelled.` without response content.
Compressed wire length is syntax-checked but not compared with decoded size. HTTP status,
Retry-After, empty/null mutation and UTF-8 BOM behavior are unchanged. No request is retried
automatically. Runtime memory and service limits still apply.

## Sign in locally

Build from the repository root with `npm run build`, then use your current terminal and
the normal CLI pipeline; no wrapper or auxiliary terminal window is required:

```powershell
npm run youtrack -- profile configure youtrack-dev
```

Only if this terminal can see the existing configured profile, resume token login without changing it:

```powershell
npm run youtrack -- auth login --profile youtrack-dev
```

If login reports a missing profile, run `profile configure` first in that same terminal; do not assume
profile visibility is identical across terminal environments.

Enter the YouTrack server URL when configuring a new profile, then enter your permanent token at the
factory's hidden token prompt. Never put a token in chat or command-line arguments.
Use the server origin and any context path (for example `https://youtrack.example.com/track`),
without `/api`, credentials, query or fragment. HTTPS is required; HTTP is accepted only
for explicit `localhost`, `127.0.0.1` or `[::1]` development addresses. Redirects are refused.

Create a token in your YouTrack profile with the YouTrack service scope and only the
account permissions you need. See JetBrains' [permanent token documentation](https://www.jetbrains.com/help/youtrack/devportal/authentication-with-permanent-token.html).
The identity fields follow [My User Profile](https://www.jetbrains.com/help/youtrack/devportal/resource-api-users-me.html).

The candidate is validated before storage in the operating-system credential store.
Non-secret profiles live in current-user AppData for application `youtrack-cli`; the
credential namespace is separate from TeamCity and every YouTrack profile is isolated.
`ReadOnly` starts enabled and `Update` disabled. Every mutation requires an explicitly enabled Update category.

For automation, supply token input from a trusted secret source on stdin:

```powershell
npm run youtrack -- auth login --profile youtrack-dev --token-stdin
```

The factory selects a new candidate from explicit `--token-stdin`, then `YOUTRACK_TOKEN`,
then the hidden prompt in an ordinary interactive CLI with all three standard streams
attached to TTYs. JSON, JSON-RPC, programmatic calls and redirected streams never prompt.
`--token-stdin` is unavailable in JSON-RPC/programmatic execution because stdin belongs to
the transport; provide the configured environment candidate instead.
Stored credentials remain available for service calls but are never configure/login candidates.
Use secret-manager stdin without putting the token in shell history; there is no token flag
or plaintext fallback.

Configure validates the proposed settings and candidate before changing an existing profile or
credential. Missing or rejected input leaves the existing pair unchanged; a new profile is not
created. After successful validation, configure removes the old credential, saves configuration,
then stores the new credential. A storage failure may leave an unauthenticated profile; no old
credential is restored against changed settings. Repeat `profile configure <name> --token-stdin`
after repairing local storage. Errors never include backend credential diagnostics.
`auth login` replaces credentials without changing endpoint settings. These rules govern the
authentication lifecycle; ordinary non-authentication `profile set` remains a separate operation.

## Controlled mutations

`Update` is disabled by default and isolated per profile. Enable it only when you deliberately
intend to write, using the standard `permissions grant Update --profile <name>` command.
This documentation does not enable it automatically. The local proof remains ReadOnly.

| Command | Required `--body` JSON object |
|---|---|
| `issues create` | `project` as exactly one of `{id}`/`{shortName}`, nonempty `summary`; optional string or null `description`, optional `customFields` |
| `issues update <issueID>` | Nonempty subset of `summary`, `description` and `customFields`; summary must be nonempty |
| `issues comments add <issueID>` | Nonempty `text` only |

Missing `--body` and malformed JSON fail before profile onboarding or credential access.
Description and comment text preserve multiline Markdown. Omitted fields remain unchanged;
`description: null` clears the description. Unknown fields (including nested project properties)
are rejected locally. Visibility, notification controls and state-machine events are not accepted.

`customFields` is a nonempty array sent in the same single POST, so a project's required fields
can be set at creation. Each entry has an explicit `$type`, exactly one of `id` or `name`, and a
`value` validated like `issues fields set` below (`null`/`[]` clear on update). A field may appear
once. `StateMachineIssueCustomField` is rejected: a new issue starts in its workflow's initial
state, and transitions stay on `issues fields set` events or `commands apply`. Selectors resolve
exactly before the write: `project.shortName` by one project read (case-insensitive match
required), field `name` (case-sensitive) against all fields of the project (create) or issue
(update). Zero or several matches fail before the POST; `id` entries need no lookup. Value
selectors (`id`, `name`, `login` for users) are resolved by YouTrack inside the request; `$type`
is never inferred and nothing is cached.

```powershell
npm run youtrack -- issues create --profile youtrack-dev --body '{"project":{"shortName":"DEMO"},"summary":"Example","customFields":[{"$type":"SingleEnumIssueCustomField","name":"Priority","value":{"name":"Major"}}]}'
```

Every narrative write also accepts a UTF-8 file for its text field: `--description-file` (issue
create/update), `--content-file` (article create/update) and `--text-file` (issue/article comment
add/update). `--body` stays required (use `{}` when the file supplies the only field) and must not
also contain that field. Files are read only after Update admission, as strict UTF-8 with an
initial BOM removed and otherwise unchanged (line endings included); invalid encoding, directories
and unreadable paths fail before any request. Clearing still uses `--body` with `null`. There is no
local size ceiling, and stdin is not used because JSON-RPC owns it.

For Windows **CMD**, replace the example project ID before deliberately running a write:

```cmd
npm run youtrack -- issues create --body "{\"project\":{\"id\":\"PROJECT_ID\"},\"summary\":\"Example issue\"}" --profile youtrack-dev
```

The equivalent **PowerShell 7** command uses ordinary single quotes around JSON:

```powershell
npm run youtrack -- issues create --body '{"project":{"id":"PROJECT_ID"},"summary":"Example issue"}' --profile youtrack-dev
```

Windows **PowerShell 5.1** requires escaping the inner quotes through the npm/CMD pipeline:

```powershell
npm run youtrack -- issues create --body '{\"project\":{\"id\":\"PROJECT_ID\"},\"summary\":\"Example issue\"}' --profile youtrack-dev
```

Updates return `id,idReadable,summary,updated`; comment creation returns the same finite fields
as comment reads. An empty successful mutation response becomes JSON `null`. No mutation retries,
implicit follow-up reads or automatic permission grants occur. Malformed bodies and remote errors
use safe diagnostics without echoing submitted JSON or server response text.

## Additional commands through operation 50

The same tree is available through normal npm commands, JSON and JSON-RPC. Use leaf `--help`
for exact arguments and permission categories; no endpoint, header or arbitrary HTTP escape hatch exists.

| Family | Additional commands | Operations |
|---|---|---:|
| Queries and commands | `commands assist/apply`, `search assist`, `issues count`, `saved-queries list/get` | 6 |
| Project, users and fields | `project get`, `project field list/get`, `user list`, `issues fields list/get/set` | 7 |
| Links and tags | `link-types list/get`, `tags list/get`, `issues links list/get/issues/add/remove`, `issues tags list/add/remove` | 12 |
| Activity and context | `activities page`, `issues activity page`, `issues comments get/update`, `issues vcs-changes list/get`, `issues sprints list` | 7 |
| Work time | `issues time-tracking get`, `issues work-items list/get/add/update`, `work-items list/get` | 7 |
| Attachments | `issues attachments list/get/upload` | 3 |

`commands assist`, `search assist` and `issues count` use POST on the wire but remain ReadOnly:
they compute suggestions or counts without applying changes. Assist is not a dry run or a guarantee
that a later command will succeed. Required `--query` is preserved exactly; optional `--caret` is
between zero and its length. `commands apply` requires comma-separated distinct explicit issue IDs via
`--issues`, never an implicit search expansion. It has no run-as or silent mode. Count returns the
server's `count`, including `-1` (pending) or `null`; the CLI never polls automatically.

Activity commands require `--categories <categories>` and support `--cursor`, `--reverse` and
`--fields`. They return one server-defined page with `activities`, before/after cursors and flags.
They do not support offset or page-size flags and do not fetch a next page automatically.
Activity time, author and issue-query filters are outside this block.

Project fields expose field types and settings without following bundle references. Issue fields
preserve polymorphic values, including scalar, null and array values. `issues fields set` accepts
an explicit `$type` and `value`: single/multi Enum, Build, Version, Owned, Group and User types;
State, Simple, Date, Period and Text types. References use explicit identity selectors (`id`,
`name`, and `login` for users); `fields set` performs no lookup of its own. Single values can use `null`,
multi values use `[]` to clear. Period values accept nonnegative 32-bit integer `minutes`
and/or `presentation`; dates use
integer Unix milliseconds. Text values use `{ "text": "..." }`. StateMachine fields instead
require `$type` and `{ "event": { "id": "..." } }`; inspect `possibleEvents` explicitly with
`--fields` before selecting a transition. Unknown types and body fields fail locally.

Relationship additions accept only `{ "id": "TARGET_ID" }`. Link IDs include the explicit
direction returned by YouTrack. `issues links remove <issueID> <linkID> <targetIssueID>` unlinks
the target; `issues tags remove <issueID> <tagID>` unassigns the tag. Neither deletes the issue or
tag itself. Comment updates accept only nonempty `text`, preserving multiline Markdown.

Work-item creation requires `duration.minutes` (nonnegative 32-bit integer) and/or nonempty
`duration.presentation`. Both may be supplied; YouTrack interprets presentation text. Writable
fields are `duration`, `date`, `author`, `type`, `text`, `created` and `updated`. Dates/timestamps
use integer Unix milliseconds; `author` and `type` use `{ "id": "..." }` or `null`. Text may be
empty, multiline or null; `updated` may also be null. Updates require at least one field and
preserve omitted fields. No client-side date, user or duration conversion is guessed. Work-item
writes accept `--fields`; only global `work-items list` supports `--query`. Other date/author
filters are outside this block. Time-tracking inspection defaults to `id,enabled`, without
expanding work items.

Attachment reads default to `id,name,size,mimeType`; explicit read projections still scrub signed
URLs. Upload requires one explicit `--file <path>` and sends one native multipart request, returning
metadata only. Missing/blank/invalid path syntax fails before onboarding. Regular-file and read
checks occur inside the Update handler before HTTP, so denied uploads do not inspect files.
Only the basename becomes the multipart filename; errors never echo local paths. No attachment
binary download or signed-URL follow-up was included in the first 50 operations; the separate
download capability is documented below.

## Additional commands through operation 100

These add fifty REST operations. Two `--direct` switches each select between two documented
read endpoints, so at this stage the tree had 98 service leaves for 100 operations.

| Family | Additional commands | Operations |
|---|---|---:|
| Global fields and choices | `field list/get`, `field type list`, `bundle enum/state list/get`, `bundle enum/state value list/get` | 11 |
| User directory and bundles | `user get`, `bundle user list/get`, `bundle user member list`, `bundle user group list/get`, `bundle user individual list/get` | 8 |
| Groups and project teams | `group list/get`, `group member list [--direct]`, `group subgroup list`, `project team get`, `project team group list`, `project team user list [--direct]` | 9 |
| Time metadata | `time-tracking settings get`, `time-tracking work-time get`, `work-item-type list/get`, `project time-tracking get`, `project work-item-type list/get` | 7 |
| Boards and sprints | `agile list/get`, `sprint list/get/create/update` | 6 |
| Articles | `article list/get/create/update`, `article comment list/get/add/update`, `project article list` | 9 |

Every new read supports `--fields`. Offset lists retain one-page `--top`/`--skip` behavior;
details and settings reads have no paging flags. Bundle defaults omit nested values and members:
use the matching paginated child command. Archived enum/state values are preserved; state
`isResolved` is a resolution classification, not a list of workflow transition events.
Global field, bundle and value detail IDs are opaque database IDs; no name lookup is performed.

User-bundle `member list` includes membership supplied by groups and directly added users.
`individual list/get` covers only users added directly, and `group list/get` covers attached
groups. `group member list` and `project team user list` return all visible members by default;
`--direct` selects the server's direct-membership endpoint. The CLI does not crawl groups or
infer membership locally. Project-team endpoints require YouTrack 2026.1 or later; unavailable
or denied routes remain errors, with no alternate Hub route or permission changes.

Time metadata exposes the server's work schedule and available work-item types without changing
settings or synthesizing locale/calendar defaults. Global/project type lists are paginated;
other metadata reads return one object. No new date, author, search or archive filters are added
by these directory commands.

Sprint reads use an explicit board ID; the literal sprint ID `current` goes directly to the
same documented detail/update route. Create requires a nonempty single-line `name`; update
requires at least one supported field. Writable fields are `name`, `goal`, `start`, `finish`,
`archived` and `isDefault`. Goal preserves empty/multiline text or null; dates are safe integer
Unix milliseconds or null; flags are booleans. Create additionally accepts
`previousSprint: { "id": "..." }`, which explicitly moves unresolved issues from that sprint.
It is never inferred and is rejected on update. `isDefault: true` affects where matching new
board issues go. Sprint issue-membership payloads, agile mutations and deletion remain outside
this block. Reads and writes support `--fields`; there is no carryover lookup or polling.

Article create accepts nonempty `project.id` and `summary`, with optional string/null `content`.
Article update accepts a nonempty subset of `summary` and `content`; comments accept only
nonempty `text`, preserving multiline Markdown. Omission keeps fields unchanged; content null
clears it. These narrow bodies exclude parent/hierarchy, visibility, reporter, stars, tags,
nested attachments/comments and comment pinning/reactions. The REST entities have additional
writable properties, but this CLI does not forward them. Article and comment reads/writes
support `--fields`; article lists have no query flag. Article attachment transfer and hierarchy
reads are documented below. Hierarchy writes, draft publishing, notification suppression and
deletion remain unsupported.

## Remaining bundles, article hierarchy and attachment transfer

`bundle build/owned/version list/get` and their `value list/get` children expose twelve
ReadOnly operations. Lists use the normal bounded page; bundle defaults do not expand values.
Archived values and nullable owners are preserved without local lookup or filtering. Version
value `startDate` requires YouTrack 2023.1 or later; the CLI does not substitute another field.

`article attachment list/get/upload` and `article child list/get` plus `article parent get`
add six operations. The hierarchy commands read only the selected relationship and never
recursively traverse descendants. A literal JSON null parent remains null; an empty body,
404 or malformed response is still an error. Article attachment upload requires one explicit
`--file`, the Update gate, and uses native multipart after checking that the file is regular.
It supports `--fields` for the response. No implicit file discovery is provided, and upload never
grants permissions.

```powershell
npm run youtrack -- issues attachments download DEMO-1 1-1 --profile youtrack-dev
npm run youtrack -- issues attachments download DEMO-1 1-1 --name report.txt --max-bytes 1048576 --profile youtrack-dev
npm run youtrack -- article attachment download KB-A-1 7-1 --profile youtrack-dev
```

Issue and article attachment downloads first read the exact attachment's fixed metadata, then request only
its returned URL. The file request sends neither Authorization nor cookies, follows no redirects,
and accepts only the configured origin and documented attachment path beneath its context.
External/CDN URLs fail rather than relaxing this policy. Signatures stay in memory and never
appear in metadata output, errors or the download result.

Files go beneath the selected profile's `AppDataDirectory/downloads`. `--name` must be a safe
single basename; the default prefixes the sanitized attachment name with its ID. Existing
filenames are never overwritten. Downloads have no default byte ceiling. Optional `--max-bytes`
accepts a positive safe integer and enforces the caller-selected bound while streaming and against
Content-Length. Filename lengths are left to the filesystem. Core stages bytes in a fresh
private directory under this profile's `temp`, then hard-links only the complete identity-checked
file into `downloads`. Partial files are removed when their identities remain trusted. Output
contains only sanitized ID/name, local path, byte count and content type.
No binary data is printed. Publication uses an exclusive hard link; unsupported filesystems
fail without a copy/rename fallback. Existing links or junctions in the directory chain and detectable directory/staged/destination
replacement are rejected. Unknown replacement files are never removed. This protects
current-user-owned AppData; it cannot prevent every malicious same-account replacement after the
last identity check. Errors report whether publication occurred and whether private staging cleanup
failed, without raw filesystem/service details. The local proof never invokes download or upload.

`article export <article> [--name <basename>]` (ReadOnly) saves the article content, with signed
URLs scrubbed like console output, as `downloads/<idReadable>.md` through the same no-overwrite
publication. Edit it and send it back with `article update <article> --body '{}' --content-file <path>`.
The result's `redacted: true` means the file contains `[redacted]` placeholders for signed or
credential-bearing URLs; sending it back unchanged would replace those URLs in YouTrack, so restore
them first or edit that article elsewhere.
The local `downloads list`, `downloads delete <name>` and `downloads clean` built-ins (ungated, no
network) show or remove saved files: only regular files directly in the selected profile's
`downloads` directory, never links, subdirectories, staging or other profiles.

## Issue batches

`issues batch validate --file <manifest>` (ReadOnly; sends no requests and never uses the token,
but like every service command runs against a configured profile) and `issues batch apply --file
<manifest>` (Update, checked before the file is read) accept a `.json` array of rows or a UTF-8 `.csv`
with a header row. A row is `action` (`create`/`update`), `issue` (update only, an exact ID, never a
search) and the same body fields as `issues create/update`. CSV columns are `action`, `issue`,
`project.id`, `project.shortName`, `summary`, `description` and `customFields` (a JSON array cell);
an empty cell omits the field, so clearing needs JSON. CSV syntax errors and unknown or repeated
columns fail as a whole; unknown keys and invalid rows fail with the row number. Either way nothing
is written. Name selectors are resolved per row during apply.

Apply runs rows in order, one request per write plus exact selector reads, without retries,
rollback or compensation; a batch is not atomic. It stops at the first unsuccessful row unless
`--continue-on-error` is given. Each row reports `completed` (with the write result), `failed`
(rejected before the write or with HTTP 4xx: not applied), `uncertain` (connectivity, 5xx or an
invalid response: it may have been applied) or `unattempted`; the overall `status` is `completed`
or `incomplete`, with counts. The command itself succeeds (exit code 0) once rows ran, so callers
must check `status`. `--failed-rows <name>.json` saves the `failed` and `unattempted` rows
as a manifest under `downloads` for deliberate resubmission; `uncertain` rows are left out and must
be checked in YouTrack first. A save failure is reported in `failedRows.error` without hiding row results.

## Local proof and offline tests

After configuring a profile, explicitly run:

```powershell
npm run test:integration --workspace @eyeauras/youtrack-cli -- --profile youtrack-dev
```

The explicit local proof uses twenty-four fixed ReadOnly rows through the compiled CLI, named profile
and OS keyring: current user; projects and issues (up to three each); one selected issue and its
comments; one selected project and its custom fields; users; and the selected issue's custom
fields, attachments, tags, links and work items. It also reads global fields, user bundles,
groups, the selected project's team/time settings, global work-item types, agiles and articles.
It also lists build, owned-field and version bundles. No bundle values or article descendants
are followed, and no binary download is invoked.
Every collection is capped at three. Projects
exercise their default projection; all added reads request only `id`. IDs remain in memory.
Output contains only static PASS/FAIL/SKIP, endpoint templates and counts. Denied or malformed
attempted reads fail. Reads without a usable project/issue prerequisite are skipped; skipped rows
are not availability evidence, and failed prerequisites still fail the overall proof. No real
writes, automatic pagination or further resource discovery occur. CI and arbitrary URL/token/
command arguments are refused; inherited `YOUTRACK_TOKEN` is removed case-insensitively.
The shared Core proof invoker keeps the 30-second timeout and separate 64-KiB stdout/stderr bounds;
see the [shared CI and process contract](../../docs/testing.md).
Do not run it in CI or add it to generic test commands. A failed proof requires local
configuration/TLS/permission investigation; its payloads are deliberately not logged.

`npm test` builds and runs deterministic offline tests, including MSW against the actual
client and declaration, synthetic profile/credential isolation, JSON-RPC and proof safety.
Tests inject `AppArguments` rather than redirecting the user's data directories.
