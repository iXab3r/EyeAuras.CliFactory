# Corrective-slice ledger

Status: locally complete and verified. Plan: [review-plan.md](review-plan.md). Scope: issue #11.
Issue synchronization: attempted before code work; connector denied comment creation (403).
Local corrective scope follows the owner's explicit approval; no external update is claimed.
No commits/pushes; pre-existing dirty runtime slice is preserved.

| Phase | Status | Agent | Review |
|---|---|---|---|
| R1 | done | root | pass: parsed identity, full checkpoint, common input bounds and both directions of RPC backpressure |
| R2 | done | root | pass: direct dispose/video, timeout, resource failure and profile isolation |
| R3 | done | root | pass: root build, dependency/patch/partial manifest cases, missing-manifest management and cross-build Stop |
| R4 | done | root | pass: cheap clients preserve quota/profile semantics; all consumers and docs migrated |
| R5 | done | root | pass: full 148-test run, authoring cost review and local cleanup |

Baseline review: 125/125 offline tests. Additional isolated reproductions confirmed stale
checkpoint overwrite, argv-value-dependent exclusivity, dependency-insensitive build identity,
oversized RPC input acceptance and premature direct browser disposal/video loss.

## Final verification

Final root npm test completed successfully on Windows / Node 24.4.1: **148 passed**, zero failures,
cancelled or skipped tests. Core 44, IPC 16, BrowserRuntime 22, random-pw 6, random-rest 25,
TeamCity 35. An earlier full 146-test pass was followed by two final regression tests and this
complete rerun. Real service/network proof was not rerun; all service responses were synthetic.

- Auth checkpoint regression holds the first snapshot while another operation changes state;
  the saved state remains the newest snapshot. Existing concurrent logout cannot resurrect auth.
- Parsed built-ins remain exclusive; profile names/arguments containing auth/permissions do not
  accidentally serialize service calls. Queued work observes updated profile configuration.
  Existing interactive onboarding and permission-before-auth tests remain green.
- Common count/UTF-8 byte/aggregate argv bounds are applied on all paths. Unterminated oversized
  RPC input fails before EOF and leaves the same host usable. Slow output applies backpressure;
  close/cancel releases waiting listeners without taking ownership of caller streams.
- Resource failures do not skip other resources, repeated disposal is stable and profile
  invalidation is confined to the affected AppArguments. Both RANDOM apps use this contract.
- Direct browser disposal finalizes a nonempty video before returning. Stuck action callbacks
  produce a bounded drain error and close browser resources. Mode-switch/parallel/cancellation
  and real Windows helper spawn tests still pass, including visible headed Chromium.
- Manifest tests cover changed local Core, new/missing artifacts, lock/installed-lock changes,
  a changed patched bundle, relocatable roots, excluded test/source files, absent/malformed
  readiness, and cleanup of definition resources when service startup cannot proceed.
- Separate-process tests prove same owner across clients, binary/RPC separation, build rejection,
  cross-build Status/Stop, concurrency 1/N/unbounded, idle shutdown and crash-without-replay.
  Final packaged PW fixture timings: cold 734 ms / warm 642 ms, one warm browser, three launches
  including deliberate mode switches; stop reaped their Chromium processes. Not a benchmark.

## Reconciliation and simplicity

Canonical DESIGN, runtime/observation/author/testing guides and module READMEs describe the new
contract and one-time update from the earlier runtime. No compatibility aliases retained.
The [authoring review](authoring-review.md) records exact roots/counts and tradeoffs: service code
including shared helpers -66 nonblank TS; foundation +480; total product TS +414, with 52 new
shared build-script MJS lines separately. New app bins need only the definition factory and URL.
No additional runtime dependency, public scopes, DI, service locator or universal packager.

Current-user process inspection after tests found **zero** worktree internal-host processes;
test teardown asserts browser exit. No user profile or artifact was removed. Fixture-owned temp
profiles/build copies were cleaned by tests. Main checkout's unrelated changes were not edited.

Local source inventory: 165 tracked/untracked non-ignored paths; staged diff empty. Credential
pattern candidates were reviewed as synthetic browser markup, unsafe-URL rejection fixtures and
a multiline auth-code false positive. No real credentials, private captures, webm/png/har/auth-state
artifacts or service payload fixtures were added. git diff --check passed (existing .gitignore
LF/CRLF warning only). This is a local review, not a commit/push or claimed external privacy scan.

External bookkeeping remains pending: GitHub connector denied the issue #11 scope comment with
403. This did not expand authority or block locally owner-approved implementation. No commit,
push, issue closure, live-service capture or publication was performed.
