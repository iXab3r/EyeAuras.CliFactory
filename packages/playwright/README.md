# Optional Playwright owner

`BrowserRuntime` owns lazy Chromium, profile contexts, operation pages and opt-in authentication
snapshots, per-operation headed mode and explicit video recording. Conflicting mode requests
wait for active operations and replace only the required resources; compatible requests reuse them.
It does not depend on IPC. Declare `resources: [browser]` for Core-managed lifecycle/profile
invalidation; direct callers own `dispose()`, which cancels/drains operations and requested videos.

See [runtime and auth contracts](../../docs/runtime-modules.md), the
[RANDOM.ORG browser example](../../integrations/random-pw/README.md) and the synthetic auth tests.
Provision Chromium explicitly before running required browser tests: `npm run browser:install`.

The [browser observation guide](../../docs/browser-observation.md) documents `browserCommandOptions`,
`browserOperationOptions`, `withPage(..., options)`, the `allowRestart` application policy,
fair admission/cancellation, auth restoration and sensitive-video storage/retention limits.

Windows helper consoles are hidden without hiding `--headed` Chromium. A version-guarded,
idempotent postinstall/build correction targets only the pinned Playwright process launcher;
review it when upgrading Playwright. See the observation guide's Windows section.
