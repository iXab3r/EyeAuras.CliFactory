# TeamCity CLI

`teamcity-cli` is the first executable integration built on the reusable
`@eyeauras/cli-factory` npm package. The package under this directory owns TeamCity REST paths,
locators, DTOs, and command vocabulary; generic command-tree, profile, credential, permission,
output, and JSON-RPC behavior stays in `packages/core`.

Ordinary text, JSON and XML responses retain their 2 MiB actual-byte limit. They now also reject
invalid Content-Length and incomplete or mismatched unencoded/identity transfers. Compressed wire
length is syntax-checked but is not compared with decoded size; actual decoded bytes remain
bounded. Errors retain the static `TeamCity response stream failed or exceeded2MiB; remote outcome
is unknown.` message without exposing body/error details. UTF-8 decoding still preserves an initial
BOM. Specialized 64 KiB discard probes and file-download limits are unchanged; no automatic retry
or command replay is added.

## Command tree

| Command | Purpose | Permission |
|---|---|---|
| `server status` | Show server version, role, and clock | `ReadOnly` |
| `projects list`, `projects show <id>` | Discover projects | `ReadOnly` |
| `jobs list`, `jobs show <id>`, `jobs status <id>` | Discover build configurations and their latest operational build | `ReadOnly` |
| `jobs run <id>` | Queue a build, optionally with `--branch` and `--comment` | `Update` |
| `builds list`, `builds show <id>` | Inspect builds across all branches and states | `ReadOnly` |
| `builds tests/problems/changes <id>` | Diagnose a build | `ReadOnly` |
| `builds cancel <id>` | Cancel a running build | `Update` |
| `queue list` | Inspect queued builds | `ReadOnly` |
| `queue cancel <id>` | Cancel a queued build while preserving cancellation metadata | `Update` |
| `agents list`, `agents show <id>` | Inspect build agents | `ReadOnly` |
| `projects create/set/move/delete` | Author project identity, hierarchy and allowed fields | `Update` |
| `jobs create/set/move/delete` | Author build configurations | `Update` |
| `projects parameters list/show`, `jobs parameters list/show` | Inspect safe parameter values and metadata | `ReadOnly` |
| `projects parameters create/set/delete`, `jobs parameters create/set/delete` | Manage plain parameters | `Update` |
| `jobs steps list/show` | Inspect ordered step summaries | `ReadOnly` |
| `jobs steps create/replace/delete` | Manage build steps | `Update` |
| `vcs roots list/show` | Discover existing roots without connection properties | `ReadOnly` |
| `jobs vcs list/show`, `jobs vcs checkout-rules show` | Inspect root attachments/rules | `ReadOnly` |
| `jobs vcs attach/replace/detach`, `jobs vcs checkout-rules set` | Manage attachments, not shared roots | `Update` |
| `jobs triggers list/show`, `jobs features list/show` | Inspect redacted extension summaries | `ReadOnly` |
| `jobs triggers create/replace/delete`, `jobs features create/replace/delete` | Manage extensions; disabled unless explicitly enabled | `Update` |
| `jobs snapshot-dependencies list/show` | Inspect upstream build dependencies | `ReadOnly` |
| `jobs snapshot-dependencies create/replace/delete` | Manage upstream dependencies | `Update` |
| `jobs templates list` | Inspect attached templates in priority order | `ReadOnly` |
| `jobs templates attach/detach` | Attach/detach existing templates, not create/delete templates | `Update` |
| `jobs agent-requirements/artifact-dependencies list/show` | Inspect redacted rule summaries | `ReadOnly` |
| `jobs agent-requirements/artifact-dependencies create/replace/delete` | Manage requirements and artifact dependencies | `Update` |
| `jobs steps/features/triggers/agent-requirements/artifact-dependencies fields show/set` | Read/write allowed scalar settings | Read: `ReadOnly`; write: `Update` |
| `jobs steps/features parameters list/show/replace/set` | Inspect redacted metadata or change non-secret plugin properties | Read: `ReadOnly`; write: `Update` |
| `jobs output-parameters list/show/create/set/delete` | Manage plain output parameters | Read: `ReadOnly`; write: `Update` |
| `projects features list/show/create/replace/delete` | Manage project features | Read: `ReadOnly`; write: `Update` |
| `projects templates list/create`, `projects templates default show/set/clear` | Create templates and manage the project default | Read: `ReadOnly`; write: `Update` |
| `jobs templates show`, `jobs aliases/branches/tags` | Inspect attachments and job metadata | `ReadOnly` |
| `projects parent`, `projects/jobs fields show` | Inspect hierarchy and allowed fields | `ReadOnly` |
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

