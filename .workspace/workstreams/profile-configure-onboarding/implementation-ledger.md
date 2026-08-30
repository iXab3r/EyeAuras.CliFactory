# Profile configure onboarding — implementation ledger

Issue: [#3](https://github.com/iXab3r/EyeAuras.CliFactory/issues/3)

Phase | Scope | Status | Agent | Review
---|---|---|---|---
P1 | Core configuration state | done | factory-core maintainer | reviewed
P2 | Generic profile configure | done | factory-core maintainer | reviewed
P3 | TeamCity explicit guest demo | done | service integration author | reviewed
P4 | Public contract and close-out | done | Reconciliation Lead | reviewed

## Evidence log

### 2026-08-30 — workstream opened

- Contract source: Issue #3.
- Baseline: profile/auth/permission/AppArguments changes are present but uncommitted; they are preserved.
- Live public evidence: `https://teamcity.jetbrains.com/guestAuth/app/rest/server` returned HTTP 200
  without a token before implementation.
- Next action: add failing core tests for incomplete/configured profile state.

### 2026-08-30 — P1/P2 core implementation reviewed

- `ProfileField.required` drives service-command preflight without integration terminology in Core.
- `profile configure [name]` uses declared field options, secure auth validation/storage, TTY-only
  prompts, and deterministic non-interactive errors.
- Focused evidence: `node --test packages/core/dist/tests/profile-configure.test.js` — 9 passed.
- The suite covers handler denial, explicit/default configuration, root and leaf TTY onboarding,
  masked interactive token input, stdin token setup, JSON-RPC errors, and protocol-stdin protection.

### 2026-08-30 — P3 TeamCity guest implementation reviewed

- TeamCity has no source default URL; existing persisted URL/token profiles need no migration.
- Guest profiles use `/guestAuth/app/rest` and omit `Authorization`; token profiles retain bearer
  auth and OS-backed profile secrets.
- Focused evidence: TeamCity CLI plus client-foundation tests passed with explicit mocked guest and
  existing token paths.

### 2026-08-30 — P4 close-out

- Public docs now describe incomplete defaults, generic onboarding, non-interactive behavior, and
  the explicit `https://teamcity.jetbrains.com` guest example.
- Organization-specific endpoint scan:
  Reviewed the source tree for organization-specific endpoint references; no matches remained.
- Final verification: `npm test` — core 14/14 passed; TeamCity 23 passed and the opt-in live smoke
  skipped as designed.
- Diff hygiene: `git diff --check` — clean.
- Known failure set: none. OAuth/PKCE and automatic demo-server access remain explicitly out of scope.
- Final verdict: complete; ready for commit, CI, and Issue #3 closure.
