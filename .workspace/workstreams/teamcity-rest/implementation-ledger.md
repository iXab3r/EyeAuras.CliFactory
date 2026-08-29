# TeamCity REST expansion — implementation ledger

**Lifecycle:** active
**Feature spec:** [GitHub Issue #1](https://github.com/iXab3r/EyeAuras.CliFactory/issues/1)

| Phase | Scope | Status | Agent | Review |
|---|---|---|---|---|
| 0 | Foundation baseline | done | service integration author | passed |
| 1 | Projects and builds | pending | — | — |
| 2 | Operational reads | pending | — | — |
| 3 | Controlled updates | pending | — | — |
| 4 | Delivery hardening | pending | — | — |

## Phase 0 — foundation baseline

Implementation evidence:

- `integrations/teamcity/src/cli.ts` exposes profile-aware auth and `jobs list/show/status`.
- `integrations/teamcity/tests/client.test.ts` exercises bearer requests, locators, empty build
  status, credential-safe errors, and CLI JSON through MSW.
- Core tests prove command/JSON-RPC reuse and profile isolation.
- Commit `ab33fa0` passed GitHub Actions on Windows, macOS, and Linux with Node 22 and 24:
  <https://github.com/iXab3r/EyeAuras.CliFactory/actions/runs/33256576311>.

Review verdict: **passed**. The baseline is real and reusable; broader TeamCity REST coverage is
not implied.

Safety follow-up review: **passed** on 2026-08-29. The permission gate is enabled for TeamCity and
all existing jobs leaves declare `ReadOnly`. Core evidence proves default read access, denied
`Update` before handler execution, explicit grant, and profile isolation. Full `npm test`: 9 passed.

## Next action

Issue #1 has frozen the smallest operational command/API inventory. Before Phase 1 implementation,
reconcile its target discovery assumptions against the authenticated server, record only sanitized
evidence here, and move Phase 1 to `in progress`.
