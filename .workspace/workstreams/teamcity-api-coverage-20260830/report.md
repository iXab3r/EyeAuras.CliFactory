# TeamCity REST API coverage audit

Snapshot: 2026-08-30. API: **TeamCity 2026.1 (current)**.
Source baseline: `e0d4d1b8dc615a969a0160f69a5fb34968d9ab3d`.
This is an audit of our `@eyeauras/teamcity-cli`, not the separately installed TeamCity CLI.

Follow-up implementation: [TeamCity v2 — Issue #5](https://github.com/iXab3r/EyeAuras.CliFactory/issues/5)
on `feature/teamcity-v2`. This report and its CSVs remain the frozen pre-v2 baseline.

## Result

Our CLI exposes **17 of 449 declared REST operations: 3.79% endpoint coverage**.
**432 operations are not exposed**: 221 GET and 211 mutation operations.

| Accounting bucket | Available | Exposed | Not exposed | Coverage |
|---|---:|---:|---:|---:|
| ReadOnly-like: GET | 235 | 14 | 221 | 5.96% |
| Update-like: POST / PUT / DELETE | 214 | 3 | 211 | 1.40% |
| Total | 449 | 17 | 432 | 3.79% |

| HTTP method | Available | Exposed | Coverage |
|---|---:|---:|---:|
| GET | 235 | 14 | 5.96% |
| POST | 62 | 3 | 4.84% |
| PUT | 92 | 0 | 0.00% |
| DELETE | 60 | 0 | 0.00% |

This is a small operational slice, not comprehensive TeamCity administration.
Basic build launch exists; project creation and build-configuration creation do not.

## Counting rules and limits

- The denominator is the configured server's current `/app/rest/swagger.json`:
  449 declared operations, 30 API groups, zero operations marked deprecated.
  JetBrains documents Swagger as the endpoint exposing the request/parameter inventory.
  [Official REST API overview](https://www.jetbrains.com/help/teamcity/rest/teamcity-rest-api-documentation.html).
- Identity is **HTTP method + path template**. Distinct documented paths count separately even
  when similar functionality exists elsewhere. Parameter names are normalized only when
  matching CLI routes. The snapshot has no collisions after that normalization.
- Do not count by `operationId`: the schema reuses some IDs, for example on build-type
  parameters and output-parameters.
- A route counts as exposed when at least one existing CLI/auth path can invoke it. This does
  **not** imply support for all fields, locators, payload properties, or workflows.
- There are 17 service leaves: 14 gated ReadOnly and 3 gated Update. `jobs status` and
  `builds list` use the same GET operation, which counts once. Authentication adds GET
  `/app/rest/users/{userLocator}`, restricted to `current`; it is not a general users API.
  Counting service leaves without auth instead gives 16/449 = 3.56%.
- `profile`, local `permissions`, help, version, JSON output, and JSON-RPC are shared CLI
  features, not additional TeamCity REST operations. JSON-RPC reuses the same command tree.
  Our CLI has no arbitrary REST passthrough command.
- Availability here means advertised by the server schema, **not** executable with the current
  token. Administration/mutation privileges were not exercised.
- GET versus non-GET is a mechanical reporting split, not a proposed permission policy. A GET
  that returns secrets or sensitive administration data must not automatically become a default
  ReadOnly command. Existing auth is also a shared capability, not a permission-gated service leaf.
- Undocumented UI routes, API versions other than this snapshot, and endpoints outside the
  Swagger inventory are outside the denominator. For example, a build-log download workflow
  using `/downloadBuildLog.html` is an additional product gap, not one of the 432 rows.
- This metric is not test coverage or a percentage of useful user scenarios. Equal weighting
  gives a field-specific accessor the same weight as creating an entire project.

## Reproducible inventory

- [api-inventory.csv](api-inventory.csv): all 449 operations; filter `cli_exposed=false` for the
  complete 432-operation gap list. Method/path/group/operation ID/deprecation are projected from
  Swagger; the accounting category and exposure flag are computed.
- [cli-map.csv](cli-map.csv): the separate source-reviewed mapping and limitations of the 17
  exposed routes. The exposure flag above is an exact join against this mapping.
- [scope.toml](scope.toml): frozen universe, identity, and rediscovery procedure.
- [implementation-ledger.md](implementation-ledger.md): verification and audit close-out.

Neither file contains a server hostname, credentials, resolved entity IDs, or real response data.

## Coverage by API group

Read and Update columns show **exposed / available**, using the accounting split above.
Groups use Swagger tags, so some project-specific routes belong to VersionedSettings rather
than Project.

| API group | Available | GET | Update | Exposed total | Missing | Coverage |
|---|---:|---:|---:|---:|---:|---:|
| BuildType | 109 | 2/49 | 0/60 | 2 | 107 | 1.83% |
| Build | 57 | 2/33 | 1/24 | 3 | 54 | 5.26% |
| Project | 48 | 2/22 | 0/26 | 2 | 46 | 4.17% |
| User | 28 | 1/11 | 0/17 | 1 | 27 | 3.57% |
| Server | 18 | 1/14 | 0/4 | 1 | 17 | 5.56% |
| VcsRootInstance | 17 | 0/11 | 0/6 | 0 | 17 | 0.00% |
| VersionedSettings | 16 | 0/7 | 0/9 | 0 | 16 | 0.00% |
| Group | 16 | 0/7 | 0/9 | 0 | 16 | 0.00% |
| Agent | 15 | 2/9 | 0/6 | 2 | 13 | 13.33% |
| BuildQueue | 15 | 1/6 | 2/9 | 3 | 12 | 20.00% |
| AgentPool | 14 | 0/5 | 0/9 | 0 | 14 | 0.00% |
| VcsRoot | 14 | 0/7 | 0/7 | 0 | 14 | 0.00% |
| Change | 10 | 1/10 | 0/0 | 1 | 9 | 10.00% |
| CloudInstance | 10 | 0/6 | 0/4 | 0 | 10 | 0.00% |
| DeploymentDashboard | 9 | 0/4 | 0/5 | 0 | 9 | 0.00% |
| Role | 8 | 0/2 | 0/6 | 0 | 8 | 0.00% |
| Investigation | 6 | 0/2 | 0/4 | 0 | 6 | 0.00% |
| Mute | 6 | 0/2 | 0/4 | 0 | 6 | 0.00% |
| Node | 6 | 0/5 | 0/1 | 0 | 6 | 0.00% |
| Root | 4 | 0/4 | 0/0 | 0 | 4 | 0.00% |
| Avatar | 4 | 0/2 | 0/2 | 0 | 4 | 0.00% |
| health | 4 | 0/4 | 0/0 | 0 | 4 | 0.00% |
| Audit | 2 | 0/2 | 0/0 | 0 | 2 | 0.00% |
| ProblemOccurrence | 2 | 1/2 | 0/0 | 1 | 1 | 50.00% |
| Problem | 2 | 0/2 | 0/0 | 0 | 2 | 0.00% |
| Server Authentication Settings | 2 | 0/1 | 0/1 | 0 | 2 | 0.00% |
| Global Server Settings | 2 | 0/1 | 0/1 | 0 | 2 | 0.00% |
| TestOccurrence | 2 | 1/2 | 0/0 | 1 | 1 | 50.00% |
| Test | 2 | 0/2 | 0/0 | 0 | 2 | 0.00% |
| AgentType | 1 | 0/1 | 0/0 | 0 | 1 | 0.00% |

Only 10 of 30 groups are touched. That does not mean 33% functional coverage: most touched
groups have only one or two routes exposed.

## What is implemented

| REST operation | CLI entry point | Implemented scope |
|---|---|---|
| `GET /app/rest/agents` | `agents list` | Connection/enabled/authorization filters and one bounded page |
| `GET /app/rest/agents/{agentLocator}` | `agents show <id>` | Positive numeric ID and selected fields |
| `GET /app/rest/buildQueue` | `queue list` | Job/project filters and one bounded page |
| `POST /app/rest/buildQueue` | `jobs run <id>` | Build configuration ID plus optional branch/comment only |
| `POST /app/rest/buildQueue/{queuedBuildLocator}` | `queue cancel <id>` | Cancellation with optional comment; readdIntoQueue=false |
| `GET /app/rest/buildTypes` | `jobs list` | Direct project filter and one bounded page |
| `GET /app/rest/buildTypes/{btLocator}` | `jobs show <id>` | ID locator and selected fields |
| `GET /app/rest/builds` | `builds list`; `jobs status <id>` | Selected locators and one bounded page; latest-build convenience query |
| `GET /app/rest/builds/{buildLocator}` | `builds show <id>` | Positive numeric ID and selected fields |
| `POST /app/rest/builds/{buildLocator}` | `builds cancel <id>` | Cancellation with optional comment; readdIntoQueue=false |
| `GET /app/rest/changes` | `builds changes <id>` | Build-scoped; one bounded page |
| `GET /app/rest/problemOccurrences` | `builds problems <id>` | Build-scoped; one bounded page |
| `GET /app/rest/projects` | `projects list` | Parent/archive filters and one bounded page |
| `GET /app/rest/projects/{projectLocator}` | `projects show <id>` | ID locator and selected fields |
| `GET /app/rest/server` | `server status` | Selected server fields |
| `GET /app/rest/testOccurrences` | `builds tests <id>` | Build-scoped; optional status; one bounded page |
| `GET /app/rest/users/{userLocator}` | `auth status / auth login / profile configure` | Only the current-user locator, for token validation |

All collection commands return one bounded page via `--limit` / `--start`, not an automatic
all-pages traversal. Selected response fields and exposed filters are fixed in the integration.

## Missing capabilities, ordered by practical value

### 1. Create and configure a working project/job

**Projects:** creation, deletion, field updates (including name/archive), moving between parents,
project parameters/features, templates, agent-pool associations, and ordering.

Representative missing operations:

- `POST /app/rest/projects`
- `DELETE /app/rest/projects/{projectLocator}`
- `PUT /app/rest/projects/{projectLocator}/{field}`
- `PUT /app/rest/projects/{projectLocator}/parentProject`

No Project Update operation is exposed: **0/26**.
[Project API reference](https://www.jetbrains.com/help/teamcity/rest/projectapi.html).

**Build configurations (our jobs):** create/delete/move/edit/pause; steps, triggers, parameters,
output-parameters, build features, templates, agent requirements, VCS root entries/checkout rules,
snapshot dependencies, and artifact dependencies.

Representative missing operations:

- `POST /app/rest/buildTypes`
- `POST /app/rest/projects/{projectLocator}/buildTypes` (another documented creation route)
- `DELETE /app/rest/buildTypes/{btLocator}`
- `POST /app/rest/buildTypes/{btLocator}/move`
- `PUT /app/rest/buildTypes/{btLocator}/{field}`
- collection/item operations under `steps`, `triggers`, `parameters`, `features`,
  `snapshot-dependencies`, and `artifact-dependencies`

No BuildType Update operation is exposed: **0/60**.
[BuildType API reference](https://www.jetbrains.com/help/teamcity/rest/buildtypeapi.html).

**VCS and versioned settings:** VCS root CRUD/properties, root instances, pending-change checks,
versioned settings configuration/status/load/commit. All three groups are absent: **0/47**.
Explicitly requesting a check is not automatically ReadOnly:
`POST /app/rest/vcs-root-instances/checkingForChangesQueue` and
`POST /app/rest/projects/{locator}/versionedSettings/checkForChanges` initiate work.
These methods are in the snapshot inventory.

### 2. Complete the build-launch workflow

`jobs run <id>` already sends `POST /app/rest/buildQueue` with a build-configuration ID and
optional branch/comment. Missing options on that **already counted** operation include:

- custom build parameters (`properties`);
- a selected agent and personal-build mode;
- pinned VCS revisions;
- clean checkout, dependency rebuilds, and queue-at-top triggering options;
- explicit selection/reuse of dependency builds.

Triggering the final configuration of an already configured chain already follows TeamCity's
normal dependency behavior; the gaps are authoring chains and advanced launch controls, not
basic chain triggering itself.
[Build launch and cancellation reference](https://www.jetbrains.com/help/teamcity/rest/start-and-cancel-builds.html).

Both cancellation commands force `readdIntoQueue=false`; restoring a cancelled build is not
exposed, even though it can use the same cancellation route.

**Queue management:** detail/compatible-agent/approval reads, reordering, pause/resume, approval,
and queued-build tags. Examples: `PUT /app/rest/buildQueue/pausedState` and
`POST /app/rest/buildQueue/{buildLocator}/approve`.
[BuildQueue API reference](https://www.jetbrains.com/help/teamcity/rest/buildqueueapi.html).

### 3. Read enough evidence to diagnose and manage builds

Missing reads include artifacts (listing, metadata, download), statistics, dependency information,
resulting/output parameters, individual tests/problems/changes and richer associated details.
Build log retrieval is also missing, with the separate denominator caveat above.

Missing updates include comments, tags, pin/unpin, deletion, and bulk build operations.
Examples: `PUT /app/rest/builds/{buildLocator}/comment`,
`POST /app/rest/builds/{buildLocator}/tags`,
`PUT /app/rest/builds/{buildLocator}/pinInfo`,
`DELETE /app/rest/builds/{buildLocator}`.
[Build API reference](https://www.jetbrains.com/help/teamcity/rest/buildapi.html).

Investigations and mutes are completely absent: **0/12**, including both reads and mutations.

### 4. Operate build infrastructure

Agent enable/disable, authorize/unauthorize, pool assignment, pool CRUD, and cloud-instance lifecycle
are missing. Existing `agents list/show` only inspect selected fields.

For example: `PUT /app/rest/agents/{agentLocator}/enabledInfo` and
`PUT /app/rest/agents/{agentLocator}/authorizedInfo`.
[Agent API reference](https://www.jetbrains.com/help/teamcity/rest/agentapi.html).

### 5. Separate administrative and sensitive capabilities

User/group/role administration, token lifecycle, server/global/auth settings, backup and cleanup
configuration, license management, audit, nodes, health, and deployment dashboards are absent
apart from current-user authentication and basic server status.

Recommendation, not an implemented contract: review custom categories such as `Administration`
and `Secrets` before exposing these operations. In particular,
`GET /app/rest/projects/{projectLocator}/secure/values/{token}` retrieves a decrypted value;
calling it a GET does not make it suitable for default ReadOnly access.
[Secure-value API documentation](https://www.jetbrains.com/help/teamcity/rest/projectapi.html).

## Verification and safety

- Rebuilt the local packages.
- Exercised every service leaf plus `auth status` against an injected fetch boundary and
  synthetic in-memory profile/secret stores: **18 successful calls, 17 unique Swagger matches**.
- Exercised all three Update commands with Update disabled: each rejected before fetch.
  The probe disabled real network access; **zero live mutations**.
- `npm test`: **42 passed** (14 Core + 28 TeamCity). An initial sandbox run could not spawn
  Node test subprocesses (`EPERM`); the permitted retry passed.
- Live evidence used only schema retrieval and a read-only server-version check. The server
  address, keyring secret, and raw server response were not saved in these artifacts.
- Source code, user profiles, permission settings, and GitHub Issues were not changed.
  This audit is not a live integration proof of every operation or permission.

## Suggested implementation sequence

These are follow-up candidates, not newly approved scope:

1. A useful project-authoring slice: create a project and job, attach VCS, configure a minimal
   step/parameters, inspect the resulting configuration.
2. Advanced launch controls and queue management.
3. Artifacts/logs/statistics and build annotations for debugging.
4. Agent/pool/cloud operations; investigations/mutes.
5. Administration and secret-bearing operations behind separately reviewed gates.

Each implementation slice should have its own bounded Issue/acceptance inventory, shared
profile/auth/permission mechanisms, offline network-boundary tests, and explicit local ReadOnly
proof. No real Update operations should be added to that proof.
