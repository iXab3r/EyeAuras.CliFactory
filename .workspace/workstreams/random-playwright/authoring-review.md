# Corrective slice: authoring and simplicity review

Date: 2026-08-31. Scope: the two existing RANDOM.ORG read operations, no new API inventory.
Baseline: the uncommitted runtime/observation slice over 40c265b, recorded in review-plan.md.
Reviewer/implementer: root (single-agent review, not an independent second review).

## Equivalent capability comparison

Both clients still provide integers and sequence, identical DTO/help/RPC declaration, profile
permissions, a per-profile quota check/backoff, no automatic retry and offline boundary tests.
Only PW owns browser/forms; only the shared service package knows RANDOM.ORG policy.

- Each bin now has seven nonblank lines: imports and runHosted with entryPoint/createDefinition.
  Application identity, build hashing and built-in forwarding are no longer author responsibilities.
- Both definition factories can also be passed to createCli for embedded tests. Definitions
  create lazy resources, never launch browsers or fetch during construction.
- resources: [browser, profiles] replaces dispose/profile-change forwarding. Resources are
  concrete owners, not a registration/lookup container.
- Invocation clients receive their signal and resolved browser options normally. The former
  per-method proxy wrappers and maps of whole clients are gone.
- RandomProfiles retains only real service-session state (request serialization/quota cooldown)
  per profile/config identity. Profile invalidation is automatic; selectors, validation and
  service postconditions stay explicit. randomProfile removes duplicated fields/validation.

The added author-visible concepts are the flat resource contract and a definition factory
(the definition already existed). Build readiness is one repository workflow: root npm run build.
No additional package dependency, public scope, DI, generic HTTP/client cache, configurable
transport or method-generation layer was added.

## Counted cost, not only shorter handlers

Method: nonblank handwritten TypeScript, comments included, normal formatting. Exact source
roots below; exclude IPC src/generated and random-common/src/{proof,live-cases}.ts. The latter
two belong to test/proof support. TeamCity is unchanged by this corrective slice and excluded
from both sides. Generated output and MJS are reported separately.

| Surface | Before | After | Delta |
|---|---:|---:|---:|
| packages/core/src | 2289 | 2490 | +201 |
| packages/ipc/src, excluding generated | 869 | 1110 | +241 |
| packages/playwright/src | 536 | 574 | +38 |
| integrations/random-common/src, excluding proof/live-cases | 189 | 272 | +83 |
| integrations/random-rest/src | 285 | 226 | -59 |
| integrations/random-pw/src | 278 | 188 | -90 |
| Total product TS | 4446 | 4860 | +414 |
| Tests/proof support | 3999 | 4826 | +827 |
| Generated IPC TS | 130 | 130 | 0 |

Test/support roots: packages/{core,ipc,playwright}/tests,
integrations/{random-rest,random-pw}/{tests,integration-tests}, and the two shared proof files.
New scripts/build.mjs: 52 nonblank MJS. Existing Windows launcher patch: 41, unchanged.
The common proof runner remains outside product counts; no generated/proof code is hidden to
make application code appear smaller.

The two integrations alone shrink by 149 lines. Including their new shared profile/state code,
the service layer shrinks from 752 to 686 (-66). Foundation TS grows by 480 to enforce input
bounds, safe disposal, resource ownership and build compatibility. Total product TS grows by
414 (~9.3%), plus the 52-line shared build script. This is not a claim of global code reduction:
the verdict weighs fewer per-consumer failure-prone obligations against the centralized safety cost.

## Deliberate tradeoffs and boundaries

- Build identity uses the whole supported npm workspace, not a transitive module resolver.
  Adding a workspace needs normal package dependencies, not a second handwritten module list.
  Unrelated built CLI changes invalidate a host too; startup rehashes deployed artifacts.
  Five local validation samples were 30/22/20/20/25 ms, not a cross-platform performance claim.
  Locked dependency contents are assumed immutable except declared patched runtime inputs.
  Arbitrary packagers/external symlink layouts remain unsupported.
- Browser disposal owns cancellation and video draining. After a five-second operation-drain
  timeout it closes browser resources and returns an error. Custom callbacks and OS I/O must
  still terminate; this is not a process-tree reaper or absolute shutdown-time guarantee.
- Core admission is based on the parsed command and current profile/policy. Interactive
  onboarding can re-enter the exclusive gate before effects; the service handler is never retried.
- Direct ProfileStore edits bypass CLI lifecycle hooks by design. Core commands are the normal
  profile mutation path; embedding code must coordinate its own lower-level mutations.
- Control operations use protocol compatibility, while Run also requires matching current build.
  Earlier hosts that checked build on Stop need the previous executable for their one-time stop.
  No compatibility branch or automatic deletion of user data is retained.

Verdict: pass for the current two-operation slice, subject to the final evidence in review-ledger.md.
The service layer and new-app entry point are smaller; the runtime accepts an explicit, measured
increase for reliability. Reconsider a more elaborate build pipeline only for a real consumer
outside this npm workspace, not speculatively.

## Second-review P2 checkpoint

Date: 2026-08-31. The table above remains the first correction's dated baseline. The four approved
P2 changes and their final gate are tracked in [review-p2.md](review-p2.md). Same two commands,
same CLI outputs/profile isolation, no new operations or dependencies. Single-agent self-review.

| Surface | Prior correction | P2 result | Delta |
|---|---:|---:|---:|
| Core source | 2490 | 2511 | +21 |
| IPC source, excluding generated | 1110 | 1219 | +109 |
| Browser source | 574 | 574 | 0 |
| RANDOM common product source | 272 | 272 | 0 |
| REST source | 226 | 226 | 0 |
| PW source | 188 | 188 | 0 |
| Total product TS | 4860 | 4990 | +130 |
| Tests/proof support | 4826 | 5186 | +360 |
| Generated IPC TS | 130 | 130 | 0 |

