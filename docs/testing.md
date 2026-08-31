# Testing workflow

Runtime correction regressions cover common UTF-8 argv limits, pre-parse bounded JSON-RPC
lines and input/output backpressure; parsed-command exclusivity; serialized full auth checkpoints;
flat resource invalidation/disposal, direct browser disposal with video and its timeout path;
workspace build-manifest drift; cross-build control and isolation after a rejected RPC Run;
passive auth readiness versus active status; logout-before-invalidation and failed-revoke retention;
headed/no-restart reuse; real-client env/profile isolation; early validation and prompt, sanitized
child startup failures while concurrent cold starts still elect one owner; control with invalid
launch limits; selected-profile show and literal RPC flags across CLI/execute/RPC; help with an
unavailable keyring while service readiness still fails correctly; generation-aware crash recovery,
retirement of unused startup children, premature stdin close, failed stdout/stderr and diagnostics,
late write errors after cancellation, peer isolation and caller-listener cleanup.
These are offline tests with synthetic profiles/pages and temporary build fixtures. Updating
only one workspace does not publish hosted readiness: use the root build before process tests.

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
| CLI process / IPC | Yes | Real process reuse, concurrency, exit/stdio, cancellation and shutdown |
| Browser fixture | Yes | Real headless/headed Chromium, routed synthetic pages, auth state, video and cleanup |
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

### TeamCity

Configure a local profile through `profile configure`, then run:

```text
npm run test:integration --workspace @eyeauras/teamcity-cli -- --profile <name>
```

The command builds Core and TeamCity first, then invokes the compiled CLI through that profile. Its
19 proof rows cover local permission inspection, authentication, bounded collection/detail reads,
build diagnostics, VCS root discovery and a two-request JSON-RPC session. Unpaged scoped authoring
lists are not included; their behavior and all mutations are proven with MSW. It accepts no endpoint or token override and
refuses `CI` or `GITHUB_ACTIONS` environments before launching the CLI.

### RANDOM.ORG examples

`integrations/random-rest` uses MSW at native fetch and a test-only AppArguments environment for
packaged-process checks. It is anonymous: no keyring credentials or fake login are needed.
The explicit `npm run test:integration --workspace @eyeauras/random-rest-cli -- --profile <name>`
uses a normally configured current-user profile, including its operator contact for User-Agent.
Its four `node:test` cases cover signed-range integers, repeated draws from 0..1, a signed sequence
and a minimal two-item sequence (15 values total). Every case invokes the packaged CLI and checks output
shape/range/uniqueness without printing the values. They run sequentially; after the first failure,
remaining cases are skipped. A zero-test runner result is a failure, not a successful live proof.
The default offline suite rehearses this exact runner and child processes under MSW; only an
explicit run against the real service is live evidence. Never run parallel live proofs.

`random-pw-cli` uses the same four-case inventory and separate `test:integration` script.
Default browser tests use Playwright context routing, reject unknown requests, and exercise real
forms, DOM parsing, persistence, cancellation and browser-process cleanup. MSW is not a browser
network boundary. The packaged-browser test rehearses the exact proof harness against synthetic
pages and proves one browser launch across separate clients.

Install Chromium explicitly before the default suite with `npm run browser:install` (CI adds
`-- --with-deps`). Missing required binaries fail tests; no silent skip is permitted. Real-service
proof never runs in CI. Process tests stop their own hosts before deleting synthetic AppData.
Transport tests run on real local named pipes/Unix sockets, not TCP substitutes. See the
[platform evidence](../.workspace/workstreams/random-playwright/implementation-ledger.md).

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

## Browser observation regressions

Headed tests require a real or virtual graphical display: use
`xvfb-run --auto-servernum npm test` on display-less Linux. Windows/macOS CI use their graphical
sessions. Missing display support is not a skipped acceptance test.

Use synthetic pages only when testing video. Verify finalized nonempty WebM files before runtime
disposal, separate operation/profile directories, opt-out after an opt-in call, and saving during
errors/cancellation. Mode tests assert actual Chromium mode, reuse, fair draining, cancelled
waiters, overload and the application's no-restart policy. Packaged tests inspect host/browser
identities and stderr-only artifact paths through both ordinary CLI and tunneled JSON-RPC.
Test cleanup stops its own host/runtime before deleting its own synthetic AppData and videos.
Never enable video in the fixed real-service proof or turn raw recordings into fixtures.
