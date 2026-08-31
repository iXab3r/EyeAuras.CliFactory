# Optional IPC and browser automation

Core remains usable without a daemon or browser. Two opt-in packages implement the current slice:
`@eyeauras/cli-factory-ipc` and `@eyeauras/cli-factory-playwright`. Both RANDOM.ORG examples use
IPC; only `random-pw-cli` imports the browser module. Neither module is a plugin/DI system.

## Application ownership

`createCli` returns `run(argv?, invocation?)`, `execute(argv, signal?)`, and async idempotent
`dispose()`. A standalone executable owns cleanup:

```ts
const app = createCli(createExampleDefinition());
try { process.exitCode = await app.run(); }
finally { await app.dispose(); }
```

An embedding caller disposes after its last call. A definition registers `resources: [browser]`,
or other objects implementing `dispose()` and optional `invalidateProfile(appArguments)`.
Core deduplicates resources and snapshots their list at construction; it attempts every cleanup
in reverse registration order even if one fails. Repeated dispose callers share the same result.
Cleanup must handle partial initialization. Disposal rejects new work, cancels the lifetime signal,
waits up to five seconds for commands and always disposes resources. Cleanup itself must terminate;
arbitrary application code cannot be forcibly stopped safely inside Node.

Core automatically invalidates the affected profile on configure/set/delete, while holding its
exclusive command admission. Each resource receives that profile's AppArguments, not its secrets.
On delete, app-owned logout/revocation runs first while resources are still usable. A failed logout
prevents Core invalidation/deletion so the caller can retry; Core cannot undo app-owned side effects.
Profile selection alone does not invalidate another profile. Direct ProfileStore mutations outside
the CLI are not lifecycle events: embedding callers own coordination for such external changes.
There is no resource registry, lookup API, dependency ordering or service locator.

Each invocation has its own input/output/error streams, signal, cwd and environment snapshot.
Handlers access them through `context.io`, `context.signal`, `context.cwd` and
`context.environment`; do not mutate process globals. Streams supplied by a caller remain owned
by that caller. Domain handlers still return data; explicit stream use is for actual streaming
work, not a second JSON renderer.

Root help outside interactive onboarding does not access profile/auth storage. Service readiness
is unchanged. `profile show` without a positional name displays the invocation's selected profile;
an explicit positional name selects the displayed profile instead, without changing the default.

`concurrency` is a positive application-wide command limit; omitted/Infinity adds no execution
limit. Core has a bounded FIFO (128 pending commands); queued cancellation removes only that
entry. Running work retains its slot until it settles, even after cancellation. Profile/auth/
permission built-ins coordinate exclusively with service commands, selected by the parsed command's declaration, not strings appearing in argv. Onboarding re-enters exclusive admission before configuration
effects and rechecks profile/policy before running the handler once. Profile file read-modify-write
operations are serialized within the owner process. There is no public scope or scheduler model.

A JSON-RPC session is one invocation but takes command slots only while executing its requests.
An idle JSON-RPC session does not block other clients' commands.

Only a sole `--json-rpc` argument starts the transport. The ordinary command parser rejects other
actual uses of that global option before handlers (CLI exit code 2); it does not reinterpret a
literal after `--` or inside `--option=--json-rpc`. Use attached option values when a value equals
a global flag. Embedded execute/RPC requests cannot recursively start another transport.

The common argv validator permits at most 256 arguments, 8 KiB UTF-8 per argument and 32 KiB
in total on CLI, programmatic, JSON-RPC and IPC paths. RPC lines are bounded at 256 KiB before
decoding/parsing, including unterminated input. Oversized argv returns -32602 without executing;
an oversized line fails that Run, not the host or peer clients. Input is pulled as requests finish
and output becomes writable; no unbounded readline/parsed-request queue is maintained.

## Enable the IPC server

Import `runHosted` from `@eyeauras/cli-factory-ipc`. This is a separate optional feature: Core does
not import the transport or add its commands. The entry point supplies only its file URL/absolute
path and a factory of the ordinary definition:

```ts
process.exitCode = await runHosted({
  entryPoint: import.meta.url,
  createDefinition: createExampleDefinition,
});
```

The factory returns a fresh `CliDefinition` for each owner. Use the same factory with `createCli`
in embedded tests. The runner adds management commands, derives applicationId from the definition
(name by default), and handles cleanup. Each process constructs and validates one Core application
before build lookup or spawn, including foreground relays. Definition construction and resource
constructors must be cheap and effect-free: do not launch browsers or contact services there.
Resources are disposed even after failed validation/build/start. Custom runner options remain
`idleTimeoutMs`, `maxInvocations` and `nodeArguments`; none are required by the examples.

Declare caller env where it is consumed, not in the entry point:

