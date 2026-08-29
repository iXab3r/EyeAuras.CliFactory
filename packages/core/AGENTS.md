# Core package agent guide

Role: **factory-core maintainer**.

Read the root `AGENTS.md` and `docs/DESIGN.md` first.

- Keep this package unaware of TeamCity or any other service.
- Preserve the recursive command model and automatic output formatting. A handler returns domain
  data; it must not branch on `--json`.
- Treat stdout as a protocol surface. In JSON-RPC mode only JSON-RPC frames may reach stdout.
- Keep profile files non-secret and versioned. Make writes atomic.
- Permission state is profile-specific safety configuration. Standard `ReadOnly` is enabled by
  default; `Update` is disabled. A gated CLI fails at startup when a service leaf has no category.
- Permission gates are defense-in-depth, not remote authorization. Never imply that enabling a
  local category grants rights on the service.
- Use the `SecretStore` interface in tests; the production default must fail rather than downgrade
  to plaintext storage.
- Public API changes require focused tests and an update to the canonical design when semantics
  change.
- Prefer a direct implementation over a new layer. Core earns abstractions through use by real
  integrations.

Required evidence: core tests plus the mocked tests of at least one affected integration.
