# Playwright RANDOM.ORG implementation ledger

Status: seven-phase baseline and browser observability extension complete for local implementation.
Scope: [issue #11](https://github.com/iXab3r/EyeAuras.CliFactory/issues/11).
Plan: [implementation-plan.md](implementation-plan.md).
HTTP baseline: local `40c265b` on `codex/random-rest-cli`, worktree `EyeAuras.CliFactory-2`.
This slice has not been committed, pushed, merged or published.

Latest local change: [owner-approved simplification](simplification.md), full 171-test gate passed.
Optional IPC is explicitly isolated; management is ipc-server, Core built-ins use one declaration
path, and the author guide starts with standalone composition. Product TS: 5055 -> 4952 (-103).
The [autonomous review/fix loop](review-fix-loop.md) retains its 169-test baseline and nine prior
regressions. No commit/push or remote issue synchronization was performed. [Third-review P2 evidence](review-p2-round3.md): 160-test baseline;
[previous round](review-p2.md): 155-test baseline.
The tables below retain the original slice's dated evidence.
See [authoring-review.md](authoring-review.md) for the reconciled source cost and migration boundary.

## Phase reconciliation

| Phase | Result | Evidence |
|---|---|---|
| 1 | Baseline/policy reconciled; grpc-js + Chromium qualified | Exact pins below; real forms and quota/result path; Windows filtered-token and Linux IPC tests |
| 2 | Core lifecycle, invocation isolation, app-owned auth | Core regression suite; actual TeamCity token consumer remains green |
| 3 | Generated bidi stdio relay | Six real local-transport tests: byte fidelity, EOF, metadata, backpressure, cancellation, invalid frames and final status |
| 4 | Self-start/ownership/concurrency/idle | Four process tests: cold-start race, same owner, 1/3/unbounded command limits, idle JSON-RPC, mismatch, stop, idle and crash recovery |
| 5 | Optional browser owner and auth state | Four real Chromium tests: warm contexts, profile isolation, cookie/localStorage restore, logout races, cancellation, partial init and browser loss |
| 6 | Shared contract and both products | Two commands only; HTTP 24 tests; PW five tests including packaged-process and exact proof-harness rehearsal |
| 7 | Acceptance and guide | Full suite, live cases, platform/timing evidence, authoring review and privacy reconciliation below |

## Versions and platforms

- Node 24.4.1; grpc-js 1.14.4; proto-loader 0.8.1; proper-lockfile 4.1.2.
- Playwright 1.62.1; installed Chromium 151.0.7922.34 (revision 1234).
  Browser installation is explicit; the runtime never silently downloads one.
- Windows: full offline suite, actual headless Chromium and process tests.
- Windows non-admin capability: all 10 IPC tests passed under a restricted current-user primary
  token with Administrators SID disabled and maximum privileges removed. IsInRole(Administrator)
  was checked false before launch. This is not a newly created OS account or a claim that the
  original shell was non-elevated.
- The first restricted-token attempts failed before Node DLL initialization. The test harness
  needed a current-user default DACL on the *new token*. No account, desktop ACL, UAC setting
  or global security policy was changed. The successful harness is recorded beside this ledger.
- Linux: all 10 IPC tests passed on actual Unix sockets under Ubuntu 20.04/WSL with temporary
  Node 24.4.1/native-keyring binaries. The repository/system Node installation was not replaced.
  Runtime test roots were native /tmp paths; imported code on the Windows mount made these runs
  much slower (~181 seconds versus ~30 seconds on Windows).
- macOS, Linux browser execution and Node 22 have not been locally qualified. Existing CI matrix
  was updated to provision Chromium before offline tests; no CI result/publication is claimed.

## Verification

Baseline seven-phase `npm test`: **110 passed**, zero failures/skips. Inventory: Core 32, IPC 10, browser owner 4, RANDOM.ORG PW 5,
RANDOM.ORG HTTP 24, TeamCity 35. All product behavior is covered offline; real service tests are
separate. The final full-suite run includes the hard-kill and already-cancelled JSON-RPC regressions.

The baseline had reported only 14 Core and 28 TeamCity tests because nested help could exit
embedded Commander early. Fixing exit overrides exposed the existing 19/35 tests; new Core
lifecycle/auth regressions then brought Core to 32. These are actual completed test counts,
not credit for previously skipped execution.

Real-service evidence (2026-08-30), through built CLI processes and normal `random-live`
current-user profiles:

| Backend | Cases | Values requested | Result |
|---|---:|---:|---|
| HTTP | 4 sequential | 15 | 4 passed, zero failures/skips |
| Playwright | Same 4 sequential | 15 | 4 passed, zero failures/skips |

The owner had authorized a synthetic contact address for this public example. No API key or
invented auth flow was used. HTTP proof completed before browser proof began. Quota was checked
before every generation. Assertions inspected values in memory without printing/saving arrays,
HTML, quota IPs, cookies or raw failure responses. Both normal hosts were stopped in finally.

Measurements on this Windows environment, not performance guarantees:

- Controlled packaged-browser test: ~1.32s cold browser operation, ~1.01s warm operation
  (includes foreground Node startup). Several clients produced exactly one launch event with
  the same host/browser identity. Explicit stop emitted close and browser PID no longer existed.
- Actual service: HTTP first case ~1.92s, later ~0.58–0.60s; PW first case ~5.61s, later
  ~2.03–2.11s. Cases differ and include network/service latency, so these are not a benchmark.
- Stronger hard-kill test was added after the ordinary crash case: terminate the owner with
  SIGKILL, leave its lease, reject the lost invocation without replay, wait for safe stale
  recovery, and use a new host. Focused Windows proof passed (~18s including stale wait).

## Integration/review decisions

The owner's browser-state exception was reconciled into canonical DESIGN/root guidance.
AppData profile JSON stays non-secret; browser state is explicit and protected. No portable
state, plaintext token fallback or personal browser profile was introduced.

Ported only the reviewed case-collision protection and embedded-help correction associated with
`3df5066`/issue #9. Did not cherry-pick unrelated integration changes or issue #10 input typing.
Main checkout's dirty TeamCity/Core work was not edited.

Boundary bugs found by tests: PowerShell security-module autoload, cold-start candidates waiting
to resurrect a stopped host, gRPC destroy bypassing final error status, waiting on a cancelled
slow sink, reentrant disposal, uncancelled terminal input, and missing auth-option defaults.
Each was fixed with targeted evidence; failures were not counted as passes.

[Authoring/simplicity review](authoring-review.md): final two-workflow batch passed. Added
handwritten runtime cost is reported openly; no resource scopes, universal auth protocol or
custom binary transport. Local artifacts are under ignored output; an accidental root
playwright-cli artifact directory was moved there without deleting its contents.

## Privacy and operational handoff

The 150-file working-tree inventory (tracked plus untracked, excluding ignored artifacts) and staged
diff were scanned; seven candidate matches were reviewed as synthetic fixtures/invalid-URL
tests, including unchanged public-safe TeamCity sentinel values. No credentials, private service
addresses, personal browser state or real-service payload fixtures were added. Staging is empty;
this does not replace the required full index + staged privacy gate before a future commit.

No owned Windows Node/host processes remained after verification. Browser closure is asserted
by the packaged fixture. Normal RANDOM.ORG profiles persist intentionally; application disposal
does not delete user configuration. Temporary browser/runtime test profiles are removed by their
own test cleanup.

Remaining deliberate limits: no full TTY emulation; no automatic replay after disconnect;
in-memory cooldown is not shared between application IDs; no guarantee that force-killing a
host reaps every browser descendant. The operating guide states these limits explicitly.
Issue closure awaits publication/CI evidence and is not part of this local implementation.

## Browser observability extension (2026-08-31)

| Phase | Scope | Status | Agent | Review |
|---|---|---|---|---|
| 8a | Scope and canonical policy | done | root | pass: issue extension and canonical policy agree |
| 8b | Runtime and CLI | done | root | pass: focused real-browser and CLI evidence |
| 8c | Focused acceptance | done | root | pass: actual Chromium modes, finalized video, queue and state tests |
| 8d | Documentation and full regression | done | root | pass: 125 tests, detailed guide and privacy review |

Owner approved automatic resource replacement only between browser operations, headed/video flags,
and detailed documentation. Existing baseline files are uncommitted; preserve unrelated main
checkout work. No external-service recordings will be made: use synthetic fixtures exclusively.

Scope extension comment: https://github.com/iXab3r/EyeAuras.CliFactory/issues/11#issuecomment-5474692448 .
The first 123-test full run passed; subsequent review added cancellation-during-video-reporting
coverage and a user-requested Windows console fix, so that run is not the final acceptance result.

The owner reported visible chrome-headless-shell console windows during verification. Inspection
confirmed Playwright 1.62.1's internal launcher omits windowsHide; both headless-shell and FFmpeg
are Windows console-subsystem binaries, while headed Chromium is GUI-subsystem. Added a small,
version/fragment-guarded postinstall/build patch for only those two helpers. It is idempotent and
does not modify browser binaries, globally intercept application spawns, or hide headed Chromium.
Focused tests observed actual spawn options: helpers hidden, headed Chromium not hidden.

A stronger mode assertion initially used CDP Browser.getBrowserCommandLine, which this Chromium
refuses without --enable-automation. Replaced that test-only observation with Browser.getVersion's
headless marker; no production launch flags were changed to satisfy the test.

### Extension final evidence and review

Final `npm test`: **125 passed**, zero failures/skips. Core 32, IPC 10, browser owner 19,
PW example 5, HTTP example 24, TeamCity 35. This final run includes both cancellation during
artifact reporting and the hidden-console correction. Focused tests also passed separately.

- Real Chromium mode changes preserve successful explicit auth checkpoints, reuse compatible
  contexts, and never cross profiles; anonymous operations do not silently persist state.
- Barrier-driven tests cover compatible overlap, fair conflicting switches, cancelled waiters,
  overload, deadlines, disposal and no-restart policy. A failed headed launch does not fall back.
- Nonempty finalized WebM headers/files are inspected before browser disposal on success,
  application error, cancellation and popup completion. Parallel operations have separate
  artifact directories; a following non-recording call has no video.
- The packaged CLI and tunneled JSON-RPC retain ordinary domain results and report paths only
  through stderr. The host PID is unchanged across headless/headed/headless operations; three
  observed Chromium launches are all reaped by stop. Controlled fixture cold/warm operation
  timing in the final run: approximately 744/633 ms, not a benchmark or service measurement.
- Actual Windows spawn options are checked for headless-shell and FFmpeg (windowsHide true)
  versus headed chrome.exe (false). The script applied cleanly, reran idempotently and executed
  through npm rebuild's postinstall hook. No new dependency and no browser executable edits.
- Documentation: [detailed observation guide](../../../docs/browser-observation.md), canonical
  DESIGN, runtime overview, author guide, package/example READMEs and testing/display setup.
  Linux CI now uses Xvfb. This is still Windows-local browser evidence, not a Linux/macOS result.
- Privacy inventory: 155 tracked/untracked non-ignored paths, staged diff empty; seven candidate
  locations were reviewed as the existing synthetic fixtures/invalid-URL tests. No new sensitive
  capture, credentials, personal state or service payload fixture. `git diff --check` passed
  (only the existing .gitignore LF/CRLF conversion warning).
- Review verdict: pass for this extension. No Core/IPC API or protocol change, no public scopes,
  browser pool, implicit auth persistence, action replay, telemetry or automatic capture.
  Normal recording uses application-profile AppData; all tests use isolated synthetic temp roots.

Known limits remain explicit: graphical session needed for headed; arbitrary in-memory state
cannot survive replacement; recording can fail after a service action; no automatic retention or
disk quota; direct callbacks must finish cooperatively. No real-service video was recorded and
the live proof was not rerun for this runtime-only extension. Prior live evidence remains dated.
No commit/push/publication or issue closure; the main checkout's unrelated changes were untouched.
