# Outcome and baseline

Build `youtrack-cli` as a second thin integration using the **same** `@eyeauras/cli-factory`
workspace package as TeamCity. Humans and AI agents should be able to inspect, triage, update,
and plan YouTrack work through one discoverable command tree, profile-scoped credentials and
permissions, human/JSON output, and persistent JSON-RPC execution.

This Issue records the complete public REST research inventory and the v1 contract. It does not
claim that implementation exists. The repository currently ships the factory and TeamCity only.
The research worktree is `EyeAuras.CliFactory-1`, branch `feature/youtrack-v1`, based on `e0d4d1b`.
No production code, commit, push, real YouTrack instance access, or live mutation is part of this
preparation task. GitHub publication uses the already configured `gh` authentication.

The owner explicitly requested the entire API inventory before implementation. This is a
research-only reconciliation with the default vertical-slice guidance in `docs/integrations.md`;
implementation still proceeds by useful slices, with no generated CLI, speculative abstraction,
or universal HTTP layer.

# First implementation slice — plan only

The next implementation slice is deliberately limited to **eight existing inventory operations**.
This update plans the work; it does not implement or accept an endpoint. Current accepted YouTrack
operation count is **0**. The full v1 scope stays 118 operations plus the separately counted derived
attachment download. Lower-priority inventories and the five published comments are unchanged.

Outcome: configure a profile, prove identity, discover a project ID, search/read an issue and its
comments, then explicitly create or edit issue narrative text and add a comment. Implement reads
before writes. This gives a useful daily workflow and concrete list/detail/mutation examples for
reviewing authoring effort before expanding the integration.

| Order | Existing operation identity | CLI mapping | Permission |
|---|---|---|---|
| A1 | `GET /api/users/me` | `user me` | ReadOnly |
| B1 | `GET /api/admin/projects` | `project list` | ReadOnly |
| B2 | `GET /api/issues` | `issues list [--query <query>]` | ReadOnly |
| B3 | `GET /api/issues/{issueID}` | `issues get <issueID>` | ReadOnly |
| B4 | `GET /api/issues/{issueID}/comments` | `issues comments list <issueID>` | ReadOnly |
| C1 | `POST /api/issues` | `issues create --body <json>` | Update |
| C2 | `POST /api/issues/{issueID}` | `issues update <issueID> --body <json>` | Update |
| C3 | `POST /api/issues/{issueID}/comments` | `issues comments add <issueID> --body <json>` | Update |

A adds the minimal package/auth/profile wiring and identity read. B proves the useful read context.
C begins only after B's review and adds three controlled mutations. Normal slice review at eight
operations includes an early authoring/simplicity review; it does not wait for fifty or reset the
cumulative counter. No production implementation, merge, commit, push or live YouTrack call is
part of this planning update.

First-slice bodies are an explicit **CLI scope decision**, not a claim that the REST API only
supports these fields:

- Issue create: nonempty `project.id` and `summary`, optional `description`.
- Issue update: a nonempty subset of `summary` and `description`; nonempty summary if supplied,
  explicit `description: null` clears it, and omitted fields remain untouched.
- Comment add: nonempty `text` only.
- Reject unsupported body fields locally with an actionable later-slice explanation. Defer typed
  custom-field/state/assignee changes, visibility/move/tag controls, draft helpers, attachment
  flows, command apply/assist, and notification suppression. These remain in their existing v1
  scope where applicable; future field/flag expansion does not count as a new REST operation.
- A project may require nondefault custom fields. First-slice creation then reports the server's
  validation failure safely; do not guess/default missing values or promise creation in every
  configured project. Extend those payloads in later reviewed slices.

Default projections for this slice are fixed:

| Family | Default fields / response shape |
|---|---|
| Identity | `id,login`; one identity object |
| Projects | `id,name,shortName`; project array |
| Issue list | `id,idReadable,summary,project(id,name,shortName),updated,resolved`; issue array |
| Issue detail | Issue-list fields plus `description,created`; one issue object |
| Comments | `id,text,author(id,login),created,updated`; comment array |
| Issue create/update result | `id,idReadable,summary,updated`; one issue object, or JSON `null` for empty success |
| Comment-add result | Comment fields above; one comment object, or JSON `null` for empty success |

No default custom-field or nested-collection expansion. Read `--fields` remains an explicit
source-shaped projection under the Issue's secret-scrubbing rule, not a promise to model every
optional DTO field. Existing bounded pagination, profile isolation, permissions, output/error and
AppArguments contracts apply unchanged.

First-slice acceptance (future implementation; all pending):

- [ ] A/B/C are implemented in order through real declarations/client and MSW boundary tests;
  exact eight method/path identities are accepted once each, with five ReadOnly and three Update.
- [ ] Auth validates before secure storage; package/profile/read behavior covers two profiles,
  noninteractive failure, JSON/RPC, encoding, explicit fields, empty pages and remote errors.
- [ ] All three writes prove Update denial before fetch, allowed exact body semantics, unsupported
  field rejection, success, safe remote validation/authorization failure, and no automatic retry.
- [ ] Same-capability list/detail/mutation examples and complete production/test/support deltas
  are reviewed against the frozen authoring baseline; early simplifications are resolved without
  requiring an abstraction. Technical/test PASS and authoring/simplicity PASS are separate verdicts.
- [ ] Focused tests plus `npm test` pass, docs describe only shipped slice behavior, the ledger
  records evidence and accepted count eight, and reviewers approve before the next slice begins.

