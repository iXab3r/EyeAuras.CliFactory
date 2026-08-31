# IPC review/fix loop

Status: complete for local implementation. Owner requested an autonomous review/fix cycle on 2026-08-31.
Scope: current runtime correctness and authoring simplicity under issue #11, not new features.
Baseline: review-p2-round3.md, 160 passing offline tests; product TS 4994, IPC 1219.
Root implements and self-reviews; no independent reviewer, commit or publication is claimed.

| Phase | Scope | Status | Agent | Review |
|---|---|---|---|---|
| L1 | Three reproduced IPC failures become regression tests | done | root | four tests failed for the reviewed reasons, then passed |
| L2 | Fix recovery ownership and caller-stream failures; repeat adjacent review | done | root | three correction passes followed by a clean focused self-review |
| L3 | Full offline suite, docs, authoring cost and cleanup | done | root | npm test passed 169/169; docs, cost and host cleanup verified |

Initial inventory: stale recovery must not resurrect a stopped successor; output sink errors
must reject/cancel without uncaught process errors; premature stdin close must cancel rather
than leave a remote command active. Use synthetic profiles and real local gRPC transport.
No protocol/public API additions or integration glue. Preserve existing uncommitted work.

Loop gate: regressions fail before fixes and pass afterward; review ownership transitions,
stream lifecycle, cancellation and peer isolation again after implementation. Fix confirmed
in-scope follow-ups, rerun affected tests, and stop after a clean focused review plus npm test.
This is bounded local evidence, not a guarantee of absence of all defects. Issue synchronization
remains the previously recorded external-access limitation; no external writes in this cycle.

## Loop evidence

- First red gate: delayed recovery timed out instead of exiting; stdout/stderr error tests
  each failed with an uncaught stream error; premature stdin close left Run active.
- First correction: compare owner metadata after acquiring the lease (Stop deletes it), watch
  caller output lifecycle for the entire invocation, and distinguish premature stdin close
  from clean EOF, including already destroyed input. All four regressions passed.
- Adjacent review: error reporting before relay could itself crash on a failed stderr; a write
  still pending at cancellation could emit a later unhandled error. Two added tests failed,
  then passed after sharing the internal callback/error-aware writer with host diagnostics.
  A pending write retains its error listener until it actually settles/closes, even if abort
  has already returned control. Caller streams are never destroyed by relay cleanup.
- Added green coverage for error/close/finish between writes, peer isolation and listener cleanup.
  Recovery polls lease freshness with owner identity checks, then makes one acquisition attempt;
  it no longer retries blindly against a successor's live lease.
- Third pass confirmed a delayed cold-start child could outlive a caller that connected to a
  peer, then launch after that peer stopped (no previous owner existed to compare). A file
  barrier in the synthetic fixture reproduced this deterministically. The foreground now
  terminates its own unused child after verifying the elected peer; three cold-start/recovery
  process tests pass together. No unrelated process is terminated.

Final focused review checked pre-start cancellation/closed sinks, clean EOF versus premature
close, callback errors before/after cancellation, idle output close/finish, listener removal,
peer isolation, lease generation changes and child ownership. The final added pre-start test
is defense-in-depth coverage, not another defect. Production changes are limited to host.ts
and relay.ts; tests use real local gRPC and synthetic process barriers, not live services.

Authoring cost: product 4994 -> 5055 (+61 internal IPC lines), tests/support 5422 -> 5780 (+358),
generated IPC 130 unchanged. Public API, protocol, integrations and dependencies unchanged.
See authoring-review.md. Runtime/testing docs now describe the corrected failure boundaries.

## Final verification and handoff

Full root npm test passed on Windows / Node 24.4.1: Core 51, IPC 29, BrowserRuntime 23,
random-pw 6, random-rest 25, TeamCity 35; total 169, zero failures/cancellations/skips. Nine new
offline tests supplement the 160-test baseline. Actual local gRPC/process and synthetic browser
fixtures ran; no live RANDOM.ORG or other service proof was rerun. Cross-platform evidence in
earlier records is dated, not renewed by this Windows run.

All six confirmed defects (three initial, two adjacent write paths, one unused-startup-child
race) are fixed. The final targeted self-review found no further actionable defect in modified
paths. This is not an independent review or an exhaustive proof of the whole repository.
No new author setup or user-data migration is required; rebuild and stop old hosts normally.

OS inspection found zero remaining worktree internal hosts. git diff --check passed with only
the pre-existing .gitignore CRLF warning; staged diff is empty. No non-ignored video, HAR or auth
state artifacts were added. Test cleanup removed only synthetic temporary data, not user data.
Earlier uncommitted changes remain intact; main checkout was not edited. No commit/push/merge,
privacy-gate claim, issue closure or external publication. Prior deferred integration-guide and
issue synchronization work remain outside this bounded loop. Known failing tests: none.