Top-level collection commands accept `--limit <count>` from 1 to 100 and `--start <offset>` starting at
zero. They return one plain array page and never auto-page. Run a branch without a leaf, such as
`teamcity-cli builds`, to see its generated help and options.

Paging defaults remain `--limit 100 --start 0`. These options accept decimal digits with an optional
minus and leading zeros, but reject whitespace, plus signs, fractions and exponents. The start must
be a nonnegative safe integer (`-0` remains valid); limit remains 1–100. Invalid options fail before
profile onboarding or credential access. Each option now reports one static error for syntax, unsafe
integers and range failures. The existing strict numeric build/queue-cancel/agent-show ID parsers
retain positive safe-integer validation and use the same decimal grammar; other numeric service
validators are unchanged. JSON options retain their existing non-echoing errors, repeat order and
service-specific body validation.

Single-owner parameter, step, extension, dependency and attachment lists use the native scoped endpoints and preserve
server order; these endpoints do not support paging options. `vcs roots list --project <id>`
filters by direct project. Local v2 coverage is **449/449 unique REST method/path pairs (100%)**:
235/235 GET and214/214 mutation routes; no inventory rows remain unexposed. This does not promise
every parameter/payload variant or live mutation verification. See the [final review](../../.workspace/workstreams/teamcity-v2/final-review.md)
for evidence and the two native-action postcondition limitations. Code publication is pending.
This is route coverage, not complete payload/feature coverage. The
[+100](../../.workspace/workstreams/teamcity-v2/checkpoint-100-review.md) and
[+150 authoring checkpoints](../../.workspace/workstreams/teamcity-v2/checkpoint-150-review.md)
record the two 50-route reviews in the latest 100-route slice. Review counters exclude the 17-route baseline.

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
Both create commands accept `--description`. `projects set <id> <field> <value>` permits only
`name`, `description`, `archived`; `jobs set` permits `name`, `description`, `paused`. Booleans
must be `true` or `false`. Move with `projects move <id> --parent <id>` or
`jobs move <id> --project <id>`. No create command promises client-side upsert or conflict semantics.

Parameters use `list <owner-id>`, `show/delete <owner-id> <name>` and
`create/set <owner-id> <name> --value <value>`. This slice supports only non-secret values.
Password, hidden, unknown-type and credential-named values are omitted with `redacted: true`.
An absent/empty TeamCity type spec means a plain parameter; supported visible types are text,
select and checkbox. Full raw type specs are never returned. Create/set preflight only metadata
and reject protected, unknown or malformed metadata before writing; only create tolerates a 404.
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

`jobs status` and `builds list` deliberately disable TeamCity's implicit build filter and include
default and non-default branches. This keeps running, failed, canceled, personal, and branch
builds visible instead of reporting an older successful default-branch build.

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
repeatable non-secret `--property <key=value>`, and default to **disabled**. Supply `--enabled`
only when activation is intended. Replacement is a full writable replacement: omitted properties
and trigger customization are not retained. No hidden GET/merge or retries occur. Trigger
`buildCustomization` and credential provisioning are not supported by this slice.

Snapshot dependencies use the same list/show/create/replace/delete shape, with required
`--source <upstream-job-id>` instead of `--type` for writes. Their dependency ID is the upstream
build configuration ID. Direct self-dependency is rejected locally; TeamCity validates cycles and
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
unless `--disabled` is supplied. Direct self-dependency is refused; the server validates revisions,
cycles and plugin semantics. Replace is full writable replacement, not a hidden read/merge.

The `fields show/set` subtree allows `disabled` for these rules, triggers and features; steps
also allow `name`. Boolean text must be exactly `true`/`false`. Step/feature `parameters replace`
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

Pool and agent changes can alter where builds run. Pool IDs are non-negative integers; pool 0
is the default and cannot be deleted. Agent/build/change IDs must be positive integers. Pool
`fields` supports only `name`. Assigning an agent moves its pool membership; unassigning a project
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
non-secret `--comment`. Agent fields expose only `id`, `name`, `connected`, `enabled`, `authorized`;
only `enabled`/`authorized` are writable. `authToken` is forbidden, not hidden behind ReadOnly.
Policy `any` forbids `--job`; `selected` accepts repeated job IDs, rejects duplicates, and with no
jobs permits none. It fully replaces selection. Policy output is `{policy, jobs}`. Agent/pool and
compatibility responses expose identities, not raw parameters, credentials or unmet requirements.

Queue position show accepts a positive integer, `first` or `last`; set supports only `1`, `first`
or `last` and requires `--build <id>`. No auto-polling or implicit launch/cancel occurs. Tag add
requires at least one repeatable `--tag` and preserves other tags. Build tag replace with no tags
clears public tags. These operations never target private users' tags. Tag add returns a local
acknowledgement and discards any successful response body; list/replace returns names only.

