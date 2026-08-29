# Profile configure onboarding — implementation plan

Lifecycle: `complete`

Issue: [#3](https://github.com/iXab3r/EyeAuras.CliFactory/issues/3)

## Goal

Ship the onboarding contract owned by Issue #3 without weakening profile isolation, protocol stdout,
or secure credential storage. Existing configured profiles must remain readable without migration.

## Constraints

- Core remains service-agnostic; TeamCity guest URL/path behavior stays in the integration.
- The virtual default profile may be incomplete, but the profile collection is never empty.
- Interactive prompts run only on an ordinary TTY execution; JSON, JSON-RPC, and non-TTY paths never
  wait for input unexpectedly.
- Secrets use the declared auth flow and OS credential store; profile files remain non-secret.
- Preserve the uncommitted AppArguments work already present in the working tree.

## Phases

### P1 — Core configuration state

Scope: required profile fields, configured/incomplete inspection, and deterministic preflight errors.

Gate: focused core tests prove empty default, configured existing profile, per-profile isolation, and
handler denial before execution.

### P2 — Generic profile configure

Scope: `profile configure [name]`, dynamic field options, TTY prompts, non-interactive flags/stdin auth,
and reuse of the existing auth validation/storage path.

Gate: focused core tests prove interactive token setup, flag-driven token setup, no prompts in JSON or
JSON-RPC, and built-in recovery availability.

### P3 — TeamCity explicit guest demo

Scope: remove the integration default URL, add profile-selected token/guest authentication, and support
an explicit JetBrains demo profile without automatic network access.

Gate: MSW tests prove guest URL prefix/no Authorization header, token behavior is unchanged, and a fresh
TeamCity CLI reports incomplete configuration.

### P4 — Public contract and close-out

Scope: update canonical/public docs, remove organization-specific defaults/examples, run repository-wide
verification, and reconcile Issue/workstream acceptance.

Gate: `npm test`, public-hostname scan, diff hygiene, ledger close-out, and Issue acceptance update.

## Review protocol

The implementing core/integration role moves each phase to `awaiting review` with exact evidence. The
root orchestrator checks code, tests, docs, and Issue agreement before marking the phase `done`.
