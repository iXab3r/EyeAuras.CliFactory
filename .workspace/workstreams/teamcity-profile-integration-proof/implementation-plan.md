# TeamCity profile-backed integration proof — implementation plan

Lifecycle: `active`

Issue: [#4](https://github.com/iXab3r/EyeAuras.CliFactory/issues/4)

## Goal

Replace TeamCity's environment-injected client smoke with an explicit local proof that exercises the
compiled CLI, a real current-user profile, its OS-keyring credential, JSON output, JSON-RPC, and a
fixed bounded inventory of read-only REST commands. The runner is development/debug evidence and
must remain outside every default and CI test path.

## Constraints

- The GitHub Issue owns command, safety, output, and acceptance scope.
- No endpoint, token, or discovered service data enters source, fixtures, logs, Issues, or this
  workstream.
- The proof takes a profile name and resolves all connection state through shipped Core behavior.
- A fixed command inventory is the primary mutation boundary; profile permissions are only defense
  in depth.
- Do not extract a generic Core runner until a second integration proves reusable mechanics.
- Mocked tests remain the regression contract. A live proof can fail because of local/service state
  and never becomes a merge or CI prerequisite.

## Phases

### P1 — Isolate the execution lane

Scope: introduce a separately compiled/invoked TeamCity integration-proof entry point and npm script,
require explicit `--profile`, and refuse `CI`/`GITHUB_ACTIONS` before spawning a child or networking.

Gate: deterministic tests prove argument validation and CI refusal; `npm test` does not discover or
execute the proof entry point.

### P2 — Prove the real product boundary

Scope: spawn `dist/src/bin.js`, select the real named profile, validate `auth status` and `server
status`, parse JSON privately, and emit only a sanitized pass/fail summary.

Gate: mocked process-level tests prove argv, exit handling, and redaction; one explicit local run
proves the configured profile and OS-keyring credential work without URL/token injection.

### P3 — Close the bounded ReadOnly inventory

Scope: add the Issue-owned collections, conditional detail/diagnostic calls, legitimate-empty-page
handling, permission inspection, and a two-request persistent JSON-RPC proof. No arbitrary argv.

Gate: the runner reports every inventory row as pass or explicit data-dependent skip; code review
maps each service command to `ReadOnly`; a local proof completes without raw payload output.

### P4 — Retire legacy evidence and reconcile

Scope: remove `tests/live.test.ts`, update TeamCity/public docs from planned to shipped behavior, run
repository verification, and reconcile Issue acceptance plus workstream close-out.

Gate: `npm test` is offline and green, the explicit proof succeeds locally, no env-injected live
test remains, CI confirms the default suite, and Issue #4 has linked commit/CI evidence.

## Review protocol

The service integration author moves a phase to `awaiting review` only with its named evidence. The
Reconciliation Lead verifies the inventory and safety boundary before marking it `done`. Any command
addition or output expansion changes Issue #4 first.