Build number/status-text writes require a running build, enforced by TeamCity. Build comment set
uses `--text`; clear removes the comment. Build delete can delete history/artifacts under server
policy; there is no local undo. Statistics remain numeric strings to avoid precision loss and
reject nonnumeric payloads without echoing them. Generic build fields permit only `id`, `buildTypeId`,
`state`, `branchName`; status/finish-date/number use named commands. Absent agent pool and cancellation
comment normalize JSON null/empty responses to null. Other JSON endpoints decode strictly.

Pool list and pool-agent list are bounded pages. Pool projects, agent compatibility, queue-compatible
agents, tags, statistics and direct parent changes are native scoped lists, not auto-paged streams.
Unrequested nested server/user/credential fields are excluded. Metadata itself may still be private:
do not publish real output or use it as a fixture without sanitization. There is no schema-free
JSON/HTTP escape hatch or unbounded global queue clearing. Later sections describe the explicit
credential/cloud/file surfaces.

## Bulk configuration and queue controls

`replace-all` replaces complete collections; omitted items are removed. Job steps/features/triggers,
requirements/dependencies/VCS entries and project features accept repeated `--item <json>` with
strict family-specific fields, not raw REST bodies. Parameters use repeated `--property name=value`;
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

`builds batch` requires repeated `--build <id>` (1–100 distinct IDs). Status/show are reads;
cancel/delete/comment/pin/tags are Update operations. Bulk write results expose error counts and
partial failures, never unconditional success or raw server diagnostics. `finish`/`finish-at`
return accepted timestamps, not proof of completion; `start-agentless` starts queued work without
an agent. Log append rejects service-message controls. VCS labels mutate an external VCS and require
one `--root-instance`; inspect individual returned statuses.

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

`users tokens` is **current-user only**. To issue into the selected profile's OS keyring:

```text
teamcity-cli users tokens create ExampleToken --alias automation --expires 20991231T235959+0000 --restriction '{"permission":"VIEW_PROJECT","project":"Example"}' --profile uat
```

Expiry or explicit `--no-expiration` is required; choose restrictions or explicitly
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

`server nodes` omits internal URLs. Responsibility set accepts only CAN_PROCESS_BUILD_MESSAGES
and true/false; the response describes enabled configuration, not effective transition.
`server api-version` is distinct from the local CLI `--version`.

## Cloud, VCS and versioned settings

`cloud profiles/images/instances` describes **remote cloud profiles**, not CLI connection profiles.
Image/instance commands require `--cloud-profile`, `--image` and, when applicable, `--instance`.
Start may incur cost. Stop schedules graceful shutdown; delete/force-stop require `--confirm`
and may interrupt running work. Acknowledgement is not proof of the final provider state.

`vcs roots create` currently provisions anonymous Git with explicit HTTPS URL/branch/project/name.
Credential-bearing URLs are rejected. Property reads return names/existence only; replace/clear
operate on the whole native map and can break attached jobs. `vcs instances` exposes polling,
commit-hook notifications, saved branch/revision state and allowlisted fields. `notify-commit`
reports scheduling only for HTTP202, not other successful statuses.

`projects versioned-settings` covers configuration/effective configuration, typed scalar fields,
context parameters, check/commit/load/status and secure-value mappings. Config replacement requires
an explicit synchronization mode; enabled mode also requires VCS root and format. Omitted fields
use documented TeamCity defaults (current build settings, UI editing on, changes off, portable
DSL on); secure values stay outside VCS. An existing-root conflict requires the caller to choose
`importDecision`, never an automatic overwrite decision. Commit/load need confirmation.
Context replacement removes omitted entries; values are never returned in context lists.

`config fields reset <project> vcsRootId --confirm` attempts the documented native DELETE.
Older official server code can fail **after changing configuration**; current-server successful
clear semantics are not verified. `resetRequested` means actual HTTP2xx only, not a verified clear.
Inspect configuration before retrying; the CLI does not retry or claim rollback.

## Explicit credential inputs

Use `credentials import <alias> --env <VARIABLE_NAME>` to import only the named environment
variable into the current profile's OS keyring. Requires Credentials; existing aliases fail.
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
requires exactly one project/global scope; detail also requires a category and fails if not unique.
`roles` defines server roles; user/group `roles` assigns them. Create takes a name and optional
permission/include IDs, never a caller-supplied role ID. Role writes require Admin.

