# YouTrack CLI

The scoped package provides the `youtrack-cli` command:

Agents use the [shared YouTrack workflow](https://github.com/iXab3r/EyeAuras.CliFactory/blob/main/docs/practices/youtrack-agent-workflow.md):
our executable is primary; the separate Python `yt.exe` is an explicit fallback.
The guide covers field selection, paging and preserving tracker/profile ownership.

```sh
npm install --global @eyeauras/youtrack-cli
youtrack-cli --help
youtrack-cli profile configure
```

Requires Node.js 22+ and npm. Compiled JavaScript and the Core dependency are installed
automatically; no repository checkout, .NET, TypeScript compiler or browser is needed.
Interactive profile configuration guides endpoint/authentication setup; secrets use the
platform secret store. Existing `youtrack-cli` profiles and permissions are unchanged.
On Windows, Core now stores DPAPI CurrentUser encrypted files under the selected profile's
AppData `secrets/` directory. Credential Manager is no longer used or migrated. Sign in again
for each profile and reimport auxiliary secrets. Existing profiles and permissions remain.

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
Offset collections use `--top 50 --skip 0` by default; top is a nonnegative safe integer and skip a nonnegative safe integer.
Paging accepts unsigned decimal digits, including leading zeros; signs (including `-0`), whitespace,
fractions, exponents and unsafe integers reject. Invalid syntax, range and overflow now fail before
onboarding or credential access on CLI, execute and RPC. The static errors are
`--top must be a nonnegative safe decimal integer.` and
`--skip must be a nonnegative integer.`; they never include the supplied input.
Directly callable service methods retain their own range validation.
Each collection command makes one request, and rejects an oversized server page. Multi-page reads
happen only for the explicit `issues list --all` described below. Issue writes send selectors
directly to the API without nested discovery requests. Issue IDs are encoded as opaque path segments, including readable IDs such as `DEMO-1`.

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
unchanged. An HTTP error status fails with Core's `HttpError` (`YouTrack answered HTTP 404.`,
codes `http.notFound`, `http.unauthorized` with an `auth login` follow-up, `http.rateLimited` with
safe Retry-After text, and so on), never with raw server errors or authentication material.
Remote mutations require the Update gate, described below. The ReadOnly download and export
commands write only their explicitly requested local file beneath profile AppData.

### Reading output