# Mandatory authoring review — every 50 newly accepted operations

Goal: reduce the total handwriting needed for integrations, including **other CLIs**, while keeping
code simple to read, debug, and extend. Follow repository law 13 and
`docs/practices/integration-authoring-reviews.md`. A shorter YouTrack handler alone is not success.

Count unique census `METHOD PATH` identities newly exposed, tested, and reviewer-accepted since
this workstream's zero-YouTrack baseline. Identity validation and `user me` share one operation;
auth/profile/help/JSON/RPC plumbing, aliases, flags, optional payload fields, tests, refactors, and
commits do not advance the counter. Count the derived download separately as a capability, never
as operation 119 or an extra metadata route. Removing/readding a previously accepted route does
not reset or inflate the count; record coverage regressions separately.

Mandatory cumulative checkpoints are **50, 100, and the final shorter batch at 118**. The normal
review of the first eight remains mandatory and does not reset those thresholds. **Do not implement
operation 51 or 101 until the preceding authoring review has PASS and all required corrective
simplifications are closed.** If a planned slice crosses a boundary, split it before that operation.
Final delivery also requires the 118 checkpoint and separate derived-download acceptance. Include
the derived download in the final source-cost/complexity review even though it does not advance
the counter; if added after the 118 review, reopen that final review for its delta before delivery. If a
later approved scope change creates another full batch, continue +50 checkpoints and review the
new final remainder; never silently move an existing gate.

The source baseline is immutable commit
`e0d4d1b8dc615a969a0160f69a5fb34968d9ab3d` in this YouTrack worktree:
**Core source 1,731 nonblank TypeScript lines + TeamCity source 1,100 + YouTrack source 0 = 2,831
production lines**. Comments count; generated output does not. Test/support baseline is separately
**2,061 lines** (Core tests 753, TeamCity tests 1,155, test support 153); separate local integration
proof is **330 lines**. Reproduction paths/commands and fixed examples are retained under
`.workspace/workstreams/youtrack-rest/research/authoring-baseline/`.

The zero-YouTrack baseline is not evidence of a reduction. During the first eight, preserve the
first direct `issues list`, `issues get`, and `issues update` implementations as the fixed
same-capability comparison set, including declaration, client, DTO/validation, setup and helper
cost. If simplifying within that slice, compare its actual direct-before and after versions.
Subsequent 50/100/118 reviews reuse those capabilities and safety guarantees. TeamCity list/detail/
mutation examples are existing authoring and shared-consumer references, not numerically equivalent
service behavior by assumption. Record exact paths and source revision; if changes are uncommitted,
record their source-content hashes/diff without forcing a commit. Attribute imported parallel changes
separately from local simplification.
At every checkpoint record a compact evidence set against that original baseline and the previous
accepted checkpoint, using the same path rules and normal formatting:

| Evidence | Required comparison |
|---|---|
| Complete production source | Nonblank handwritten TS in `packages/core/src/**` plus every `integrations/*/src/**`: Core, YouTrack, other integration breakdown, net total, and newly added files/setup/helpers |
| Declaration/client/DTO/validation work | Equivalent issue/build list, detail and controlled mutation examples; show call paths and full helper/setup cost rather than isolated shortened handlers |
| Tests, fixtures, support, proof | Report separately with exact paths/count rules; preserve independent boundary, profile, permission and output evidence |
| Public concepts and complexity | Added/removed concepts, dependencies and call-path layers; which code a new CLI author must understand, customize and debug |
| Shared benefit | Actual TeamCity and YouTrack use of a new extraction; service-neutral use of an existing Core improvement may be demonstrated without inventing a third product |

An amortized production delta per newly accepted operation is supporting evidence only. Compare
like-for-like behavior and explicit safety guarantees; a rich workflow is not equivalent to a
simple field read. Do not claim a reduction before implementing and measuring it. Never game
metrics through minification, giant expressions, hidden generators/schema/DSL authoring, weakened
types/errors/help/permissions, deleted tests, or unsafe raw DTO output. There is no required
percentage reduction that can justify more complexity.

Implement representative operations directly first, find repetition in actual code, and try the
smallest function or improvement to an existing Core surface. Input typing, option declarations,
handler binding and contract-test setup are candidates, not mandatory abstractions. A **new**
shared mechanism needs demonstrated use in actual TeamCity and YouTrack implementations; a
synthetic example cannot supply the missing consumer. Keep service paths, query/field semantics,
DTOs and endpoint safety local. Do not introduce a generic HTTP/CRUD layer, generator, plugin
system or new dependency merely to lower the metric. Retain clear direct code when abstraction
is not a net improvement and explain the decision.

Before proposing shared code, inspect accepted Core improvements from the parallel TeamCity work.
Do not copy a mutable/unreviewed branch or attribute its savings to this workstream. A later reviewed
baseline import/merge must record the new commit, comparable counts and attribution while retaining
the original baseline and cumulative operation count; no merge is authorized by this planning task.

Review record: baseline/revision + accepted IDs/count; fixed sample diffs; total source and separate
test/support changes; concepts/layers/dependencies; shared-consumer evidence; checks run;
technical verdict; independent authoring/simplicity verdict; required corrections, owner and closure
evidence. Green tests alone never close the authoring gate. All checkpoints currently remain pending.
# Block 51–100 — article and sprint CLI body restrictions

