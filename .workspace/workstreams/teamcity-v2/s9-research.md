# S9 administration and deployment API research

Research date: 2026-08-30. Proposed exact-50 batch for [Issue #5](https://github.com/iXab3r/EyeAuras.CliFactory/issues/5).
This file records contracts and remaining evidence gaps, not accepted production coverage.
No private profiles, credentials, server records, live mutations, Git, or GitHub state were touched.

## Scope and source hierarchy

The frozen 449-route inventory minus baseline 17, S1+S2 50, S3-S7 250, and S8 50 leaves
82 routes. This slice selects **50: 29 GET / ReadOnly and 21 Update**. S10 owns the other 32.
Identity is the literal frozen method/path; do not count aliases or generic transport coverage.

Primary evidence:

- [Current official anonymous OpenAPI](https://teamcity.jetbrains.com/guestAuth/app/rest/swagger.json),
  retrieved with Accept: application/json; info.version = 2026.1 (current). This public JetBrains
  endpoint supplied API metadata only, not account/service records.
- Official source pinned at [fc730e618ccd4b57dbbaf03425bb79a9580d19d2](https://github.com/JetBrains/teamcity-rest/tree/fc730e618ccd4b57dbbaf03425bb79a9580d19d2).
  It is older than the 2026.1 schema; use it for precise behavior where unchanged, never as evidence
  that a new 2026.1 route does not exist.
- Source links beside each behavior section identify the exact handler/model/service. Models in the
  current schema are the final authority for wire names, primitive types, and newly added fields.

The table lists every native query parameter. A missing fields query really means it is absent;
do not append fields to all mutations. JSON is the selected representation where supported, with
Content-Type and Accept independently correct. Request DTOs must be constructed, never spread from
GET responses. Every successful value is locally projected even when server fields were requested.
All Update leaves deny before networking, reading sensitive input, or opening files; require the
existing explicit confirmation convention for replacement, destructive, or high-impact actions.
No mutation is part of the live ReadOnly proof inventory.

## Exact census

| # | Method | Frozen path | Native query | Request / response | Gate and implementation note |
|---|---|---|---|---|---|
| 1 | GET | `/app/rest` | none |  none → text/plain string | ReadOnly; Text landing information; parse only relative REST path/help metadata, never claim an endpoint JSON collection. |
| 2 | POST | `/app/rest/agentPools/{agentPoolLocator}/authorizationTokens` | none | JSON authorizationTokensRequirements → JSON items | Update; Secret-producing mint; persist every returned item in profile keyring before reporting success (A). |
| 3 | GET | `/app/rest/audit` | locator, fields |  none → JSON auditEvents | ReadOnly; Bounded audit list; IDs/timestamps/action only (B). |
| 4 | GET | `/app/rest/audit/{auditEventLocator}` | fields |  none → JSON auditEvent | ReadOnly; Audit detail; omit comment/related-entity payloads (B). |
| 5 | PUT | `/app/rest/avatars/{userLocator}` | none | multipart file → native bytes/void (see note) | Update; Multipart part avatar; replace image (C). |
| 6 | DELETE | `/app/rest/avatars/{userLocator}` | none |  none → native bytes/void (see note) | Update; Delete avatar; actual no-content success (C). |
| 7 | GET | `/app/rest/buildTypes/{btLocator}/investigations` | fields |  none → JSON investigations | ReadOnly; Scoped investigations; reuse S6 safe projection. |
| 8 | GET | `/app/rest/buildTypes/{btLocator}/vcsRootInstances` | fields |  none → JSON vcs-root-instances | ReadOnly; Scoped VCS instances; reuse S8 safe projection. |
| 9 | GET | `/app/rest/deploymentDashboards` | locator, fields |  none → JSON deploymentDashboards | ReadOnly; Dashboard list; bounded locator (D). |
| 10 | POST | `/app/rest/deploymentDashboards` | none | JSON deploymentDashboard → JSON deploymentDashboard | Update; Create dashboard {id,name,project:{id}}; no fields query (D). |
| 11 | GET | `/app/rest/deploymentDashboards/{deploymentDashboardLocator}` | fields |  none → JSON deploymentDashboard | ReadOnly; Dashboard get (D). |
| 12 | DELETE | `/app/rest/deploymentDashboards/{deploymentDashboardLocator}` | none |  none → native bytes/void (see note) | Update; Delete dashboard (D). |
| 13 | GET | `/app/rest/deploymentDashboards/{deploymentDashboardLocator}/instances` | locator, fields |  none → JSON deploymentInstances | ReadOnly; Bounded instance list (D). |
| 14 | POST | `/app/rest/deploymentDashboards/{deploymentDashboardLocator}/instances` | none | JSON deploymentInstance → JSON deploymentInstance | Update; Upsert instance including history, not strict create (D). |
| 15 | GET | `/app/rest/deploymentDashboards/{deploymentDashboardLocator}/instances/{deploymentInstanceLocator}` | fields |  none → JSON deploymentInstance | ReadOnly; Instance get (D). |
| 16 | POST | `/app/rest/deploymentDashboards/{deploymentDashboardLocator}/instances/{deploymentInstanceLocator}` | none | JSON deploymentStateEntry → JSON deploymentInstance | Update; Append state entry {state,deploymentDate,build?}; not full replacement (D). |
| 17 | DELETE | `/app/rest/deploymentDashboards/{deploymentDashboardLocator}/instances/{deploymentInstanceLocator}` | none |  none → native bytes/void (see note) | Update; Remove instance from this dashboard (D). |
| 18 | GET | `/app/rest/health` | locator, fields |  none → JSON healthStatusItems | ReadOnly; Require explicit health scope; empty locator otherwise yields no items (E). |
| 19 | GET | `/app/rest/health/category` | locator, fields |  none → JSON healthCategories | ReadOnly; Health categories; count/start not proven by old category finder (E). |
| 20 | GET | `/app/rest/health/category/{locator}` | fields |  none → native healthCategory | ReadOnly; Category by id:<categoryId> (E). |
| 21 | GET | `/app/rest/health/{locator}` | fields |  none → JSON healthItem | ReadOnly; Unique health item selector, NOT identity:<id> (E). |
| 22 | GET | `/app/rest/info` | fields |  none → application/xml plugin | ReadOnly; XML-only plugin metadata; bounded parse, no DTD/entities (F). |
| 23 | DELETE | `/app/rest/mutes/multiple` | fields | JSON mutes → JSON bytes/void (see note) | Update; Mutes body schema proven, exact mutation identity still requires current-handler evidence (G). |
| 24 | GET | `/app/rest/projects/{projectLocator}/defaultValueSets` | fields |  none → JSON typedValueSets | ReadOnly; Named default value-set metadata; exclude value/keyword/description payloads (H). |
| 25 | GET | `/app/rest/projects/{projectLocator}/deploymentDashboards` | fields |  none → JSON deploymentDashboards | ReadOnly; Project dashboard list, no paging query (D). |
| 26 | GET | `/app/rest/projects/{projectLocator}/deploymentDashboards/{dashboardLocator}` | fields |  none → JSON deploymentDashboard | ReadOnly; Project dashboard detail; CLI accepts only child ID (D). |
| 27 | GET | `/app/rest/roles` | fields |  none → JSON roles | ReadOnly; Role definitions, not user role assignments (I). |
| 28 | POST | `/app/rest/roles` | fields | JSON role → JSON role | Update; Required name; supplied id forbidden; optional permission/include IDs (I). |
| 29 | GET | `/app/rest/roles/id:{id}` | fields |  none → JSON role | ReadOnly; Role detail; literal id: segment (I). |
| 30 | DELETE | `/app/rest/roles/id:{id}` | none |  none → native bytes/void (see note) | Update; Delete role definition (I). |
| 31 | PUT | `/app/rest/roles/id:{roleId}/included/{includedId}` | fields |  none → JSON role | Update; No body; returns changed Role (I). |
| 32 | DELETE | `/app/rest/roles/id:{roleId}/included/{includedId}` | fields |  none → JSON role | Update; No body; returns changed Role, not void (I). |
| 33 | PUT | `/app/rest/roles/id:{roleId}/permissions/{permissionId}` | fields |  none → JSON role | Update; No body; returns changed Role (I). |
| 34 | DELETE | `/app/rest/roles/id:{roleId}/permissions/{permissionId}` | fields |  none → JSON role | Update; No body; returns changed Role, not void (I). |
| 35 | GET | `/app/rest/server/authSettings` | none |  none → JSON serverAuthSettings | ReadOnly; Local metadata projection; raw auth-module properties may be secret (J). |
| 36 | PUT | `/app/rest/server/authSettings` | none | JSON serverAuthSettings → JSON serverAuthSettings | Update; Full authentication-module replacement required; no implicit masked read/merge (J). |
| 37 | GET | `/app/rest/server/backup` | none |  none → text/plain string | ReadOnly; Current backup progress or Idle, not last-backup verdict (K). |
| 38 | POST | `/app/rest/server/backup` | fileName, addTimestamp:boolean, includeConfigs:boolean, includeDatabase:boolean, includeBuildLogs:boolean, includePersonalChanges:boolean, includeRunningBuilds:boolean, includeSupplimentaryData:boolean |  none → text/plain string | Update; Query-only trigger, fileName mandatory semantically; returns filename (K). |
| 39 | GET | `/app/rest/server/cleanup` | none |  none → JSON cleanup | ReadOnly; Cleanup schedule/config (K). |
| 40 | PUT | `/app/rest/server/cleanup` | none | JSON cleanup → JSON cleanup | Update; Nullable-field patch; exactly one schedule form (K). |
| 41 | GET | `/app/rest/server/globalSettings` | none |  none → JSON serverGlobalSettings | ReadOnly; Local safe numeric/boolean projection; exclude encryptionKey/URLs/paths (L). |
| 42 | PUT | `/app/rest/server/globalSettings` | none | JSON serverGlobalSettings → JSON serverGlobalSettings | Update; Typed numeric/boolean patch; omission preserves existing values (L). |
| 43 | GET | `/app/rest/server/licensingData` | fields |  none → JSON licensingData | ReadOnly; Licensing summary; fields projection without keys (M). |
| 44 | GET | `/app/rest/server/licensingData/licenseKeys` | fields |  none → JSON licenseKeys | ReadOnly; License metadata only (M). |
| 45 | POST | `/app/rest/server/licensingData/licenseKeys` | fields | text string → JSON licenseKeys | Update; Text/plain key(s) from profile-secret aliases, not argv (M). |
| 46 | GET | `/app/rest/server/licensingData/licenseKeys/{licenseKey}` | fields |  none → JSON licenseKey | ReadOnly; Actual secret in path; alias-only input and sensitive HTTP errors (M). |
| 47 | DELETE | `/app/rest/server/licensingData/licenseKeys/{licenseKey}` | none |  none → native bytes/void (see note) | Update; Actual secret in path; alias-only input and sensitive HTTP errors (M). |
| 48 | GET | `/app/rest/server/metrics` | fields |  none → JSON metrics | ReadOnly; Numeric metric series; omit arbitrary metricTags (N). |
| 49 | GET | `/app/rest/server/plugins` | fields, locator |  none → JSON plugins | ReadOnly; Plugin metadata; no loadPath/parameters (N). |
| 50 | GET | `/app/rest/server/{field}` | none |  none → text/plain string | ReadOnly; Safe enum only; server source also supports superUserToken (N). |

## A. Agent-pool one-time authorization tokens

Current schema contract: POST body
`{timeToLiveSeconds:number,count:number}`, both int32; response `{item?:string[]}`.
The schema marks neither field required and states no defaults or maximum. A useful conservative
CLI requires positive bounded integers explicitly (e.g. count <= 50 is a CLI safety bound, not a
claimed TeamCity maximum) and targets `id:<poolId>`. No fields query is advertised.

These are one-time agent registration credentials, not harmless raw IDs. Require explicit
profile-secret destination aliases (one alias per requested token, or a declared namespace with
deterministic non-colliding suffixes). Preflight alias validity/collision and secret-store
availability before POST. Require returned item count to match the request, validate non-empty
strings, persist all items, then return only aliases/count/TTL/pool identity. Never print token
bytes, response body, request URL with credentials, or caught sensitive causes. Minting can have
succeeded when local persistence fails; report that accurately, do not auto-retry POST, and do not
claim remote revocation. A secret-store test must cover second-write failure and cross-profile isolation.
The older AgentPoolRequest source lacks this new route; current schema proves shape, not undocumented
TTL limits or remote permission specifics.

## B. Audit and existing scoped collections

Audit list query uses an AuditLocator. Current dimensions: id, count, start, action,
affectedProject (ProjectLocator), buildType (BuildTypeLocator), user (UserLocator), and
systemAction true/false/any. Use explicit typed options and a bounded count/start page;
encode nested ID locators instead of accepting arbitrary strings.

AuditEvent projection: `id,timestamp,action(id,name)`; collection
`count,nextHref,auditEvent(id,timestamp,action(id,name))`. Omit comment, action.pattern,
relatedEntities, user email/name, and arbitrary related values. Follow only validated same-service
continuation if a future explicit page command needs it; no auto-draining.

Scoped build-type investigations return Investigations and use the already proven S6 safe
scope/target/state model. Scoped vcsRootInstances return VcsRootInstances with the native hyphenated
`vcs-root-instance` collection and S8 safe IDs/status metadata. Neither route has a locator query;
do not invent server pagination or add these unpaged reads to fixed local proof by default.

## C. Avatar replace/remove

[AvatarRequest source](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/request/AvatarRequest.java)
requires multipart/form-data with part named `avatar`. PUT accepts file bytes and returns void;
DELETE returns 204. Send a FormData-created boundary, not a manually hardcoded Content-Type.
Server requires permission to edit the target user and rejects request size >= its configured limit
(default 10,485,760 bytes, including multipart overhead). CLI can use a stricter byte bound and require
a regular user-selected PNG/JPEG file; no implicit traversal of directories or file-to-stdout dump.

The input path is explicit user input, not profile configuration. Default/private app-owned copies
must derive from AppDataDirectory. Avatar downloads belong to S10. Offline tests need multipart field,
bytes, target ID, bound failure before HTTP, denied Update, void response, and no raw binary output.

## D. Deployment dashboards and instances

[DeploymentDashboardRequest](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/request/DeploymentDashboardRequest.java),
[StateEntries](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/model/deployment/StateEntries.java),
[StateEntry](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/model/deployment/StateEntry.java),
[ProjectRequest](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/request/ProjectRequest.java).

Dashboard create minimal body:
`{id:string,name:string,project:{id:string}}`. Source consumes these three values directly.
Create returns Dashboard using long fields and has no fields query. Safe local result:
`{id,name,project:{id}}`. Collection key is deploymentDashboard, with count/nextHref.

Dashboard locator: id, name, project, affectedProject, count, start.
Instance locator: id, dashboard, currentState, count, start. Locator state values are
lowercase in_progress/successful/failed/cancelled/unknown; body/output states are uppercase
IN_PROGRESS/SUCCESSFUL/FAILED/CANCELLED/UNKNOWN. Do not reuse a single case-sensitive enum
without the explicit wire conversion.

Instance collection POST is **upsert** in the source (`addOrUpdateInstance`). Full typed body:
`{id,attributes:{},deploymentStateEntries:{deploymentStateEntry:[{state,deploymentDate,build?:{id}}]}}`.
The history wrapper is dereferenced; do not omit it. An empty history is structurally accepted by
the model, but prefer a required initial state/date for a useful create/upsert UX. Attributes are a
string map: expose only explicitly typed safe keys if a real consumer needs them, not arbitrary
secret-bearing JSON passthrough. They can be omitted from output regardless of input support.

Instance detail POST **appends a state entry**, body
`{state,deploymentDate,build?:{id}}`; timestamp uses TeamCity form YYYYMMDDTHHmmss+ZZZZ.
Do not send the schema's accidental implementation property entryFromPosted. POST returns Instance
and has no fields query. Safe result `id,currentState,deploymentDashboard(id)`.
Old StateEntry serializer gates deploymentDate under a suspicious name field; do not rely on a
selective history-date projection without newer evidence.

The instance list handler injects parent dashboard scope. Project dashboard detail source uses
setDimensionIfNotPresent(project), so a raw child locator with its own project could override the
expected parent. Prevent that by accepting child IDs only and constructing its id locator internally.
Detail/delete must remain scoped by the explicit parent. Do not cascade-delete extra objects.

## E. Health

[HealthItemFinder](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/data/finder/impl/HealthItemFinder.java)
and [HealthRequest](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/request/HealthRequest.java).

Current HealthItemLocator dimensions are buildType, count, global, healthCategory, minSeverity,
project, reportType, start, vcsRoot. Explicit global:true or a project/buildType/VCS-root scope
is necessary: the default empty scope yields no health items. minSeverity accepts info/warn/error;
response severity is INFO/WARN/ERROR.

**Health item identity is not an advertised locator dimension.** A detail command can accept typed
scope + category + optional report type yielding one item; the server rejects a non-unique match.
Do not invent id:<healthItem.identity>. It can also expose an exact typed query returned by the list
only if those actual locator dimensions identify it; never fabricate an identity route.

Safe item: `identity,severity,healthCategory(id,name)`. List key healthItem, count, nextHref.
Safe category: id,name; omit description/helpUrl by default. Category finder supports id:<id>
and bare id, case-insensitively. The generic category list route has locator, but old CategoryFinder
does not install count/start dimensions; current schema claims pagination only at collection level.
Use an unpaged category list with a response byte/item bound, not invented server count support.
Single category produces is absent from current Swagger; model + Jersey source permits selecting
application/json, but test actual representation and fail explicitly on incompatible media.

## F. REST landing and XML plugin info

[RootApiRequest](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/request/RootApiRequest.java).
Root is a text landing message containing relative server endpoint and documentation link, not
a machine endpoint inventory. A typed landing result may expose validated relative endpoint and
official help link; do not blindly emit a text blob if it can contain sensitive/custom URLs.
A boolean ACK alone is not useful endpoint discovery.

GET /info is **application/xml only**. Request fields
`name,displayName,version,loaded,disabled`, use a bounded XML parser with external entities/DTD
disabled/rejected, require plugin root, and project those attributes. Do not use the JSON transport
and discard parse failure. JSON/JSON-RPC output is still a normal projected domain object because
wire media and CLI output format are independent. Exclude loadPath and parameters.

## G. Bulk unmute: remaining evidence boundary

The current 2026.1 schema proves DELETE /mutes/multiple has JSON/XML body Mutes, optional fields,
and void success. Mutes contains mute[], and Mute exposes id:int32, assignment, scope, target,
resolution. An ID-only body is **not proven**. A structurally valid full candidate is
`{mute:[{id,scope,target,resolution}]}`, with the same scoped target unions and resolution DTO as
S6; assignment is not required by schema. However, none of these fields is marked required, and
the schema alone does not show whether the handler removes by ID, scope/target, or another rule.

Older public MuteRequest lacks bulk DELETE; its single DELETE resolves an ID then builds mute data.
Public generated SDK signatures prove only the same envelope, not consumed identity. Do not mark
coverage accepted based on a synthetic 204 MSW alone. Current distribution static bytecode research
is the next bounded evidence step; no real-server mutation was performed.
If implementation eventually consumes full models, compare each chosen ID/scope/target before
dispatch and do not over-broaden a scope, but that is an additional fail-safe, not proof of contract.

## H. Project default value sets

[TypedValueSet](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/model/project/TypedValueSet.java).
GET response `{count,valueSet:[...]}`; current OpenAPI refers to capitalized TypedValueSet.
Safe projection `count,valueSet(name,displayName)` identifies available parameter value-set types.
The full model additionally has description, shortDescription, keyword:string[], and
value:[{value,label}]. Those can contain environment-specific or arbitrary values; do not dump them.
No locator/pagination query exists. This metadata command is real useful type discovery, not an ACK.

## I. Role definitions and permissions

[RoleRequest](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/request/RoleRequest.java).
These routes define server roles; they are distinct from previously shipped user/group role assignment.

Minimal create body `{name}`. **id must not be supplied**, because the server generates it.
Optional typed subsets:
`permissions:{permission:[{id}]}`, `included:{role:[{id}]}`.
All permission IDs and included-role IDs are validated before creation. Reject duplicate role
references and self-inclusion locally where applicable; remote RolesManager remains authoritative
for cycle and protected-role constraints. Permission IDs are normalized by server enum lookup.

Safe Role projection `id,name,permissions(permission(id)),included(role(id))`.
List key role, count. No list locator exists. Included-role/permission PUT and DELETE have no body,
accept fields, and return the changed Role; they are not no-content deletes. Whole-role DELETE
returns void. Remote mutation permission is MANAGE_ROLES; reads require view-all-users capability.

## J. Server authentication: full module replacement

[ServerAuthRestService](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/service/rest/ServerAuthRestService.java).

GET/PUT accept no fields. AuthSettings fields: allowGuest, guestUsername, welcomeText,
collapseLoginForm, perProjectPermissions, emailVerification, modules; current schema also
buildAuthenticationMode (strict/lax). Read result must be locally projected to safe booleans/mode
and module names, never arbitrary module properties or welcome text.

PUT **requires modules.module to exist**, validates module names, clears all configured auth modules,
then adds precisely the submitted list. Missing scalar fields are preserved, but missing modules
is an error, not a scalar patch. Do not GET/merge masked secret properties and write them back.
Do not advertise a guest-only setter that silently resets authentication modules.

A minimal native full-replacement example is
`{modules:{module:[{name:"Default",properties:{property:[]}}]},allowGuest:false}`.
The module must actually exist on the target; the name Default is a documented example, not
a universal discovery guarantee. For extensible module configuration require a typed module name
plus explicitly supplied properties composed from non-secret options and profile-secret aliases.
No raw secret argv/files/config; do not infer required LDAP/OAuth keys from unknown modules.
At minimum expose an explicit reset-to-selected-built-in-module operation with a clear
replacement/lockout warning, rather than pretending full arbitrary authentication administration.

GET remote rights VIEW_SERVER_SETTINGS or MANAGE_AUTHENTICATION_SETTINGS; PUT requires
MANAGE_AUTHENTICATION_SETTINGS. Any auth replacement needs Update and explicit confirmation.
Current buildAuthenticationMode is schema-only here; do not claim old source proves its setter.

## K. Backup and cleanup

[ServerRequest](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/request/ServerRequest.java).

Backup POST has no body. Require explicit non-empty server-relative filename (a safe basename
is sufficient); no local path interpretation. Query names include the native misspelling
**includeSupplimentaryData**, plus addTimestamp/includeConfigs/includeDatabase/includeBuildLogs/
includePersonalChanges/includeRunningBuilds. Booleans omitted use server defaults; CLI should make
chosen values clear. Returned text is the resulting server backup filename, not completion.
GET returns current progress enum text or Idle; Idle alone does not prove a successful previous run.
Do not automatically download backups: they contain broad sensitive server data.

Cleanup DTO:
`{enabled?:boolean,maxCleanupDuration?:number,daily?:{hour:number,minute:number},cron?:{minute:string,hour:string,day:string,month:string,dayWeek:string}}`.
Duration is minutes. Daily hour 0..23/minute 0..59; cron is the five documented fields, server adds
seconds=0. Both daily and cron together are rejected. Source only changes non-null scalar/schedule
fields and persists, so `{enabled:false}` is a valid small patch.
This configures future cleanup; it is **not** an immediate cleanup trigger.
Read and mutation return the same DTO, no fields query. Use safe numeric/boolean/schedule projection.

## L. Server global settings

[ServerGlobalSettingsRestService](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/service/rest/ServerGlobalSettingsRestService.java).

GET/PUT have no fields query. Safe read fields: defaultQuietPeriod, defaultExecutionTimeout,
maxArtifactsNumber, maxArtifactSize, enforceDefaultVCSCheckInterval, defaultVCSCheckInterval,
useEncryption, artifactsDomainIsolation. Exclude rootUrl, artifactsUrl, artifactDirectories,
encryptionKey from default output and all diagnostics.

Typed numeric/boolean partial update is source-proven: only non-null supplied fields are changed.
Require at least one option and safe integers (int64 values must fit JS safe integer or use explicit
string representation in DTO parsing). maxArtifactsNumber/maxArtifactSize accept -1 as unlimited;
defaultExecutionTimeout <=0 disables the limit. Do not arbitrarily reject documented sentinel values.
No universal JSON PUT. Changing paths/URLs can be a later explicit typed option, not needed to make
this native route useful. Enabling custom encryption requires encryptionKey; disabling it selects
base strategy. Do not slip either into a general boolean switch; any future key input is alias-only
and deserves explicit security-impact confirmation.

## M. Licensing without key disclosure

[ServerRequest license handlers](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/request/ServerRequest.java).
POST is text/plain, not JSON. It accepts keys split by newline, CR, comma, or space; a single key
from a profile-secret alias is the smallest useful typed operation. Multiple aliases can construct
newline-separated body. Never accept actual license values in argv/profile JSON.

GET/DELETE /licenseKeys/{licenseKey} uses the **actual sensitive key as a path parameter**.
Resolve an explicit secret alias only after gating/preflight; interpolate only into the internal
HTTP request; omit sensitive path and response text from all errors/logging.
The source's invalid-key response explicitly includes submitted keys. Standard error text
sanitization based only on password field names is insufficient here.

LicenseKey safe fields: valid,active,expired,obsolete,expirationDate,maintenanceEndDate,type,
servers,agents,unlimitedAgents,buildTypes,unlimitedBuildTypes,pipelines,unlimitedPipelines.
Do not expose key,errorDetails,rawType. Collection key licenseKey with count.
LicensingData can expose safe capacity/status/serverLicenseType fields using explicit current DTO
members; nested licenseKeys must be metadata-projected or excluded. A list ordinal is not a stable
license identity; detail/delete use keyring alias, not invented server ID.

POST returns added keys as LicenseKeys; project only metadata after actual server success.
DELETE returns void; report only successful deletion of that alias-referenced key, never secret value.
GET uses VIEW_SERVER_SETTINGS; mutations CHANGE_SERVER_SETTINGS. Do not auto-delete the local alias
when removing a server license unless the user explicitly asks; the owner may need it elsewhere.

## N. Metrics, plugins, and safe scalar fields

Metric collection: `count,metric(name,prometheusName,metricValues(metricValue(name,value)))`.
MetricValues contains metricValue[] and count. MetricValue.value is numeric. Drop descriptions,
metricTags and nested tags; tags can contain arbitrary IDs, hostnames, paths, or URLs.
Series with same metric name can remain separate without tag output; make loss of tag dimensions
clear rather than merging/adding values incorrectly. No locator query/pagination exists.

Plugins: `count,plugin(name,displayName,version,loaded,disabled)`; no loadPath/parameters.
Current schema adds optional locator but does not publish a dedicated PluginLocator model here;
omit it until a typed filter has primary-source evidence. Bound response bytes/items locally.

[Server scalar implementation](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/model/server/Server.java)
also supports superUserToken, dataDirectoryPath, webUrl/url, artifactsUrl, and old aliases.
Implement only the clean safe enum version,versionMajor,versionMinor,buildNumber,startTime,currentTime,role
(and internalId only if a real operator needs it). Return `{field,value}` with scalar validation.
Do not support old aliases, raw arbitrary fields, or superUserToken. One useful explicit subset
supports the native route without pretending all credential-bearing variants are safe.

## Acceptance and unresolved items

For each row test exact method/path/query/body/media, data result, empty/optional shapes, permission
denial before HTTP, invalid input before HTTP, and hostile extra secret fields absent from JSON/RPC.
Use synthetic public fixtures only. For secrets additionally verify alias scoping, unavailable store,
existing-alias conflict, persistence failure after remote success, and zero secret bytes in errors.
For XML test malformed XML, DTD/entity rejection, wrong root/media and bounded response handling.
For avatar verify multipart and bytes; for no-content responses do not parse JSON.
Run affected MSW tests and repository npm test; research is not runtime verification.

Known gaps: bulk unmute consumed identity/success semantics need current-handler evidence; new
agent-token default/limit behavior is unspecified; health-category pagination and optional plugin
locator are deliberately not fabricated. No route should be marked accepted until its usable typed
behavior and evidence are both real.

### Static current-distribution follow-up

The public repository metadata reports its last push on 2024-03-04; enumerating its public branches
found no 2026.1 implementation branch. The official
[2026.1.3 release listing](https://www.jetbrains.com/help/teamcity/previous-releases-downloads.html)
identifies build 222742. HEAD for its official tar.gz reports 1,556,745,472 bytes.
A bounded stream scan into a unique OS-temp research directory failed to locate the old exact
rest-api.zip/rest-api-plugin.zip names; this does **not** prove that the REST code is absent.
The initial .NET TarReader also rejected a GNU numeric header. No plugin was retained or executed.

A broader repeated full-archive scan was rejected by tool auto-review because of the repeated
1.56 GB transfer and potential multi-candidate disk footprint. It was not retried or bypassed.
Materially smaller alternatives were checked: a strict 64 KiB HTTP Range read of the official
installer ZIP central directory finds only the installer EXE; candidate ZIP/WAR/update archives
return 404; official Maven metadata under REST plugin coordinates is missing or HTML rather than
Maven XML; bounded anonymous public REST project/build searches did not locate a current artifact.

Consequently neither current bulk-unmute handler identity nor the current versioned-settings
parameter DELETE postcondition has been established by bytecode. Further broad distribution
retrieval requires explicit approval for the resource footprint, or a directly supplied small
current REST artifact. Do not replace this evidence gap with a successful mocked response.
The old Mute.getFromPosted model explicitly requires scope, target, resolution and permits omitted
assignment; adding id yields a structurally valid full candidate, but still does not prove which
fields the new bulk DELETE handler consumes.

### Reconciled delivery contract for the two documented actions

The orchestrator can expose these as **typed documented native actions**, without claiming an
independently verified domain postcondition. That is distinct from a generic raw-request escape
hatch or a fabricated ACK: the exact endpoint, validated body/selector, Update gate, real HTTP
response, and failure semantics must all be exercised. A void native operation naturally has no
domain response body to project. It is reasonable to report `serverAcknowledged:true` only after
an actual successful HTTP response, paired with `postconditionVerified:false`; do not report a
count of successfully unmuted entities or that a setting was definitely cleared.

Track two separate facts in acceptance: documented operation implemented/offline contract-tested,
and current-server mutation behavior not live-verified. A mock proves the former, never the latter.
This does not authorize live Update experiments. Errors remain errors; a timeout or server error
after dispatch has unknown remote outcome and must not be automatically retried or rolled back.

#### Versioned-settings scalar reset

Primary references:
[current API operation](https://www.jetbrains.com/help/teamcity/rest/versionedsettingsapi.html#deleteVersionedSettingsConfigParameter),
[request handler](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/request/VersionedSettingsRequest.java),
[scalar model](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/model/versionedSettings/VersionedSettingsConfig.java),
[config service](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/service/impl/versionedSettings/VersionedSettingsConfigsServiceImpl.java).

Native DELETE /projects/{locator}/versionedSettings/config/parameters/{name} has no body, query,
or declared response schema. The old handler calls the scalar setter with null; that setter
updates configuration, re-reads the scalar, then tests `Objects.equals(value, updateParamValue)`.
This is **not a null dereference**: the problem is that getFieldValue always uses String.valueOf,
so even an absent value comes back as the literal string "null", unequal to Java null. If update
and re-read succeed, this old implementation therefore throws after the write for every supported
field. A current successful clear cannot be demonstrated from that implementation.

The old service additionally requires synchronizationMode and materializes defaults:
showSettingsChanges false; storeSecureValuesOutsideVcs true; portableDsl true; allowUIEditing true;
buildSettingsMode alwaysUseCurrent. Removal does not necessarily mean a property ceases to exist.
Deleting synchronizationMode is invalid before update. vcsRootId/format are operationally structural
and can cause validation/configuration changes; a safer first reset-attempt enum is a deliberately
documented subset of optional scalar settings, not arbitrary field names. Avoid resetting a flag
that could weaken secret storage or unexpectedly enable two-way VCS synchronization.

UI wording: "Attempt the documented native reset; server versions may reject after applying a
default. Inspect configuration before retrying." Success data can be
`{projectId,field,action:"reset",serverAcknowledged:true,postconditionVerified:false}` only on 2xx.
Preserve non-2xx and network errors with a safe unknown-outcome warning; never convert them to success.
No background GET is necessary to execute the documented action; an explicit read-back can show
observed configuration, but cannot prove deletion semantics for a defaulted field.

#### Bulk mute deletion with full typed models

Primary references:
[current unmute operation](https://www.jetbrains.com/help/teamcity/rest/muteapi.html#unmuteMultipleTests),
[Mutes model](https://www.jetbrains.com/help/teamcity/rest/mutes.html),
[Mute model](https://www.jetbrains.com/help/teamcity/rest/mute.html),
[posted Mute parser](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/model/problem/Mute.java),
[Resolution parser](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/model/problem/Resolution.java).

The current operation explicitly consumes Mutes in JSON/XML. A conservative full typed request is:

~~~ts
type MuteDeleteScope =
  | { project: { id: string } }
  | { buildTypes: { buildType: { id: string }[] } };
type MuteDeleteTarget =
  | { tests: { test: { id: string }[] } }
  | { problems: { problem: { id: string }[] } };
type MuteDeleteResolution =
  | { type: "manually" | "whenFixed" }
  | { type: "atTime"; time: string };
type BulkUnmuteBody = {
  mute: {
    id: number; // positive int32, matching selected remote mute
    scope: MuteDeleteScope;
    target: MuteDeleteTarget;
    resolution: MuteDeleteResolution;
  }[];
};
~~~

The posted Mute parser requires scope/target/resolution, delegates their validation, and accepts
omitted assignment. It does not inspect id and does not reject a supplied id; thus the full object
is demonstrably valid input **to that posted model** when scope/targets resolve. Resolution requires
one of manually/whenFixed/atTime; atTime requires a parsable time. Keep the original resolution from
the selected mute instead of inventing manually for a timed mute. Do not send response-only href,
assignment text/user metadata, counts, or paging links.

Require 1..N explicit selected IDs with a small fixed batch bound, no duplicates, exactly one scope
variant and one target variant, nonempty bounded ID arrays, valid timestamps, and no anyProblem
shortcut. Prefer a bounded ReadOnly preflight for each selected ID with
`id,scope(project(id),buildTypes(buildType(id))),target(tests(test(id)),problems(problem(id))),resolution(type,time)`.
Construct the body from those selected typed models (or compare supplied models exactly), fail
closed on unsupported scope/target, and never broaden selection to an entire locator-matched set.
The outer Update gate must run before these preflight requests too. This improves targeting but
does not make the remote operation atomic or race-free.

Send one actual DELETE /mutes/multiple with Content-Type/Accept application/json and the full body;
fields can be omitted because success is void. Current docs/schema do not specify whether the
handler consumes IDs, scope/target, or both, nor all-or-nothing behavior. On actual 2xx return only
selected/requested IDs and `serverAcknowledged:true,postconditionVerified:false`. A separate explicit
read-back can check whether those mute IDs remain, but does not prove no additional targets changed.
On any failure retain unknown-outcome semantics and do not retry automatically. Tests can prove
the request contract and propagation of both success/error outcomes without claiming a live deletion.
