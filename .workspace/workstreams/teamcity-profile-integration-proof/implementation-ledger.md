# TeamCity profile-backed integration proof — implementation ledger

Issue: [#4](https://github.com/iXab3r/EyeAuras.CliFactory/issues/4)

Phase | Scope | Status | Agent | Review
---|---|---|---|---
P1 | Isolate the execution lane | done | service integration author | reviewed
P2 | Prove the real product boundary | done | service integration author | reviewed
P3 | Close the bounded ReadOnly inventory | done | service integration author | reviewed
P4 | Finalize the only supported path and reconcile | done | Reconciliation Lead | reviewed

## Evidence log

### 2026-08-30 — workstream opened

- User correction: real-service evidence should exercise the product's real CLI/profile/keyring
  path during development, not merely a client constructed from URL/token environment variables.
- Baseline audit: `integrations/teamcity/tests/live.test.ts` instantiates `TeamCityClient` directly,
  requires `TEAMCITY_URL` and `TEAMCITY_TOKEN`, and is discovered then skipped by the default test
  glob.
- Scope and acceptance are frozen in Issue #4; no implementation phase has started.
- Planning-contract verification: `npm test` passed (Core 14/14; TeamCity 23 passed with the
  expected legacy live-smoke skip).
- Earlier manual evidence confirmed the compiled CLI can execute the intended bounded read-only
  surface through a configured local profile, without persisting or publishing response payloads.
- Next action: implement P1 and record proof that CI refusal occurs before child-process creation.

### 2026-08-30 — scope correction

- The user rejected a compatibility period. Issue #4 records immediate replacement: the previous
  URL/token-injected test and its documentation are deleted, not retained as a fallback.

### 2026-08-30 — P1/P2/P3 reviewed

- `integration-tests/profile-proof.ts` is outside the default test glob and invokes only the compiled
  CLI process with a required profile name. It never instantiates the service client or injects a
  URL/token.
- The fixed inventory contains 17 proof rows, including conditional detail checks and JSON-RPC.
  Every service command maps to `ReadOnly`; an enabled `Update` permission does not broaden it.
- Offline runner tests cover argument rejection, CI refusal before invocation, exact argv inventory,
  bounded pages, empty-page skips, and omission of raw child output from summaries.
- Local evidence: `npm run test:integration --workspace @eyeauras/teamcity-cli -- --profile default`
  completed with 17 passed, 0 skipped, 0 failed through the real current-user profile/keyring.
- A direct entry-point run under `CI=true` exited with refusal code 2 before launching the CLI.

### 2026-08-30 — P4 submitted for review

- Deleted `tests/live.test.ts` and its stale local compiled output. No URL/token-injected real-test
  command remains in product docs or npm scripts.
- Public docs now describe the profile-backed proof as the only supported real-service development
  path.
- `AGENTS.md` and the canonical design make clean breaks the project-wide early-stage policy:
  no compatibility shims, aliases, parallel paths, or automatic old-format migrations.
- `npm test`: Core 14/14 and TeamCity 28/28 passed; zero skips and no real-service proof discovery.
- `git diff --check`: clean.
- Remaining gate: publish the implementation and link successful CI before Issue closure.

### 2026-08-30 — P4 reviewed and workstream closed out

- Implementation (history-sanitized equivalent): [1e18191](https://github.com/iXab3r/EyeAuras.CliFactory/commit/1e181913c7d5b240f6b6121a4357b032f9f39229).
- [CI run 33282403466](https://github.com/iXab3r/EyeAuras.CliFactory/actions/runs/33282403466)
  passed all six jobs: Windows, Linux, and macOS on Node 22 and 24. CI ran only the offline suite.
- Reconciliation checked all four phases and the Issue acceptance checklist against the shipped
  runner, deterministic tests, real-profile local proof, and public documentation. No status drift
  or remaining evidence gaps were found.
- Delivered: the profile-backed local proof is the only real-service test path; the previous
  environment-injected test is deleted, and clean breaks are documented as project policy.
- Final verification: Core 14/14 and TeamCity 28/28 offline tests; local real-profile proof 17/17;
  CI refusal before CLI invocation; all six CI jobs green; clean diff checks.
- Known failures: none within this scope.
- Deferred candidates: none required for Issue #4. Generic runner extraction and fixture recording
  remain explicit non-goals, not incomplete implementation.
- Verdict: complete; Issue #4 is ready for closure with this evidence.
