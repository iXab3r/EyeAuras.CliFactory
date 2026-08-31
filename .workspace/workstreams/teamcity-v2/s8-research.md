# S8 infrastructure, cloud, and VCS API research

Research date: 2026-08-30. This is a proposed implementation batch for
[Issue #5](https://github.com/iXab3r/EyeAuras.CliFactory/issues/5), not acceptance of implemented
coverage. The orchestrator owns the Issue scope and the 50-operation authoring checkpoint.
Only this research file was written. No production/tests, GitHub state, user profiles, credentials,
or live Update operations were touched.

## Census and sources

Exactly 50 frozen remaining routes: CloudInstance 10, VcsRoot 11, VcsRootInstance 12,
VersionedSettings 16, and Root GET /version. The split is 24 GET / ReadOnly and 26 Update.
These exclude baseline, S1-S5, the 45 + 5 planned S6 routes, and S7's 50 routes.
VCS settingsFile and every files/latest route are intentionally left for the file/artifact batch.

Primary sources:

- Current official [JetBrains public server OpenAPI](https://teamcity.jetbrains.com/guestAuth/app/rest/swagger.json),
  retrieved anonymously with Accept: application/json; info.version was 2026.1 (current).
  This is a public JetBrains service, not a user's private configured endpoint. Only API metadata
  was extracted; no account/service records were retained.
- [CloudInstanceApi](https://www.jetbrains.com/help/teamcity/rest/cloudinstanceapi.html),
  [VcsRootApi](https://www.jetbrains.com/help/teamcity/rest/vcsrootapi.html),
  [VcsRootInstanceApi](https://www.jetbrains.com/help/teamcity/rest/vcsrootinstanceapi.html),
  [VersionedSettingsApi](https://www.jetbrains.com/help/teamcity/rest/versionedsettingsapi.html).
- Official source at
  [fc730e618ccd4b57dbbaf03425bb79a9580d19d2](https://github.com/JetBrains/teamcity-rest/tree/fc730e618ccd4b57dbbaf03425bb79a9580d19d2):
  [CloudRequest](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/request/CloudRequest.java),
  [VcsRootRequest](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/request/VcsRootRequest.java),
  [VcsRootInstanceRequest](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/request/VcsRootInstanceRequest.java),
  [VersionedSettingsRequest](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/request/VersionedSettingsRequest.java).

The pinned source is older than current TeamCity. Current OpenAPI corroborates route/media/model
contracts; source is used for validation and side-effect details, with version-sensitive caveats
explicitly marked. Do not treat an absent method in old source as proof the current route is absent.

## Transport, gates, and projections

All table paths are relative to /app/rest. JSON request bodies use Content-Type: application/json;
JSON response requests use Accept: application/json. Plain-text bodies/responses use text/plain.
VersionedSettings JSON operations do not explicitly enumerate media in OpenAPI annotations; their
typed model contract and official examples support JSON. Do not invent a form-encoded API.

Every GET leaf declares ReadOnly; every POST/PUT/DELETE leaf declares Update, including cloud
actions, VCS polling requests, and configuration synchronization. Server-required permissions are
independent: for example, a read-only configuration request can still require remote EDIT_PROJECT.

ACK means normalize successful empty/void transport to a small local acknowledgement. It is not
a fabricated JSON response supposedly supplied by TeamCity. Do not convert a failed HTTP request
to ACK, assume atomic rollback, or blindly retry mutations.

Suggested selectors:

~~~text
CP = id,name,cloudProviderId,project(id)
CI = id,name,profile(id),agentPoolId,operatingSystemName
CN = id,name,state,startDate,image(id),agent(id)
VR = id,name,vcsName,project(id)
VI = id,name,vcs-root-id,vcsName,modificationCheckInterval,commitHookMode
PROPS = count,property(name)
STATE = count,entry(name,value)
PROJECTS = count,project(id,name)
VC = synchronizationMode,vcsRootId,format,buildSettingsMode,allowUIEditing,
     showSettingsChanges,storeSecureValuesOutsideVcs,portableDsl,settingsPath,
     applyChangesInDependenciesAndVcsSettings,dslExecutionMode
VS = type,timestamp,dslOutdated,missingContextParameters
~~~

Selectors are request-side minimization, not the final safety boundary: always construct explicit
local DTOs too. Omit href/webUrl/networkAddress, cloud error objects/messages, VCS repository URLs,
properties values, configuration error text, stack traces, and source filenames by default.
Request only the field sets the command actually returns.

List operations support exactly one bounded page unless noted otherwise. A returned nextHref is
pagination metadata; never auto-follow it for a mutation. Reuse existing response-size limits.

## Cloud routes: 10

| # | Method | Path | Query, typed input, response | Proposed CLI leaf |
|---|---|---|---|---|
| 1 | GET | /cloud/images | locator with count/start and typed project/profile filter; fields=count,nextHref,cloudImage(CI); CloudImages | cloud images list |
| 2 | GET | /cloud/images/{imageLocator} | fields=CI; CloudImage | cloud images show |
| 3 | GET | /cloud/instances | locator with count/start and typed project/profile/image filter; fields=count,nextHref,cloudInstance(CN); CloudInstances | cloud instances list |
| 4 | POST | /cloud/instances | JSON {image:{id:compositeImageId}}; optional fields exists but unnecessary; VOID response / ACK | cloud instances start |
| 5 | GET | /cloud/instances/{instanceLocator} | fields=CN; CloudInstance | cloud instances show |
| 6 | DELETE | /cloud/instances/{instanceLocator} | No body/query; immediate forced termination; ACK | cloud instances delete |
| 7 | POST | /cloud/instances/{instanceLocator}/actions/forceStop | No body/query despite declared JSON/XML consumes; immediate forced termination; ACK | cloud instances force-stop |
| 8 | POST | /cloud/instances/{instanceLocator}/actions/stop | No body/query; schedule termination when free; ACK | cloud instances stop |
| 9 | GET | /cloud/profiles | locator with count/start and typed project filter; fields=count,nextHref,cloudProfile(CP); CloudProfiles | cloud profiles list |
| 10 | GET | /cloud/profiles/{profileLocator} | fields=CP; CloudProfile | cloud profiles show |

Cloud profiles are remote infrastructure definitions, not CliFactory connection profiles.
Keep them under cloud profiles, not the built-in profile command tree.

### Cloud identity is composite

Cloud profile IDs are strings. Cloud image/instance IDs are not bare provider instance IDs:

~~~ts
type CloudImageIdentity = { profileId: string; imageId: string };
type CloudInstanceIdentity = {
  profileId: string;
  imageId: string;
  instanceId: string;
};
~~~

The server's returned image ID is a nested locator-shaped string:
profileId:PROFILE,id:IMAGE. The returned instance ID is
profileId:PROFILE,imageId:IMAGE,id:INSTANCE. A path locator wraps this as one id value,
for example id:(profileId:PROFILE,id:IMAGE). Escape each literal; do not concatenate an arbitrary
user locator string. Either accept the opaque returned ID with a dedicated composite parser,
or expose explicit profile/image/instance ID inputs and build the locator locally.

POST /cloud/instances requires image. The posted image accepts exactly one of id or locator;
a minimal safe command uses id constructed from typed identity, not both, not an arbitrary raw
CloudInstance body, and not a guessed plain AMI/VM ID.

Typed safe output shapes:

~~~ts
type CloudProfileSummary = {
  id: string; name?: string; cloudProviderId?: string; project?: {id: string};
};
type CloudImageSummary = {
  id: string; name?: string; profile?: {id: string};
  agentPoolId?: number; operatingSystemName?: string;
};
type CloudInstanceSummary = {
  id: string; name?: string; state?: string; startDate?: string;
  image?: {id: string}; agent?: {id: number};
};
type CloudImages = {count?: number; nextHref?: string; cloudImage?: CloudImageSummary[]};
type CloudInstances = {count?: number; nextHref?: string; cloudInstance?: CloudInstanceSummary[]};
type CloudProfiles = {count?: number; nextHref?: string; cloudProfile?: CloudProfileSummary[]};
~~~

Current schema lists cloud states as scheduled to start, scheduled to stop, starting, running,
restarting, stopping, stopped, unknown, and error. Preserve the wire spelling (including spaces).
Do not infer completion from a successful start/stop acknowledgement or add automatic polling.

DELETE instance and POST forceStop are distinct census routes with the same forced termination
effect in source. POST stop is graceful scheduling. Explain this explicitly; a delete label must
not imply deletion of an inert record. These actions can terminate running work and incur cloud
cost; keep Update and explicit destructive confirmation.

Useful list locator dimensions confirmed by the finders are project:(id:P),
affectedProject:(id:P), profile:(id:PROFILE), image:(id:(...)) for instances, and
agentPool:(id:N) for images. Use a small typed subset. Hidden error/state/network filters are
not needed for the first implementation and must not become generic passthrough.

[CloudUtil identity parsing](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/data/CloudUtil.java),
[CloudInstance model/start](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/model/cloud/CloudInstance.java),
[CloudImage posted identity](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/model/cloud/CloudImage.java),
[CloudImageLocator](https://www.jetbrains.com/help/teamcity/rest/cloudimagelocator.html),
[CloudInstanceLocator](https://www.jetbrains.com/help/teamcity/rest/cloudinstancelocator.html),
[CloudProfileLocator](https://www.jetbrains.com/help/teamcity/rest/cloudprofilelocator.html).

## VCS root routes: 11

| # | Method | Path | Query, typed input, response | Proposed CLI leaf |
|---|---|---|---|---|
| 11 | POST | /vcs-roots | fields=VR; JSON VcsRootCreate; VcsRoot | vcs-roots create |
| 12 | DELETE | /vcs-roots/{vcsRootLocator} | No query/body; ACK | vcs-roots delete |
| 13 | GET | /vcs-roots/{vcsRootLocator}/instances | fields=count,vcs-root-instance(VI); VcsRootInstances; no locator/page query | vcs-roots instances |
| 14 | GET | /vcs-roots/{vcsRootLocator}/properties | fields=PROPS; Properties with names only | vcs-roots properties list |
| 15 | PUT | /vcs-roots/{vcsRootLocator}/properties | fields=PROPS; JSON {property:[{name,value}]}; Properties | vcs-roots properties replace |
| 16 | DELETE | /vcs-roots/{vcsRootLocator}/properties | No query/body; ACK | vcs-roots properties clear |
| 17 | GET | /vcs-roots/{vcsRootLocator}/properties/{name} | No fields query; plain-text value; discard for metadata-only existence | vcs-roots properties exists |
| 18 | PUT | /vcs-roots/{vcsRootLocator}/properties/{name} | Plain-text value; plain-text result; discard echoed value | vcs-roots properties set |
| 19 | DELETE | /vcs-roots/{vcsRootLocator}/properties/{name} | No query/body; ACK | vcs-roots properties delete |
| 20 | GET | /vcs-roots/{vcsRootLocator}/{field} | Allowlisted field; no fields query; plain-text result | vcs-roots fields get |
| 21 | PUT | /vcs-roots/{vcsRootLocator}/{field} | Allowlisted field, typed text body; plain-text result | vcs-roots fields set |

Use id:<externalVcsRootId> for the path identity. Parent project references use external IDs.

### Creation and properties

A useful minimal create command can support a Git anonymous repository first:

~~~ts
type VcsRootCreate = {
  id: string;
  name: string;
  vcsName: "jetbrains.git";
  project: {id: string};
  properties: {property: [
    {name: "authMethod"; value: "ANONYMOUS"},
    {name: "branch"; value: string},
    {name: "url"; value: string}
  ]};
};
~~~

The service source explicitly requires vcsName and properties plus a project (project element or
older projectLocator). Use the project element, not the deprecated projectLocator. id and name
are good explicit CLI requirements even where source delegates their validation/defaults.
The documented Git example uses authMethod, branch, url. Do not claim every VCS provider can be
configured with this Git schema.

Validate a credential-free repository URL, branch, and explicit project/root identity before
HTTP. Do not write a private URL into examples/fixtures, return it in the root summary, put
credentials into URL userinfo/query, or reuse the active TeamCity auth token as a VCS credential.

PUT properties replaces the full map; empty property:[] clears it. DELETE properties also clears
the whole map. This can remove the repository URL, authentication configuration, and polling
settings, breaking attached build configurations. No hidden GET/merge is implied.

Property lists request names only. Scalar GET can return a sensitive value and has no fields
query; an existence command must discard it and keep ambiguous 404 as an error. A missing root
is not proof that only the property is absent. Text PUT can echo the value; discard it before
building a public result.

The initial ordinary property setter should accept only validated nonsecret names/values.
If authenticated VCS configuration is included, add an explicit credential-reference branch:
read the value from the active profile's injected secret store and place it only in the intended
wire property. For example, official SSH documentation names secure:passphrase, and a server-side
uploaded key is referenced via teamcitySshKey. Do not invent authentication property names or
accept raw --password/--token argv. The route can be covered without claiming every authentication
method is implemented.

### Scalar fields

Confirmed GET fields: id, name, vcsName, projectId (project is a supported synonym), and
modificationCheckInterval. Avoid internal IDs and repositoryMappings in public output.

Confirmed PUT fields:

- id: nonempty new external ID; can affect references.
- name: nonempty name.
- project: typed ProjectLocator string in the body, such as id:DESTINATION; moving the root.
- modificationCheckInterval: integer text; empty text restores the default interval.
- defaultModificationCheckIntervalInUse: only true is supported; false is rejected by the server.

Prefer the canonical project field, not parallel compatibility aliases. Do not expose vcsName as
writable: it is read-only in the published field handler. Reject negative intervals and typo
booleans locally even where the server implementation is permissive. A narrow name setter is
enough to expose PUT without promising unsupported fields.

[Manage VCS Roots](https://www.jetbrains.com/help/teamcity/rest/manage-vcs-roots.html),
[VcsRoot model fields](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/model/change/VcsRoot.java),
[SSH key REST properties](https://www.jetbrains.com/help/teamcity/ssh-keys-management.html#REST+API).

## VCS root instance routes: 12

| # | Method | Path | Query, typed input, response | Proposed CLI leaf |
|---|---|---|---|---|
| 22 | GET | /vcs-root-instances | locator=count:N,start:S plus typed filter; fields=count,nextHref,vcs-root-instance(VI); VcsRootInstances | vcs-instances list |
| 23 | POST | /vcs-root-instances/checkingForChangesQueue | Typed bounded locator, requestor=user or commit_hook, fields=count,nextHref,vcs-root-instance(VI); no body; VcsRootInstances | vcs-instances check-changes |
| 24 | POST | /vcs-root-instances/commitHookNotification | Required nonempty typed locator; optional okOnNothingFound boolean; no body; text response, usually 202 | vcs-instances notify-commit |
| 25 | GET | /vcs-root-instances/{vcsRootInstanceLocator} | fields=VI; VcsRootInstance | vcs-instances show |
| 26 | GET | /vcs-root-instances/{vcsRootInstanceLocator}/properties | fields=PROPS; Properties names only | vcs-instances properties |
| 27 | GET | /vcs-root-instances/{vcsRootInstanceLocator}/repositoryState | fields=STATE; Entries of branch -> revision | vcs-instances state show |
| 28 | PUT | /vcs-root-instances/{vcsRootInstanceLocator}/repositoryState | fields=STATE; JSON {entry:[{name:branch,value:revision}]}; Entries | vcs-instances state replace |
| 29 | DELETE | /vcs-root-instances/{vcsRootInstanceLocator}/repositoryState | No query/body; ACK; reset stored repository state | vcs-instances state reset |
| 30 | GET | /vcs-root-instances/{vcsRootInstanceLocator}/repositoryState/creationDate | No query/body; text/plain TeamCity DateTime | vcs-instances state created |
| 31 | GET | /vcs-root-instances/{vcsRootInstanceLocator}/{field} | Allowlisted field; no fields query; plain-text result | vcs-instances fields get |
| 32 | PUT | /vcs-root-instances/{vcsRootInstanceLocator}/{field} | Allowlisted field; plain-text body/result | vcs-instances fields set |
| 33 | DELETE | /vcs-root-instances/{vcsRootInstanceLocator}/{field} | lastVersionInternal (or legacy display spelling); no query/body; ACK | vcs-instances fields clear |

Wire names contain hyphens. Do not accidentally decode as vcsRootInstance or vcsRootId:

~~~ts
type VcsInstanceSummary = {
  id: string;
  name?: string;
  "vcs-root-id"?: string;
  vcsName?: string;
  modificationCheckInterval?: number;
  commitHookMode?: boolean;
};
type VcsRootInstances = {
  count?: number;
  nextHref?: string;
  "vcs-root-instance"?: VcsInstanceSummary[];
};
type Entries = {count?: number; entry?: {name: string; value: string}[]};
~~~

VCS instance IDs are service strings; preserve exact identity rather than Number coercion.
Useful typed list filters: vcsRoot:(id:ROOT), project:(id:P), buildType:(id:B),
versionedSettings:true|false, and count/start. Single-target Update operations should require
id:<instanceId>; a multi-target check should require an explicitly bounded declared selection.
The nested /vcs-roots/{root}/instances route (#13) is unpaged and accepts fields only.

### Polling and commit hooks are effects

checkingForChangesQueue schedules checking for the selected page only; it does not return found
changes or prove completion. requestor defaults to user in source; commit_hook has special meaning
for background polling intervals. Do not silently choose it.

commitHookNotification requires a locator despite OpenAPI marking the query optional. Its source
returns 202 when a check is scheduled, 404 if no match, or 200 if no match and okOnNothingFound=true.
Text can contain a locator and account description. Discard it; return a small status-aware result,
such as {scheduled:true} only on 202 and {scheduled:false} for the explicit no-match 200 case.
Do not report scheduled:true on every 2xx. No fields query is supported on this route.

Never auto-page a POST by following nextHref or silently run an unbounded all-roots mutation.
A ReadOnly permission gate must reject before any HTTP call even if remote TeamCity permits the
operation under a less restrictive server permission.

### Repository state and fields

repositoryState is Entries, not the richer repositoryState nested model returned by some instance
projections. Entry name is a branch identifier and value is its revision. PUT replaces this state;
reject duplicate branch names and malformed/empty identifiers before HTTP. Do not pass arbitrary
property files as repository state. DELETE resets TeamCity's saved last state; it does not delete
Git branches, change the remote repository, or create a commit. Such a reset still affects change
detection, so remains Update.

creationDate is the creation timestamp of this recorded state, not necessarily creation of the
VCS root instance (the generated operation description is imprecise).

Confirmed scalar reads include id, name, vcsName, projectId, lastVersion, lastVersionInternal,
currentVersion, currentVersionInternal, and commitHookMode. Current-version reads may ask the VCS
provider and can fail; do not add them to live proof automatically.

Confirmed scalar writes:

- lastVersionInternal: a revision string sets a single-version state; empty text resets it.
- commitHookMode: strict true/false text.
- lastVersion only accepts empty text in the source; no nonempty display-version setter.

DELETE only supports lastVersionInternal and the older lastVersion spelling. Expose the former
as the canonical reset, not a generic field deletion or compatibility alias. There is no supported
name setter on a VCS instance.

[VcsRootInstance fields](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/model/change/VcsRootInstance.java),
[VcsRootInstanceLocator](https://www.jetbrains.com/help/teamcity/rest/vcsrootinstancelocator.html).

## Versioned Settings routes: 16

| # | Method | Path | Query, typed input, response | Proposed CLI leaf |
|---|---|---|---|---|
| 34 | GET | /projects/{locator}/versionedSettings/affectedProjects | fields=PROJECTS; Projects; no locator/page query | projects versioned-settings affected |
| 35 | POST | /projects/{locator}/versionedSettings/checkForChanges | No body/query; ACK | projects versioned-settings check-changes |
| 36 | POST | /projects/{locator}/versionedSettings/commitCurrentSettings | No body/query; ACK; commits settings to VCS | projects versioned-settings commit |
| 37 | GET | /projects/{locator}/versionedSettings/config | fields=VC; VersionedSettingsConfig | projects versioned-settings config show |
| 38 | PUT | /projects/{locator}/versionedSettings/config | fields=VC; JSON VersionedSettingsConfigInput; VersionedSettingsConfig | projects versioned-settings config replace |
| 39 | GET | /projects/{locator}/versionedSettings/config/effective | fields=project(id),config(VC); VersionedSettingsEffectiveConfig | projects versioned-settings config effective |
| 40 | GET | /projects/{locator}/versionedSettings/config/parameters/{name} | Allowlisted config field; no fields query; text result | projects versioned-settings config fields get |
| 41 | PUT | /projects/{locator}/versionedSettings/config/parameters/{name} | Allowlisted field; typed plain-text body/result | projects versioned-settings config fields set |
| 42 | DELETE | /projects/{locator}/versionedSettings/config/parameters/{name} | No query/body; documented void; see post-mutation error caveat | projects versioned-settings config fields clear |
| 43 | GET | /projects/{locator}/versionedSettings/contextParameters | NO fields query; VersionedSettingsContextParameters; local names-only projection | projects versioned-settings context list |
| 44 | PUT | /projects/{locator}/versionedSettings/contextParameters | NO fields query; JSON {versionedSettingsContextParameter:[{name,value}]}; same model | projects versioned-settings context replace |
| 45 | POST | /projects/{locator}/versionedSettings/loadSettings | fields=PROJECTS; no body; Projects; overwrites current settings from VCS | projects versioned-settings load |
| 46 | GET | /projects/{locator}/versionedSettings/status | fields=VS; VersionedSettingsStatus | projects versioned-settings status |
| 47 | GET | /projects/{locator}/versionedSettings/tokens | Optional status=used|unused|broken; NO fields query; VersionedSettingsTokens | projects versioned-settings tokens list |
| 48 | POST | /projects/{locator}/versionedSettings/tokens | NO fields query; JSON {versionedSettingsToken:[{name,value:secret}]}; VersionedSettingsTokens with values removed | projects versioned-settings tokens set |
| 49 | DELETE | /projects/{locator}/versionedSettings/tokens | NO fields query; JSON {versionedSettingsToken:[{name}]}; VersionedSettingsTokens; in-use tokens rejected | projects versioned-settings tokens delete |

Use id:<externalProjectId> as the project path locator. All synchronization actions are Update.
Commit writes to the external repository; load can replace multiple projects' settings. Describe
the affected scope and require explicit confirmation. Affected-project listing is read-only;
the command must not automatically load just because the list was read.

### Ordinary and effective configuration are different DTOs

~~~ts
type VersionedSettingsConfig = {
  synchronizationMode?: "useParentProjectSettings" | "disabled" | "enabled";
  vcsRootId?: string;
  format?: string;
  buildSettingsMode?: "alwaysUseCurrent" | "useCurrentByDefault" | "useFromVCS";
  allowUIEditing?: boolean;
  showSettingsChanges?: boolean;
  storeSecureValuesOutsideVcs?: boolean;
  portableDsl?: boolean;
  settingsPath?: string;
  applyChangesInDependenciesAndVcsSettings?: boolean;
  dslExecutionMode?: "sandbox" | "agent";
};
type VersionedSettingsEffectiveConfig = {
  project?: {id: string}; // project from which the effective configuration is inherited
  config?: VersionedSettingsConfig;
};
type VersionedSettingsConfigInput = VersionedSettingsConfig & {
  synchronizationMode: "useParentProjectSettings" | "disabled" | "enabled";
  importDecision?: "overrideInVCS" | "importFromVCS";
};
~~~

The effective route is missing from the generated help index and old pinned source but is
explicitly present in the current official public 2026.1 schema. Its response is
versionedSettingsEffectiveConfig with project and config, NOT a flat VersionedSettingsConfig.
The current schema also corroborates settingsPath, applyChangesInDependenciesAndVcsSettings,
and dslExecutionMode; these are absent in the old config class.

For a useful enabled-config command require vcsRootId and format (xml or kotlin for the first
slice), in addition to synchronizationMode. A disabled/inherited mode need not require a VCS root.
Keep importDecision explicit: overrideInVCS overwrites the repository settings; importFromVCS
overwrites the current TeamCity configuration. Do not resolve conflicts automatically.

Config PUT is not a partial patch in the inspected service implementation. Omitted options use
server defaults: showSettingsChanges=false, storeSecureValuesOutsideVcs=true, portableDsl=true,
allowUIEditing=true, buildSettingsMode=alwaysUseCurrent. Require deliberate replacement input or
document the resulting defaults; do not claim omitted fields are preserved. No hidden read/merge
is needed for a replace command.

For credential safety, a first CLI contract must not set storeSecureValuesOutsideVcs=false:
this allows secrets into VCS. Keep it true in constructed configs and reject a scalar attempt to
disable it. Ordinary Update authority must not silently become approval to publish credentials.
Output can report the current boolean so a user can detect an unsafe existing configuration.

The source config service checks EDIT_PROJECT even for GET; keep local ReadOnly because the GET
does not mutate. An authorization error is not proof the profile is unauthenticated.

[Config source and enum spellings](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/model/versionedSettings/VersionedSettingsConfig.java),
[Config service/defaults](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/service/impl/versionedSettings/VersionedSettingsConfigsServiceImpl.java),
[Current config model](https://www.jetbrains.com/help/teamcity/rest/versionedsettingsconfig.html),
[Manage Version Control Settings](https://www.jetbrains.com/help/teamcity/rest/manage-vcs-settings.html).

### Scalar config fields and deletion caveat

These are typed Versioned Settings fields, NOT arbitrary build parameters. Old source allowlists:
synchronizationMode, vcsRootId, showSettingsChanges, buildSettingsMode, format, allowUIEditing,
storeSecureValuesOutsideVcs, portableDsl. importDecision is not supported through this scalar API.

Map enums and booleans strictly; do not let misspelled booleans turn into false. Fields added to
the current JSON model are not automatically proven writable through the scalar handler.

The published DELETE handler calls the scalar setter with null. The setter then writes config,
reads the value back, and compares it with the submitted null. The old model's getters use
String.valueOf, so a resulting literal "null" or a materialized default can cause an error AFTER
the update. This is a real source-level caveat, not verified current runtime behavior.

Consequences: document the route as a reset attempt, keep HTTP failure truthful, never retry
blindly, and never describe every field as reliably removable. Deleting mandatory
synchronizationMode is invalid. A current controlled disposable-server test or current handler
source is needed before claiming a guaranteed successful clear variant. Do not create a fake
success fixture solely to erase this uncertainty. The current schema confirms only method/path,
name input, and void success contract, not which field clears successfully.

### Context parameters

Wire shape is singular versionedSettingsContextParameter, with no count and no fields query:

~~~ts
type VersionedSettingsContextParameters = {
  versionedSettingsContextParameter?: {name: string; value?: string | null}[];
};
~~~

GET can include required-but-missing context parameters with null values. Local output can return
{name,hasValue} only; do not print arbitrary context values. PUT replaces the configured context
map. Validate the entire nonsecret list first, reject duplicate names, and use [] only as explicit
clear. The source converts duplicates to a map, potentially overwriting earlier values.

Context parameters are not a secure token store. Disallow password/token/key-like names and
credential-bearing values through normal argv. Return names/presence after PUT, not echoed values.

The prose Manage VCS Settings guide mentions POST for context modification, but the current
OpenAPI, frozen inventory, and request implementation all define PUT. Use PUT.

[Context model](https://www.jetbrains.com/help/teamcity/rest/versionedsettingscontextparameters.html),
[Context service](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/service/impl/versionedSettings/VersionedSettingsDslParametersServiceImpl.java),
[Context tests, including missing values](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/test/jetbrains/buildServer/server/rest/request/versionedSettings/VersionedSettingsRequestContextParamsTest.java).

### Status and actions

A safe status DTO is {type?:"info"|"warn",timestamp?:string,dslOutdated?:boolean,
missingContextParameters?:string[]}. Omit message, versionedSettingsError, stackTraceLines and
file. Do not assume timestamp is in TeamCity DateTime format: old source serializes a Date via
toString, and current schema declares only string.

Status can fail if versioned settings have never been enabled. checkForChanges and affectedProjects
require enabled configuration in the source. Successful load returns Projects, not a Build or
boolean. The response is not evidence that a build was started or completed.

### Secure-value tokens: explicit keyring input, not auth tokens

~~~ts
type VersionedSettingsTokenMetadata = {name: string; description?: string};
type VersionedSettingsTokens = {
  versionedSettingsToken?: {name?: string; description?: string; value?: string}[];
};
type VersionedSettingsTokenSetWire = {
  versionedSettingsToken: {name: string; value: string}[];
};
type VersionedSettingsTokenDeleteWire = {
  versionedSettingsToken: {name: string}[];
};
~~~

These names identify secure-value mappings used by versioned project configuration. They are not
user access tokens, and POST does not mint an authentication credential. Do not reuse the S7
user-token issuance command or its output DTO.

Confirmed source behavior:

- GET status accepts exactly used, unused, broken; omitted/empty means all.
- GET removes each value before returning. There is no fields parameter; still locally drop any
  unexpected value and omit description by default if it can contain free text.
- POST adds/sets mappings without replacing unrelated mappings. The official test starts with
  two mappings, adds one, and observes three.
- POST consumes only entries whose value is not null. Reject absent values locally instead of
  silently reporting an ignored mapping as success.
- DELETE consumes names only; the official test constructs an entry with name and no value.
- DELETE rejects the batch if any requested token is currently used, before removal.
- POST and DELETE return the complete current metadata list with secret values removed, not only
  the affected names. A public mutation result should acknowledge the explicitly requested names
  rather than claiming every returned name was changed.

For POST, expose typed pairs of remote token name and local credential alias. Resolve all aliases
through context.secrets.require for the selected profile BEFORE HTTP; forbid duplicate remote
names and missing/empty secrets. Never accept a raw token value through argv, positional input,
JSON-RPC argv, profile JSON, or an environment-export command. Do not assume the active TeamCity
login secret is the desired mapping value.

Only the private wire serializer sees secret values. Public results contain names and completion
status. Do not return raw server bodies, error causes, request objects, or store errors. The
input credential remains in its existing scoped store; remote deletion must not silently delete
local credential aliases. No new Core abstraction is needed for this integration-owned workflow.

[Tokens model](https://www.jetbrains.com/help/teamcity/rest/versionedsettingstokens.html),
[Tokens service](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/service/impl/versionedSettings/VersionedSettingsTokensServiceImpl.java),
[Tokens tests: name-only delete and add semantics](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/test/jetbrains/buildServer/server/rest/request/versionedSettings/VersionedSettingsRequestTokensTest.java).

## Root version: 1

| # | Method | Path | Query, typed input, response | Proposed CLI leaf |
|---|---|---|---|---|
| 50 | GET | /version | No query/body; text/plain version string | server rest-version |

The generated description calls this the TeamCity server version; the pinned RootApiRequest
implementation returns the REST plugin's own version string. Keep it distinct from /apiVersion,
the normal /server summary, and the local CLI --version. Preserve the returned string rather than
parsing it as semver or labeling it the CLI build version.

[RootApiRequest](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/request/RootApiRequest.java).

## Bulk-unmute primary-source follow-up

DELETE /mutes/multiple is not part of these S8 50. It remains a separate unresolved earlier route.

Current official 2026.1 public OpenAPI confirms JSON/XML Mutes body, optional fields, and a
default/void success response. The body is marked optional at the schema level, as are many
semantically required TeamCity payloads. That is NOT proof an empty or ID-only body works.

Additional primary checks performed:

- [Official generated Kotlin MuteApi](https://github.com/JetBrains/teamcity-rest-auto-kotlin-client/blob/master/src/main/kotlin/org/jetbrains/teamcity/rest/apis/MuteApi.kt):
  bulk POST and single DELETE are present; no bulk DELETE contract/example.
- [Official Kotlin client MuteTest](https://github.com/JetBrains/teamcity-rest-client/blob/master/teamcity-rest-client-impl/src/test/kotlin/org/jetbrains/teamcity/rest/MuteTest.kt):
  create-and-delete test uses single deleteMute(id), not the bulk route.
- Official JetBrains GitHub code searches and public YouTrack/documentation searches did not
  reveal a bulk DELETE implementation or request example.
- Public JetBrains UI scripts were read in memory, without executing JavaScript or actions.
  The legacy bulk investigation/mute dialog uses /tests/bulkInvestigate.html, not REST
  /mutes/multiple; this cannot establish the REST DELETE payload.
- Official Maven directory metadata did not expose a REST plugin artifact at the source's
  org.jetbrains.teamcity.plugins:rest-api coordinates.
- Current public TeamCity 2026.1.3 downloadable distributions are approximately 1.56 GB tar.gz
  or exe. No large distribution was fetched. HEAD checks for a selectively readable zip/war
  or public standalone rest-api.zip returned 404.

Therefore the useful fact remains Mutes/mute[]; the mandatory per-item deletion identity
(id only versus scope/target) is still unproven. A full Mute schema is not proof every field is
required, nor proof id alone is consumed. Do not fabricate a mock and count verified coverage.
A current official handler/client example or an explicitly authorized disposable mutation proof
is still needed. No live Update was performed during this research.

## Minimum acceptance evidence for S8

- Exact one-to-one route census; no duplicate baseline/S6/S7 operation counting.
- Gates reject every Update before HTTP, including cloud start/stop and VCS notifications.
- Typed composite cloud identities are escaped and round-trip; bare provider IDs do not silently
  target another profile/image. POST image has exactly one identity form.
- Cloud start/stop handle empty responses without JSON parsing; delete is documented as forced.
- All cloud DTOs drop networkAddress, webUrl, errors, and extra nested properties.
- Property/context reads and echoed mutation responses cannot leak arbitrary values.
- Full VCS property and repository-state replacements validate all entries before HTTP.
- VCS instance collection decoders use vcs-root-instance and vcs-root-id exactly.
- Commit-hook 202 versus explicit no-match 200 produce truthful different acknowledgements.
- No mutating request auto-pages; no retries after ambiguous or partial mutation failures.
- Effective config decoder handles project/config nesting and fixed fields.
- Config replacement does not promise patch preservation; unsafe secret-to-VCS configuration
  is rejected, importDecision is explicit, and config DELETE retains the documented uncertainty.
- Context mutation uses PUT, not the outdated prose guide's POST.
- Versioned-token POST resolves all profile-scoped secret references before HTTP; normal JSON,
  JSON-RPC, errors and mocks never expose the resolved value. Test two-profile isolation.
- Versioned-token DELETE sends names only; it does not delete local credential aliases.
- Default tests remain offline and synthetic. Do not automatically expand the fixed local
  ReadOnly live-proof inventory with administrative, unpaged, or VCS-contacting operations.