```ts
return {
  // ...ordinary definition...
  auth: tokenAuth({ env: "EXAMPLE_TOKEN" }), // automatically forwarded for login
  environmentKeys: ["EXAMPLE_REGION"],     // optional application-owned inputs
};
```

The host unions definition/auth keys. Custom auth may declare `auth.environmentKeys` itself.
Each caller sends a fresh allowlisted snapshot; missing keys remain missing, even if the host was
started by a caller with those values. Read `context.environment`; process.env belongs to the host
process and is not updated per invocation. No mutation/serialization of global env is performed.
Standalone execution keeps its ordinary process-env snapshot. These inputs are not logged or
stored by the host; auth explicitly persists credentials through the existing scoped secret store.

### Build compatibility

The supported path is this locked npm/TypeScript workspace: `npm run build` (or `npm test`).
The shared build script discovers workspace manifests, builds local dependencies first and writes
root `.cli-build.json` atomically only after all builds succeed. It removes the prior readiness
marker before starting, so an interrupted build fails closed. New integrations need no hash list
or root build-command edit; declare their local dependencies in package.json normally.

Before service work, the runner validates the manifest against deployed dist JS/JSON/proto/native/
WASM files, runtime scripts, workspace package manifests, root and installed npm locks, Node version
and platform. Test directories, source-only edits, absolute checkout paths and the marker itself
are excluded. The PW module declares its patched dependency bundle as a runtime input in its
own package.json; this is a runtime-maintainer detail, not application bootstrap code.

This is a conservative **whole-workspace** fingerprint. Changes to another built CLI can invalidate
the running host too. Validation rehashes files on launch: this costs disk I/O but catches stale,
mixed or partial artifacts. It is a compatibility check, not a tamper-proof signature or hot reload.
Installed dependencies are assumed immutable under their lock, except explicitly declared runtime
inputs. External linked packages, bundlers, single-file executables and arbitrary build layouts
are not supported by this initial build path. Do not copy the helper as a universal packager.

After changing compiled code/dependencies/patches, run the root build, then `ipc-server stop` and retry.
Missing/stale manifests fail before spawning a host or sending service work. Status/Stop skip
manifest and launch-only `idleTimeoutMs`/`maxInvocations` validation, so invalid limits do not
prevent inspecting/stopping an existing owner or cause an absent owner to start. They still require
a loadable valid CLI definition and a matching control protocol. A successful workspace-only tsc
is not the publication step.

A foreground invocation connects or spawns the same executable in internal host mode. The host
creates exactly one application and keeps its resources until shutdown. Status/stop use ordinary
Core command declarations but execute locally and never start a host:

```text
random-pw-cli ipc-server status --json
random-pw-cli ipc-server stop --json
```

The startup handshake and Run must match protocol and build before work is sent. An incompatible
build does not start a competing writer. Status/Stop require only matching control protocol,
allowing the new executable to inspect/stop the old host; they never send a domain command.
Readiness has a 20-second deadline. Service Run validates host limits before build lookup/spawn;
Core declarations validate on all paths, with actionable errors. Known child startup failures return promptly with fixed
diagnostics for definition construction, build, AppData access, ownership or IPC endpoint setup.
Private exit codes identify the failure phase; raw child stderr/error details are not forwarded or
stored. Check the named phase locally rather than expecting remote stack traces. A child that
loses a cold-start ownership race does not fail its client while the elected owner is becoming
ready; the client continues waiting for that owner. No command is sent before readiness and no
startup failure replays service work. An unresponsive live child still uses the bounded timeout.
Idle shutdown defaults to 60 seconds with no active Runs;
startup gets at least 20 seconds for its first caller. An open gRPC channel or browser alone
does not keep the host alive. An open JSON-RPC Run *does* keep it alive until EOF/cancellation.

The optional `maxInvocations` safety cap defaults to 128 active Runs, including queued commands
and JSON-RPC sessions; an app can raise it or use Infinity. This is separate from command
concurrency. The fixed Core queue still refuses overload explicitly. A rejected or disconnected
invocation is never silently retried. Stop cancels active work and disposes resources; transport
shutdown gets five seconds after application disposal.

### Protocol and platform boundary

The small protobuf service has bidi `Run` and unary `Status`/`Stop`. Official
`@grpc/proto-loader` tooling generates TypeScript contracts during build. There is no custom
binary framing or raw `node:net` transport.

Each Run starts with argv/protocol/build/cwd/allowlisted environment, followed by stdin byte
frames. Client EOF half-closes stdin; cancellation is gRPC cancellation. Responses are stdout
bytes, stderr bytes and one terminal exit code. Success requires both Exit and final gRPC OK.
The frontend does not parse domain output. Byte order is preserved within each stream; stdout
and stderr are separate sinks, not a promise of cross-stream terminal ordering.

