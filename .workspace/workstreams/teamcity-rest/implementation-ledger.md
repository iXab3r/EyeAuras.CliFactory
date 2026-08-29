# TeamCity REST expansion — implementation ledger

**Lifecycle:** complete
**Feature spec:** [GitHub Issue #1](https://github.com/iXab3r/EyeAuras.CliFactory/issues/1)

| Phase | Scope | Status | Agent | Review |
|---|---|---|---|---|
| 0 | Foundation baseline | done | service integration author | passed |
| 1 | Discovery and baseline correction | done | service integration author | passed |
| 2 | Operational reads | done | service integration author | passed |
| 3 | Controlled updates | done | service integration author | passed |
| 4 | Delivery hardening | done | service integration author | passed |

## Phase 0 — foundation baseline

Implementation evidence:

- `integrations/teamcity/src/cli.ts` exposes profile-aware auth and `jobs list/show/status`.
- `integrations/teamcity/tests/client.test.ts` exercises bearer requests, locators, empty build
  status, credential-safe errors, and CLI JSON through MSW.
- Core tests prove command/JSON-RPC reuse and profile isolation.
- Commit `ab33fa0` passed GitHub Actions on Windows, macOS, and Linux with Node 22 and 24:
  <https://github.com/iXab3r/EyeAuras.CliFactory/actions/runs/33256576311>.

Review verdict: **passed**. The baseline is real and reusable; broader TeamCity REST coverage is
not implied.

Safety follow-up review: **passed** on 2026-08-29. The permission gate is enabled for TeamCity and
all existing jobs leaves declare `ReadOnly`. Core evidence proves default read access, denied
`Update` before handler execution, explicit grant, and profile isolation. Full `npm test`: 9 passed.

## Phase 1 — discovery and baseline correction

Started on 2026-08-29 from the frozen contract in Issue #1. The implementation boundary is
explicit: reusable CLI/profile/auth/permission/output behavior stays in `packages/core`; TeamCity
DTOs, locators, fields, pagination limits, REST paths, and operational filter semantics stay in
`integrations/teamcity`.

Discovery evidence: the target's public login page reports TeamCity 2026.1.3. Its public
`/app/rest/swagger.json` reports `TeamCity REST API`, Swagger 2.0, version `2026.1 (current)`, and
confirms the selected GET/POST resource paths. The guest REST `apiVersion` endpoint also returned
`2026.1`. Authenticated data reads could not run because no `TEAMCITY_TOKEN` or OS-stored credential
is available in this workspace; the added opt-in smoke is the executable authenticated evidence
path and has no credential fallback.

Implementation evidence:

- `TeamCityClient` now requests the frozen minimal fields and exact bounded locators for server,
  projects, jobs, and current-user validation.
- The `jobs status` regression asserts `defaultFilter:false,branch:default:any,count:1`, including
  a latest failed non-default-branch build.
- CLI tests exercise generated help and representative human/JSON reads through the real handlers.
- Focused TeamCity suite passed after review; credentials are redacted even if a remote error body
  echoes the token.

Review verdict: **passed**. Target Swagger and implementation agree on the chosen REST families;
the authenticated smoke remains explicit and read-only.

## Phase 2 — operational reads

Implementation evidence:

- Added bounded build list/show/tests/problems/changes, queue list, and agent list/show client and
  command paths. TeamCity locator encoding, pagination, DTOs, and the `commiter` normalization stay
  integration-local.
- MSW tests verify exact methods, paths, locators, requested fields, empty collections, pagination
  bounds, malformed JSON, 401, and 404 behavior.
- Artifact/log/admin surfaces remain absent as required by Issue #1.

Review verdict: **passed**. The core package contains no TeamCity resource vocabulary or REST
abstraction.

## Phase 3 — controlled updates

Implementation evidence:

- Added `jobs run`, `builds cancel`, and `queue cancel` with exact JSON bodies and stable-ID
  targeting.
- A table-driven CLI test proves all three fail at the `Update` gate before `fetch`, then issue
  exactly one request after an explicit profile-specific grant.
- Separate profiles prove URL, token, and permission isolation; remote conflict errors remain
  credential-safe. There are no live mutation tests.

Review verdict: **passed**. `ReadOnly` and `Update` are sufficient; no custom category was added.

## Phase 4 — delivery hardening

In progress evidence:

- Added a compiled-process test for root/nested help, permission help, JSON stdout, stderr, and exit
  codes.
- Added an opt-in read-only live smoke for auth/server/projects/jobs/builds/queue/agents.
- Added the TeamCity operating guide and synchronized root/testing documentation.
- A general Commander 14 root-help exit-code defect, proven by this consumer, was fixed in
  `packages/core` with a core regression test. No TeamCity concept moved into core.
- Local repository-wide `npm test` passed; the only skipped test is the documented opt-in live
  smoke because this workspace has no TeamCity credential.

Final verification:

- implementation commit: [`9c9b35e`](https://github.com/iXab3r/EyeAuras.CliFactory/commit/9c9b35eff3e079ea9254578a7a2d06605f515440);
- GitHub Actions: [run 33260409427](https://github.com/iXab3r/EyeAuras.CliFactory/actions/runs/33260409427), all six Windows/macOS/Linux × Node 22/24 jobs passed;
- staged diff check and credential-pattern scan passed; generated `dist` output and raw discovery
  payloads were not committed.

Review verdict: **passed**. Public docs match the shipped tree and all local/CI default gates are
green.

## Close-out

Delivered outcomes:

- 14 `ReadOnly` and three `Update` TeamCity leaves complete the Issue #1 operational loop;
- the TeamCity product references the common `@eyeauras/cli-factory` npm package while all service
  paths, locators, DTOs, and filters remain integration-local;
- deterministic MSW, CLI/profile/auth/permission/JSON-RPC, process, and opt-in live-smoke evidence
  is in place.

Known product failures: **none**.

External evidence note: the authenticated live smoke was not executed in this workspace because
no credential was available. It is intentionally skipped by default, documented, and executable
with external environment inputs. Public target discovery confirmed the REST 2026.1 contract.

Deferred candidates remain those explicitly excluded by Issue #1: artifacts/logs, workflow and
administrative mutations, raw REST, streaming, OAuth, `CliWrap.ts`, and npm publishing. They need
separate Issues before implementation.

## Next action

No workstream action remains. Close Issue #1 after linking this close-out; create separate Issues
for any deferred candidate selected next.
