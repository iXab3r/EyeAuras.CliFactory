# S7 administrative API research

Research date: 2026-08-30. This is primary-source research, not implementation acceptance and
not an independent replacement for [Issue #5](https://github.com/iXab3r/EyeAuras.CliFactory/issues/5).
Only this file was added for the S7 research assignment. No production/test files, GitHub state,
profile/auth state, or live service mutations were changed.

## Candidate census

Exactly 50 remaining frozen-inventory routes were selected after subtracting the baseline and
S1-S5 coverage maps: User 27, Group 16, Node 6, and GET /apiVersion. This is 23 ReadOnly GET
operations and 27 Update operations. None intersects the 45 + 5 proposed S6 operations in
[s6-research.md](s6-research.md). The baseline GET /users/{userLocator}, already used for auth,
is deliberately not counted again.

The outcome is a coherent access/administration surface: manage user/group identities, explicit
memberships and role assignments, profile-keyring token handoff, and node responsibility status.
These routes remain subject to the ordinary 50-operation authoring checkpoint before the next
implementation batch.

## Primary references and confidence

The route/media inventory is the [2026.1 UserApi](https://www.jetbrains.com/help/teamcity/rest/userapi.html),
[GroupApi](https://www.jetbrains.com/help/teamcity/rest/groupapi.html),
[NodeApi](https://www.jetbrains.com/help/teamcity/rest/nodeapi.html), and
[RootApi](https://www.jetbrains.com/help/teamcity/rest/rootapi.html).

Implementation details are corroborated by the official TeamCity REST source at
[fc730e618ccd4b57dbbaf03425bb79a9580d19d2](https://github.com/JetBrains/teamcity-rest/tree/fc730e618ccd4b57dbbaf03425bb79a9580d19d2).
The public source predates some current endpoints; missing source is explicitly distinguished
from a verified contract. No private server schema or service response was read.

Principal source files:

- [UserRequest](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/request/UserRequest.java)
- [GroupRequest](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/request/GroupRequest.java)
- [DataUpdater](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/data/DataUpdater.java)
- [NodesRequest](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/request/NodesRequest.java)
- [RootApiRequest](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/request/RootApiRequest.java)

## Media, projections, and typed identity

All table paths have prefix /app/rest. JSON endpoints use Accept: application/json; JSON bodies
also use Content-Type: application/json. Plain scalar responses use Accept: text/plain. Plain
request bodies use Content-Type: text/plain. ACK means successful empty/void response normalized
by the client, not an invented JSON response from TeamCity.

Proposed safe selectors:

~~~text
U = id,username,name
G = key,name,description
N = id,role,state,current
R = count,responsibility(name,description)
TOK = name,creationTime,expirationTime
PA = count,permissionAssignment(permission(id),project(id),isGlobalScope)
~~~

These are explicit projections, not permission guarantees. Every result still needs local
projection to the intended small DTO. Never spread a server object. Default account DTOs omit
password, properties, roles, groups, e-mail, login history, authentication metadata, and avatar
URLs. Those intentional service surfaces have separate typed commands where needed.

- User path identity: id:<userId>; named current-user token operations may use current.
  User IDs are int64 in the service locator. Preserve decimal strings when they exceed safe
  integer range; do not silently round them through Number().
- Group path identity: key:<groupKey>, not id:<groupKey>. Embedded posted groups use {key:string}.
- Node path identity: id:<nodeId>. Node IDs are strings.
- Role path/body identity: {roleId:string,scope:"g" or "p:<projectId>"}.
  The scope value is a single encoded path segment and is not a full URL.
- Validate and escape each literal or path segment using the existing TeamCity-specific rules.
  No raw method/path/body passthrough is proposed.

[UserLocator](https://www.jetbrains.com/help/teamcity/rest/userlocator.html),
[UserGroupLocator](https://www.jetbrains.com/help/teamcity/rest/usergrouplocator.html),
[TeamCityNodeLocator](https://www.jetbrains.com/help/teamcity/rest/teamcitynodelocator.html),
[RoleAssignment](https://www.jetbrains.com/help/teamcity/rest/roleassignment.html).

## User routes: 27

| # | Method | Path after /app/rest | Query, typed body, wire result | Suggested CLI leaf |
|---|---|---|---|---|
| 1 | GET | /users | locator=count:N,start:S; fields=count,user(U); Users | users list |
| 2 | POST | /users | fields=U; JSON UserIdentityInput; User | users create |
| 3 | PUT | /users/{userLocator} | fields=U; JSON UserIdentityUpdate; User | users update |
| 4 | DELETE | /users/{userLocator} | No query/body; ACK | users delete |
| 5 | DELETE | /users/{userLocator}/debug/rememberMe | No query/body; text/plain declared but void implementation; ACK | users sessions forget-remembered |
| 6 | GET | /users/{userLocator}/groups | fields=count,group(G); Groups | users groups list |
| 7 | PUT | /users/{userLocator}/groups | fields=count,group(G); JSON {group:[{key:string}]}; Groups | users groups replace |
| 8 | GET | /users/{userLocator}/groups/{groupLocator} | fields=G; Group; 404 if membership absent | users groups show |
| 9 | DELETE | /users/{userLocator}/groups/{groupLocator} | Optional fields documented but unnecessary; no body; ACK | users groups remove |
| 10 | POST | /users/{userLocator}/logout | No documented query/body; ACK | users sessions logout |
| 11 | GET | /users/{userLocator}/permissions | Optional locator; fields=PA; PermissionAssignments | users permissions list |
| 12 | GET | /users/{userLocator}/properties | fields=count,property(name); Properties | users properties list |
| 13 | GET | /users/{userLocator}/properties/{name} | No fields query; plain-text value, discard for existence output | users properties exists |
| 14 | PUT | /users/{userLocator}/properties/{name} | Plain-text nonsecret value; plain-text result, discard | users properties set |
| 15 | DELETE | /users/{userLocator}/properties/{name} | No query/body; ACK | users properties delete |
| 16 | GET | /users/{userLocator}/roles | No fields query; RoleAssignments | users roles list |
| 17 | POST | /users/{userLocator}/roles | No fields query; JSON {roleId,scope}; RoleAssignment | users roles add |
| 18 | PUT | /users/{userLocator}/roles | No fields query; JSON {role:[{roleId,scope}]}; RoleAssignments | users roles replace |
| 19 | GET | /users/{userLocator}/roles/{roleId}/{scope} | No query/body; RoleAssignment | users roles show |
| 20 | PUT | /users/{userLocator}/roles/{roleId}/{scope} | No query/body; RoleAssignment | users roles grant |
| 21 | DELETE | /users/{userLocator}/roles/{roleId}/{scope} | No query/body; ACK | users roles revoke |
| 22 | GET | /users/{userLocator}/tokens | fields=count,token(TOK); Tokens | users tokens list |
| 23 | POST | /users/{userLocator}/tokens | JSON TokenCreateInput; fields=TOK,value; Token with one-time secret value | users tokens create |
| 24 | DELETE | /users/{userLocator}/tokens/{name} | Token name in path; no query/body; ACK | users tokens delete |
| 25 | GET | /users/{userLocator}/{field} | No query/body; plain-text field value | users fields get |
| 26 | PUT | /users/{userLocator}/{field} | Plain-text body/result; password special case returns no value | users fields set |
| 27 | DELETE | /users/{userLocator}/{field} | No query/body; ACK | users fields clear |

All GET commands use ReadOnly. All POST/PUT/DELETE commands use Update. Remote role grants,
password operations, logout, and token issuance do not grant local CliFactory Update permission.

The CLI labels are proposals for the owning Issue, not shipped names. Two add/grant leaves map
to distinct REST routes and must explain the same capability without pretending they are aliases
required for backward compatibility.

### User input and update semantics

A minimal new user requires username. Optional name/e-mail/password exist on the service DTO.
For the first thin implementation, use identity-only inputs and omit roles/groups/properties;
their explicit trees already cover those effects.

~~~ts
type UserIdentityInput = {
  username: string;
  name?: string;
  email?: string;
  // password may only be supplied internally from a declared secret input
  password?: string;
};
type UserIdentityUpdate = {
  username?: string;
  name?: string;
  email?: string;
  // optional internal secret input, never a public raw-password flag
  password?: string;
};
~~~

A username-only create is supported by the source's required-field validation. It does not prove
the account can authenticate under a server's auth configuration; do not claim a working login
without a password/auth protocol being configured.

Important correction: PUT /users/{userLocator} does NOT clear omitted roles/groups/properties.
DataUpdater.modify only replaces a collection when that collection is present in the body.
Omitted username/name/e-mail/password likewise preserve the existing field. An identity-only
update therefore needs no hidden GET and does not wipe roles. A supplied collection does replace
its existing state, and the compound request can partially apply before a later part fails.
Do not include collections in the identity-update command.

Field allowlists confirmed by the User model:

- GET: id, name, username, email.
- PUT: username, name, email, password.
- DELETE: name, email, password.
- PUT password returns null instead of echoing the secret. GET password is unsupported.
- DELETE password removes the password; it is a remote security mutation, not local logout.

A conservative first slice may expose GET id/name/username, PUT name/username, and DELETE name,
while still counting each route once. If password fields are supported, use the explicit secure-input contract
below; never accept arbitrary field names just because the URL has {field}.

[User source](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/model/user/User.java),
[Manage Users](https://www.jetbrains.com/help/teamcity/rest/manage-users.html).

### Memberships and sessions

Users and groups use posted group key, not group name or numeric ID. PUT groups is full replacement
of directly assigned memberships. The All Users group is retained by server semantics even when
the posted list is empty; do not promise zero memberships. Duplicate group keys should fail
locally. Membership GET/DELETE can return 404 when both user and group exist but the membership
does not.

DELETE debug/rememberMe clears remembered-login data. POST logout terminates active sessions.
Neither is the factory's auth logout, neither promises token revocation, and neither should delete
the active local profile's credential. Do not silently combine these effects.

The current docs define POST logout; it is absent from the inspected older UserRequest source,
so no undocumented body or return schema is asserted.

### Permission assignments

Wire shape:

~~~ts
type PermissionAssignments = {
  count?: number;
  permissionAssignment?: {
    permission?: { id?: string };
    project?: { id?: string };
    isGlobalScope?: boolean;
  }[];
};
~~~

The source finder supports locator dimensions global:true/false, project:<ProjectLocator>, and
permission:<permissionId>. For a simple focused query, use project:(id:PROJECT) and optional
permission:VIEW_PROJECT, plus the fixed PA selector. Do not fabricate nextHref pagination.
These are resolved permissions for the named project: a result does not independently prove
permission on every subproject.

[PermissionAssignmentFinder](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/data/finder/impl/PermissionAssignmentFinder.java),
[PermissionAssignments](https://www.jetbrains.com/help/teamcity/rest/permissionassignments.html).

## Group routes: 16

| # | Method | Path after /app/rest | Query, typed body, wire result | Suggested CLI leaf |
|---|---|---|---|---|
| 28 | GET | /userGroups | fields=count,group(G); no locator pagination; Groups | groups list |
| 29 | POST | /userGroups | fields=G; JSON {key:string,name:string,description?:string}; Group | groups create |
| 30 | GET | /userGroups/{groupLocator} | fields=G; Group | groups show |
| 31 | DELETE | /userGroups/{groupLocator} | No query/body; ACK | groups delete |
| 32 | GET | /userGroups/{groupLocator}/parent-groups | fields=count,group(G); Groups | groups parents list |
| 33 | PUT | /userGroups/{groupLocator}/parent-groups | fields=count,group(G); JSON {group:[{key:string}]}; Groups | groups parents replace |
| 34 | GET | /userGroups/{groupLocator}/properties | fields=count,property(name); Properties | groups properties list |
| 35 | GET | /userGroups/{groupLocator}/properties/{name} | No fields query; plain-text value, discard for existence output | groups properties exists |
| 36 | PUT | /userGroups/{groupLocator}/properties/{name} | Plain-text nonsecret value; plain-text result, discard | groups properties set |
| 37 | DELETE | /userGroups/{groupLocator}/properties/{name} | No query/body; ACK | groups properties delete |
| 38 | GET | /userGroups/{groupLocator}/roles | No fields query; RoleAssignments | groups roles list |
| 39 | POST | /userGroups/{groupLocator}/roles | No fields query; JSON {roleId,scope}; RoleAssignment | groups roles add |
| 40 | PUT | /userGroups/{groupLocator}/roles | No fields query; JSON {role:[{roleId,scope}]}; RoleAssignments | groups roles replace |
| 41 | GET | /userGroups/{groupLocator}/roles/{roleId}/{scope} | No query/body; RoleAssignment | groups roles show |
| 42 | POST | /userGroups/{groupLocator}/roles/{roleId}/{scope} | No query/body; RoleAssignment | groups roles grant |
| 43 | DELETE | /userGroups/{groupLocator}/roles/{roleId}/{scope} | No query/body; ACK | groups roles revoke |

All GET commands use ReadOnly; all mutations use Update.

Group creation requires nonempty key and name. The simple input intentionally does not combine
group creation with users/roles/properties/parents. Such combinations exist server-side but are
not required to cover the create route and create more failure modes.

Parent replacement is explicit and may clear parents with {group:[]}. Reject duplicate keys and
a direct self-parent locally. The server detects longer cycles; do not add hidden network traversal
just to duplicate server validation. Its implementation attempts to restore prior parents on
certain errors, but do not advertise arbitrary rollback/transaction guarantees.

[Manage User Groups](https://www.jetbrains.com/help/teamcity/rest/manage-user-groups.html),
[Group source](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/model/group/Group.java).

## Shared role contract, kept TeamCity-specific

~~~ts
type RoleAssignment = { roleId: string; scope: string; href?: string };
type RoleAssignments = { role?: RoleAssignment[] };
~~~

Responses are projected to roleId/scope only; the service does not support a fields query on these
role endpoints. The collection property is role, not roles or roleAssignment. Preserve custom
role IDs rather than inventing a closed built-in role enum.

Provide exactly one typed scope choice: global -> g, or project ID -> p:<projectId>.
Validate the complete list before replacement; reject duplicate (roleId,scope) pairs. Empty
{role:[]} is an intentional clear operation, not a missing body.

Group role-at-scope creation is POST. User role-at-scope creation is PUT. The older user POST
overload is hidden/deprecated and not part of the selected frozen inventory.

User/group role replacement removes existing direct roles before adding posted ones in the
published implementation. A failure halfway through can leave changed assignments. Do not retry
blindly or claim atomicity. JSON POST adds one role without replacement.

[RoleAssignment source](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/model/user/RoleAssignment.java),
[RoleAssignments source](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/model/user/RoleAssignments.java).

## Node/API version routes: 7

| # | Method | Path after /app/rest | Query, typed body, wire result | Suggested CLI leaf |
|---|---|---|---|---|
| 44 | GET | /server/nodes | Optional typed locator role/state; fields=count,node(N); Nodes | server nodes list |
| 45 | GET | /server/nodes/{nodeLocator} | fields=N; Node | server nodes show |
| 46 | GET | /server/nodes/{nodeLocator}/disabledResponsibilities | fields=R; DisabledResponsibilities | server nodes responsibilities disabled |
| 47 | GET | /server/nodes/{nodeLocator}/effectiveResponsibilities | fields=R; EffectiveResponsibilities | server nodes responsibilities effective |
| 48 | GET | /server/nodes/{nodeLocator}/enabledResponsibilities | fields=R; EnabledResponsibilities | server nodes responsibilities enabled |
| 49 | PUT | /server/nodes/{nodeLocator}/enabledResponsibilities/{name} | Plain-text true/false; NO fields query; EnabledResponsibilities | server nodes responsibilities set |
| 50 | GET | /apiVersion | No query/body; text/plain API version string | server api-version |

Only #49 is Update; the others are ReadOnly.

~~~ts
type NodeSummary = {
  id: string;
  role?: "main_node" | "secondary_node";
  state?: "online" | "offline" | "stopping" | "starting";
  current?: boolean;
};
type Nodes = { count?: number; node?: NodeSummary[] };
type Responsibilities = {
  count?: number;
  responsibility?: { name: string; description?: string }[];
};
~~~

Do not output Node.url: it can expose an internal server topology address. Nodes are not
paginated via nextHref in the inspected model. Supported simple list locators are role:main_node
or role:secondary_node and state:online/offline/stopping/starting.

The server distinguishes enabled configuration from effective responsibilities after a node
observes configuration changes. The PUT result is EnabledResponsibilities, not proof of effective
transition or a bare boolean. The server uses Boolean.parseBoolean, so the CLI must reject values
other than exact true/false instead of allowing typos to disable a responsibility.

The assignable responsibility set is service-defined. Primary tests prove
CAN_PROCESS_BUILD_MESSAGES is assignable; MAIN_NODE is also assignable subject to no other online
main node. CAN_CLEANUP is explicitly rejected by the source test. For a narrow slice, a
CAN_PROCESS_BUILD_MESSAGES-only setter is sufficient to expose the route without speculative
enum coverage. If MAIN_NODE is exposed, clearly describe its administrative impact. Do not guess
names such as PROCESSING_BUILD_MESSAGES.

[Node](https://www.jetbrains.com/help/teamcity/rest/node.html),
[NodesRequestTest](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/test/jetbrains/buildServer/server/rest/request/NodesRequestTest.java),
[EnabledResponsibilities source](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/model/nodes/EnabledResponsibilities.java),
[EffectiveResponsibilities source](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/model/nodes/EffectiveResponsibilities.java).

## Explicit credential and keyring handling

This section distinguishes remote wire facts from the proposed safe CLI workflow. Scope the
workflow in Issue #5 before implementing it. No credential was read or issued during research.

### Token wire contract

~~~ts
type TokenCreateInput = {
  name: string;
  expirationTime?: string;
  permissionRestrictions?: {
    permissionRestriction: (
      | { permission: { id: string }; isGlobalScope: true }
      | { permission: { id: string }; project: { id: string } }
    )[];
  };
};
type TokenWire = {
  name?: string;
  creationTime?: string;
  expirationTime?: string | null;
  value?: string; // secret: private to issuance/storage workflow
};
type TokensWire = { count?: number; token?: TokenWire[] };
~~~

Timestamps use TeamCity DateTime strings such as yyyyMMddTHHmmss+ZZZZ. Omitted/null expiration
means a permanent token on the server; the CLI should require an explicit expiry or an explicit
no-expiration choice. Expiration must be in the future.

No permissionRestrictions means same permissions as the issuing user. If restrictions are
provided, permissionRestriction must be nonempty. Each entry supplies permission.id and either
isGlobalScope:true or project.id. Reject mixed scope and duplicate permission/scope pairs.
The server validates that the owner possesses the requested rights; arbitrary permission IDs
are not silently ignored. One permission ID per entry, not a comma-separated list.

The first CLI contract should make same-as-user versus explicit restrictions an intentional choice,
not silently mint an unrestricted token while displaying a local ReadOnly label. CliFactory's
ReadOnly gate and TeamCity token restrictions are different mechanisms.

TeamCity only returns the secret value once, on creation. Token listing cannot recover it.
The official Manage Users guide states users can create tokens only for their own account,
regardless of administrative privileges. Therefore a current-user-only token subtree using
/users/current/tokens is the simplest honest CLI; it still maps to the same census templates.
Do not suggest administrators can issue another user's token through this endpoint.

[Token](https://www.jetbrains.com/help/teamcity/rest/token.html),
[PermissionRestrictions](https://www.jetbrains.com/help/teamcity/rest/permissionrestrictions.html),
[Manage Users: access tokens](https://www.jetbrains.com/help/teamcity/rest/manage-users.html#Manage+Access+Tokens),
[Token source](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/model/user/Token.java),
[Tokens source](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/model/user/Tokens.java).

The older Manage Users guide illustrates POST to /tokens/{name}; that overload is hidden in
current public source and is not the frozen census route. Use POST /tokens with JSON body.

### Proposed one-time secret handoff

- Listing sends fields=count,token(name,creationTime,expirationTime) and explicitly drops any
  unexpected value even if a synthetic/misbehaving server sends one.
- Creation requests fields=name,creationTime,expirationTime,value. The value is needed only by
  a private issuance workflow, not by a public domain DTO or renderer.
- Require an explicit destination credential alias, reserve an integration-owned prefix such as
  issued-token:<alias>, and persist through context.secrets.set. The context already scopes the
  OS credential store to the application and selected profile. Do not bypass it with global
  keyring calls, config JSON, environment exports, AppData files, or stdout.
- Never allow the destination alias to overwrite the integration's active auth credential.
  An existing destination must fail before the HTTP call or require an explicit replacement
  contract; silent overwrite would lose user data.
- The successful public result contains only name, timestamps, and stored:true (plus a nonsecret
  alias if useful). The token value must never survive into normal execute/JSON/JSON-RPC output.
- Save failure after remote creation is not atomic rollback. Report that creation occurred but
  local secure persistence failed, without the secret or backend error excerpt. Do not retry
  token creation, claim success, or silently revoke something unless an explicit compensating
  revocation workflow was accepted in the Issue. The named remote token may need revocation.
- Token DELETE revokes the remote name. Local credential removal, if supported, must refer only
  to an explicitly known matching issued-token alias; never delete the profile's auth token just
  because a remote token name happened to match.
- Adding generated credentials creates ownership/lifecycle obligations: document how the CLI
  removes them on explicit deletion and profile cleanup without deleting unrelated keyring data.
  Do not assume the existing token-only auth logout cleans arbitrary newly named credentials.

Current Core already has profile-scoped get/require/set/delete through ScopedSecrets.
No new Core abstraction is justified by token issuance alone. An integration-owned helper can
coordinate the named remote operation and private secure-store handoff.

### Password input, if included

No raw password option, positional password, JSON-RPC argv password, fixture containing real
passwords, or plaintext config. Prefer an explicit named profile credential read through
context.secrets.require; a separately declared stdin/masked input flow is possible when supported
by the application contract. Never repurpose the profile's TeamCity auth token as a password.

Password create/update sends the secret only in the intended JSON or text HTTP body, then returns
safe user identity/ACK. Do not echo the request body, a response body, or fetch exception cause.
A password does not need redundant persistence if the user only requested a one-time input flow;
if it is persisted, it must use the injected scoped secret store with declared cleanup ownership.

A narrower S7 implementation can omit password fields and still expose all three generic
field routes via nonsecret name operations. Do not claim unsupported password workflows.

### User/group properties

Collection reads request names only via fields=count,property(name). Scalar GET has no fields
parameter and returns a value; an exists command must discard it and preserve ambiguous 404 as an
error, rather than claiming only the property is absent when the account/group may be absent.

PUT accepts only explicitly nonsecret property names/values through the existing validation.
The remote response is text and may echo the value; the public result should be an ACK with
identity/name, not the echoed string. Never provide a generic escape hatch to set password/token/
cookie/key-shaped properties through argv. DELETE should use a validated property name and ACK.

## Urgent S6 follow-up: DELETE /mutes/multiple remains unresolved

Primary facts from [MuteApi 2026.1](https://www.jetbrains.com/help/teamcity/rest/muteapi.html):

- DELETE /app/rest/mutes/multiple exists in the frozen inventory.
- It consumes JSON/XML Mutes and accepts optional fields.
- Mutes serializes its list under mute.
- No response DTO is documented; successful void/empty response is plausible and documented
  absence must not be turned into a guessed JSON result.

Still unproven: whether an ID-only body {mute:[{id:101}]} is sufficient versus requiring each
mute's scope/target (and possibly resolution), and what partial/missing-ID behavior is.
The inspected public MuteRequest has no bulk DELETE. Official JetBrains GitHub searches for
mutes/multiple, unmuteMultipleTests, unmuteMultiple, and @DELETE plus mutes did not reveal an
implementation or example. Targeted official-documentation searches did not reveal one either.

The general Mutes schema lists available properties; it does not establish which properties a
DELETE handler consumes. Do not implement a fabricated ID-only mock and call the uncertainty
resolved. Nor does the older single DELETE prove the bulk handler works the same way:
single DELETE resolves a MuteInfo first and derives scope/targets from it.

Resolution requires additional primary evidence (a current official implementation or explicit
request example), or a genuinely controlled mutation test in an explicitly authorized disposable
service. This research assignment authorizes neither private profile reads nor live Update
tests, and none was performed. No percentage should count this route as verified while only a
payload guess exists.

## Minimum mock evidence before acceptance

- Every Update gate rejects before HTTP, including role grants, group replacement, remote
  logout, token issuance, and node assignment.
- Unknown field names, typo booleans, duplicate role/group keys, direct self-parent, and
  empty required values fail before HTTP.
- User identity PUT omits unrelated collections; no hidden GET and no accidental clearing.
- Role replace sends exactly the declared complete list; failures are not retried.
- User group replacement with [] is valid but does not assert the service has no All Users group.
- Role-at-scope methods differ correctly: user PUT versus group POST.
- Membership 404 and scalar-property 404 retain truthful error semantics.
- Role responses contain no fields query; local projection drops href and extra data.
- Token create saves the one-time value to the selected profile's injected store before success;
  normal JSON and JSON-RPC output contain no value. Test wrong/empty returned name/value,
  existing destination, write failure after remote creation, and isolation across two profiles.
- Token metadata listing drops an unexpected secret value from a hostile fixture.
- Token creation does not replace the current profile authentication credential.
- Node results omit url; responsibility PUT returns enabled, not effective, state and accepts
  only exact true/false.
- No new administrative/unpaged route is automatically added to the fixed live proof inventory.
- All fixtures are synthetic. HTTP/JSON/store failures do not echo raw bodies or secret causes.