`deployments` creates/deletes dashboards within projects. Instance `upsert` supplies an explicit
initial state/date history; `append-state` adds one entry. State uses uppercase native values
and TeamCity timestamps. Parent IDs remain explicit. Destructive/upsert commands require confirmation.

`server authentication replace --item <json> --confirm` replaces the **complete module list** and
can lock out users. Omitted scalar settings are preserved; missing modules are an error. Typed
modules accept non-secret properties plus `secrets:[{"name":"password","alias":"directory"}]`.
It never reads and rewrites masked existing credentials. `server settings set` is a typed
numeric/boolean partial update, excluding encryption changes, paths and URLs.

`server cleanup configure` changes a future schedule, not immediate cleanup. `server backup start`
schedules a timestamped config/database backup, excluding logs/personal changes/running builds/
supplementary data; returned filename is not completion proof. License commands use input-secret
aliases even where native REST embeds a key in the URL. Server fields are allowlisted; no
superuser-token field. XML-only `server rest-plugin` is projected to ordinary JSON metadata.

`pools tokens create <id> --ttl <seconds> --store-as <alias>` mints one-time registration tokens,
not user access tokens. Repeat aliases for a batch (up to50); TTL is explicitly1–86400 seconds.
Every returned token must be stored before success is reported. Values are never printed.

`mutes delete-many --id <id> --confirm` accepts up to50 distinct explicit IDs, preflights each
full scope/target/resolution and sends one native Mutes DELETE. Current docs define body/void
response but do not establish handler identity/atomicity. Actual2xx returns
`serverAcknowledged:true,postconditionVerified:false`, not a claimed deletion count. No retry or
rollback claim. Like config reset, this is documented native action coverage, not live proof.

## Files, server paths and secure resolution

The four trees are `jobs files`, `builds artifacts`, `vcs instances files` and `server files`.
Each has list/children/metadata/download/archive. Server areas are explicitly logs, backups or
dataDirectory; no custom areas. Relative paths reject traversal, encoded segments, absolute/UNC
paths and backslashes. Lists/ZIP selection are bounded, nonrecursive, exclude hidden files and do
not browse archives. No automatic href traversal. Artifact reads disable usage recording and
parameter resolution; job VCS reads disable parameter resolution.

```text
teamcity-cli builds artifacts list 12345 --limit 20 --profile uat --json
teamcity-cli builds artifacts download 12345 dist/application.zip --output application.zip --profile uat --json
teamcity-cli builds source 12345 src/example.ts --output example.ts --profile uat --json
teamcity-cli users avatar download 123 --size 64 --output avatar.png --profile uat --json
```

Downloads require a new basename and save only below
`AppArguments.AppDataDirectory/downloads`, using Core's shared identity-checked private staging
under `TempDirectory`. Result is
`{path,bytes,sha256,mediaType}` for an actual retained file. Default actual-byte limit16MiB,
maximum64MiB with `--max-bytes`; SVG is additionally limited to1MiB. HTTP206 partial responses are
rejected without publication or automatic retry; downloads do not support ranges/resume.
No overwrite, redirect,
symlink/junction escape, automatic opening, execution or extraction. Atomic no-clobber publication
requires same-profile hard-link support; unsupported filesystems fail closed. PNG/ZIP/SVG types
and signatures are validated; SVG/icon success says nothing about the build's success.
The fresh staging directory and file use private POSIX modes/current-user ACLs; the published hard
link retains the file protection. Core never changes AppData ancestor/download-directory ACLs and
does not repair a user data root deliberately made public. Detectable directory/staged/destination
replacement is rejected without deleting unknown files. A same-user process can still race after
the final identity check. Data can be sensitive:
do not publish downloads or turn them into fixtures without explicit sanitization. File cleanup
follows profile AppData semantics; it is not permission to silently erase existing user data.

`settings-path` on jobs/projects/VCS roots and `builds artifacts-path` return a typed absolute
**SERVER** path. They neither download XML nor read that path on the local machine.

The following require Credentials even though two native routes are GET:

```text
teamcity-cli projects secure create-reference Example --value-secret input --store-as reference --profile uat
teamcity-cli projects secure resolve Example --reference reference --store-as resolved --profile uat
teamcity-cli builds resolve-parameter 12345 env.MODE --store-as resolved-mode --profile uat
```

Values go only from/to profile keyring aliases, preserving whitespace. A parameter expression
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
the selected current-user profile and its OS-keyring credential, not test-only URL/token inputs.
The fixed 19-row inventory covers authentication, permission inspection, server, bounded projects,
jobs/status, builds/tests/problems/changes, queue, agents, VCS root discovery and a persistent
JSON-RPC session. It deliberately excludes unpaged scoped parameter/step/extension/dependency/attachment lists;
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