This later contract amendment defines the supported writable fields for the article and sprint
commands already in the v1 inventory. Earlier preparation and first-eight planning sections are
retained as decision history; current implementation status belongs to the linked workstream.
These are explicit CLI restrictions, not a claim to cover the complete REST entity schema. They
change no endpoint identity, priority, permission category, release count or published inventory row.

All six commands retain their published positional IDs and required inline `--body <json>`:

| Command | Supported body contract |
|---|---|
| `article create` | Required `project: {id: <nonempty string>}` and nonblank `summary`; optional `content` string or explicit `null`. |
| `article update <article>` | Nonempty subset of nonblank `summary` and `content` string or explicit `null`; unspecified fields stay omitted. |
| `article comment add <article>` | Required nonblank `text` string; preserve multiline text. |
| `article comment update <article> <comment>` | Required nonblank `text` string; preserve multiline text. |
| `sprint create <agile>` | Required nonblank single-line `name` without control characters; optional `goal` string or `null`, `start`/`finish` safe-integer UTC milliseconds or `null`, `archived`/`isDefault` booleans, and explicit `previousSprint: {id: <nonempty string>}`. |
| `sprint update <agile> <sprint>` | Nonempty subset of nonblank single-line `name` without control characters, `goal`, `start`, `finish`, `archived`, and `isDefault`, with the same value types as creation. `previousSprint` is not accepted on update. |

Preserve empty and multiline sprint goals; do not replace an omitted goal with an empty value.
`previousSprint` is a create-only explicit choice: it moves unresolved issues from that sprint.
Never infer it from the board or current sprint. Setting `isDefault: true` automatically adds new issues that match the board column to this sprint; it is an explicit side effect, not a cosmetic flag. The CLI does not expose sprint issue membership
writes in this block, and must not assume replacement semantics for an `issues` collection.

For articles, defer parent/visibility/reporter/stars/tags and nested-resource writes, draft helpers
(`draftId`) and mute options; the separately declared article-comment commands above remain in scope.
For sprints, defer issue-membership and mute options. Reject unsupported body fields locally rather
than silently dropping them. Article creation does not require an existing article ID from copied
subarticle prose in the reference; it uses the explicit project and summary above.

Reads and write-result projections support the documented `--fields` option. Existing contracts
remain binding: finite source-shaped defaults, credential-safe human/JSON/RPC output, empty successful
2xx bodies as `null`, pre-fetch Update gates, missing required `--body` or malformed JSON syntax rejected before onboarding, semantic body fields/types validated before fetch, profile
isolation, and no automatic mutation retry. No real-service mutation proof is authorized.

Deterministic acceptance includes each allowed/unsupported field, missing and empty required bodies,
multiline content/text/goal, omission versus explicit null, safe-integer date validation, boolean
validation and create-only previous-sprint behavior. Missing required `--body` and malformed JSON syntax must not reach onboarding or fetch; unsupported body fields/types/null values must fail before fetch. All six Update leaves must be denied before fetch when disabled; prior output/error/response
sanitization and no-retry tests remain mandatory. This amendment does not add service calls or aliases
to the accepted-operation counter.

