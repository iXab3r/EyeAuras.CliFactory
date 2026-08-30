# RANDOM.ORG HTTP example ledger

| Phase | Scope | Status | Agent | Review |
|---|---|---|---|---|
| 1 | Contract/workspace | done | root | scope checked against owner selection |
| 2 | HTTP/CLI implementation and tests | done | root | source and deterministic boundaries reviewed |
| 3 | Documentation and verification | done | root | tests/docs reviewed; live proof explicitly unrun |
| 4 | Live test suite and actual service verification | done | root | range corrected; 24 offline and 4 real service tests pass |

## Initial state

Worktree: `D:/Work/EyeAuras.CliFactory-2`, branch `codex/random-rest-cli`, baseline `1d36395`.
Main checkout is dirty with unrelated work; no changes were reset, copied, or committed.
[Issue #8](https://github.com/iXab3r/EyeAuras.CliFactory/issues/8) owns the feature contract.
The owner explicitly chose the obsolete anonymous HTTP API. This basic slice excludes IPC,
Playwright and strings. Official API/guidelines were read; fixtures will be synthetic.
Live proof needs an operator-configured profile/contact; no personal contact is inferred.

## Implementation evidence

- Initial two MSW tests failed with the client stubs (`Not implemented`); after implementing the
  HTTP contract, both passed. Expanded suite reached 20 passing tests, including the actual bin.
- Only the new integration, root workspace/build files, documentation and this ledger changed.
  Core and TeamCity source are unchanged in this worktree. No new third-party dependency is used.
- Response cancellation must not await the other consumer of an instrumented/tee'd stream;
  tests caught that hang. Cleanup initiates cancellation without waiting for unrelated readers.
- Leaf help in the baseline Core can exit an embedded process. The example tests help in a
  separate CLI process so it cannot silently terminate the rest of its test suite. Core behavior
  and the existing TeamCity suite's file-level early exit were not changed in this feature.
- First full `npm test` passed: Core 14, RANDOM.ORG 20, TeamCity 28 reported test entries. Final
  run follows after two additional timeout/pre-cancel tests and documentation cleanup.
- `npm exec --offline -- random-rest-cli --help` passed, confirming the installed bin link.
- Live proof has not run: no operator-configured RANDOM.ORG profile/contact has been provided.
  Source contracts came from official HTTP API/client guidelines; all test values are synthetic.

## Initial slice close-out (before live-test follow-up)

Local implementation status: complete. Issue remains open because no commit/PR/CI publication was
requested. Final `npm test` passed: RANDOM.ORG 22, Core 14, TeamCity 28 reported entries; note the
baseline test limitation above. `git diff --check` and relative-document-link/whitespace checks
passed. No current integration failures are known. Live RANDOM.ORG compatibility remains unverified
on this machine until an operator supplies a configured contact profile and runs the explicit proof.

Authoring review: baseline zero; two service leaves and three HTTP paths (quota is internal).
Integers and sequence share request/response checks, but retain obvious endpoint parameter mapping.
The shared command declaration returns domain data; Core supplies profiles, permissions and both
rendering modes. Core source delta is zero; production integration source is 243 nonblank TypeScript
lines including comments, counted under `integrations/random-rest/src` against baseline `1d36395`.
Tests/fixtures/support add 409 nonblank TypeScript lines under `integrations/random-rest/tests`;
the separate live-proof harness adds 47 under `integrations/random-rest/integration-tests`.
No new external dependency, generic HTTP framework, plugin loader, IPC or browser package was added.
Validation and bounded-response handling are explicit safety code, not extra public features.
Verdict: pass for the small example; strings, IPC/PW and cross-process coordination remain deferred.

Next use: `npm exec -- random-rest-cli --help`; configure a real operator contact through
`profile configure`, then run the documented local-only proof. Do not substitute a fixture contact
or parallel live invocations. No credentials, real service responses or personal profile data were
collected. No commits or pushes were made, and the original checkout remains untouched by this slice.

## Live-test follow-up

Owner requested actual RANDOM.ORG verification and integration tests. Issue #8 now includes four
fixed small live cases, replacing the initial two-row proof. No normal RANDOM.ORG profile store
exists on this machine at the start of the follow-up. Operator contact requested without reading
unrelated personal data or substituting fixture values; test implementation continues meanwhile.

### Follow-up verification

- Added four separately reported sequential cases in `integration-tests/live.test.ts`, executed
  through the packaged CLI by the existing `test:integration` command. Total bounded inventory:
  14 values; no payloads in diagnostics. Later cases skip after the first failure.
- The same runner/child-process chain is exercised under MSW in the default suite: 4 passes on
  synthetic success; HTTP 503 yields 1 failure/3 skips; CI refuses before any case. The runner also
  fails if its inventory did not execute, avoiding a misleading zero-test success.
- Final offline `npm test` passed: RANDOM.ORG 23, Core 14, TeamCity 28 reported entries.
  TypeScript build, `git diff --check`, doc whitespace and link checks passed.
- Attempted the real command: `npm run test:integration --workspace @eyeauras/random-rest-cli --
  --profile default`. Actual outcome: 0 passed, 1 failed, 3 skipped; categorized failure is
  `profile is not configured`. The ordinary RANDOM.ORG profile store does not exist, so execution
  stopped before HTTP access. This is not evidence of either service success or service failure.
- Remaining action requires the owner's contact email for User-Agent. The agent will configure
  the ordinary profile through the packaged CLI and repeat the exact live command once supplied.
  No fixture email was sent, no personal email was inferred, and no service payload was collected.

### Owner-authorized contact and live-discovered correction

- Owner explicitly authorized any contact address. Configured a reserved synthetic example.com
  address through the compiled CLI in the ordinary `random-live` profile; no real personal
  contact was inferred. This supersedes the earlier contact blocker.
- First real run with that profile: 1 passed, 1 failed, 2 skipped. Signed integers worked;
  equal-bound integers failed with HTTP 503. A bounded sequential diagnostic (quota plus the two
  equal-bound generators) confirmed both endpoints require the maximum to exceed the minimum.
  No random response arrays were printed or saved, and no real response became a fixture.
- Reconciled issue #8, design, validation and docs to `min < max`. A new MSW-boundary regression
  failed before the fix; the corrected client rejects equal bounds before any HTTP request.
  CLI and packaged-process tests exercise the same rejection. Mock process fixtures now reject
  invalid ranges too, avoiding the previous unrealistic success behavior.
- The four-case live inventory now draws three integers from 0..1 to guarantee repetition without
  a probabilistic assertion, and uses the minimum supported two-item sequence. Total: 15 values.
  The invalid equal-bound cases remain covered by offline rejection tests, not live generation.

### Final verified outcome

- Full `npm test` passed after the correction: RANDOM.ORG 24, Core 14, TeamCity 28 reported entries
  (the baseline Core/TeamCity test limitation noted above is unchanged).
- Actual `npm run test:integration --workspace @eyeauras/random-rest-cli -- --profile random-live`
  passed all 4 cases, with 0 failures and 0 skips, on 2026-08-30. This run used the normal compiled
  CLI, current-user profile and real HTTPS service, without MSW or injected test AppData. Checked
  JSON shape, empty success stderr, counts, integer bounds and sequence uniqueness in memory;
  random payloads were not printed, saved or committed.
- `git diff --check` passed. Final authoring review: still two service leaves, zero Core source
  delta and no new third-party dependency. Follow-up adds test evidence and one stricter range
  check, not public capabilities. IPC/Playwright remain separate future work.
- No remaining work for this HTTP slice. The ordinary `random-live` profile remains configured
  for local reuse; no credentials were created. No commit, push or issue closure was performed.

### Local commit handoff

Owner requested a local commit of this completed slice before planning the Playwright version.
Commit scope is limited to the HTTP integration, its workspace wiring, documentation and this
workstream. Check the full tracked tree and staged diff for privacy before committing; exclude
generated output and ordinary profile data. No push or issue closure is authorized by this step.

Pre-commit verification: `npm test` passed again (24 RANDOM.ORG, 14 Core, 28 TeamCity reported
entries). Reviewed the complete 93-file index and staged diff for credential formats, literal
secrets, credential-bearing URLs, private/internal addresses and non-synthetic contact data.
All flagged entries were confirmed synthetic test markers/negative URL fixtures; the additional
URL inventory's sole unclassified match was a protocol prefix in a validation message, not a
server address. Manual changed-source/docs review found no raw service payloads or personal data.
Staged scope is 25 intended files, with no build output or profile state; privacy verdict: pass.
