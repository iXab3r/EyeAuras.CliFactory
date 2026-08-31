# Publication and main reconciliation

Owner authorized commit, push, merge into the default branch, and merge-back to the working branch.
Role: Reconciliation Lead + Core/integration maintainer. No history rewriting or force push.

## Pre-merge acceptance checkpoint — 2026-08-31

| Phase | State | Evidence |
|---|---|---|
| Feature privacy gate and commit | Complete | ffb3d93; feature suite 171/171; full tracked-tree and staged-diff privacy review passed |
| Push codex/random-rest-cli | Complete | origin accepted ffb3d93 after explicit owner confirmation |
| Reconcile with main | Accepted for merge commit | Full merged suite 1070/1070; security, required options, command inference and all integration tests retained |
| Publish main and merge it back | Pending publication | Commit accepted merge, push main, fast-forward working branch to main, push and verify both remote identities |

Initial main: adbc566. Feature base: 40c265b. Other worktrees are explicitly out of scope;
the primary checkout has unrelated uncommitted documentation. All integration work takes place
in EyeAuras.CliFactory-2. Earlier local-only evidence remains a dated baseline, not publication status.

Automatic safety review originally blocked publication and the security-sensitive auth reconciliation.
The owner explicitly confirmed both the origin destination and the fail-closed credential order.
The approved destination is https://github.com/iXab3r/EyeAuras.CliFactory.git, branches
codex/random-rest-cli and main.

## Reconciliation decisions and evidence

- Keep main's fresh token selection, all-three-stream TTY rule, masked input fixes, required-option
  parsing/help, literal command inference and own-property profile checks.
- Preserve the optional IPC architecture, common recursive built-ins, disposal and exclusive admission.
  Auth remains app-owned: no token-only Core contract or additional public transaction API.
- Configure validates candidate configuration/auth before persistence, defers scoped secret changes,
  then deletes replaced credentials, saves the profile and saves new credentials. Storage failures
  fail closed and expose no backend details. Existing main auth-contract tests remain intact.
- Invalidate resources before app-owned configure login, not after a successful fresh login.
  Generic auth regressions cover success/rejection/throw/cancellation for existing and new profiles,
  staged read-after-write/delete, unchanged peer credentials and invalidation order. App-owned
  browser/remote effects are explicitly outside this persistence guarantee.
- Required profile prerequisites are not mandatory parser options: stored/prompted values still work.
  Built-in groups display help successfully like service groups. Tests retain leaf parser errors
  and add group unknown-option failures across CLI/execute/RPC, without terminating the process.
- TeamCity tests use the real temporary profile fixture and per-test cleanup. YouTrack's auth mock
  inspects persisted configuration directly rather than deadlocking on a nested exclusive command.
  Path assertions cover readiness/handler contexts after admission and no contexts for denied work.
  The YouTrack executable now disposes its application in finally.
- Root build discovers all workspaces. Lockfile reconciliation adds the YouTrack workspace/link
  without changing the feature's dependency versions. Generated protobuf output is reproducible.

Final root npm test: Core 81, IPC 31, Playwright 23, random-pw 6, random-rest 25,
TeamCity 569, YouTrack 335: total 1070 passed, zero failed/cancelled/skipped.
All evidence is offline, using synthetic profiles/services/browser pages. No live proof was run.

Privacy gate covers all 447 tracked text files and the full staged diff, including embedded
authoring snapshots. No binary artifacts, real credentials, personal captures or private service
addresses were found. Reviewed candidates are synthetic credential URLs (36 occurrences including
snapshots), documentation protocol punctuation, reserved example/invalid/loopback hosts, approval
metadata, identifier-building expressions, synthetic redaction fixtures and dependency version fields.
The feature commit's earlier 175-path/119-change review remains its dated baseline. Diff whitespace
checks pass. Publication does not close Issue #11 or claim a new remote CI/platform result.

## Publication receipt — complete

Merge e4d219f (parents adbc566 and ffb3d93) was published to origin/main. The working branch
codex/random-rest-cli was then fast-forwarded to main and pushed. A fresh fetch verified identical
local main, working-branch HEAD, origin/main and origin/codex/random-rest-cli identities, with a
clean working tree. This completes the owner's commit/push/merge/merge-back request. This receipt
changes documentation only; the runtime verified by the 1070-test gate is unchanged. No known
local test failures remain; remote CI/platform status is not asserted. Other worktrees were untouched.