Official references: [Article resource](https://www.jetbrains.com/help/youtrack/devportal/resource-api-articles.html),
[Article operations](https://www.jetbrains.com/help/youtrack/devportal/operations-api-articles.html),
[Sprint resource](https://www.jetbrains.com/help/youtrack/devportal/resource-api-agiles-agileID-sprints.html),
[Sprint operations](https://www.jetbrains.com/help/youtrack/devportal/operations-api-agiles-agileID-sprints.html).

# Final v1 contract clarification — article results, downloads and authentication

This later amendment clarifies the existing final-v1 behavior and supersedes broader earlier wording
where stated below. Earlier preparation/implementation decisions and all 281 inventory rows remain
unchanged. No endpoint priority, permission, release count, public API or derived-operation count is
added by these clarifications. Implementation acceptance still requires independent tests/review.

## Article parent and upload results

`article parent get <article>` may return JSON `null` only when the successful response explicitly
contains JSON null. This is an explicit CLI handling policy, not a guarantee that every YouTrack
version returns null for a root article. Never turn 403, 404, an empty body, malformed JSON or another
failure into absence. Other documented successful objects retain normal validation and redaction.

`article attachment upload <article> --file <path>` supports documented write-result `--fields`
with finite defaults, the same explicit-file/Update gate and signed-URL output scrubbing as existing
attachment commands. This already-inventoried attachment upload remains in scope and supersedes the earlier block100 shorthand deferring nested-resource writes; it adds no endpoint. Article binary download and broader optional write payloads remain deferred.

## Signed download URL and file publication

The existing issue-download command accepts either documented signature form under the configured
context-relative `/api/files/` path: `/context/api/files/<fileID>?sign=...` or
`/context/api/files/<fileID>/sign=...`, where `/context` represents the actual configured context and
may be empty. The returned fileID can differ from the attachment entity ID. Require the metadata
object's `id` to match the requested attachmentID exactly; do not substitute the fileID for it.

Treat the signature as opaque secret material. Its encoded content may include CR/LF or slash
characters; this does not authorize an origin/context/path escape or signature disclosure. Validate
the actual URL structure without treating an encoded signature as an identifier. The same-origin,
configured-context, HTTPS/loopback, no-Authorization-on-binary-request and no-redirect policies remain
binding. Fetch only the exact metadata-returned URL; no arbitrary URL option or external/CDN fallback.

Reject existing symlinks/junctions along the managed download path. Create a private profile-owned
temporary file and publish the completed file using an exclusive hard link, never an overwrite or
an overwrite-capable rename fallback. Fail closed if the required hard-link operation is unsupported;
clean temporary/partial data on failure. Existing name/path/byte-limit/projection-redaction rules and
profile AppData ownership remain binding. Portable Node filesystem APIs cannot guarantee protection
against a malicious process running as the same OS user that swaps ancestor directories between
checks and operations. This explicit threat-model limit is not a promise of race-free isolation from
that same-user attacker; no stronger filesystem guarantee is claimed.

## Core configure/login candidate and persistence policy

For token-authenticated `profile configure`, first validate the profile name and candidate config.
Choose a new token candidate in this order: explicit `--token-stdin`, integration token environment
variable, then a masked prompt only in an ordinary fully interactive rendered invocation. Never use
a stored token as a configure/login candidate. Missing candidates and candidate/config validation
failures change neither the existing config nor its credential. Validate the new candidate against
the candidate config before any persistent change.

Prompting requires ordinary rendered execution without `--json` and TTY stdin, stdout and stderr.
JSON, JSON-RPC, programmatic/render-false execution and redirected input or output never prompt.
Explicit `--token-stdin` is unavailable inside JSON-RPC/programmatic execution because that transport
owns stdin; an explicit rendered CLI stdin flow remains available. Existing secret redaction and
profile-specific credential identity remain mandatory.

After successful configure authentication validation, remove that profile's previous credential,
then persist the candidate config, then persist the validated credential. If credential removal
fails, do not change config. A later persistence failure may leave an unauthenticated profile and
must provide actionable login/reconfigure guidance. Do not roll back in a way that pairs the old
credential with a new endpoint. This is a fail-closed ordering across config and keyring stores,
not a claim that those stores form an atomic transaction.

`auth login` validates a new candidate against the current config before replacing its credential;
it does not change the endpoint. Preserve no-auth integrations and TeamCity guest configuration:
they require neither token nor keyring access, while guest auth login remains rejected. Ordinary
`profile set` remains a non-auth lifecycle operation and is not covered by this configure transaction
policy. Reusing internal profile-name validation does not introduce a new public Core API.

## Required deterministic evidence

Test explicit article-parent null separately from empty/malformed/error responses; upload default
and explicit projections; both signed-URL forms including opaque encoded signature characters,
metadata-ID binding, origin/context/redirect/header checks, existing link/junction rejection,
exclusive publication and unsupported-link failure/cleanup. Keep real signatures and private service data
out of normal outputs, failures, logs and fixtures; tests use clearly synthetic values.

Auth tests must prove candidate precedence, no stored fallback, every noninteractive prompt guard,
config/candidate validation before persistence, credential-removal failure preserving config, later
persistence failure leaving no old-token/new-endpoint combination, profile isolation and unchanged
no-auth/TeamCity guest behavior. Existing CLI/RPC/output and full-suite gates remain required. These
are implementation contracts; the amendment alone accepts no operation or auth lifecycle path.

# Frozen inventory boundary

Snapshot date: **2026-08-30**. The official current YouTrack public `/api` resource index is the
census authority, not a live customer's server. The index contains **169 reference pages**;
**144 method-bearing pages expose 281 unique documented operations**: **136 GET, 101 POST,
44 DELETE**. The other **25 pages** describe/delegate resources without additional operations.
The resource-index page reports updated 2026-08-12. Retrieval date, per-page SHA-256 snapshots,
and exact request-table findings are retained in the local discovery evidence.

Operation identity is the uppercase method plus one space plus the literal documented Resource-table
`/api` path. Preserve case and placeholder spelling, including repeated placeholders. Source
ambiguities are recorded separately rather than silently rewriting or merging identities. Priority totals: **P0 9, P1 109, P2 140, P3 23**; v1 contains **118 endpoint operations plus one
separate derived issue-attachment download capability**, v2 contains **163 endpoint operations**
plus the separately identified supplementary candidates. The complete row-level inventory is
attached in the numbered inventory
comments on this Issue. Every row contains method/path, permission, priority/release, official
source, and a CLI mapping for v1. Priorities are human product decisions, separate from source facts.

- Include all documented current YouTrack `/api` business operations, including administrative
  and destructive APIs and current identity/project-team endpoints introduced in YouTrack 2026.1.
- Current reference coverage is not a promise that older Cloud/Server versions expose every
  endpoint. V1 targets the current documented surface; unsupported endpoints fail actionably.
  Do not silently fall back to Hub or legacy routes.
- The separate Hub REST API is not part of this YouTrack census. Remaining Hub-only capabilities
  require their own inventory/integration decision. Deprecated `/rest` is excluded.
- `/api/issueTags` is a deprecated resource-only landing page with no methods in this snapshot.
  Record its existence but do not invent GET/POST support; the documented `/api/tags` operations
  are inventoried normally.
- Instance-defined app/extension endpoints, internal/undocumented routes, UI routes, and workflow
  or import JavaScript APIs are excluded. Dynamic handlers cannot form a finite public REST census
  or inherit permission semantics solely from the HTTP method.
- Metadata discovery and returned-URL attachment transfer are recorded separately below; they do
  not inflate the 281-operation business census.


Inventory navigation (the five comments together contain all 281 operations):

1. [V1 inventory, part 1 — 60 operations](https://github.com/iXab3r/EyeAuras.CliFactory/issues/6#issuecomment-5467744074)
2. [V1 inventory, part 2 — 58 operations](https://github.com/iXab3r/EyeAuras.CliFactory/issues/6#issuecomment-5467744138)
3. [V2 inventory, part 3 — 60 operations](https://github.com/iXab3r/EyeAuras.CliFactory/issues/6#issuecomment-5467744211)
4. [V2 inventory, part 4 — 60 operations](https://github.com/iXab3r/EyeAuras.CliFactory/issues/6#issuecomment-5467744292)
5. [V2 inventory, part 5 — 43 operations](https://github.com/iXab3r/EyeAuras.CliFactory/issues/6#issuecomment-5467744398)
# Release and safety policy

| Priority | Release | Usefulness rule |
|---|---|---|
| P0 | v1 | Essential daily issue discovery, reading, creation/triage, command execution, and identity proof |
| P1 | v1 | Common collaboration/planning/context operations supporting real issue workflows |
| P2 | v2 | Less frequent dedicated conveniences, deeper administration, destructive maintenance, or uncertain contracts |
| P3 | v2 | Rare system/backup/license/telemetry and other operational administration |

A low-priority dedicated endpoint does **not** imply that the same remote capability is forbidden
through a high-priority generic YouTrack command. `commands apply` accepts the official command
language and may delete, move, clone, vote, watch, or perform other mutations permitted by the
server. It is always `Update`; documenting that power is part of its acceptance contract.

Enable exactly the factory standard categories: **ReadOnly enabled by default, Update disabled
by default**, isolated per profile. Classify by effect, not verb. The three documented POST reads
`/api/commands/assist`, `/api/search/assist`, and `/api/issuesGetter/count` are ReadOnly; every other
POST and every DELETE in this census is Update. Expected category totals: **139 ReadOnly and
142 Update**. Built-in profile/auth/permission recovery commands retain factory behavior.

Command assistance supplies parsed suggestions/errors; it is not a transactional dry run or a
guarantee that a later command will succeed or have no additional effects. There is no implicit
permission grant, hidden write retry, or automatic mutation during reads/auth validation.

# Public CLI and integration contract

- Package: `@eyeauras/youtrack-cli`; executable and stable `applicationId`: `youtrack-cli`.
  Location: `integrations/youtrack`; dependency: the existing workspace
  `@eyeauras/cli-factory` version `0.1.0`. Add the workspace to explicit root build orchestration.
  Do not copy core source or create a submodule/plugin/generator for this consumer.
- Inventory command strings below are relative to `youtrack-cli`. Every service leaf must be
  declared once and carry its row's explicit permission category. Help, human output, `--json`,
  and `--json-rpc` execute the same recursive declaration and handler.
- Resource IDs are opaque arguments. Accept documented readable issue IDs where supported; do
  not assume readable IDs work for every resource. Encode each path segment and query value
  correctly. Map repeated documentation placeholders to distinct user arguments (for example
  parent and child article IDs) rather than reusing one argument accidentally.
- Structured write leaves in the inventory use `--body <json>` with an inline JSON object for
  their documented request body; scalar routing IDs remain positional. Validate object shape,
  required fields, and mutually exclusive modes before fetch, but preserve service-shaped
  polymorphic `$type`/custom-field values. Commands with a documented richer positional or
  multipart signature use that signature instead. No arbitrary method/path escape hatch in v1.
- Do not represent relationship removal as object deletion. For example child-article removal
  detaches a parent/child relationship, while article deletion is a different operation.

- `commands apply --query <query> --issues <ids>` takes an explicit comma-separated list of
  1–20 issue IDs. Never expand a search into mutation targets. V1 does not expose `runAs`, silent
  notification suppression, or arbitrary command payload passthrough; those field-level capabilities
  are deferred independently of the P0 endpoint. Custom workflow/visibility/deletion effects remain
  possible through the documented command language and require Update. Assistance never executes.
- Cursor activity leaves require `--categories <categories>` and accept `--cursor <cursor>` for
  continuation, with the endpoint's documented before/after cursor metadata. The initial call
  omits a cursor intentionally; no inferred cursor or background polling. Cursor endpoints expose
  only documented cursor/reverse filters, not `--top`, `--skip`, or `--page-size`.
- The complete API inventory means endpoint operations, not an obligation to expose every optional
  entity field, query parameter, command-language convenience, or old server version in v1.
## Profiles and authentication

- Required non-secret profile field `url`, configured with `profile configure [name] --url <url>`:
  a server origin plus any YouTrack context path, without credentials/query/fragment or appended
  `/api`. Normalize joining without discarding the context path. Require HTTPS except explicit
  localhost development URLs; do not compile a private server or product-specific default URL.
- Authenticate with a permanent bearer token through factory `tokenAuth`, environment candidate
  `YOUTRACK_TOKEN`, `--token-stdin`, or the factory masked terminal prompt. Never offer a token
  command-line argument, plaintext fallback, token export, or config field for secrets.
- Validate a candidate with bounded `GET /api/users/me?fields=id,login` before saving it to
  the OS credential store. No guest-mode switch, OAuth/device flow, Hub token-management API,
  or automatic credential migration is included in v1.
- URL/configuration, credentials, enabled categories, and profile-owned files remain isolated
  across profiles, including interleaved JSON-RPC requests. Profile-owned state derives from
  `context.appArguments.AppDataDirectory`; no working-directory/executable storage or public
  AppData override. Existing profile/auth lifecycle commands are inherited unchanged.
- Root/service onboarding may prompt only in the factory's ordinary interactive flow. `--json`,
  JSON-RPC, redirected streams, and programmatic calls fail before the service handler with an
  actionable configuration command. Never prompt in an agent pipeline.
- Never forward Authorization to another origin or expose bearer values through redirects,
  diagnostic text, fixtures, or errors. Follow no cross-origin authenticated redirects.

## Pagination, projections, and results

- Collection leaves expose bounded `--top <n>` and `--skip <n>` only where the endpoint documents
  `$top`/`$skip`. Defaults: top 50 and skip 0; accepted top 1–100, skip a nonnegative integer.
  A normal invocation makes one collection request. No automatic full scan or `--all` in v1.
- Cursor activity endpoints expose documented `--cursor <cursor>` and required nonempty categories rather
  than translating them to offset pagination. Fetch one server-defined cursor page per invocation;
  no invented page-size flag or promised row cap. Preserve cursor and continuation metadata in
  returned domain objects; do not guess total counts or promise snapshot consistency.
- Expose documented `--fields <projection>` for read/projection-capable operations. Define useful
  finite default projections per leaf in implementation, preserve service/domain field names,
  and avoid implicit follow-up requests for nested resources. An explicit projection must not
  cause logging or credential disclosure.
- Query text uses the exact YouTrack search language, passed as one quoted argument; use proper
  URL/body encoding. `issuesGetter/count` may return `count: -1` while computation is pending:
  retain the pending state and make no implicit polling loop. Counts are not collection paging.
- Empty collections are successful empty results. Each non-streaming `--json` invocation emits
  one JSON value with no ANSI/progress chatter; handlers return values instead of rendering.
  Text/JSON/RPC outputs must describe the same operation result.
- Preserve the existing factory error contract: ordinary CLI failures (including `--json`) produce
  an actionable stderr message and exit 1; JSON-RPC execution failures use the current structured
  `-32000` error path. Do not promise or introduce a parallel CLI JSON error envelope.
- Distinguish invalid local input, incomplete profile/auth, permission denial, transport failure,
  remote 400/401/403/404/409/429/5xx, malformed JSON, and unsupported server capability without
  leaking response bodies or secrets. Return rate-limit information safely where available;
  do not automatically retry writes, and do not infer universal idempotency.

## Default projections and required body families

Default projections are finite and selected from the linked entity documentation. Issue reads
include identity/readable ID, summary, project identity, and relevant current fields; issue detail
also includes description and timestamps. Comment reads include ID, text, author identity, and
timestamps. Projects/users/groups/tags/saved queries/link types expose ID plus their documented
name/login/summary fields. Field/bundle reads expose ID, name, type discriminator and only the
values needed to select a valid issue value. Agile/sprint reads expose ID/name, relevant date/state,
and project/board identity. Article reads expose ID/summary and, for detail, content and parent
identity. Attachment metadata exposes ID/name/size/MIME information, with secret URL scrubbing.
Work-item reads expose ID/date/duration/type/author and issue identity. Exact polymorphic `$type`
and optional fields stay source-shaped and are pinned by MSW examples during each slice; no
unbounded embedded collections or automatic expansions are implied.

Collection results are arrays where the API returns arrays; detail results are domain objects;
cursor results retain their page envelope. Empty-body successful mutations return JSON `null`.
Issue creation requires project ID and summary; issue/comment/article/sprint/work-item updates
require an object containing at least one documented writable field. Comment creation requires
text; article creation requires summary and its documented project reference; sprint creation
requires name; work-item creation requires `duration.minutes` or `duration.presentation`, while
date/author remain optional explicit documented fields. Typed
custom-field updates require the documented field type/value (or state-machine event). Link/tag
add bodies identify their target resource. Invalid or empty required payloads fail before fetch.
The per-resource official method section remains authoritative for optional fields and the exact
polymorphic schema. `--body` is never accepted by `commands apply` in v1.

No generic issue-style query option is promised for article lists when their reference does not
document it. Permission-catalog reads describe available permissions, not a computed effective
access check for an arbitrary user.

## Mutation, body, and file behavior

- Disabled Update must fail before the native fetch boundary for **every** Update leaf. Server
  authorization remains authoritative even after a local category grant.
- Each mutation validates documented required fields/types; missing required command parameters
  produce local errors, not a prompt. Omit unspecified optional fields instead of silently clearing
  values. Explicit null/removal behavior follows the documented endpoint.
- Multipart attachment upload, where in v1 inventory, uses an explicit input file path, streams or
  reads that user-selected file without saving copies to the checkout, and sends only the expected
  multipart fields. No directory recursion, implicit file discovery, or raw binary stdout.
- Raw issue-attachment download is a separate v1 derived capability below. Attachment metadata
  does not automatically fetch the returned URL. No background watchers/stream subscriptions,
  bulk orchestration, unconditional overwrite, or live destructive proof is included.

# Supplementary documented surfaces (outside the 281)

| Operation | Permission | Priority/release | Decision |
|---|---|---|---|
| `GET /api/openapi.json` | ReadOnly | P2 / v2 | Official instance-specific OpenAPI metadata. Potential `schema get`; not fetched from a live instance during this research and not a substitute for the frozen public census. |
| `GET <attachment URL returned by YouTrack>` after attachment metadata | ReadOnly | P1 / v1 | `issues attachments download <issueID> <attachmentID> [--name <basename>] [--max-bytes <n>]`; derived two-step capability, not an additional indexed API operation. Contract below. |
| App-defined `/api/.../extensionEndpoints/...` handlers | Future explicit per-handler review; conservatively Update until reviewed | Excluded | Runtime-defined global/issue/article/project/user scopes are not finite inventory rows or operational built-in leaves; never infer ReadOnly from HTTP method alone. |



The five excluded dynamic extension templates are:

```text
/api/extensionEndpoints/{app}/{handler}/{endpoint}
/api/issues/{issueID}/extensionEndpoints/{app}/{handler}/{endpoint}
/api/articles/{articleID}/extensionEndpoints/{app}/{handler}/{endpoint}
/api/admin/projects/{projectID}/extensionEndpoints/{app}/{handler}/{endpoint}
/api/users/{userID}/extensionEndpoints/{app}/{handler}/{endpoint}
```

Their handlers may define GET/POST/PUT/DELETE, but these are runtime scopes rather than five fixed
operations or a safe generic proxy contract. See [official endpoint scopes](https://www.jetbrains.com/help/youtrack/devportal/api-url-and-endpoints.html).
Separate identity protocol paths `<HubServiceURL>/api/rest/oauth2/auth` and
`<HubServiceURL>/api/rest/oauth2/token`, and the broader `<HubServiceURL>/api/rest/...` API, are
excluded boundaries, not ReadOnly service commands. See [OAuth authorization](https://www.jetbrains.com/help/youtrack/devportal/OAuth-authorization-in-youtrack.html).
The following three historical official-support examples are **P2/v2 verification candidates**,
not current-reference guarantees or additional rows in the 281: `GET /api/reports/{reportID}`
(ReadOnly), `GET /api/reports/{reportID}/status` (ReadOnly), and
`POST /api/reports/{reportID}/status` (Update, triggers recalculation). Before implementation,
verify supported versions/schema against the instance OpenAPI or current official reference; they
are excluded from implementation until that evidence exists.
Source: [JetBrains support reply, 2024-02-26](https://youtrack-support.jetbrains.com/hc/en-us/community/posts/17238863984402-Time-report-query).
Separate Hub REST and OAuth authorization/token protocol endpoints remain outside this integration;
v1 consumes a permanent token and never implements Hub credential administration.

## Derived issue-attachment download contract (P1/v1)

`issues attachments download <issueID> <attachmentID> [--name <basename>] [--max-bytes <n>]`
first fetches the exact issue attachment metadata, then GETs only its returned URL. This is not an
arbitrary URL fetcher. Resolve relative URLs against the profile's YouTrack URL; permit only HTTPS
(same localhost exception as profile configuration), matching origin, and the documented attachment
path/context. Reject cross-origin URLs and redirects before following them. The binary request has
**no Authorization header**; a returned signature is transient secret material. If a deployment
requires an external/CDN origin, fail actionably rather than silently weakening this v1 policy.

Store the file beneath `context.appArguments.AppDataDirectory/downloads`, never in the checkout,
CWD, or executable directory. `--name` accepts a single safe basename; default to a sanitized
attachment name prefixed by its ID. Reject traversal/rooted/reserved paths and an existing
filename. Default transfer limit is 25 MiB; `--max-bytes` must be 1–104857600. Enforce the limit
while reading as well as checking Content-Length; use a profile-owned temporary file and remove
partial data on failure. Return only sanitized attachment ID/name, local path, byte count, and
content type, never binary stdout or the fetched URL. No implicit overwrite or recursive download.

Treat signed attachment URLs as secrets even in metadata commands: omit credential-bearing URL
values from defaults and redact them as `[redacted]` if an explicit projection requests them.
Never expose the signature in human/JSON/RPC output, errors, logs, fixtures, redirect diagnostics,
or saved metadata; explicit nested selections such as `attachments(url)` cannot bypass redaction. MSW tests cover the two-request flow, same-origin relative URL resolution,
no Authorization on the binary request, foreign-origin/redirect rejection, size limits, traversal,
existing file, partial cleanup, redaction, and profile-owned destinations. This derived capability
is counted separately from the endpoint census and contributes one additional v1 CLI leaf.
# Known official-reference inconsistencies

- Article-create prose contains a copied required-ID/subarticle statement that conflicts with its
  draftId guidance and from-scratch example. V1 creation uses project + summary, not a required
  existing article ID. Creating a sprint with optional `previousSprint` moves unresolved issues;
  never infer this field or hide its effect behind ordinary sprint creation.
- Current-user prose lists `fullName`, while a sample uses the name field. Auth validation requests only
  the unambiguous `id,login`; user display fields follow the entity table and version evidence.
- Notification-profile tables show `/api/users/{userID}/profiles/notifications`, while request
  syntax adds `/{profileID}`. Preserve the documented table identities in the census; classify
  these operations v2 and verify against the target version's OpenAPI before implementation.
- Assigned-role examples and declared operation tables disagree about a POST collection/detail
  route. Preserve table facts and defer the uncertain implementation to v2; do not invent an
  additional endpoint from a sample. Source discrepancy remains visible in research evidence.
- Child-article paths reuse `{articleID}` for parent and child. The census preserves source spelling;
  the CLI has separate parent/child arguments and tests both encoded IDs and unlink semantics.

- Direct group membership samples POST to the collection, while tables/syntax declare the item
  path. Keep the item fact and P2/v2 verification gate; do not add a sample-only operation.
- User attribute prose and POST examples disagree on email writability; user writes remain P2/v2
  with target-version verification. Newer team-member metadata may require 2026.2 even though the
  team endpoints appeared in 2026.1. Avoid promising unverified field support.
- Issue custom-field samples sometimes use `/fields/{fieldID}`, while resource tables/syntax use
  `/customFields/{fieldID}`. Use the declared route without a legacy alias; test state-machine event
  values and `$type` variants rather than assuming all state fields are simple enums.
- Issue-link removal repeats `{issueID}` in the source template. Map the final segment to
  `<targetIssueID>`; removing the relation deletes neither issue.
# Deterministic acceptance and completion contract

Preparation acceptance (this task):

- [x] The Issue contains every one of the 281 normalized operation identities exactly once in its
  numbered inventory comments, with official source, ReadOnly/Update, priority, and release.
- [x] All P0/P1 rows have exact CLI mappings; P2/P3 are explicitly deferred to v2. Supplemental and
  excluded surfaces are named separately; source contradictions and page coverage are recorded.
- [x] Generated facts and human decisions are separate locally; remote Issue/comments are read
  back and reconciled against the census after publication; all payloads pass privacy review.
- [x] This Issue is linked from the workstream plan/ledger; research completion is not mislabeled
  as shipped integration functionality.

V1 implementation acceptance (future work; **all remain open at research completion**):

- [ ] All P0/P1 mapped leaves are implemented using the shared CliFactory, without parallel legacy
  paths or service-specific logic in core. Recursive help accurately advertises their arguments.
- [ ] MSW at native fetch covers each operation's method/path, encoded IDs/query/body, minimal
  response parsing, errors, and empty results; fixtures contain synthetic data only.
- [ ] Every Update leaf has an explicit denial-before-fetch assertion and successful/remote-reject
  cases. ReadOnly POST exceptions work with Update disabled; profile permission isolation holds.
- [ ] Auth tests prove validation before secure persistence, unavailable-keyring failure without
  fallback, no prompting in automation, secret redaction, URL/context-path handling, and isolation
  of URL/token/category/AppData between two profiles and interleaved RPC requests.
- [ ] Pagination/projection tests cover documented offset and cursor modes, parameter validation,
  empty/final pages, count `-1`, and no hidden follow-up requests or mutation retry.
- [ ] Real CLI/process evidence covers packaging, human output, one JSON value, stderr/exit status,
  and persistent JSON-RPC. Tests inject supported AppArguments dependencies rather than adding
  a public environment override.
- [ ] A separate optional local proof invokes only a fixed bounded ReadOnly command inventory
  through the packaged CLI, named normal profile, and OS keyring; rejects CI before networking,
  accepts no endpoint/token override or arbitrary argv, and prints counts/pass/skip only. It is
  excluded from `npm test`; no real instance is needed for deterministic regression tests.
- [ ] Focused YouTrack tests and `npm test` pass; core changes, if any, also prove an affected TeamCity
  scenario. Current public docs describe shipped behavior and reconfiguration requirements.
- [x] P2/P3 and supplementary v2 work are owned by [YouTrack v2, Issue #7](https://github.com/iXab3r/EyeAuras.CliFactory/issues/7),
  whose published body contains all 163 deferred rows and supplemental verification boundaries.
  Exact remote readback was verified; no inventory row was silently dropped.
- [ ] Formal closure still requires complete v1 acceptance, workstream close-out, linked commit/PR
  and CI evidence, and any required pre-commit privacy review. V2 transfer alone does not close v1.

# Workstream, dependencies, and references

Workstream: `.workspace/workstreams/youtrack-rest/implementation-plan.md` and
`implementation-ledger.md`, with the census boundary in `scope.toml`, in the local
`EyeAuras.CliFactory-1` worktree on `feature/youtrack-v1`. These files are currently uncommitted;
this Issue deliberately does not claim a remote branch/blob link exists yet. The local workstream now backlinks this Issue. Partial implementation PRs reference it without closing it.

Dependencies: existing core token/profile/permission/AppArguments/JSON/RPC contracts; the current
public YouTrack REST API; independently reviewed source uncertainties before their deferred
implementation. No extra service, commercial SDK, plugin, or public package publication is required.

Official references:

- [REST API resource index](https://www.jetbrains.com/help/youtrack/devportal/api-resources.html)
- [REST API URL and endpoints](https://www.jetbrains.com/help/youtrack/devportal/api-url-and-endpoints.html)
- [Permanent-token authentication](https://www.jetbrains.com/help/youtrack/devportal/authentication-with-permanent-token.html)
- [Fields/projection syntax](https://www.jetbrains.com/help/youtrack/devportal/api-fields-syntax.html)
- [Pagination](https://www.jetbrains.com/help/youtrack/devportal/api-concept-pagination.html)
- [OpenAPI specification](https://www.jetbrains.com/help/youtrack/devportal/youtrack-openapi-specification.html)
- [Attachment download](https://www.jetbrains.com/help/youtrack/devportal/api-usecase-download-issue-attachment.html)
- [App HTTP handlers](https://www.jetbrains.com/help/youtrack/devportal/apps-reference-http-handlers.html)

Every inventory row also links its concrete official resource reference.







