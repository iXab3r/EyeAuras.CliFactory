# Testing workflow

AI CLI Factory uses mock-first development while keeping a narrow path to real-service evidence.
The default test suite must be safe to run offline and must never require credentials.

## The loop

1. Start with one user-visible command and its expected domain result.
2. Obtain a response from official documentation or an explicit opt-in call to the real service.
3. Sanitize it before it enters the repository.
4. Write an MSW handler at the native `fetch` boundary and a failing client/command test.
5. For side effects, prove a disabled permission rejects before the MSW handler is reached.
6. Implement only the behavior required by that test.
7. Run the focused test, then the repository check before merging.

This is TDD with service evidence: authentication opens the door to discover the real contract;
mocked tests make the discovered contract fast, deterministic, and reviewable.

## Fixture safety

Never commit:

- access/refresh tokens, cookies, authorization headers, passwords, or private keys;
- internal user e-mail addresses or personal names;
- private hostnames unless the repository owner has explicitly made them part of the product;
- build logs, source fragments, artifact URLs with signatures, or environment variables;
- identifiers that are not required to explain the contract.

Prefer the smallest hand-authored fixture that preserves the fields the client consumes. If a
recorded response is used, redact it before saving and review the staged diff as if it were public.
Tests should fail when required fields drift, not snapshot every byte returned by a service.

## Test tiers

| Tier | Runs by default | Purpose |
|---|---:|---|
| Unit | Yes | Command definitions, output, profile and auth behavior |
| Mocked service | Yes | HTTP request/response contracts through MSW |
| CLI process | Yes when added | Exit codes, stdout/stderr separation, JSON validity |
| Real integration | No | Explicit contract discovery and smoke checks |

Real integration tests require both an opt-in flag such as `TEAMCITY_INTEGRATION=1` and credentials
provided outside Git. They must be read-only unless the command and test name make mutation
unmistakable. A skipped real-service test is expected in CI, not a missing test failure.

## Required evidence

For a change in `packages/core`, run the core tests and at least one affected integration test. For
a change in an integration, run its mocked tests. Before a commit intended for `main`, run:

```text
npm test
```

Do not call a test mocked when it bypasses the actual HTTP parsing or command handler under test.
Mock the boundary, not the implementation.

For the end-to-end authoring sequence and repository placement, see
[`integrations.md`](integrations.md).
