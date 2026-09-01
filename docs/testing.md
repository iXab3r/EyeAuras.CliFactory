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

TeamCity and YouTrack import the separate `@eyeauras/cli-factory/proof` entry. Their runners call
`parseProofProfile(argv, environment)` before invoking even an injected test invoker. It accepts
only `--profile <name>` using Core's profile-name rules. CI preflight recognizes nonempty `CI`,
`GITHUB_ACTIONS`, `TF_BUILD`, `BUILD_BUILDID`, `TEAMCITY_VERSION`, `JENKINS_URL` and `BUILDKITE`
variables regardless of casing; a value of `false` still means the variable is present.

`createProofInvoker({ executable, environment?, credentialEnvironment?, timeoutMs?, maxOutputBytes? })`
takes a packaged-entry file URL and returns a function accepting code-owned `{ argv, stdin? }`.
It checks CI again before every spawn, removes named credential variables case-insensitively,
closes stdin after writing, and returns stdout only on exit zero. Defaults are 30 seconds per child
and 65,536 bytes **per stream**, with stderr drained without retention. Limits must be positive
safe integers; timeout is at most 2,147,483,647 ms. Startup/input/output failure, timeout and byte
overflow terminate the child and close its pipes before settlement; errors never include raw child
diagnostics. Integration code parses JSON/RPC and prints only its own safe method/count summaries.

Offline Core tests use synthetic Node children to exercise this process boundary without profiles,
keyrings or a network. Integration tests still assert their complete fixed inventories and service
shapes. Success requires the expected number of rows, at least one passed row, and no failed rows;
dependent skips cannot hide a failed source read. There is no shared endpoint registry or report DSL.

### TeamCity

Configure a local profile through `profile configure`, then run:

```text
npm run test:integration --workspace @eyeauras/teamcity-cli -- --profile <name>
```

The command builds Core and TeamCity first, then invokes the compiled CLI through that profile. Its
19 proof rows cover local permission inspection, authentication, bounded collection/detail reads,
build diagnostics, VCS root discovery and a two-request JSON-RPC session. Unpaged scoped authoring
lists are not included; their behavior and all mutations are proven with MSW. It accepts no endpoint
or token override, removes `TEAMCITY_TOKEN` regardless of casing, and uses the shared CI preflight.
The 64 KiB per-stream bound replaces TeamCity's formerly unbounded capture; oversized responses now
fail the affected row instead of accumulating indefinitely. The two RPC requests still share one
child process and both response envelopes and service results must validate.

### YouTrack

`npm run test:integration --workspace @eyeauras/youtrack-cli -- --profile <name>` runs the existing
24 fixed ReadOnly rows. Service projections, ID validation, bounded pages and dependent skips stay
in the integration. It uses the same 30-second/64-KiB process bounds and removes `YOUTRACK_TOKEN`
regardless of casing. Failed/denied reads remain failures; empty prerequisite lists skip only their
dependent reads. The proof neither prints service payloads nor expands its inventory dynamically.

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

## Bounded response regressions

The shared response-reader tests cover absent/empty bodies, declared-length syntax and identity
length mismatches, actual chunked-byte overflow, split UTF-8/BOM bytes, empty chunks and reused
producer buffers, abort/read failures, and deterministic reader-lock cleanup. A synthetic local
HTTP server verifies native fetch decompression: compressed overhead may exceed the decoded bound
when the actual body fits, while decoded overflow still fails. This loopback test uses no profile,
credentials or real service. MSW tests in both integrations retain service decoding, status,
empty/null mutation and privacy contracts, and an unread response clone cannot block cancellation.

## Safe profile-file regressions

Core publication tests use only synthetic temporary AppData. They cover basename/path/device
preflight before acquisition, directory links and replacement, private stage/file identity,
complete partial writes, empty and bounded streams, cancellation, validation, no-clobber races,
unsupported hard links, post-link destination replacement and cleanup failure before/after
publication. Replacement tests assert that unknown files are retained rather than deleted.
Integration MSW tests retain 206, Content-Length, stream/cancellation and service format/auth rules.
Encoded whole-file responses keep each service's conservative wire-header bound, skip encoded
length equality, and still enforce emitted-byte overflow. No live download belongs in any tier.

## Required evidence

Shared option-parser regressions cover signed/unsigned decimal spelling, leading zeros, safe bounds,
invalid JSON and non-echoing errors without causes. Core exercises required options and declared
defaults through CLI, execute and persistent RPC. TeamCity and YouTrack exercise real native-fetch
paging plus invalid input in unconfigured TTY, JSON, execute and RPC calls before credentials or HTTP.
TeamCity also retains repeated JSON order and strict numeric-ID validation. YouTrack range/overflow
rejection now occurs before onboarding; direct-client domain validation stays covered separately.

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

