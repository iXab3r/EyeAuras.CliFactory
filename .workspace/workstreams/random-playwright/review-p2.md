# Second review: four approved P2 corrections

Status: locally complete and verified. Owner approved the four P2 findings in the task; P3 guide cleanup is deferred.
Parent issue #11 synchronization remains pending after the connector's documented 403; no bypass,
commit, push, live service or delegation. Baseline: locally verified 148-test slice, product TS 4860.

| Phase | Scope | Status | Review |
|---|---|---|---|
| P2-A | Explicit optional passive auth readiness; logout before resource invalidation | done | root: pass, focused Core/browser regressions |
| P2-B | Definition/auth-owned env declarations; early validation and bounded startup diagnosis | done | root: pass, declaration and real-process regressions |
| P2-C | Consumers, docs, regression and authoring reconciliation | done | root: pass, full 155-test gate and authoring reconciliation |

Shipped decisions reconciled with DESIGN:
- AuthDefinition.isReady is an optional local-only preflight, with no browser/network effects;
  omission delegates auth enforcement to service handlers. Explicit status has no validate boolean.
  tokenAuth provides readiness from scoped secret storage. No generic browser login-state inference.
- Profile deletion invokes app logout/revoke before invalidating resources; a failed logout preserves
  resources/profile for retry.
- CliDefinition and AuthDefinition declare environmentKeys. tokenAuth supplies its env automatically;
  runHosted unions declared keys and removes its independent public environmentKeys option.
- Construct/validate Core before spawn. Distinguish startup phases with fixed child exit codes,
  not raw child stderr, a custom transport or stored diagnostics. Competing startup losers still
  wait for the elected owner. All resources remain owned even on failed validation/build/start.

Evidence required: implicit status is never called by commands; headed/no-restart browser regression;
logout ordering and failed-revoke retention; profile-scoped readiness; declared env in multiple real
clients with no undeclared forwarding; invalid options/declarations fail before spawn; child startup
failures return promptly with safe phase diagnostics; existing cold-start races remain green.
Final gate: root npm test and a new authoring source delta, with no extra dependency.

## Evidence and review

The initial status and deletion regressions failed before implementation (implicit status was
called, and logout observed already-invalidated resources). Early-validation regression failed
on a missing build manifest instead of reporting invalid idleTimeoutMs. All now pass.

- Core: explicit status is not a preflight; optional readiness is profile-scoped, excludes fetch/
  streams and follows permission admission. A failed revoke retains profile/resources, then retry
  observes logout before invalidation. Existing token onboarding/permissions remain green.
- Browser: initial and repeated headed requests succeed with allowRestart false and one launch;
  no auth status callback runs. The fixture captures real launch arguments but launches invisible
  Chromium; existing observation tests cover actual headed behavior. App-owned synthetic browser
  auth now registers its resources and checks the actual session inside its service handler.
- IPC: invalid idleTimeoutMs/maxInvocations, concurrency and permission declarations surface before
  build lookup and dispose their resources. Multiple real clients share one host, declare token env
  only through tokenAuth, preserve independent caller values and profile credentials, omit unknown
  env, and never inherit a missing token from host process.env. Assertions emit booleans, not secrets.
- Startup: child factory failure, conflicting runtime storage and synthetic lock EACCES report
  fixed safe phase messages under a 10-second test ceiling, rather than the 20-second readiness
  timeout. Raw synthetic private markers never reach client output. Only live-owner/ELOCKED races
  get the ownership wait path; filesystem access failures do not masquerade as competing owners.
  Existing five-client cold starts, limits 1/N/unbounded, idle/cancel/crash and build mismatch pass.

The first full root npm test passed 155 tests. The final full rerun also passed 155 tests and
includes the added lock-access classification case (inside the same startup test).
Authoring review: same capabilities, product TS 4860 -> 4990 (+130), tests/support 4826 -> 5186
(+360), generated IPC 130 unchanged; browser and integration source unchanged. No new dependency.
Canonical DESIGN/runtime docs describe the shipped contract and migration, not a proposed API.
Review is root's explicit self-review, not independent delegation. External issue sync remains
pending after the prior 403; owner approval is local authority, not a claim of external publication.

## Final gate and handoff

Root `npm test` completed successfully on Windows / Node 24.4.1: Core 47, IPC 19, BrowserRuntime 23,
random-pw 6, random-rest 25, TeamCity 35. Total 155, zero failures/cancellations/skips. Both full
runs passed; no live service was contacted. Existing packaged browser tests still prove one warm
browser and host and reap Chromium after stop. Real Unix qualification was not rerun in this slice.

Read-only process inspection after completion confirmed zero worktree internal-host processes.
The initial sandboxed process query was denied; the successful elevated read-only query is the
evidence, not the failed query's empty result. No non-ignored webm/har/auth-state artifacts were
found. Tests removed only their synthetic temporary profiles/build fixtures; user data was not
removed. Staged diff is empty; git diff --check passes with the existing .gitignore line-ending
warning only. This is not a commit privacy gate or a claim of external publication.

All four P2 are implemented; known failing tests: none. Deferred: P3 new-integration guide cleanup,
external issue synchronization and any commit/push/publication (not authorized). All earlier dirty
work was preserved. Next owner action can review this local slice or authorize its commit; do not
close issue #11 on local evidence alone. Rebuild then stop an older running host before using the
new API; no compatibility alias or automatic user-data migration exists.
