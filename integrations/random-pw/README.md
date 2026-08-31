# random-pw-cli

The browser counterpart to [random-rest-cli](../random-rest/README.md): exactly the same
`integers` and `sequence` service commands, domain options, permissions and `{ values: number[] }`
output. This implementation visits RANDOM.ORG's quota page, fills its real forms, submits once
and validates `pre.data` in the resulting DOM. It does not call an API behind Playwright.

## Run

```text
npm ci
npm run browser:install
npm run build
npm exec -- random-pw-cli profile configure default --contact <your-email>
npm exec -- random-pw-cli integers --count 5 --min 1 --max 6 --json
npm exec -- random-pw-cli sequence --min 1 --max 10 --json
npm exec -- random-pw-cli ipc-server status --json
npm exec -- random-pw-cli ipc-server stop --json
```

Linux browser provisioning may require `npm run browser:install -- --with-deps`.
Use an operator-controlled contact address, not a secret. It is stored in non-secret profile
configuration and included in User-Agent, as requested by RANDOM.ORG's client guidelines.
No account, API key, auth commands or browser login snapshot is needed for this anonymous example.

For clean scripted stdout invoke `node integrations/random-pw/dist/src/bin.js ...` directly.
Profiles live in normal current-user AppData under `random-pw-cli`; HTTP profiles use the
separate `random-rest-cli` namespace and must be configured separately.

The first command starts a local gRPC host; the first service operation lazily starts headless
Chromium. Later CLI processes reuse that host/browser and the selected profile's context.
Operation pages close after each request. The application uses concurrency one and stops its
host after 60 seconds without active invocations. `ipc-server status/stop` never start a host.
Profile changes invalidate the corresponding browser context. See [runtime mechanics and
limitations](../../docs/runtime-modules.md).

## Watch an operation or record it

```text
npm exec -- random-pw-cli integers --count 3 --headed
npm exec -- random-pw-cli sequence --min 1 --max 5 --record-video --json
npm exec -- random-pw-cli integers --headed --record-video --json
```

Only the PW client adds these runtime flags. Defaults are headless and video off **on each call**,
not whatever the previous caller selected. Compatible operations reuse resources. A mode change
waits for active browser work, then restarts Chromium (visibility) or just the profile context
(recording), without stopping the host or resetting the quota cooldown.

Videos finalize before command completion, including ordinary error/cancellation where possible.
Each requested operation has a unique protected directory below the profile's
`browser/artifacts`. Paths are reported on stderr; `--json` and JSON-RPC domain results are
unchanged. Videos can contain sensitive page content, have no automatic retention limit, and are
never automatically uploaded. Recording a real quota page may capture information such as the
displayed public IP: only record when you intentionally want to retain the page content.

Headed mode requires a graphical session and does not pause execution or keep the operation's page
open afterward. Next invocation without flags returns to headless/no recording automatically.
See the [detailed observation guide](../../docs/browser-observation.md) for all lifecycle,
concurrency, state, security, disk-cleanup and integration-author rules.

## Small, bounded service contract

- `integers`: count 1–100 (default 1), min default 1, max default 100; duplicates allowed.
- `sequence`: min default 1, max default 10; the entire interval, unique and shuffled.
- Both require integral bounds within ±1e9, min < max, and at most 100 results.
- Both are ReadOnly but consume IP-based random-bit quota. Negative quota blocks this client for
  ten minutes. Each form operation is bounded to four minutes, with two-minute page waits.
- No automatic retry/replay, alternate random generator, API fallback or anti-bot bypass.
  Changed DOM, challenge pages, quota errors and navigation failures are sanitized failures.
- Different application IDs (including REST versus PW) and different machines do not coordinate
  their shared public-IP quota. Run real-service commands/proofs sequentially.

The example app owns its browser runtime, including an explicitly supplied test runtime; do not
share that owner between applications. The browser runtime can persist explicitly opted-in authentication for other apps; synthetic
tests prove login/status/logout and restoration without inventing a RANDOM.ORG login workflow.

## Verify

```text
npm test
# Linux without a display: xvfb-run --auto-servernum npm test
npm run test:integration --workspace @eyeauras/random-pw-cli -- --profile <configured-profile>
```

Default tests launch real Chromium against strictly routed synthetic pages; external browser
requests are rejected. Process tests run the packaged CLI and its self-spawned host, measure
cold/warm reuse, inspect browser identity and prove Chromium is gone after stop.

The explicit local proof runs the same four cases as HTTP: 15 values total, bounded ReadOnly
commands, normal profiles, no arbitrary argv/URL overrides, no raw output, and fail-fast skipping
after the first error. It refuses CI and never runs as part of `npm test`.

References: [integer form](https://www.random.org/integers/),
[sequence form](https://www.random.org/sequences/), [client guidelines](https://www.random.org/clients/).
