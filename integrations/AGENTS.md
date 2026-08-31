# Integration agent guide

Role: **service integration author**.

Read the root `AGENTS.md`, `docs/DESIGN.md`, `docs/integrations.md`, and `docs/testing.md` first.

- Use the service's own vocabulary and small DTOs containing only consumed fields.
- Build commands as a discoverable tree. Branches group resources; leaves return domain data.
- Use the factory's profiles, auth, output, and JSON-RPC facilities instead of reimplementing them.
- Enable permission gates for agent-facing integrations. Every service leaf must declare
  `ReadOnly`, `Update`, or a documented custom category. Status/list/get commands are `ReadOnly`;
  commands that trigger, cancel, create, modify, delete, upload, or comment are at least `Update`.
- HTTP clients depend on native `fetch` and mock it with MSW; browser clients use real Playwright
  with context routing/local fixtures in default tests. Do not add an HTTP wrapper until a real repeated
  need survives two integrations.
- Authentication validation may identify the current user but must never return or log the token.
- Keep real-service proof outside default tests and CI. It must invoke the packaged CLI through a
  real current-user profile/keyring and a fixed bounded `ReadOnly` inventory; never forward
  arbitrary argv or accept test-only URL/token injection.
- Fixtures must be public-safe and minimal.

Required evidence: focused mocked tests for the changed client/command and `npm test` before merge.
