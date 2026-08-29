# Integration agent guide

Role: **service integration author**.

Read the root `AGENTS.md`, `docs/DESIGN.md`, and `docs/testing.md` first.

- Use the service's own vocabulary and small DTOs containing only consumed fields.
- Build commands as a discoverable tree. Branches group resources; leaves return domain data.
- Use the factory's profiles, auth, output, and JSON-RPC facilities instead of reimplementing them.
- Depend on native `fetch` and mock it with MSW. Do not add an HTTP wrapper until a real repeated
  need survives two integrations.
- Authentication validation may identify the current user but must never return or log the token.
- Real-service tests are opt-in and read-only unless mutation is unmistakably requested.
- Fixtures must be public-safe and minimal.

Required evidence: focused mocked tests for the changed client/command and `npm test` before merge.
