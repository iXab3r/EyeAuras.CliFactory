# TeamCity CLI

`teamcity-cli` is the first executable integration built on the reusable
`@eyeauras/cli-factory` npm package. The package under this directory owns TeamCity REST paths,
locators, DTOs, and command vocabulary; generic command-tree, profile, credential, permission,
output, and JSON-RPC behavior stays in `packages/core`.

Ordinary text, JSON and XML responses have no tool-imposed byte ceiling. Invalid Content-Length
and incomplete or mismatched unencoded/identity transfers still fail. Compressed wire length is
syntax-checked without comparing it with decoded size. Stream errors explain the failure and
keep redacted native causes; stack traces appear with `--verbose`, response bodies never. UTF-8 decoding preserves an initial BOM. Specialized discard
probes stop reading unwanted bytes after 64 KiB; this does not reject an operation or truncate
returned content. No automatic retry or command replay is added.

On Windows, Core now stores DPAPI CurrentUser encrypted files under the selected profile's
AppData `secrets/` directory. Credential Manager is no longer used or migrated. Sign in again
for each profile and reimport auxiliary secrets. Existing profiles and permissions remain.

## URL and token input

Copy the service base address, for example `https://teamcity.example.test/` or `https://example.test/teamcity/`. Include any context path and port; omit `/app/rest`, build/project pages and query strings. HTTP and HTTPS are supported. Context segments named `api`, `app/rest`, `admin` or `issues` are
valid deployment contexts; the CLI appends its own service endpoints to the configured base.
Create/copy an access token in **My Settings & Tools > Access Tokens** (the user profile).
See the [TeamCity user-profile guide](https://www.jetbrains.com/help/teamcity/configuring-your-user-profile.html). Paste only its value: `FICTIONAL_TOKEN_VALUE` is a fictional example.
Do not include `Bearer `, `Authorization:`, or surrounding quotes. The same guidance appears in
`profile configure --help`, `auth login --help`, and before interactive input.

New URL/token input trims outer whitespace, including pasted CRLF. URL trailing slashes are
normalized without losing the context path; internal token symbols remain unchanged. Empty input,
headers/quoted tokens and malformed transport URLs fail with a safe hint before authentication or
persistence. This applies to onboarding, profile URL writes, login, environment/stdin candidates,
`execute` and JSON-RPC (which never prompts). Existing data is retained; use `profile set` or
`profile configure` to correct an old URL. Failed configure input preserves working credentials.

## Installation

Install the scoped npm package to get the `teamcity-cli` command:

```sh
npm install --global @eyeauras/teamcity-cli
teamcity-cli --help
teamcity-cli profile configure
```

Requires Node.js 22+ and npm. The package includes compiled JavaScript and installs Core
automatically; no repository checkout, .NET, TypeScript compiler or browser is needed.
Interactive profile configuration guides endpoint/authentication setup; standalone secrets
use the platform secret store. Existing `teamcity-cli` profiles and permissions are unchanged.
Licensed under MIT. See the [release guide](https://github.com/iXab3r/EyeAuras.CliFactory/blob/main/docs/npm-release.md).

## Command tree

| Command | Purpose | Permission |
|---|---|---|
| `server status` | Show server version, role, and clock | `ReadOnly` |
| `projects list`, `projects show <id>` | Discover projects | `ReadOnly` |
| `jobs list`, `jobs show <id>` | Discover build configurations | `ReadOnly` |
| `jobs run <id>` | Queue one build, optionally with `--branch`, `--comment`, one-off `--param`, `--clean-sources` and `--wait` | `Update` |
| `builds list`, `builds show <id>`, `builds show --job <id> --latest` | Inspect builds across all branches and states, one `--branch`, or the latest finished build of a job | `ReadOnly` |
| `builds wait <id>`, `builds diagnose <id>` | Wait for a result; summarize problems and failed tests | `ReadOnly` |
| `builds tests/problems/changes <id>` | Diagnose a build | `ReadOnly` |
| `builds cancel <id>` | Cancel a running build | `Update` |
| `queue list` | Inspect queued builds | `ReadOnly` |
| `queue cancel <id>` | Cancel a queued build while preserving cancellation metadata | `Update` |
| `agents list`, `agents show <id>` | Inspect build agents | `ReadOnly` |
| `projects create/set/move/delete` | Author project identity, hierarchy and scalar fields | `Update` |
| `jobs create/set/move/delete` | Author build configurations | `Update` |
| `jobs copy <source-id> <id> --name <name> --project <id>` | Copy settings server-side, including protected parameters, without exposing their values | `Credentials` |
| `projects parameters list/show`, `jobs parameters list/show` | Inspect safe parameter values and metadata | `ReadOnly` |
| `projects parameters create/set/delete`, `jobs parameters create/set/delete` | Manage plain parameters | `Update` |
| `jobs parameters set-password <job-id> <name> --value-secret <alias>` | Replace an existing job-owned password from the active profile's input-secret; retain its specification and return no value | `Credentials` |
| `jobs steps list/show` | Inspect ordered step summaries | `ReadOnly` |
| `jobs steps create/replace/delete` | Manage build steps | `Update` |
| `vcs roots list/show` | Discover existing roots without connection properties | `ReadOnly` |
| `jobs vcs list/show`, `jobs vcs checkout-rules show` | Inspect root attachments/rules | `ReadOnly` |
| `jobs vcs attach/replace/detach`, `jobs vcs checkout-rules set` | Manage attachments, not shared roots | `Update` |
| `jobs triggers list/show`, `jobs features list/show` | Inspect redacted extension summaries | `ReadOnly` |
| `jobs triggers create/replace/delete`, `jobs features create/replace/delete` | Manage extensions using server defaults | `Update` |
| `jobs snapshot-dependencies list/show` | Inspect upstream build dependencies | `ReadOnly` |
| `jobs snapshot-dependencies create/replace/delete` | Manage upstream dependencies | `Update` |
| `jobs templates list` | Inspect attached templates in priority order | `ReadOnly` |
| `jobs templates attach/detach` | Attach/detach existing templates, not create/delete templates | `Update` |
| `jobs agent-requirements/artifact-dependencies list/show` | Inspect redacted rule summaries | `ReadOnly` |
| `jobs agent-requirements/artifact-dependencies create/replace/delete` | Manage requirements and artifact dependencies | `Update` |
| `jobs steps/features/triggers/agent-requirements/artifact-dependencies fields show/set` | Read/write scalar settings | Read: `ReadOnly`; write: `Update` |
| `jobs steps/features parameters list/show/replace/set` | Inspect redacted metadata or change non-secret plugin properties | Read: `ReadOnly`; write: `Update` |
| `jobs output-parameters list/show/create/set/delete` | Manage plain output parameters | Read: `ReadOnly`; write: `Update` |
| `projects features list/show/create/replace/delete` | Manage project features | Read: `ReadOnly`; write: `Update` |
| `projects templates list/create`, `projects templates default show/set/clear` | Create templates and manage the project default | Read: `ReadOnly`; write: `Update` |
| `jobs templates show`, `jobs aliases/branches/tags` | Inspect attachments and job metadata | `ReadOnly` |
| `projects parent`, `projects/jobs fields show` | Inspect hierarchy and scalar fields | `ReadOnly` |
| `pools list/show/create/delete`, `pools fields show/set` | Inspect/manage agent pools and names | Read: `ReadOnly`; write: `Update` |
| `pools agents list/assign`, `pools projects list/assign/unassign` | Manage pool membership, not member lifetime | Read: `ReadOnly`; write: `Update` |
| `agents enabled/authorized/policy/pool show/set`, `agents fields show/set`, `agents delete` | Manage agent eligibility and membership | Read: `ReadOnly`; write: `Update` |
| `agents compatible-jobs/incompatible-jobs`, `queue show/compatible-agents` | Inspect scheduling identities | `ReadOnly` |
| `queue position show/set`, `queue tags list/add` | Inspect positions/tags or change queued work | Read: `ReadOnly`; write: `Update` |
| `builds number/status-text show/set`, `builds pin show/set` | Manage display metadata and pin status | Read: `ReadOnly`; write: `Update` |
| `builds comment set/clear`, `builds delete` | Change annotations or delete a build/history | `Update` |
| `builds tags list/add/replace` | Inspect/manage public tags | Read: `ReadOnly`; write: `Update` |
| `builds statistics list/show`, `builds status/finish-date/canceled-info`, `builds fields show` | Inspect selected build evidence | `ReadOnly` |
| `changes show/parents` | Inspect change metadata and direct parents, not source files | `ReadOnly` |

Every collection command with `--limit <count>` and `--start <offset>` returns a page, whether
`builds list`, `projects list`, `queue list`, `audit list` or one of the other 22. The page's shape:

```json
{ "count": 2, "items": [ ... ], "hasMore": true, "nextStart": 2 }
```

**How a page is filled.** `--limit` is the most items to return, not the size of one request.
- Each request asks for one item more than it keeps. If it arrives, more exist: reading goes on
  after the kept items, or `hasMore` is `true` once `--limit` is reached.
- It follows TeamCity's continuation, including the `lookupLimit` expansions that TeamCity adds
  after scanning 5000 entities. It reads only the numbers in `nextHref`, never the link itself.
- TeamCity continues after the items it served, or at the same start with a deeper `lookupLimit`
  when it served none. The CLI follows only such a continuation and computes the next start
  itself, so no item is read twice or skipped.
- It stops at the caller limit, cancellation, completion, or a continuation it cannot follow.
- A single request keeps at most 1,000 items, so it asks for at most 1,001.

**What the fields mean.**
- `hasMore: false` only when TeamCity confirmed the end.
- `hasMore: null` means not established: the continuation was not followed,
  or a full page came without a continuation.
- `nextStart` is the `--start` value that continues after the items returned. It is `null` when
  there is none, including when nothing was read: `--start` cannot carry a `lookupLimit`. Paging
  on while `nextStart` is not `null` always makes progress. Offsets can shift while new builds
  arrive, so this is not a snapshot.

**When a later request fails.** The command exits 1 with the `list.incomplete` code. The items
already read are still printed, with `hasMore: null`. A later request stopped by Ctrl+C reports
`interrupted` instead.

Human views print `More results: --start 20` only when a selection can continue.
An uncertain selection without a continuation says `More results may exist.` Complete selections
have no footer. Build, queue, job and agent lists use tables; project lists use a tree of the
selected projects, with missing parents at the top level. Other lists retain their result fields. `queue delete-page` is a mutation and
still deletes exactly one requested page. Run a branch without a leaf, such as
`teamcity-cli builds`, to see its generated help and options.

Paging defaults remain `--limit 100 --start 0`. These options accept decimal digits with an optional
minus and leading zeros, but reject whitespace, plus signs, fractions and exponents. The start must
be a nonnegative safe integer (`-0` remains valid); limit accepts any nonnegative safe integer. Invalid options fail before
profile onboarding or credential access. Each option now reports one static error for syntax, unsafe
integers and range failures. The existing strict numeric build/queue-cancel/agent-show ID parsers
use safe-integer validation without an invented positive-ID rule and use the same decimal grammar; other numeric service
validators are unchanged. JSON options retain their existing non-echoing errors, repeat order and
service-specific body validation.

Single-owner parameter, step, extension, dependency and attachment lists use the native scoped endpoints and preserve
server order; these endpoints do not support paging options. `vcs roots list --project <id>`
filters by direct project. Local v2 coverage is **449/449 unique REST method/path pairs (100%)**:
235/235 GET and214/214 mutation routes; no inventory rows remain unexposed. This does not promise
every parameter/payload variant or live mutation verification. Config-parameter reset and bulk
unmute report native acknowledgement without verified postconditions. Review counters exclude the
17-route baseline; future expansion follows the [authoring-review practice](../../docs/practices/integration-authoring-reviews.md).

## Author a job

Configure a profile first and grant Update only in the intended environment. These commands have
real side effects; the example IDs and values are synthetic, and the VCS root must already exist:

```text
teamcity-cli projects create Example --name Example --profile uat
teamcity-cli jobs create Example_Build --project Example --name Build --profile uat
teamcity-cli jobs parameters create Example_Build env.MODE --value debug --profile uat
teamcity-cli jobs steps create Example_Build --name Echo --type simpleRunner --property "script.content=echo hello" --property use.custom.script=true --profile uat
teamcity-cli jobs vcs attach Example_Build --root Example_Git --checkout-rules "+:src=>." --profile uat
teamcity-cli jobs show Example_Build --profile uat --json
teamcity-cli jobs run Example_Build --profile uat --json
```

Project creation defaults its parent to TeamCity's standard `_Root`; `--parent` overrides it.
Both create commands accept `--description`. `projects set <id> <field> <value>` and `jobs set`
forward scalar fields and string values unchanged; TeamCity validates field availability and semantics. Move with `projects move <id> --parent <id>` or
`jobs move <id> --project <id>`. No create command promises client-side upsert or conflict semantics.

Parameters use `list <owner-id>`, `show/delete <owner-id> <name>` and
`create/set <owner-id> <name> --value <value>`. This slice supports only non-secret values.
Password, hidden, malformed-type and credential-named values are omitted with `redacted: true`.
An absent/empty TeamCity type spec means a plain parameter; visible UI types are not closed to a client list. Full raw type specs are never returned. Create/set preflight only metadata
and reject protected or malformed metadata before writing; only create tolerates a 404.
This is a safety check, not an atomic guarantee against concurrent server changes.
Do not put credentials into plain parameters, script text or argv: name/type heuristics cannot
identify arbitrary secrets stored under innocent names. Credential provisioning is outside S1.

Steps accept `--name`, `--type`, and repeatable `--property <key=value>` (split on the first `=`;
duplicate/empty keys fail). `jobs steps replace <job-id> <step-id>` fully replaces writable input:
omitted properties are not preserved and no GET/merge runs first. Output omits raw plugin payloads
and script content; only a small allowlist of known, non-secret setting values is exposed.

`jobs vcs replace <job-id> <root-id> --checkout-rules <rules>` keeps the specified root identity.
`jobs vcs checkout-rules set <job-id> <root-id> --rules <rules>` changes rules only; an empty string
clears them. `jobs vcs detach` removes only the job attachment, never the shared root.
Root discovery returns identity/type/project summaries, never connection properties.

Deletion always targets one explicit ID/name. Deleting a project/job can cascade through its
server-owned children, settings and history according to TeamCity policy; there is no extra
client-side sweep or undo. Deleting `_Root` is refused. Successful empty responses return an
acknowledgement; a missing entity remains an HTTP error, not a successful delete.
Mutations are not automatically retried. HTTP errors expose status only, not remote body text;
malformed JSON errors contain no response excerpts.

`builds list` deliberately disables TeamCity's implicit build filter and includes default and
non-default branches. This keeps running, failed, canceled, personal and branch builds visible,
instead of reporting an older successful default-branch build.

## Run, wait and diagnose

```text
teamcity-cli builds list --job Demo_Tests --branch main --limit 20
teamcity-cli builds show --job Demo_Tests --branch main --latest
teamcity-cli jobs run Demo_Tests --branch main --param env.MODE=test --wait --timeout 10m
teamcity-cli builds wait 101
teamcity-cli builds diagnose 101
```

**Choosing a build.**
- `--branch <name>` limits `builds list` to one branch as TeamCity names it. A name containing
  locator characters is sent as an explicit value condition, so TeamCity never re-parses it as
  locator syntax.
- `builds show` takes exactly one selector: a numeric build ID, or `--job <id> --latest`, optionally
  with `--branch`. Mixing them, or giving `--job`/`--branch` without `--latest`, fails before any
  request.
- `--latest` reads once and returns the first finished, non-personal build in TeamCity's order
  (newest start first), whatever its result, including failed and canceled builds. Without
  `--branch` it searches all branches; in human mode stderr names the scope.
- Without `--state`, `builds list` includes queued, running and finished builds across all branches.
  It sends `defaultFilter:false` without a state dimension. JetBrains'
  [BuildPromotionFinder source](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/data/finder/impl/BuildPromotionFinder.java#L936)
  defaults the missing state to `any`; `setLocatorDefaults` returns early for `defaultFilter:false`.
  The locator remains unchanged: an explicit default would add no selection guarantee.
- Queued and running builds are listed with `builds list --state queued|running`. TeamCity lists
  queued builds in queue order, not newest first, so "latest" never means "next in queue".
- Latest is resolved per call. To keep working on one build, reuse the returned ID.

**Running.**
- `jobs run` sends one POST to the build queue. Without `--wait` it returns
  `{ "accepted": true, "build": {...} }`: the build was queued, which does not mean it will succeed.
- Each `--param name=value` applies to that one build only and never changes the job
  configuration. Repeat the option for more parameters; repeated names are passed to TeamCity in order.
  With parameters, the queue response requests `properties(property(name))`. The result's
  `build.parameterNames` contains only submitted names confirmed by that response, deduplicated;
  inherited names and all values are discarded. An empty array means no names were confirmed.
  The names remain in the final result with `--wait`, including a failed wait. This uses the
  [Build properties contract](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/model/build/Build.java#L632),
  which includes custom-build parameters.
- Parameter values are not echoed in output or errors. Never pass secrets in argv; secret
  parameters are not supported here.
- If the queue response is lost or unreadable, or TeamCity or a proxy answers with a 5xx status,
  the outcome is unknown. The command fails with `run.unknownOutcome` and suggests
  `builds list --job <id> --state any`, preceded by the same list for the run's `--branch` when
  it had one. Both list builds in every state, because an accepted build can leave the queue
  within seconds. The command never repeats the POST.
- `--branch` selects the branch to build; without it TeamCity builds the job's default branch.
- `--clean-sources` asks TeamCity to delete this build's entire checkout directory, including
  untracked files and build caches, then fetch its sources again. It applies only to the queued
  build; it does not request cleanup of dependency builds or change persistent job settings. Omitted by default,
  it sends only `triggeringOptions.cleanSources=true` when selected. See TeamCity's
  [BuildTriggeringOptions](https://www.jetbrains.com/help/teamcity/rest/buildtriggeringoptions.html).

**Waiting.** `jobs run --wait` (still `Update`) and `builds wait <id>` (`ReadOnly`) only read the
build: GET `/builds/id:<id>`, every `--interval` (default 5s, 1s–10m). `--timeout` (default 10m,
1s–24h) starts when waiting starts: for `jobs run --wait`, once the build is accepted. It covers
queue time and each read, but not the queue request itself. Queueing and waiting use one client,
so one profile and credential. Nothing ever cancels the build. The results are:

| Result | Exit | Output |
|---|---|---|
| Finished `SUCCESS` | 0 | `{ build, outcome: "succeeded" }`, plus `accepted: true` for `run` |
| Finished `FAILURE` or failed to start | 1 | same result with `outcome: "failed"` |
| Canceled | 1 | `outcome: "canceled"` |
| Finished without a known result | 1 | `outcome: "unknown"` |
| `--timeout` elapsed | 124 | last known state, `outcome: "timedOut"`; the build continues |
| Ctrl+C | 130 | last known state, `outcome: "interrupted"`; the build continues |
| The build disappeared during the wait | 1 | last known state, `outcome: "missing"` |
| A read failed after the build was accepted | 1 | the accepted build and ID, with a `builds wait <id>` suggestion |

Failed outcomes follow Core's contract:
- **CLI:** the result goes to stdout and the reason to stderr.
- **JSON-RPC:** an error whose `data` holds `code`, `exitCode`, `result` and follow-up argv.
- **Programmatic `execute`:** rejects with a `CliError` that carries `.result`.

`builds show` still succeeds for a failed build: it is only a read. In human mode, state changes
appear on stderr while waiting, for example `Build 101: running`. The terminal result appears
only in the record, with one stderr explanation for a failed outcome. JSON output is one final value.

**Diagnosing.** `builds diagnose <id>` reads the build with its test and problem counters. It adds
up to 10 problem occurrences and up to 20 failed test identities, never stack traces or build
logs. Each section is one of:
- `complete`, titled `all N` in human output when it has items, such as `Problems (all 2)`;
- `truncated`, with more available through `builds problems` or `builds tests --status failure`;
  human output says `first 20 of 25`;
- `unavailable`, with the reason `denied`, `not-found` or `failed`.

An unavailable section sets `partial: true` and exits 1 with the data: missing information is
never reported as "no failures". The sections are read concurrently and are not an atomic
snapshot.

**Ctrl+C.** The packaged executable turns the first Ctrl+C into a local stop; a second one exits
immediately. A stopped wait keeps its last known state, as above. Any other interrupted command
exits 130. An interrupted read reports `interrupted`, and an interrupted download keeps its
message about the saved data. An interrupted write keeps its unknown outcome:
`run.unknownOutcome` for a queue request, `request.unknownOutcome` for others.

## Triggers, features, dependencies and templates

These are configuration mutations gated by Update, not immediate build launches. Use the intended
profile and existing upstream jobs/templates. Examples below are synthetic:

```text
teamcity-cli jobs triggers create Example_Build --type vcsTrigger --profile uat
teamcity-cli jobs triggers list Example_Build --profile uat --json
teamcity-cli jobs features create Example_Build --type swabra --profile uat
teamcity-cli jobs snapshot-dependencies create Example_Build --source Example_Compile --property sync-revisions=true --profile uat
teamcity-cli jobs templates attach Example_Build --template Example_Template --profile uat
teamcity-cli jobs templates list Example_Build --profile uat --json
teamcity-cli jobs templates detach Example_Build Example_Template --inline-settings --profile uat
```

Triggers/features accept `create <job-id>`, `show/delete <job-id> <trigger-id|feature-id>` and
`replace <job-id> <trigger-id|feature-id>`. Both create and replace require `--type`, accept
repeatable non-secret `--property <key=value>`, and leave omitted activation fields to TeamCity.
Extensions may be enabled by server defaults; `--enabled` sends `disabled:false`. Replacement is a full writable replacement: omitted properties
and trigger customization are not retained. No hidden GET/merge or retries occur. Trigger
`buildCustomization` and credential provisioning are not supported by this slice.

Snapshot dependencies use the same list/show/create/replace/delete shape, with required
`--source <upstream-job-id>` instead of `--type` for writes. Their dependency ID is the upstream
build configuration ID. TeamCity validates dependency targets, cycles and
plugin settings. Removing a dependency never deletes its upstream job.
Trigger/dependency path IDs accept letters, digits, `_` and `-`, not raw locators such as `id:...`.
Feature IDs are literal encoded path segments. All three families return metadata and redacted
property names/types, **not property values**, even when a plugin supplies unknown fields.

Template attach preserves other attachments. By default it sends `optimizeSettings=false`;
`--optimize-settings` asks TeamCity to remove redundant local settings. Detach affects only the
named attachment and never deletes the template. By default `inlineSettings=false` means inherited
settings are not copied; `--inline-settings` copies them locally before detachment. Template
creation is available through `projects templates create`; `jobs templates replace-all` replaces
attachments in explicit order, and `clear --confirm` detaches all. Dependency per-property
subroutes remain unsupported.

## Extended job and project configuration

Examples below change only explicitly named resources, but may affect future builds. All IDs are
synthetic; activate Update only for the intended profile:

```text
teamcity-cli jobs agent-requirements create Example_Build --type equals --parameter env.MODE --value debug --profile uat
teamcity-cli jobs artifact-dependencies create Example_Build --source Example_Compile --rules "*.zip=>artifacts" --revision lastSuccessful --profile uat
teamcity-cli jobs features fields set Example_Build FEATURE_1 disabled true --profile uat
teamcity-cli jobs steps parameters replace Example_Build RUNNER_1 --property use.custom.script=true --profile uat
teamcity-cli jobs output-parameters create Example_Build env.RESULT --value ready --profile uat
teamcity-cli projects templates create Example Example_Template --name Template --profile uat
teamcity-cli projects templates default set Example --template Example_Template --profile uat
teamcity-cli projects templates default clear Example --profile uat
```

Requirements need `--type` and `--parameter`; `--value` depends on the requirement type. Artifact
dependencies need `--source`, `--rules`, and `--revision`; optional `--revision-value`, `--branch`
and `--clean` express revision selection and destination cleanup. Both rule families are active
unless `--disabled` is supplied. The server validates dependencies and revisions,
cycles and plugin semantics. Replace is full writable replacement, not a hidden read/merge.

The `fields show/set` subtree forwards scalar field names and text values to the API; steps
also support named fields such as `name`; their text is validated by TeamCity. Step/feature `parameters replace`
replaces the complete property set; no `--property` clears it. `parameters set` changes one named
non-secret property. These plugin reads expose metadata only, including single-property show;
they do not return raw property/script values. Output parameters reuse ordinary plain-parameter
validation, protected-metadata preflight and redaction.

Project features accept `--type` and repeatable non-secret properties, have no disabled toggle,
and take effect immediately. Project template creation requires an ID and `--name`. Clearing the
own default does not delete the template and may reveal an inherited default. `jobs templates show`
inspects one attachment. `jobs branches` is bounded with `--limit`/`--start`; aliases, tags and
project-template/feature lists preserve native scoped order without paging.

## Operator commands

Pool and agent changes can alter where builds run. Numeric IDs must be safe integers; the server
validates identity and deletion semantics, including pool 0 (the default). Field selectors are
encoded and sent to the API, excluding credential-shaped names. Assigning an agent moves its pool membership; unassigning a project
removes membership, never the project. Deleting an agent requires inactivity, validated by TeamCity.

```text
teamcity-cli pools create --name ExamplePool --profile uat
teamcity-cli pools agents assign 1 7 --profile uat
teamcity-cli pools projects assign 1 Example --profile uat
teamcity-cli agents policy set 7 selected --job Example_Build --profile uat
teamcity-cli agents enabled set 7 false --comment "Maintenance" --profile uat
teamcity-cli queue position set first --build 42 --profile uat
teamcity-cli builds pin set 42 true --comment "Investigating" --profile uat
teamcity-cli builds tags add 42 --tag review --profile uat
teamcity-cli builds statistics list 42 --profile uat --json
```

`agents enabled/authorized set` and `builds pin set` accept strict `true`/`false` plus an optional
non-secret `--comment`. Raw scalar field writes preserve text; the server validates these values. Dedicated JSON Boolean
controls require `true` or `false`. `authToken` is forbidden, not hidden behind ReadOnly.
Policy is `any` or `selected` (case-insensitive, as on the server); supplied spelling and job lists
are forwarded unchanged, including repetitions. An empty `selected` list permits none. It fully replaces selection. Policy output is `{policy, jobs}`. Agent/pool and
compatibility responses expose identities, not raw parameters, credentials or unmet requirements.

Queue position strings are encoded and validated by TeamCity; set requires `--build <id>`.
`1`, `first` and `last` remain useful server-supported forms, not a closed CLI enum. No auto-polling or implicit launch/cancel occurs. Tag add
requires at least one repeatable `--tag` and preserves other tags. Build tag replace with no tags
clears public tags. These operations never target private users' tags. Tag add returns a local
acknowledgement and discards any successful response body; list/replace returns names only.

Build number/status-text writes require a running build, enforced by TeamCity. Build comment set
uses `--text`; clear removes the comment. Build delete can delete history/artifacts under server
policy; there is no local undo. Statistics remain API strings, preserving numeric precision and future textual values.
Scalar field selectors are not closed to a local list; the server validates their availability. Absent agent pool and cancellation
comment normalize JSON null/empty responses to null. Other JSON endpoints decode strictly.

Pool list and pool-agent list are pages, like every other `--limit`/`--start` collection. Pool
projects, agent compatibility, queue-compatible agents, tags, statistics and direct parent changes
are native scoped lists, not pages.
Unrequested nested server/user/credential fields are excluded. Metadata itself may still be private:
do not publish real output or use it as a fixture without sanitization. There is no schema-free
JSON/HTTP escape hatch or unbounded global queue clearing. Later sections describe the explicit
credential/cloud/file surfaces.

## Bulk configuration and queue controls

`replace-all` replaces complete collections; omitted items are removed. Job steps/features/triggers,
requirements/dependencies/VCS entries and project features accept repeated `--item <json>` with
documented compact family forms. Additional native JSON fields are preserved. Parameters use repeated `--property name=value`;
metadata preflights prevent replacing protected settings. `parameters clear --confirm` deliberately
deletes all own parameters, including protected ones. `value/type/raw-type show/set` only exposes
plain values or safe type names; raw secret/type text is never returned.

Project pools, pool projects, project child ordering and template attachments have explicit full
replacement commands. `queue delete-page --job Example_Build --limit 10 --confirm` deletes only
one bounded page for one job. `queue delete <id>` removes cancellation history as well, unlike
`queue cancel`. `queue reorder --build <id>` preserves explicit ID order. Queue pause requires a
reason, and `queue approval approve <id>` approves only that build as the current user, not its chain.
All these writes require Update and are mock-tested, not exercised against a live server.

## Build triage and evidence

`builds batch` requires repeated `--build <id>`; duplicates are preserved. Status and show are reads;
cancel, delete, comment, pin and tags are Update operations.

A batch write returns `{ count, errorCount, items: [{ buildId, succeeded }] }`. TeamCity marks only
the failed items; its per-item message is never shown. Counts that disagree with the items mean
success is unknown, and the command fails. When any item fails, the command exits 1 with the
`batch.partial` code, and the complete per-item result is still printed. Two other writes can
succeed partly:
- `builds set-status` with reported errors exits 1 with `build.statusPartial`;
- `builds vcs-labels add` with a `FAILED` label exits 1 with `labels.partial`.

`finish`/`finish-at` return accepted timestamps, not proof of completion. Timestamp strings are
forwarded unchanged; the server owns configured date formats and temporal validation. `start-agentless` starts
queued work without an agent. TeamCity interprets service messages in appended log text. VCS labels mutate an
external VCS and require one `--root-instance`.

Investigations use a strict typed item, for example:

```json
{"target":{"kind":"test","projectId":"Example","testId":"9223372036854775807"},"state":"TAKEN","assignee":3,"resolution":"whenFixed","comment":"Synthetic example"}
```

Pass it with `investigations create --item <json>` or `replace`; `create-many` repeats items.
Target may instead be `{"kind":"job","jobId":"Build"}` or a project/problem target.
Show/delete take only `--target <json>`. Replacement is server-side delete/create and **not atomic**.
The CLI validates the entire body first and never retries that mutation.

Mutes use `{"project":"Example","tests":["123"],"resolution":"manually"}`; replace project with
`jobs:["Build"]`, tests with `problems:["123"]`, or choose whenFixed/atTime (time required).
One scope/target kind, no implicit all-problems mute. Create/create-many/show/delete are explicit.
Tests/problems expose list/show/occurrence; occurrence requires `--build`. IDs stay strings.

Runtime `builds output-parameters/resulting-properties list` and `changes attributes` return
names only. Runtime parameter `exists <build-id> <name>` discards the scalar body without output,
hash or file; 404 stays an error because it can mean a missing build too. Native build occurrence
collections are unpaged and excluded from the fixed real-service proof.

## Accounts, access policy and issued tokens

User/group/node writes require **Admin**, token issuance/revocation/local owned-token cleanup
requires **Credentials**. Both categories default off; granting Update does not enable either.
They are local safety gates, not remote authorization. No live administrative proof runs in CI.

`users` exposes bounded list, identity-only create/update/delete, direct groups, roles,
resolved permissions, property names/existence, safe identity fields and remote session commands.
`groups` exposes identities, direct parents, roles and properties. User update preserves omitted
collections; role/group replacement is explicit and can be non-atomic. No items clears direct
assignments; the server retains All Users membership. Role scope is exactly one `--global` or
`--project <id>`. Replace uses repeated `--item '{"roleId":"R","project":"Example"}'`.
Password/email workflows are not exposed; username-only create does not guarantee login.

`users tokens` is **current-user only**. To issue into the selected profile's platform secret store:

```text
teamcity-cli users tokens create ExampleToken --alias automation --expires 20991231T235959+0000 --restriction '{"permission":"VIEW_PROJECT","project":"Example"}' --profile uat
```

Expiry or explicit `--no-expiration` is required; expiration-time semantics are validated by TeamCity; choose restrictions or explicitly
`--same-permissions`. The latter inherits the user's remote rights, not the local ReadOnly gate.
The one-time value is stored as a private `issued-token:<alias>` secure record and never printed.
Existing aliases fail before HTTP and never overwrite the active auth credential. The preflight
is not an atomic reservation across multiple processes. If storage fails after issuance, the
command reports it without secrets; revoke the named remote token explicitly, without retrying.

`users tokens delete <name> --alias automation` first checks the alias's recorded remote name,
revokes remotely, then removes that owned record. Without alias it only revokes remotely.
`users tokens forget --alias automation` removes only the local record, not the remote token.
Forget owned aliases **before deleting a profile**; factory auth logout/profile cleanup does not
discover arbitrary issued aliases. If a profile was removed first, recreate that same profile name
and use explicit forget. No unrelated credential is silently deleted.

`server nodes` omits internal URLs. Responsibility names are encoded and validated by TeamCity; values use true/false; the response describes enabled configuration, not effective transition.
`server api-version` is distinct from the local CLI `--version`.

## Cloud, VCS and versioned settings

`cloud profiles/images/instances` describes **remote cloud profiles**, not CLI connection profiles.
Image/instance commands require `--cloud-profile`, `--image` and, when applicable, `--instance`.
Start may incur cost. Stop schedules graceful shutdown; delete/force-stop require `--confirm`
and may interrupt running work. Acknowledgement is not proof of the final provider state.

`vcs roots create` provisions anonymous Git with explicit URL/branch/project/name, preserving
service strings and URL spelling. Supported Git transports are validated by TeamCity.
Embedded passwords and HTTP token-as-user URLs are rejected; SSH account names remain literal. Property reads return names/existence only; replace/clear
operate on the whole native map and can break attached jobs. `vcs instances` exposes polling,
commit-hook notifications, saved branch/revision state and server-validated scalar fields. `notify-commit`
reports scheduling only for HTTP202, not other successful statuses.

`projects versioned-settings` covers configuration/effective configuration, typed scalar fields,
context parameters, check/commit/load/status and secure-value mappings. Config replacement forwards supplied native fields without inventing missing service values.
Only `storeSecureValuesOutsideVcs: true` is inserted to keep secure values outside VCS; disabling
that protection is rejected. The server decides omitted-field and mode/root requirements. An existing-root conflict requires the caller to choose
`importDecision`, never an automatic overwrite decision. Commit/load need confirmation.
Context replacement removes omitted entries; values are never returned in context lists.

Config replacement and `config fields set <project> format <value>` pass the format string
unchanged to the server. The [API entity contract](https://www.jetbrains.com/help/teamcity/rest/versionedsettingsconfig.html)
gives `kotlin` and `xml` as examples, rather than a closed set. The server validates the supplied
format; forwarding a string does not establish support for executing that language.

`config fields reset <project> vcsRootId --confirm` attempts the documented native DELETE.
Older official server code can fail **after changing configuration**; current-server successful
clear semantics are not verified. `resetRequested` means actual HTTP2xx only, not a verified clear.
Inspect configuration before retrying; the CLI does not retry or claim rollback.

## Explicit credential inputs

Use `credentials import <alias> --env <VARIABLE_NAME>` to import only the named environment
variable into the current profile's platform secret store. Requires Credentials; existing aliases fail.
No raw credential argv, environment scanning, plaintext fallback or automatic auth-token reuse.
`credentials forget <alias>` removes only that input entry. Versioned-settings token mappings use
`--mapping remote-name=alias`; lists expose names and deletes retain local aliases.

| Secure namespace | Purpose | Explicit cleanup |
|---|---|---|
| `token` | CLI authentication | `auth logout` |
| `issued-token:<alias>` | Named REST access token plus ownership metadata | `users tokens forget --alias <alias>` |
| `input-secret:<alias>` | Explicit inputs, resolved values, pool registration tokens | `credentials forget <alias>` |
| `secure-reference:<alias>` | Project secure-value reference, not its underlying value | `projects secure forget-reference <alias>` |

Clean up owned aliases before deleting their profile. Recreating the same profile name permits
explicit cleanup if necessary; unrelated entries are never silently erased. Namespace/alias
preflight is not a cross-process atomic reservation. A remote operation and local storage are not
atomic: failure after remote success reports partial/unknown outcome without automatic retry.

## Server administration and deployments

`audit` returns action/timestamp metadata without comments or related private payloads. `health`
accepts project/global/category selectors, including combined scopes. TeamCity validates detail uniqueness.
`roles` defines server roles; user/group `roles` assigns them. Create takes a name and optional
permission/include IDs, never a caller-supplied role ID. Role writes require Admin.

`deployments` creates/deletes dashboards within projects. Instance `upsert` supplies an explicit
initial state/date history; `append-state` adds one entry. State uses uppercase native values
and TeamCity timestamps. Parent IDs remain explicit. Destructive/upsert commands require confirmation.

`server authentication replace --item <json> --confirm` replaces the **complete module list** and
can lock out users. Omitted scalar settings are preserved; omitted modules are not injected. Typed
modules accept non-secret properties plus `secrets:[{"name":"password","alias":"directory"}]`.
It never reads and rewrites masked existing credentials. `server settings set` preserves additional native fields, including paths and URLs; known scalar
types are checked, and inline encryption keys and credential-shaped data remain blocked.

`server cleanup configure` changes a future schedule, not immediate cleanup. `server backup start`
schedules a timestamped config/database backup, excluding logs/personal changes/running builds/
supplementary data; returned filename is not completion proof. License commands use input-secret
aliases even where native REST embeds a key in the URL. Server scalar fields are encoded and server-validated; credential-shaped names such as
superuser-token remain blocked. XML-only `server rest-plugin` is projected to ordinary JSON metadata.

`pools tokens create <id> --ttl <seconds> --store-as <alias>` mints one-time registration tokens,
not user access tokens. Repeat aliases for a batch; TTL uses the API's signed integer type in seconds; lifetime semantics are validated by TeamCity.
Every returned token must be stored before success is reported. Values are never printed.

`mutes delete-many --id <id> --confirm` accepts distinct explicit IDs, preflights each
full scope/target/resolution and sends one native Mutes DELETE. Current docs define body/void
response but do not establish handler identity/atomicity. Actual2xx returns
`serverAcknowledged:true,postconditionVerified:false`, not a claimed deletion count. No retry or
rollback claim. Like config reset, this is documented native action coverage, not live proof.

## Files, server paths and secure resolution

The four trees are `jobs files`, `builds artifacts`, `vcs instances files` and `server files`.
Each has list/children/metadata/download/archive. Server areas, including configured `custom.*`
areas, are validated by TeamCity. Remote path segments are encoded once; literal percent signs,
colons, backslashes and Unicode are preserved. Empty/dot segments and leading separators are
rejected because they would change URL route composition. Lists/ZIP selection are nonrecursive and exclude hidden files. ZIP selection does not
browse archives. Artifact lists recognize archives without enumerating their contents. No automatic href traversal. Artifact reads disable usage recording and
parameter resolution; job VCS reads disable parameter resolution.

Artifact lists add `directory` and `archive` booleans. NAME marks directories with `/` and archives
with `(archive)`. These indicators come from the presence of `children` and `content` in the
[File model](https://www.jetbrains.com/help/teamcity/rest/file.html): directories have children;
archives have both children and content. The request selects `children($none),content($none)`
and enables archive recognition (`browseArchives:true`) while keeping `recursive:false`; it
returns no nested children or hrefs. See JetBrains'
[archive projection](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/data/finder/impl/BuildArtifactsFinder.java#L464).
Each listing reads one extra entry to establish `hasMore` without another request; only the
requested number is returned. A complete list has `hasMore:false` and no footer; when more exist,
the shared footer suggests a larger selection, such as `More results: --limit 21`. At the safe-integer boundary completeness can
remain unknown (`hasMore:null`). `Next:` suggests `children` for each directory and `download`
for each file or archive. These commands retain the selected profile and current directory path;
unsafe shell tokens are omitted by Core's shared follow-up policy. An empty listing prints
`No files found.`. No implicit recursion, pagination or href following occurs.

```text
teamcity-cli builds artifacts list 12345 --limit 20 --profile uat --json
teamcity-cli builds artifacts download 12345 dist/application.zip --output application.zip --profile uat --json
teamcity-cli builds source 12345 src/example.ts --output example.ts --profile uat --json
teamcity-cli users avatar download 123 --size 64 --output avatar.png --profile uat --json
```

Downloads default to the invocation working directory. Files and source use the final resource
path component, archives append `.zip`, avatars use `avatar.png`, and status icons use `statusIcon.svg`.
Unsafe or ambiguous default names are rejected. Optional `--output <path>` resolves relative paths
against the invocation directory and uses absolute paths as supplied. The parent must exist.
Core stages beside the destination in a private `.download-*` directory. Result is
`{path,bytes,sha256,mediaType}` for an actual retained file. Downloads have no default byte limit.
An optional `--max-bytes` sets a caller-selected budget with no tool-imposed upper ceiling. HTTP206 partial responses are
rejected without publication or automatic retry; downloads do not support ranges/resume.
No overwrite, symlink/junction escape, automatic opening, execution or extraction. Atomic no-clobber publication
requires destination-filesystem hard-link support; unsupported filesystems fail closed. PNG/ZIP/SVG types
and signatures are validated; SVG/icon success says nothing about the build's success.
The fresh staging directory and file use private POSIX modes/current-user ACLs; the published hard
link retains the file protection. Core never changes existing destination directory ACLs and
does not repair a user data root deliberately made public. Detectable directory/staged/destination
replacement is rejected without deleting unknown files. A same-user process can still race after
the final identity check. Data can be sensitive:
do not publish downloads or turn them into fixtures without explicit sanitization. Existing files
in profile AppData remain untouched. The former `downloads list/delete/clean`
commands are removed; arbitrary output paths are not registered for profile cleanup.

`settings-path` on jobs/projects/VCS roots and `builds artifacts-path` return a typed absolute
**SERVER** path. They neither download XML nor read that path on the local machine.

The following require Credentials even though two native routes are GET:

```text
teamcity-cli projects secure create-reference Example --value-secret input --store-as reference --profile uat
teamcity-cli projects secure resolve Example --reference reference --store-as resolved --profile uat
teamcity-cli builds resolve-parameter 12345 env.MODE --store-as resolved-mode --profile uat
```

Values go only from/to profile secret aliases, preserving whitespace. A parameter expression
returned unchanged is unresolved, not success. Aliases are collision-checked; no secrets in JSON,
RPC, diagnostics or files. These routes and sensitive downloads are excluded from live proof.

## Profiles and authentication

The public CLI has no compiled-in TeamCity URL. The virtual `default` profile exists immediately,
but service commands cannot run until its required URL and authentication mode are configured.
Configure separate profiles whenever URLs or security realms differ:

```text
teamcity-cli profile configure uat --url https://teamcity-uat.example.com --token-stdin
teamcity-cli profile configure production --url https://teamcity.example.com --token-stdin
teamcity-cli profile set-default production
teamcity-cli auth status --profile production --json
```

In an ordinary terminal, running `teamcity-cli` or a service command with an incomplete profile
starts the same guided configuration. JSON, JSON-RPC, redirected/non-TTY input, and programmatic
execution never prompt; they fail before networking and print an actionable `profile configure`
command.

JetBrains currently exposes a public TeamCity server that supports guest REST reads. Create it as
an explicit demo profile; the CLI never selects it or contacts it automatically:

```text
teamcity-cli profile configure jetbrains-demo --url https://teamcity.jetbrains.com --guest
teamcity-cli server status --profile jetbrains-demo --json
```

Guest mode uses TeamCity's `/guestAuth/app/rest` path and sends no Authorization header. Its
available data and uptime are controlled by JetBrains. To convert a guest profile to token auth,
reconfigure it with `--no-guest --token-stdin`.

Use `profile set <name> --url <url>` to update an existing profile. A default profile always
exists. To remove one, make another profile default first and then run `profile delete <name>`;
the final remaining profile cannot be deleted.

For token profiles, configuration validates the token through the current-user REST endpoint before
the common package stores it in the platform credential store. `auth login` remains available for
credential rotation. Tokens never enter profile JSON. For automation, pipe the token to
`--token-stdin` or set `TEAMCITY_TOKEN`; do not put it in a command-line argument.

## Permission fail-safe

`ReadOnly` is enabled by default. Ordinary service writes require profile-specific `Update`;
administrative writes require Admin and credential workflows require Credentials, both separately
disabled by default. Categories are not hierarchical. For example:

```text
teamcity-cli permissions list --profile uat
teamcity-cli permissions grant Update --profile uat
teamcity-cli jobs run Example_Build --profile uat --branch main --json
teamcity-cli permissions revoke Update --profile uat
```

Granting `Update` in UAT does not grant it in Production. This local gate reduces accidental AI
actions; it does not replace TeamCity's own authorization.

## Human output

Help leads with everyday work:
- The root lists `Everyday` (`builds`, `jobs`, `projects`, `queue`, `agents`), then `Triage`,
  `Administration` and Core's local `Configuration`.
- `builds --help` starts with `list`, `show`, `wait`, `diagnose`, `tests`, `problems` and
  `changes`, followed by `Files`, `Control` and `Evidence`.
- `jobs`, `projects`, `queue` and `agents` start with their everyday commands: list and show, plus
  `jobs run` and `queue cancel`.
- Examples appear at the root and on `jobs` and `builds`.

A typo such as `teamcity-cli bulds` is reported as an unknown command with a suggestion. An argument
error shows one usage line, not the full help. Commander's `help <name>` with an unknown name still
prints the root help.

Help describes actions briefly. Operational caveats live with the command groups above:

- Triage batches target the supplied IDs; inspect item failures even after an HTTP success.
  Investigations are replaced by removal followed by creation, so replacement is not atomic.
  Finish requests, cache resets and VCS labels require reading their returned status.
- Configuration replacement removes omitted settings or entries; an empty replacement clears the
  named collection. Detaching a template or VCS root removes the attachment. Server paths refer
  to the server filesystem. A local `forget` removes only the stored alias, leaving remote state.
- Administration can change access immediately. Replacing authentication modules can lock users
  out. Current-user tokens, project secure references, agent-registration credentials and license
  aliases are separate credential kinds. Values stay in profile secret storage; use name/existence
  commands to inspect them. Backups can contain server data and are not downloaded automatically.
- Cloud lifecycle actions can incur cost; forced termination can interrupt running work. An
  acknowledgement confirms the request, not the final provider state. VCS settings changes can
  update attached projects or external repositories. No mutation is retried automatically.

Some commands print a compact view instead of every field:
- `builds list` prints a table: BUILD, JOB, BRANCH, STATE, RESULT, AGE. RESULT is shown only for
  finished builds; a running build's intermediate status is not a result.
- `builds show` prints a summary with `Next:` suggestions: `builds wait` for a queued or running
  build, `builds diagnose` for a failed one, and the artifact list for a finished one.
- `builds cancel` and `queue cancel` print the build record; `queue list`, `jobs list` and
  `agents list` print compact tables. `projects list` indents the selected project hierarchy.
- `jobs run` and `builds wait` print the build title, state and result fields, with no duplicate
  outcome field. A newly queued build says `State: queued` once.
- `builds tests` prints STATUS, FLAGS (new, muted, ignored, investigated), DURATION and TEST.
  Test details and stack traces appear only in `--json`.
- `builds problems` prints TYPE, FLAGS and a one-line DESCRIPTION, worded as `builds diagnose`
  words it.
- String lists (tags, attribute names and parameter names) print one item per line.
- File listings print NAME, SIZE and MODIFIED; artifact listings add directory and archive markers.
- Downloads print the full local path, byte count and SHA-256 of the saved file.

In a terminal, `builds list` fits its width by shortening only BRANCH, `builds problems` only
DESCRIPTION. Build and job IDs, test names and file
names are never cut; an impossible fit wraps. Redirected output is not shortened. `--json` and
JSON-RPC return the same complete data as before.

## Machine-oriented output

Append `--json` to any leaf command for stable machine-readable output:

```text
teamcity-cli builds list --state running --limit 20 --json
teamcity-cli builds problems 12345 --json
```

For several calls in one Node process, start `teamcity-cli --json-rpc` and send one JSON-RPC 2.0
object per line:

```json
{"jsonrpc":"2.0","id":1,"method":"cli.execute","params":{"argv":["server","status","--profile","uat"]}}
{"jsonrpc":"2.0","id":2,"method":"cli.execute","params":{"argv":["jobs","list","--profile","production"]}}
```

With `--json`, a failure writes one line to stderr and nothing to stdout, except the result of a
failed outcome:

```json
{"error":{"code":"permission.denied","message":"Permission 'Update' is disabled for profile 'uat'.","exitCode":1,"profile":"uat","next":[["permissions","grant","Update","--profile","uat"]]}}
```

JSON-RPC returns the same fields, apart from `message`, in `error.data`, and adds `result` for a
failed outcome. Every `next` argv can be sent back to `cli.execute` unchanged. Core's codes
(`usage`, `permission.denied`, `profile.*`, `auth.*`, `secrets.unavailable`, `download.failed`,
`interrupted`, `error`, the `http.*` statuses of its shared `HttpError` and the `request.*`
transport reasons) are listed in the [design](../../docs/DESIGN.md#machine-output-is-a-first-class-contract).
TeamCity adds these:

| Code | Meaning |
|---|---|
| `http.unauthorized`, `http.forbidden`, `http.notFound`, `http.conflict`, `http.rejected`, `http.rateLimited`, `http.serverError` | Core's `HttpError`: TeamCity answered with that HTTP status, also for a refused download; the response body is never read or shown, and `401` suggests `auth login` |
| `request.failed` | A read was lost in transit; nothing was changed, so it can be retried. A lost download reports Core's download error instead |
| `request.unknownOutcome` | A write was lost in transit; it may or may not have been applied, and is never repeated |
| `run.unknownOutcome` | The queue request's outcome is unknown; check `builds list --job <id> --state any` |
| `build.failed`, `build.canceled`, `build.unknown`, `build.missing` | Waited build outcome, with the build as data |
| `wait.timeout` (exit 124), `wait.interrupted` (exit 130), `wait.failed` | Observation stopped; the build continues on the server |
| `diagnose.partial`, `list.incomplete`, `batch.partial`, `build.statusPartial`, `labels.partial` | Partial data or a partial write, printed in full and exiting 1 |

## Tests and local integration proof

The default suite is offline. MSW verifies the native `fetch` boundary, including exact REST
methods, paths, locators, requested fields, mutation bodies, permission denial before networking,
profile isolation, and credential-safe errors.

Run the integration suite through the repository command:

```text
npm test
```

For development/debug proof-of-work, configure a real local profile once and run:

```text
npm run test:integration --workspace @eyeauras/teamcity-cli -- --profile <name>
```

This command builds Core and TeamCity and then runs the compiled CLI as child processes. It uses
the selected current-user profile and its platform-protected credential, not test-only URL/token inputs.
The fixed 19-row inventory covers authentication, permission inspection, server, bounded projects,
jobs, builds/tests/problems/changes, the latest finished build of a listed finished build's job,
queue, agents, VCS root discovery and a persistent JSON-RPC session. It deliberately excludes unpaged scoped parameter/step/extension/dependency/attachment lists;
their contracts and all authoring/operator mutations are covered offline, not claimed as live-verified.
All new v2 routes are contract-tested offline; the fixed live inventory was not broadened.

Only `ReadOnly` service commands are invoked, with at most three items per collection. Empty lists
are valid and dependent detail checks are explicitly skipped. Output contains pass/count/skip
summaries, never raw payloads or discovered identifiers. No fixture or artifact is recorded.

The proof is outside `npm test` and refuses CI/CD environments before launching the CLI. It is a
local development tool, not a regression suite or production availability monitor.
The shared Core proof invoker limits each child to 30 seconds and each stdout/stderr stream to
64 KiB. Oversized responses now fail instead of using unbounded capture. It strips inherited
`TEAMCITY_TOKEN` case-insensitively and applies the [shared CI preflight](../../docs/testing.md).

See [the integration authoring guide](../../docs/integrations.md) for how this product references
the common package and how to start the next in-repo or external integration.
