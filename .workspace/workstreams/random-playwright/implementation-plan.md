# Playwright RANDOM.ORG and optional runtimes

Status: seven-phase baseline and browser observability extension implemented and locally verified.
The reliability corrections and owner-approved simplification are locally complete. Current
contract/evidence: [simplification.md](simplification.md) and [authoring-review.md](authoring-review.md),
171 tests. [review-fix-loop.md](review-fix-loop.md) retains the prior 169-test baseline. [review-p2-round3.md](review-p2-round3.md) retains the 160-test baseline;
[review-p2.md](review-p2.md) retains the previous round;
[review-plan.md](review-plan.md) and [review-ledger.md](review-ledger.md) retain the first
correction's evidence. Earlier phase evidence below is dated, not the latest count.
Role: Reconciliation Lead + Core maintainer + integration author. Owner/reviewer: root agent.
Scope and acceptance: [issue #11](https://github.com/iXab3r/EyeAuras.CliFactory/issues/11).
HTTP dependency: [issue #8](https://github.com/iXab3r/EyeAuras.CliFactory/issues/8), local commit
`40c265b`. Working branch: `codex/random-rest-cli`, worktree `EyeAuras.CliFactory-2`.

## Intended result

Two equivalent service CLIs, one direct HTTP and one real browser implementation. Both compose
the optional IPC host; only PW imports the optional browser module. Repeated shell invocations
reuse server-owned resources. Keep exactly the two accepted service commands, not the obsolete
three-command inventory in the earlier design draft. The issue owns detailed behavior.

## Baseline reconciliation

The committed HTTP slice passed 24 offline tests and four actual live cases; root verification
reported 14 Core and 28 TeamCity entries. The baseline embedded leaf-help early-exit limitation
is documented in the HTTP ledger and must be fixed/proven before embedding Core in a shared host.

At planning time this worktree's DESIGN described OS-only credentials and token-only authentication.
The main checkout contains the owner's accepted browser-state exception and broader planned
runtime design, but also unrelated uncommitted TeamCity/Core changes. Reconcile the selected
policy explicitly before public API work; do not copy or commit that checkout wholesale.

[Issue #9](https://github.com/iXab3r/EyeAuras.CliFactory/issues/9) has a reviewed local profile
case-collision correction on another branch. [Issue #10](https://github.com/iXab3r/EyeAuras.CliFactory/issues/10)
also changes Core types. Phase 1 resolves the dependency/merge strategy before persistence is
declared safe; this plan neither cherry-picks those commits nor authorizes unrelated integration
imports. Existing user profile data is never normalized or removed automatically.

## Ordered implementation phases

Each phase is a small reviewable change; do not advance on a claimed capability without its gate.

| Phase | Change and user-visible result | Evidence gate |
|---|---|---|
| 1 | Reconcile baseline/policy; qualify Windows grpc-js named pipes and Chromium form access | Ordinary-user local transport works with two client processes and assessed access controls; headless form/quota/result path known; exact dependencies and Core conflict strategy recorded |
| 2 | Core lifecycle and per-invocation execution | Idempotent async dispose, partial-init cleanup, independent streams/signals, no process exit from help/errors, safe profile-store updates; Core + existing consumers pass |
| 3 | Generated gRPC stdio relay without daemon orchestration | Real-process bidi Run tests: concurrent clients, binary/split UTF-8, EOF versus cancellation, bounded slow-reader buffers, final Exit/status, no output mixing or replay |
| 4 | Self-starting host, simple command limit and idle teardown | Single-owner startup race, build mismatch, stale recovery, 1/N/unbounded concurrency, queue cancellation/overflow, tunneled JSON-RPC, no active command killed by idle timeout |
| 5 | Optional PW owner and app-owned auth/state mechanics | Lazy headless Chromium, warm browser/profile contexts, operation-page cleanup, cancellation/crash handling; synthetic state restore/logout/profile isolation; real token consumer still works |
| 6 | Shared RANDOM.ORG declaration and two composed CLIs | Extract only actual shared code; PW fills forms/reads DOM; HTTP remains browser-independent; identical service contract and separate-process browser reuse |
| 7 | Acceptance and operating guide | Full deterministic suite, platform matrix, both fixed live proofs run sequentially, cold/warm timing evidence, zero owned processes after shutdown, simplicity/privacy review |

### 1. Resolve uncertainty before infrastructure

Use a minimal bounded qualification, not a general runtime prototype. On Windows, prove the
selected grpc-js `unix:` named-pipe path under a normal user; check actual spawned-child behavior
and access protection. Maintainer guidance is a starting point, not proof of permissions.
If local access cannot meet the contract with the selected stack, stop that phase and discuss
the narrow alternative; do not silently add TCP or a handwritten transport.

Provision a pinned Playwright/Chromium version explicitly. Inspect the two public forms and
quota page, establish selectors and wait conditions, and perform only bounded sequential reads.
Do not save a quota page/IP, full HTML, trace or random payload as a fixture. An unavailable
headless service or anti-bot challenge is an explicit finding, not permission to bypass it.
Unix qualification must run on its real platform before support is claimed.

### 2. Make Core safe to embed

Separate long-lived application state from invocation streams, signal and allowed caller context.
Handlers still return data; rendering stays server-side. Help/version/validation errors must not
exit the host. Profile mutations need an internal atomic read-modify-write owner, not just rename.
Do not expose a resource-scope framework.

An executable owner disposes in finally; embedded callers dispose after their last operation.
The server owns disposal until shutdown. Injected caller-owned streams/resources remain caller-owned.
Prove failure and concurrent-dispose behavior, not only the no-resource happy path.

### 3-4. Relay first, then process ownership

Implement the issue's small generated schema and strict frame-state checks. One Run is one CLI
invocation; an entire JSON-RPC session remains one Run. The frontend relays bytes and exit code
without parsing domain JSON. Cancellation affects only its invocation.

Then add host discovery/startup and the bounded application-wide command queue. Limit logical
commands, not connections: an idle JSON-RPC client must not consume an execution slot.
Use deterministic synchronization barriers for parallel tests, not timing guesses.
Same application identity across worktrees means shared AppData: detect incompatible builds,
do not hide concurrent writers behind checkout-specific endpoint names.

Status/stop must not start a host. Idle time begins after the final active Run/queued command;
an open channel or browser process alone does not count as activity. Choose and document actual
idle/startup/shutdown deadlines after the qualification measurements, not as performance promises.

### 5. Keep browser ownership and authorization separate

Start with one supported browser (Chromium), one warm browser per runtime and profile contexts.
Open/close a page for each operation; do not rebuild the browser after every command. Normal
shutdown closes owned pages, contexts and the browser. A browser-mode/config change must invalidate
the affected runtime explicitly; do not mix headed/headless assumptions in one browser.

The app decides login completion, identity and logout; the helper supplies state persistence.
Use a synthetic local login site to prove cookies/origin-state restore, safe checkpoint writes,
profile/config invalidation and logout versus in-flight state saves. Token auth becomes a helper
of the app-owned contract; migrate its actual consumer without parallel old/new public APIs.
The anonymous RANDOM.ORG example must not grow artificial auth commands.

Store declared browser auth files under profile AppData with current-user access, atomic writes
and no diagnostic capture. Do not add a persistent personal browser directory or generic OAuth
framework. Check supported storageState data explicitly; do not promise universal session restore.
Masked/raw-mode terminal auth is outside the first stdio bridge and must fail clearly when
unsupported, rather than exposing input.

### 6. Wire the actual examples

Proposed boundaries: `packages/ipc`, `packages/playwright`, `integrations/random-common`,
`integrations/random-rest` and `integrations/random-pw`. These are working names, not scaffolded
packages. The shared integration package holds only the two declarations, DTOs, common validation
and contract-test inventory; service selectors and HTTP parsing remain in their respective clients.

PW visits quota then the selected form, submits once and reads the rendered result. A lost page
after submission is not automatically retried. Unknown/changed DOM and service errors fail with
sanitized diagnostics. Real Chromium traffic is mocked through Playwright routing or a local
fixture server; Node MSW alone is not a browser boundary. Reject unhandled external traffic.

Configure command concurrency one in both example apps. Prove general parallel transport against
synthetic stateful consumers, never by stressing RANDOM.ORG. Keep profiles/contact separately
configured for each applicationId. HTTP gains hosting without a Playwright dependency.

### 7. Close with evidence

- Default tests stay deterministic/offline, including actual browser and child-process checks.
  Browser installation is an explicit environment prerequisite; missing binaries cannot silently
  skip required tests. External RANDOM.ORG never runs in CI.
- Reuse the fixed four-case inventory from the HTTP proof for each backend; configure ordinary
  profiles and run them sequentially. Validate shape/range/uniqueness, not equal random samples.
- Prove reuse by observed host/browser identity in controlled tests, not latency alone. Record
  cold/warm timings separately from service/network time and label the tested machine/environment.
- Cover cancellation of one client while another survives, explicit stop, idle exit and recovery
  after a crash. Never claim power-loss cleanup is guaranteed by dispose.
- Run Core/HTTP/token-consumer regressions and repository `npm test`. Inspect total Core +
  modules + integrations code and public concepts; count nonblank handwritten TS with comments,
  normal formatting, generated output excluded. Report tests/support separately.
- Update canonical docs only as capabilities ship. Privacy-check full tree and staged diff before
  any future authorized commit. Do not close the issue without its publication/CI evidence.

## Current handoff

The owner subsequently approved implementation through Phase 7 without intermediate prompts.
All planned modules and both examples are implemented; the ledger records actual tests, live
proofs, qualification limitations and the final authoring review. The HTTP baseline remains
commit `40c265b`; the PW/runtime slice is uncommitted and has not been pushed or merged.
The main checkout and its unrelated TeamCity work were not edited.

## Owner-approved extension: browser observability

The subsequent owner request approves automatic idle-boundary mode switching, --headed and
--record-video, and detailed documentation. Scope/acceptance are recorded in issue #11's
2026-08-31 extension comment. No new service commands, Core plugin surface or IPC messages.

| Phase | Scope | Gate |
|---|---|---|
| 8a | Reconcile scope and canonical mode/artifact policy | Issue, plan and DESIGN agree |
| 8b | Browser admission, mode switching, recording and PW command options | Focused real-browser tests, synthetic network only |
| 8c | Concurrency, state, cancellation and packaged CLI evidence | Same host, fair switching, auth isolation, finalized files, JSON/RPC parity |
| 8d | Detailed operator/author guide and close-out | Full npm test, documentation review and safe artifact cleanup |

Baseline for this extension: 110 passing offline tests; browser module 274 nonblank handwritten
source lines, PW integration 244, shared random package 182. Review added concepts and total code
after the slice, not only handler length. Root agent implements and reconciles the review;
no delegation or commit/push is authorized.

Extension close-out: phases 8a-8d completed locally. Final full suite: 125 passed, no failures
or skips. Windows hidden-console acceptance was added by the owner during verification and is
covered by a guarded install/build correction plus an actual spawn-options test. See the ledger
for exact limitations and the documentation links. No commit, push, merge or issue closure.
