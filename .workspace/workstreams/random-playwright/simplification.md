# Owner-approved simplification pass

Status: locally complete. Role: Reconciliation Lead + Core maintainer + integration author.
Scope: owner conversation approval; issue #11 remains the publication owner. Remote issue
synchronization is pending (previous connector access returned 403). No commit/push requested.

## Baseline and scope

Baseline: 169 passing offline tests on Windows/Node 24.4.1. Product handwritten nonblank TS:
Core 2515, IPC 1280, browser 574, RANDOM common 272, HTTP 226, PW 188; total 5055.
Tests/proof support 5780 separately; generated IPC 130 excluded. Largest physical source files:
Core cli.ts 1024, IPC host.ts 661, browser index.ts 483. Preserve prior correctness evidence.

| Work | Acceptance | State |
|---|---|---|
| Optional IPC boundary | Core and standalone apps remain independent; server lifecycle and frontend separated; no mutable placeholder handlers | Complete |
| Explicit ipc-server commands | Service-owned server coexists, management never starts a process, no legacy alias | Complete |
| One Core command tree | Profile/auth/permissions use the same declaration and adapter as service commands; preserve ordering and exclusive mutations | Complete |
| Small concrete simplifications | Share RANDOM result parser, remove accidental IPC exports, typed browser queue errors, real profile persistence in ordinary fixtures | Complete |
| Author guide and closure | Minimal standalone recipe first, IPC/PW opt-in; focused tests, npm test, self-review and total source-cost reconciliation | Complete |

Do not add scopes, plugins, DI, a generic scheduler/HTTP client or an alternative legacy path.
Keep lease/generation ownership, stream backpressure, build identity and browser scheduling
safety. Existing profile data is not removed or migrated silently. The old IPC management root
is replaced, not aliased; TeamCity's service-owned server root is unchanged.

## Result and self-review

- Core uses ordinary command declarations for all profile/auth/permission leaves and one Commander
  adapter. Profile configuration/auth live in profile-commands.ts; permission commands live with
  their policy code. Parsed declarations select admission, not argv text. The trivial dispatch
  alias, duplicate manual Commander tree, and unreachable empty-argv help fallback are removed.
- IPC is opt-in and independent of Playwright. host.ts composes the application and handles failure
  cleanup; client.ts owns remote discovery/control/relay; server.ts keeps lease/generation, admission,
  idle and shutdown together. Endpoint and command helpers are private. Management handlers bind
  directly to local or remote controls, with no throwing placeholder or later reassignment.
- ipc-server replaces the old management name. Service-owned server status coexists in standalone,
  hosted and JSON-RPC usage. Public package exports contain only runHosted/HostedCliOptions; deep
  imports are blocked. The protocol and existing owner metadata remain unchanged.
- The two RANDOM clients share strict integer-result validation, while their boundary-specific
  limits/errors remain explicit. Browser queue errors use the existing sanitized error class rather
  than message comparison. Core/TeamCity ordinary fixtures use real isolated ProfileStore instances,
  not a second implementation; in-memory secret stores intentionally avoid the OS keyring in tests.
- The author guide begins with a complete standalone definition/entry point and separately adds
  IPC and browser automation. Automatic workspace builds and the clean command migration are documented.

No new public Core concept, resource scope, plugin system, dependency, service operation or generic
scheduler was introduced. BrowserRuntime remains cohesive rather than being split solely for line
count. Core and browser admission queues retain different responsibilities. Whole-workspace build
identity and lease/backpressure safeguards remain deliberate reliability costs.

## Verification

The new optional-IPC regression was observed failing before the implementation (management
incorrectly required a build). A preliminary IPC process run after an isolated Core rebuild failed
closed on the stale whole-workspace manifest; a root rebuild corrected that test setup. It was not
worked around by weakening compatibility checks.

Focused Core 51, IPC 31 and TeamCity 35 passed. Final root npm test: **171 passed**, zero failures,
cancellations or skips: Core 51, IPC 31, browser 23, PW 6, HTTP 25, TeamCity 35. This includes real
hidden Windows helper processes/Chromium, profile isolation, stream/cancellation races and the new
service-root plus tunneled-management regression. The complete suite passed again after the final
Core fallback/export cleanup. Additional package-boundary checks confirm Core has no IPC/PW/gRPC
dependency and internal IPC imports fail with ERR_PACKAGE_PATH_NOT_EXPORTED.

The final packaged PW fixture observed one warm baseline browser and three launches including
mode switches, all reaped by stop. Synthetic cold/warm times (~752/666 ms) are fixture evidence,
not a service benchmark. No live RANDOM.ORG calls, captures or personal profiles were used here.
Post-suite process inspection found zero remaining worktree-owned IPC server processes.
Git diff --check passed (existing .gitignore line-ending warning only). Existing uncommitted changes
remain uncommitted; the main checkout was not changed. Remote issue sync/publication remain pending.

See the [authoring checkpoint](authoring-review.md#simplification-checkpoint) for total source cost.
