# Optional IPC server

`runHosted` composes a self-spawning local IPC server with generated gRPC stdio relay.
It does not depend on Playwright. See [the runtime contract](../../docs/runtime-modules.md)
and the [HTTP entry point](../../integrations/random-rest/src/bin.ts).

Pass `{entryPoint: import.meta.url, createDefinition}`. The factory returns a normal Core
`CliDefinition`; it does not build a CliApplication or forward module commands. Run the root
`npm run build` to publish the validated workspace manifest. Service work requires that build;
`ipc-server status/stop` are protocol-only and can manage a previous build.

Environment inputs belong to `CliDefinition.environmentKeys` or `AuthDefinition.environmentKeys`;
`tokenAuth({env})` contributes its key automatically. Runner/Core validation precedes spawn.
Known child startup failures report a fixed, sanitized phase instead of waiting for the timeout.

Build regenerates TypeScript contracts from `proto/cli-host.proto` with the official
proto-loader tool. Commit the schema and generated declarations together; never hand-edit
generated files. Tests cover real processes and named-pipe/Unix-socket streaming.

## Boundaries

- `host.ts`: public runner; selects the process mode and composes a Core definition with ready
  management handlers. It owns failure cleanup. No mutable placeholder handlers.
- `client.ts`: control requests, discovery/startup and per-invocation byte relay.
- `server.ts`: single-owner lease/generation, RPC admission, idle timer and shutdown together.
- `commands.ts` and `endpoint.ts`: private management declarations/routing and address derivation.
- `relay.ts`: bounded stdio bridge and cancellation; `build.ts`: workspace compatibility identity.

Only `runHosted`/`HostedCliOptions` are public. Core does not import this package; an ordinary
`createCli` app has no IPC commands. `ipc-server` never reserves a service's `server` namespace.
See [migration](../../docs/runtime-modules.md#ipc-command-name-migration) for the old command name.