Premature stdin close (without EOF) cancels its Run, including an input already destroyed on
entry. A closed/failed output sink cancels only that invocation, even between writes; it does
not require a process-global error handler from the application. Relay never destroys caller
streams. Invocation listeners detach on completion; an already pending write retains its error
handler until its callback/error/close settles, so cancellation cannot turn a late write failure
into an uncaught exception. Custom Writable implementations must obey Node's stream contract
and eventually settle pending writes or be closed by their owner.

Frames contain at most 16 KiB of stream bytes; protobuf messages are capped at 64 KiB. The relay
honors backpressure and refuses an output stream exceeding 1 MiB of queued data, including a
single oversized write. Stream large results in bounded writes. Disconnect may leave a remote
action's outcome unknown; the message says so, and no automatic replay occurs.

This is a noninteractive stdio bridge, not a PTY. Raw mode, masked terminal input, terminal
resize, arbitrary file descriptors and process-global chdir/env emulation are outside this slice.
Use explicit configuration flags, allowed environment inputs or token stdin. Token stdin is
unavailable inside JSON-RPC, where stdin already belongs to the protocol. Application browser
login can open its own headed browser when deliberately configured; the transport does not
invent a universal login flow.

### Ownership and access

IPC uses grpc-js over Windows named pipes (`unix:////./pipe/...`) or Unix domain sockets.
There is no TCP listener. Endpoint identity is derived from application AppData, not checkout.
Application-wide runtime metadata lives in `RoamingAppDataDirectory/.runtime`, outside the
profile namespace. A proper-lockfile lease plus live-PID check prevents competing owners.
A live PID is never considered stale just because its event loop stalled. Cold-start losers
exit rather than wait to resurrect a stopped server. A caller that connects to an elected peer
terminates only its own unused startup child, never that peer. Dead-owner recovery respects the
lease's ten-second stale interval, checks the observed owner while waiting and rechecks it after
acquisition. Changed or removed owner metadata ends that stale recovery attempt; a successful
Stop does not give old waiters permission to launch a replacement. A later explicit invocation
can start a new host normally. A crash before owner metadata is written can require another launch
after that interval; startup reports failure without sending a command.

Dedicated runtime/browser directories are current-user-only (Windows protected DACL / Unix
0700), and endpoints are restricted before readiness (Windows DACL / Unix 0600).
Permission failures are fatal; there is no TCP or plaintext-secret fallback. PowerShell is used
only to apply Windows OS access controls, never to frame or transport messages. These controls
do not isolate hostile code already running as the same user, or privileged administrators.
Browser state is not encrypted by this helper and may be included in AppData backups.

## Browser owner and application auth

`BrowserRuntime` lazily launches one Chromium, headless by default; `headless:false` is an
explicit owner choice. `withPage({appArguments, baseURL, userAgent?, persistAuth?}, signal, action, options?)`
reuses a profile context and closes the operation page and owned popups in finally. Config fingerprint
changes replace that context after active browser operations drain. `invalidateProfile(appArguments)`
closes profile resources; Core invokes it through the resource contract. `dispose()` cancels
queued/active work and waits for operations, page closure and video finalization before closing
contexts and Chromium. Its five-second operation-drain deadline forces cleanup and reports failure
with possible partial artifacts; it does not bound arbitrary custom callbacks or OS I/O.
A crashed browser is recreated only for a *subsequent* invocation;
an action in progress is not replayed.

The integration owns selectors, navigation, login completion, authorization status, logout and
result validation. Use `BrowserOperationError` only for deliberately sanitized application
diagnostics. Raw Playwright errors/call logs are replaced with bounded categories. No automatic
screenshots, traces, HTML captures or challenge bypass are enabled.

`persistAuth:true` explicitly stores `browser/auth-state.json` below that profile's
`AppDataDirectory`, with atomic checkpoints and current-user access. It contains Playwright
cookies, localStorage and IndexedDB plus a configuration fingerprint. The per-profile queue owns
snapshot capture **and** atomic replacement, preventing a delayed old snapshot from overwriting a
newer checkpoint. Invalidation/closing is checked before and after capture. SessionStorage, external
identity-provider state and arbitrary browser/device state are not universally restorable.
`clearAuth(appArguments)` invalidates contexts and removes the snapshot, coordinated with
in-flight writes. Normal dispose preserves saved login state. Anonymous RANDOM.ORG does not
enable auth persistence.

Core's `AuthDefinition` delegates `login`, `status`, `logout` and optional login options to
the application; Core supplies common commands, profile selection and scoped secret persistence.
`tokenAuth` is one helper of this contract, still used by TeamCity. Standalone secrets stay in
the OS keyring. A browser-auth integration calls the browser owner from those callbacks and registers
`resources: [browser]` for automatic profile invalidation/disposal. Server-side logout/revocation semantics
remain application-specific.