Human mode is for people; `--json` is the machine view. Every everyday command has a view built
from Core's formats: lists such as `issues list`, `project list`, `article list` and `issues
comments list` are tables (`ISSUE  SUMMARY  PROJECT  STATE  UPDATED`), `issues get` and
`article get` are records with a description or content section and a `Next:` command, tags and
link groups are one line each, and a mutation names the object it changed (`Created DEMO-99 · New
issue`, `Removed tag 6-1 from DEMO-7.`). A table ends with `More results: --skip <n>` only when
the page came back full. Long work prints one progress line per page (`issues list --all`), per
failed batch row and at the start of a download on stderr, never under `--json`. An explicit
`--fields` projection prints the generic `key: value` shape, so you see exactly the fields you
asked for. Root help groups the commands into Everyday, Reference and Configuration, with examples.

JSON responses have no CLI byte ceiling. Invalid/truncated identity transfer lengths, stream failure
or cancellation fail with `The response stream failed or was cancelled.` without response content.
Compressed wire length is syntax-checked but not compared with decoded size. HTTP status,
Retry-After, empty/null mutation and UTF-8 BOM behavior are unchanged. No request is retried
automatically. Runtime memory and service limits still apply.

## URL and token input

Copy the service base address, for example `https://youtrack.example.test/youtrack/`. Include any context path and port; omit `/api`, issue pages and query strings. HTTP and HTTPS are supported. Context segments named `api`, `app/rest`, `admin` or `issues` are
valid deployment contexts; the CLI appends its own service endpoints to the configured base.
Create/copy a permanent token in your YouTrack profile with the **YouTrack** service scope.
See the [permanent-token guide](https://www.jetbrains.com/help/youtrack/devportal/Manage-Permanent-Token.html). Paste only its value: `FICTIONAL_TOKEN_VALUE` is a fictional example.
Do not include `Bearer `, `Authorization:`, or surrounding quotes. The same guidance appears in
`profile configure --help`, `auth login --help`, and before interactive input.

New URL/token input trims outer whitespace, including pasted CRLF. URL trailing slashes are
normalized without losing the context path; internal token symbols remain unchanged. Empty input,
headers/quoted tokens and malformed transport URLs fail with a safe hint before authentication or
persistence. This applies to onboarding, profile URL writes, login, environment/stdin candidates,
`execute` and JSON-RPC (which never prompts). Existing data is retained; use `profile set` or
`profile configure` to correct an old URL. Failed configure input preserves working credentials.

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
factory's masked token prompt. Never put a token in chat or command-line arguments.
Use the server origin and any context path (for example `https://youtrack.example.com/track`),
without `/api`, credentials, query or fragment. Normal redirects are followed, including
same-host HTTP-to-HTTPS upgrades with authentication. Other origin changes remove credentials.

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
then the masked prompt in an ordinary interactive CLI with all three standard streams
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
| `issues create` | Native `project` object and required `summary` (string or null); additional native fields are preserved |
| `issues update <issueID>` | Native issue JSON; known supplied field types are checked |
| `issues comments add <issueID>` | Native comment JSON; text may be a string or null |

Missing `--body` and malformed JSON fail before profile onboarding or credential access.
Description and comment text preserve multiline Markdown. Omitted fields remain unchanged;
`description: null` clears the description. Additional fields, including visibility and notification controls, reach the API unchanged.
The server decides applicability and required fields.

`customFields` is an array sent in the same single POST; empty arrays, repeated entries and
multiple identity attributes are preserved. Each entry supplies its `$type`; future types and native
metadata are forwarded. Known value types are checked as below. YouTrack resolves project, field
and value selectors inside the write; the CLI performs no catalog reads or ID rewriting.
`$type` is never inferred and nothing is cached.

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
that a later command will succeed. Required `--query` is preserved exactly; optional `--caret` uses the API's signed Int type; the server validates position semantics.
`commands apply` requires comma-separated explicit issue IDs via
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
multi values use `[]` to clear. Period values accept signed 32-bit integer `minutes`
and/or `presentation`; dates use
integer Unix milliseconds. Text values use `{ "text": "..." }`. StateMachine fields instead
require `$type` and `{ "event": { "id": "..." } }`; inspect `possibleEvents` explicitly with
`--fields` before selecting a transition. Additional native fields and future `$type` values reach the API unchanged, including readback
metadata alongside an event. Known value types still validate JSON/scalar structure.

Relationship additions accept a native reference, such as `{ "id": "TARGET_ID" }`, and preserve metadata. Link IDs include the explicit
direction returned by YouTrack. `issues links remove <issueID> <linkID> <targetIssueID>` unlinks
the target; `issues tags remove <issueID> <tagID>` unassigns the tag. Neither deletes the issue or
tag itself. Comment updates preserve native fields, including nullable text, visibility and pinning.

Work-item creation requires `duration.minutes` (signed 32-bit integer) and/or string
`duration.presentation`. Both may be supplied; YouTrack interprets presentation text. Writable
fields are `duration`, `date`, `author`, `type`, `text`, `created` and `updated`. Dates/timestamps
use integer Unix milliseconds; `author` and `type` use `{ "id": "..." }` or `null`. Text may be
empty, multiline or null; `updated` may also be null. Updates preserve additional native fields and
leave omitted fields to the server. No client-side date, user or duration conversion is guessed. Work-item
writes accept `--fields`; only global `work-items list` supports `--query`. Other date/author
filters are outside this block. Time-tracking inspection defaults to `id,enabled`, without
expanding work items.

Attachment reads default to `id,name,size,mimeType`; explicit read projections still scrub signed
URLs. Upload requires one explicit `--file <path>` and sends one native multipart request, returning
metadata only. Missing/empty/NUL path syntax fails before onboarding. Regular-file and read
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
same documented detail/update route. Create requires a string `name`; update
preserves supplied native fields. Known fields include `name`, `goal`, `start`, `finish`,
`archived` and `isDefault`. Goal preserves empty/multiline text or null; dates are safe integer
Unix milliseconds or null; flags are booleans. Create additionally accepts
`previousSprint: { "id": "..." }`, which explicitly moves unresolved issues from that sprint.
It is never inferred; the server validates its applicability. `isDefault: true` affects where matching new
board issues go. Additional native sprint properties are forwarded; separate agile mutations and deletion remain outside
this block. Reads and writes support `--fields`; there is no carryover lookup or polling.

Article create accepts a native project reference and nullable summary. Article and comment
updates preserve additional native fields, including parent, visibility and pinning. Known text
fields preserve multiline strings and documented null values; omission leaves API defaults in charge. Article and comment reads/writes
support `--fields`; article lists have no query flag. Article attachment transfer and hierarchy
reads are documented below. Native body properties are validated by the API; separate deletion remains outside this command tree.

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
npm run youtrack -- issues attachments download DEMO-1 1-1 --output report.txt --max-bytes 1048576 --profile youtrack-dev
npm run youtrack -- article attachment download KB-A-1 7-1 --profile youtrack-dev
```

Issue and article attachment downloads first read the exact attachment's fixed metadata, then request only
its returned URL. The file request sends neither Authorization nor cookies and follows normal HTTP redirects.
HTTP(S) URLs may use an external/CDN origin or another native file path; userinfo and raw
controls are rejected at the transport boundary. Signatures stay in memory and never
appear in metadata output, errors or the download result.

Files default to the invocation working directory using the metadata filename. Unsafe or ambiguous
default filenames are rejected. `--output <path>` chooses a relative path against that working
directory or an absolute path. The parent must exist. Existing files and symlinks are never overwritten,
regardless of the selected profile. Downloads have no default byte ceiling; optional `--max-bytes`
bounds streamed bytes and Content-Length. Core stages bytes in a fresh private `.download-*` directory
beside the output file, then hard-links only the complete identity-checked file into place. Partial files are removed when their identities remain trusted. Output
contains only sanitized ID/name, local path, byte count and content type.
No binary data is printed. Publication uses an exclusive hard link; unsupported filesystems
fail without a copy/rename fallback. Existing links or junctions in the directory chain and detectable directory/staged/destination
replacement are rejected. Unknown replacement files are never removed. This protects
the output destination; it cannot prevent every malicious same-account replacement after the
last identity check. Errors report whether publication occurred and whether private staging cleanup
failed, without raw filesystem/service details. The local proof never invokes download or upload.

`article export <article> [--output <path>]` (ReadOnly) saves the article content, with signed
URLs scrubbed like console output, as `<idReadable>.md` in the invocation working directory through the same no-overwrite
publication. Edit it and send it back with `article update <article> --body '{}' --content-file <path>`.
The result's `redacted: true` means the file contains `[redacted]` placeholders where console-output
scrubbing removed text (signed or credential-bearing URLs, undecodable URL-like text or the token);
sending it back unchanged would replace that text in YouTrack, so restore it first or edit that
article elsewhere.
The former `--name` option and `downloads list/delete/clean` commands are removed. Existing files
in profile AppData are left untouched; move or delete them explicitly if desired. New user outputs
are not owned by profile cleanup.

## Issue batches

`issues batch validate --file <manifest>` (ReadOnly; sends no requests and never uses the token,
but like every service command runs against a configured profile) and `issues batch apply --file
<manifest>` (Update, checked before the file is read) accept a `.json` array of rows or a UTF-8 `.csv`
with a header row. A row is `action` (`create`/`update`), `issue` (update only, an exact ID, never a
search) and the same body fields as `issues create/update`. CSV columns are `action`, `issue`,
`project.id`, `project.shortName`, `summary`, `description` and `customFields` (a JSON array cell);
an empty cell omits the field, so clearing needs JSON. CSV syntax errors and unknown or repeated
columns fail as a whole; malformed rows fail with the row number. Additional JSON row fields
are forwarded as native issue fields. Either way nothing
is written. The API resolves native selectors inside each row's single write.

Apply runs rows in order, one request per write plus exact selector reads, without retries,
rollback or compensation; a batch is not atomic. It stops at the first unsuccessful row unless
`--continue-on-error` is given. Each row reports `completed` (with the write result), `failed`
(rejected before the write or with HTTP 4xx: not applied), `uncertain` (connectivity, 5xx or an
invalid response: it may have been applied) or `unattempted`; the overall `status` is `completed`
or `incomplete`, with counts. Only a fully completed batch succeeds (exit code 0). Any `failed`,
`uncertain` or `unattempted` row fails the command with `batch.incomplete` (exit code 1).
The full summary, counts, rows and `failedRows` metadata stay available: ordinary CLI prints the
summary on stdout and the reason on stderr; `--json` prints the summary on stdout and one machine-error
line on stderr; JSON-RPC carries `error.data.code` and `error.data.result`; `execute` rejects with
a `CliError` carrying `.result`.

This is a breaking change: scripts that previously relied on exit 0 plus `status: incomplete`
must now handle the failure path and read the same summary from the appropriate surface.
See the [unreleased notes](../../CHANGELOG.md#unreleased).

`--failed-rows <path.json>` saves the `failed` and `unattempted` rows
as a manifest at the requested path relative to the invocation working directory for deliberate resubmission; `uncertain` rows are left out and must
be checked in YouTrack first. A save failure is reported in `failedRows.error` without hiding row results.

## Compared with `yt` 0.22.2

The everyday issue and article workflows have explicit, typed commands:
- issue creation and updates with custom fields in one request;
- exact human-readable selectors;
- budgeted `issues list --all`;
- JSON/CSV batches;
- attachment downloads, article export and text-file inputs.

Deliberate differences:
- field types are never guessed and selectors never take the first match;
- field-value names are validated by YouTrack rather than pre-resolved;
- a failed batch never deletes created issues to compensate.

Not provided:
- project, user, group and role administration;
- deletion wrappers;
- burndown and velocity reports;
- interactive tables, themes, tutorials and aliases;
- stdin input (JSON-RPC owns stdin).

## Local proof and offline tests

After configuring a profile, explicitly run:

```powershell
npm run test:integration --workspace @eyeauras/youtrack-cli -- --profile youtrack-dev
```

The explicit local proof uses twenty-four fixed ReadOnly rows through the compiled CLI, named profile
and platform secret store: current user; projects and issues (up to three each); one selected issue and its
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