Counts use the identical nonblank handwritten-TS method/roots above. Existing MJS scripts are
unchanged; no new script, dependency, transport, protocol message, service scope or DI facility.
The shared cost grows 130 lines (~2.7% of product source), primarily safe startup classification
and validation/cleanup. This is not a claim of global source reduction.

Author benefit: token env is declared once in tokenAuth, not duplicated in hosted bootstrap;
custom inputs live in the definition/auth module that consumes them. Bootstrap remains seven
nonblank lines in each example. Browser auth can omit passive readiness; a handler owns its
actual auth checks rather than duplicating active status before every command. Optional isReady
is only needed for an app that can provide a local preflight; tokenAuth provides it automatically.
Status no longer has two modes selected by a boolean. Profile logout no longer requires working
around premature resource invalidation. Foreground Core construction catches invalid declarations
without a separate public validation API, and private child exit codes expose safe failure phases
without teaching application authors another IPC/lifecycle protocol.

Verdict: pass for this bounded correction. The canonical guide includes the clean API migration;
the unrelated P3 new-integration guide cleanup remains deferred by the approved scope.

## Third-review P2 checkpoint

Date: 2026-08-31. Scope/evidence: [review-p2-round3.md](review-p2-round3.md), same two RANDOM
operations and unchanged integration source/entry points. No additional authoring concepts,
dependencies, scripts or public interfaces. Root self-review, not independent delegation.

Using the identical count method, Core source grows 2511 -> 2515 (+4); IPC stays 1219, browser 574,
common product 272, REST 226 and PW 188. Product total 4990 -> 4994 (+4). Tests/support grow
5186 -> 5422 (+236); generated IPC remains 130. MJS scripts are unchanged.

The net four product lines correct framework routing/selection instead of asking consumers for
custom workarounds. The shared Commander declaration detects actual RPC option use; no alternate
argv parser was added. Existing global-option parsing still requires attached --option=value
syntax for values equal to a global flag. Control ignores irrelevant launch limits, help does
not require auth storage, and profile show uses the already-resolved context. Verdict: pass for
authoring simplicity; full verification is recorded in the round's evidence file.

## Autonomous review/fix checkpoint

Date: 2026-08-31. Scope/evidence: [review-fix-loop.md](review-fix-loop.md). Same two service
operations, public APIs, entry points and dependencies. Three correction passes followed by a
clean focused self-review of modified IPC paths; no independent reviewer is claimed.

Identical nonblank handwritten TS count: Core 2515, IPC 1280, browser 574, common product 272,
REST 226, PW 188. Product total 5055 versus 4994 (+61, about 1.2%); all growth is internal IPC
ownership and stream handling. Tests/proof support 5780 versus 5422 (+358); generated IPC 130,
unchanged. MJS scripts and integration source remain unchanged.

The internal writer is shared by relay and host diagnostics, removing duplicate reporting code.
Owner metadata already contains generation identity; recovery uses it without a new persistent
schema or public scheduler. Losing foreground callers retire only their own unused child. Authors
need no process-global stream handlers, restart coordination, new flags, or lifecycle glue.
Verdict: acceptable centralized reliability cost with zero additional authoring concepts. The
existing integration-guide cleanup and external issue/publication work remain outside this loop.

## Simplification checkpoint

Date: 2026-08-31. Owner-approved scope and evidence: [simplification.md](simplification.md).
Same two service operations and same standalone/hosted/browser capabilities. Root self-review,
not independent delegation. The previously deferred author-guide cleanup is now included.

| Surface | Before | After | Delta |
|---|---:|---:|---:|
| Core handwritten source | 2515 | 2391 | -124 |
| IPC handwritten source | 1280 | 1299 | +19 |
| Browser source | 574 | 574 | 0 |
| RANDOM common product source | 272 | 295 | +23 |
| REST source | 226 | 215 | -11 |
| PW source | 188 | 178 | -10 |
| Total product TS | 5055 | 4952 | -103 |
| Tests/proof support (same historical roots) | 5780 | 5901 | +121 |
| Generated IPC TS | 130 | 130 | 0 |

Counts retain the identical nonblank/comment-inclusive method above after normal formatting.
No new MJS script or dependency. TeamCity production is unchanged; its support.ts separately drops
153 -> 104 nonblank lines (-49), and ordinary CLI tests now pass TestContext for temporary-storage
cleanup. These TeamCity test files are outside the historical test-count roots. Formatting changes
and added boundary/process assertions explain why total counted tests did not shrink.

The primary gain is one command-construction path instead of two, not just file movement. Core
cli.ts falls from 1024 to 494 physical lines; the cohesive profile/auth module has 348. IPC host.ts
falls from 661 to 195, with server lifecycle 258 and frontend 170. IPC's total +19 lines are explicit
module/import boundaries, not new runtime behavior or author-facing settings. Shared result parsing
removes duplicated rules; its combined common + clients cost is +2 lines rather than a size saving.

Author entry points remain seven nonblank lines for each hosted RANDOM example. No dispatcher,
build hash list, disposal forwarding or new abstraction is required. A normal app still imports
only Core, and the guide demonstrates that path before IPC/PW opt-ins. runHosted adds explicitly
named ipc-server commands without occupying the service's server namespace. Accidental transport
exports are removed instead of retained as compatibility aliases. Verdict: pass; less product code
(-103, about 2%) and fewer mechanisms, with all 171 offline regressions passing.