## Shared offline CLI fixture

Import `createCliFixture` from `@eyeauras/cli-factory/testing`; the ordinary package export
does not initialize or re-export testing utilities. The fixture creates a canonical temporary
root, isolated AppArguments, memory secrets and a real ProfileStore view. Omitted `profiles`
leaves the virtual default unconfigured. Explicit profile entries contain `name`, non-secret
`values`, optional exact `permissions` and optional synthetic `secrets` keyed by credential name.
Nothing logs in, launches a browser, grants Update, installs mocks or contacts a service.

Create every application through `fixture.createApplication(runtime => ...)`. It passes the
isolated runtime to the real integration factory and records its application for disposal.
The exposed ProfileStore supports preparation/inspection of the real document; it is not injected
by default, because Core must preserve the integration's profile defaults and validation.
A non-default `defaultProfile` requires explicit profile preparation to persist that identity.

Register the fixture with the current node:test context before other setup. Cleanup is registered
before profile preparation and application creation; it disposes all registered applications in
reverse order before checking the root's identity and removing only that owned directory.
A changed root is retained and reported. A failed application shutdown also retains temporary data,
since resources may still use it. Failed test assertions still run the registered cleanup.

Use the application's `execute` for domain results and the fixture's `stdout()`, `stderr()` and
`resetOutput()` for existing runtime-stream tests. `run(app, argv, invocation?)` returns
`{ exitCode, stdout, stderr }` using fresh captured streams, fixture cwd and an empty environment
unless explicitly supplied. `json(app, argv, invocation?)` parses successful JSON output;
`rpc(app, commandArgvList, invocation?)` sends successive requests through one real RPC session.
Both require a successful transport/CLI exit; RPC command errors remain response objects.
The raw application's `execute` and `run` retain their normal environment semantics; auth tests
must explicitly provide synthetic environment inputs when those inputs are under test.

TeamCity's support adapter retains its declared synthetic URL/token and existing independent
ProfileStore/AppArguments overrides; `createCli()` registers each application with the fixture.
Its profile-isolation suite uses the unconfigured shared fixture directly. YouTrack's adapter is
unconfigured and retains only profile-path observation plus its actual application factory.
Both integrations' ordinary, authentication and persistent RPC suites use these adapters.

Specialized fixtures remain where their purpose differs: TeamCity's hostile download roots and
YouTrack's direct download roots exercise path replacement and filesystem publication; upload
tests create separate synthetic input files; TeamCity packaged-process tests require process-owned
AppData. These do not become service-aware options on the shared fixture. TeamCity's separate
download-root cleanup disposes its applications before removing the root. Existing Core lifecycle
and optional runtime fixtures remain focused on their own lower-level/process/browser contracts.
### Shared command-contract assertions

The testing entry point also exports small independent assertions. `assertHttpRequest` checks
an independently authored method, origin/path, exact query (including repeated values), selected
headers and optional JSON/text body. Omitted body means no request body. Service response shaping,
unusual multipart/preflight behavior and MSW handlers remain ordinary integration callbacks.

Wrap a catch-all MSW handler with `trackRequests(t, expectedCount, respond)` and delegate to its
`handle(request)`. It records every request, rejects excess calls and registers final verification
with the test context. Resolver assertion failures are rethrown outside MSW, rather than disappearing
behind the CLI's sanitized HTTP error. Tests still compare the independently authored domain result.

`assertPermissionDenied(app, argv, category, requests)` requires an explicit category and zero
service requests. It never infers permissions or grants them. `assertCliOutput(fixture, app, argv,
expected, humanPattern, requests)` is specifically for repeatable mocked commands with exactly one
HTTP request per invocation: it verifies human and JSON output separately on the same application,
including the per-mode request count. Multi-request workflows retain their direct assertions.
`assertSafeCliFailure` checks exit status, empty stdout, expected stderr and caller-supplied forbidden
patterns. No automatic redaction or broad snapshot comparison is implied.

Current samples cover TeamCity's explicit Update JSON/text/204 authoring workflow and operator
list/detail/create, RPC and sanitized failures, plus YouTrack catalog and work-time reads/mutations,
disabled ReadOnly/Update and multi-profile RPC recovery. The larger pre-existing TeamCity case loops
and specialized endpoint/security tests remain direct tests; their legacy method-based permission
selection is not a feature or guarantee of these helpers.


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
