# Third review: four approved P2 corrections

Status: locally complete and verified. Owner approved all four findings in the task. Parent scope: issue #11;
external synchronization remains pending after the recorded connector 403, with no bypass.
Baseline: 155 passing tests, product TS 4990, tests/support 5186. No commit/push, live service,
delegation or previously deferred P3 guide cleanup is authorized. Preserve all existing dirty work.

| Phase | Scope | Status | Review |
|---|---|---|---|
| R3-A | Regression evidence for control limits, selected profile, literal RPC flag and root help | done | root: all five regressions failed before implementation |
| R3-B | Local Core/host fixes, no new public authoring API | done | root: five focused regressions pass |
| R3-C | Docs, full regression and authoring-cost reconciliation | done | root: pass, 160-test gate, docs/cost/cleanup verified |

Plan: first make the four isolated review reproductions durable tests, then fix only those paths.
Use Commander parsing for non-transport argv rather than another parser. Keep malformed actual
RPC mode requests rejected before handlers and preserve CLI exit code 2 for that misuse. Explicit
profile-show positional names override the selected profile; omission uses the resolved context.
Root help outside interactive onboarding does not need auth readiness. Host control ignores
launch-only idle/capacity limits; service Run still validates before build/spawn.

Evidence gate: Core CLI/execute/RPC parity and missing-secret-store tests, real-process control
with invalid limits and no owner resurrection, existing onboarding/admission regressions, final
root npm test, cleanup and source-cost comparison with unchanged integrations/dependencies.
Root is implementer and self-reviewer; do not claim independent review or external publication.

## Implementation evidence

- Profile show uses context.profile when name is omitted; explicit names still use the store.
  Tests compare CLI JSON, execute and RPC with default, suffix/prefix --profile and explicit-name
  override. No integration-specific profile handling was added.
- Only the sole RPC flag enters runJsonRpc. Commander option events reject actual mixed uses
  before handlers, preserving CLI exit code 2 and rejecting nested mode through execute/RPC too.
  Positional data after -- and attached --value=--json-rpc have equal semantics across all paths.
  Separate-token values matching global options already fail under Commander's parent parsing;
  this slice documents the attached-value syntax, not a replacement global-option parser.
- Noninteractive/programmatic/RPC root help bypasses profile/auth storage. A throwing synthetic
  keyring proves no readiness reads occur for help, while the same store still rejects a service
  operation. Existing TTY onboarding remains covered by the full Core suite.
- Host management bypasses launch-only limit validation. Process tests cover absent and live
  owners, invalid idle and capacity, refusing service work under invalid limits, and stopping the
  exact existing owner. Build tests combine invalid limits with a missing manifest and verify
  resource disposal. Control does not spawn a replacement owner.

Focused red gate: 4 Core tests and 1 real-process host test failed for the reviewed reasons.
Focused green gate: all 5 passed after the local changes. Canonical DESIGN, runtime and testing
guides describe the corrected behavior. Source delta: Core 2511 -> 2515; all other product roots
unchanged. Total product TS 4990 -> 4994 (+4); tests/support 5186 -> 5422 (+236); generated IPC
130 unchanged. Counts use the established authoring-review method. No new dependency/public API.

## Final verification and handoff

Root npm test passed on Windows / Node 24.4.1: Core 51, IPC 20, BrowserRuntime 23, random-pw 6,
random-rest 25, TeamCity 35; total 160, zero failures/cancellations/skips. Five new regression
tests supplement the prior 155-test baseline. No real service/network proof was run; browser
traffic and process data were synthetic. Existing real headed/video, token onboarding, quota,
concurrency and packaged browser shutdown regressions remain green.

Final read-only OS inspection found zero worktree internal hosts. No non-ignored webm/har/auth-state
artifacts were added. Tests cleaned only their synthetic temporary files; no user data was removed.
git diff --check passed (existing .gitignore line-ending warning only), staged diff empty. This is
local evidence, not a pre-commit privacy gate, commit, push, merge or publication.

All four approved P2 are complete; known failing tests: none. Remaining exclusions: original P3
integration-guide cleanup, a general Commander global-option parsing overhaul, and issue #11
synchronization/publication. Existing caller syntax for global-like option values is documented
as --option=value. No author-side adapters or reconfiguration are required; hosted builds follow
the ordinary rebuild/server-stop workflow. Earlier uncommitted work remains intact.