`status(context)` runs only for explicit `auth status`, not before every service command. Optional
`isReady(context)` is a passive local hint after permission checks: no browser launch/restart,
navigation or network validation. `tokenAuth` supplies this via scoped secret presence. A browser
app can omit it and check authentication in its actual page operation, returning a sanitized
instruction to run `auth login` if necessary. Core neither guesses cookie validity nor opens a
default-headless page before a caller's headed operation. An explicit status/login callback owns
its own browser options; these are not inferred from the last service call.

Migration from the initial slice: replace `status(context, validate)` with `status(context)` and
move any passive check to optional `isReady`. Move custom `runHosted.environmentKeys` to the
definition or auth implementation; tokenAuth env needs no extra list. No legacy alias or automatic
profile/auth-data deletion is introduced. Rebuild, stop the previous host, then use the new build.

Profile names differing only by case now fail closed on every platform, including existing
conflicting profile documents. Back up and reconcile those names manually; no automatic rename
or credential migration occurs. This ports the reviewed fix in issue #9 without importing
unrelated changes from the main worktree.

## Headed execution and video

PW service leaves opt into shared `--headed` and `--record-video` options. Each call resolves
its own settings; defaults are headless and no video. Compatible calls reuse resources concurrently.
An incompatible call waits fairly for active operations, including video finalization, then replaces
Chromium for visibility or just the selected profile context for recording. Later requests cannot
bypass a waiting switch. The host and IPC connections remain alive; commands are never replayed.
`BrowserRuntime({allowRestart:false})` lets stateful applications reject automatic mode changes.

Recordings are explicit sensitive artifacts under protected profile `browser/artifacts`, not
credentials in profile JSON. Finalized paths go to stderr; domain/JSON/RPC results are unchanged.
No automatic retention, upload, redaction guarantee or implicit recording for later callers.
On Windows, a pinned install/build correction hides only the headless-shell and FFmpeg console
processes; it preserves explicit headed Chromium windows.

See the detailed [browser observation guide](browser-observation.md) for examples, fairness and
cancellation rules, auth/transient-state limits, video layout/cleanup, author APIs and display setup.

## Development evidence

### Updating from the earlier runtime slice

Replace application-level dispose/profile-change forwarding with `resources`; return a definition
from the hosted factory and rebuild all in-repo consumers together. Do not keep old/new bootstrap
paths in parallel. Hosts started by the earlier implementation still enforced build matching on
Stop: stop those with their previous executable before upgrading. No profile/auth/video migration
or automatic deletion is performed. Protocol-only control applies to hosts created by this slice.

Install browsers explicitly with `npm run browser:install`; Linux CI also uses `--with-deps`.
Linux headed tests run under Xvfb; other CI platforms use their graphical session.
A missing browser/display fails required tests rather than silently skipping them.

Windows tests cover real Chromium, app-owned synthetic auth, independent CLI processes, same
host/browser identity, stop, idle, crashes, protocol errors and overload. The IPC suite also ran
under a filtered Windows token with Administrators disabled and maximum privileges removed, and
under Node 24 in Ubuntu 20.04/WSL on real Unix sockets. This is not evidence of macOS execution or
of a Linux browser run; the CI matrix provisions browsers for those future runs.

The fixed real-service proof is four sequential read cases per example, outside default tests
and CI. See the [workstream ledger](../.workspace/workstreams/random-playwright/implementation-ledger.md)
for versions, counts and measurements. Hard process kill or power loss is not a graceful dispose
guarantee; no cross-platform process-tree reaper/job-object framework is claimed.

The [review/fix loop](../.workspace/workstreams/random-playwright/review-fix-loop.md)
records the latest local verification. The earlier
[corrective review](../.workspace/workstreams/random-playwright/review-ledger.md)
retains its dated 148-test offline Windows baseline; see also the
[authoring cost comparison](../.workspace/workstreams/random-playwright/authoring-review.md).
Earlier cross-platform/live evidence is dated and was not rerun for this corrective slice.

## IPC command-name migration

The management root is now `ipc-server`, not `server`; there is no compatibility alias. A service
may independently expose `server` commands (for example TeamCity's `server status`). Update shell
scripts and JSON-RPC argv to `ipc-server status/stop`. Newly built management calls use the control
protocol and can stop a protocol-compatible previous build without a valid build manifest.
An already-open old JSON-RPC session still has its old command tree: close it and reconnect after
stopping the old process, or use its old executable's `server stop` before upgrading. Existing
profile config, credentials and browser state are unchanged; no AppData deletion is needed.

The package's public entry point exports only `runHosted` and `HostedCliOptions`. Endpoint paths,
relay and generated gRPC types are internal implementation details, not authoring APIs.
