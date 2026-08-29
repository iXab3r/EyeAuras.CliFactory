# Testing workflow

AI CLI Factory uses mock-first development while keeping a narrow path to real-service evidence.
The default test suite must be safe to run offline and must never require credentials.

## The auth-first development loop

1. Start with a walking skeleton: profile fields, authentication, and the cheapest identity/status
   command that proves the service is reachable.
2. Build the real CLI and configure a named current-user profile through `profile configure`; let
   the normal OS credential store own its secret.
3. Run the integration's explicit local read-only proof through the packaged CLI process.
4. Inspect only the fields needed for the next user-visible command. Obtain them from that proof or
   from official documentation.
5. Sanitize the smallest useful example before it enters the repository.
6. Write an MSW handler at the native `fetch` boundary and a failing client/command test.
7. For side effects, prove a disabled permission rejects before the MSW handler is reached.
8. Implement only the behavior required by that test, then re-run the local proof while debugging.
9. Run focused mocked tests and the repository check before merging.

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
| Local profile-backed proof | Never | Explicit development/debug evidence through a real CLI profile |

## Local profile-backed integration proof

Every real integration should grow one explicit proof command as soon as authentication works. The
proof uses the compiled executable, a required profile name, the normal current-user profile store,
and the normal OS keyring. It must not accept a test-only endpoint or credential: URL/token injection
can prove a client while bypassing the product path that users actually depend on.

The proof is physically separate from unit/mocked test globs and from `npm test`. Its script refuses
known CI environments before starting a child process or network call. Do not add it to GitHub
Actions, scheduled automation, release workflows, or a generic workspace test command. Running it is
an explicit local developer action and its result is proof-of-work for the current machine/profile,
not a merge gate or availability monitor.

Safety comes from construction:

- require an explicit profile and invoke only the packaged CLI;
- keep a fixed internal command inventory containing only bounded `ReadOnly` leaves;
- never accept arbitrary argv, even if the selected profile currently has `Update` enabled;
- limit collection sizes and treat empty pages as valid, with dependent detail calls skipped;
- parse responses in memory and print only method/pass/count summaries;
- never persist raw payloads, credentials, discovered URLs, IDs, logs, or proof artifacts;
- convert any useful real response into a separately reviewed, minimal sanitized MSW fixture.

Mocked tests remain the durable regression suite because they are deterministic and safe. The local
proof answers a different question: “Does the real built product work with this real profile now?”

### TeamCity migration note

TeamCity currently has a legacy opt-in smoke that injects `TEAMCITY_URL` and `TEAMCITY_TOKEN` into a
direct `TeamCityClient`. It reaches the server but does not prove the compiled CLI/profile/keyring
path and is discovered as a skip by the default suite. Do not copy this pattern. Its replacement is
planned in [Issue #4](https://github.com/iXab3r/EyeAuras.CliFactory/issues/4) and the linked
`teamcity-profile-integration-proof` workstream.

Until that replacement ships, the legacy smoke remains available explicitly:

```text
TEAMCITY_INTEGRATION=1 TEAMCITY_URL=https://teamcity.example.com TEAMCITY_TOKEN=<external-token> npm test
```

It performs only bounded GET requests for authentication, server, projects, jobs, builds, queue,
and agents. It never records responses or exercises the three mutation commands, but it is not the
factory template for new integrations.

## Required evidence

Changes to application-data behavior use an injected `AppArgumentsEnvironment`; tests never redirect
the real user's folders. Cover the exact `RoamingAppDataDirectory/Profile` composition, separation of
at least two profiles, and deletion of a profile-owned directory when lifecycle semantics change.
For JSON-RPC, prove that two requests selecting different profiles receive different
`AppDataDirectory` values without restarting the process.

For a change in `packages/core`, run the core tests and at least one affected integration test. For
a change in an integration, run its mocked tests. Before a commit intended for `main`, run:

```text
npm test
```

Do not call a test mocked when it bypasses the actual HTTP parsing or command handler under test.
Mock the boundary, not the implementation.

For the end-to-end authoring sequence and repository placement, see
[`integrations.md`](integrations.md).
