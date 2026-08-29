# TeamCity profile-backed integration proof — implementation ledger

Issue: [#4](https://github.com/iXab3r/EyeAuras.CliFactory/issues/4)

Phase | Scope | Status | Agent | Review
---|---|---|---|---
P1 | Isolate the execution lane | pending | service integration author | pending
P2 | Prove the real product boundary | pending | service integration author | pending
P3 | Close the bounded ReadOnly inventory | pending | service integration author | pending
P4 | Retire legacy evidence and reconcile | pending | Reconciliation Lead | pending

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
