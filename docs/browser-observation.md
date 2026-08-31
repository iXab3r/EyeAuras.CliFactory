# Observing browser-backed CLI operations

The optional `@eyeauras/cli-factory-playwright` module supplies headed execution and explicit
video recording. Core and the gRPC host do not depend on these features. The executable example
is `random-pw-cli`; `random-rest-cli` does not accept browser flags.

## Operator quick start

Configure the PW profile and install Chromium as described in the
[example guide](../integrations/random-pw/README.md), then:

```powershell
npm exec -- random-pw-cli integers --count 3 --profile demo --headed
npm exec -- random-pw-cli sequence --min 1 --max 5 --profile demo --record-video
npm exec -- random-pw-cli integers --count 3 --profile demo --headed --record-video --json
npm exec -- random-pw-cli integers --count 3 --profile demo --json
```

For strictly clean machine stdout, invoke the built bin directly:
`node integrations/random-pw/dist/src/bin.js ...`. npm itself may print lifecycle information.

| Leaf options | Requested Chromium mode | Record this operation |
|---|---|---|
| Neither option | Headless | No |
| `--headed` | Visible window | No |
| `--record-video` | Headless | Yes |
| Both | Visible window | Yes |

These are boolean leaf options, not persisted profile settings or server-wide sticky defaults.
There is no `--headless disabled`, output-directory argument, or inherited recording switch.
Pass them after the service command, just like its other options. Help is generated from the
same command declaration. Invalid arguments, missing configuration, or permission denial do not
start a browser merely because a browser option was supplied.

Every invocation resolves its options independently. In particular, the last command in the
example returns to headless and recording off, even if another client previously requested both.
Repeated calls with the same settings reuse warm resources.

## What changes and what stays alive

Playwright sets visibility when launching Chromium and recording when creating a BrowserContext.
The runtime cannot reveal an already-running headless browser window or turn recording on in an
existing non-recording context.

| Difference from existing resources | Automatic action |
|---|---|
| None | Reuse Chromium and the selected profile context |
| Visibility changed | Drain operations, close all profile contexts and Chromium, launch the requested mode |
| Recording changed for an existing profile | Drain operations, replace only that profile context |
| Profile context does not exist | Create it in the current compatible browser |
| Connection/auth configuration fingerprint changed | Drain operations, replace that profile context without restoring mismatched auth |

The application host, service quota/backoff state and gRPC connections remain alive. A browser-mode
change is not `ipc-server stop`: it neither kills the server nor resets application-owned state such
as RANDOM.ORG's quota cooldown. Compatible callers do not pay another browser startup cost.

There is one Chromium per BrowserRuntime. Visibility is therefore shared across profiles;
recording is configured on each profile context. Two profiles can concurrently use different
recording settings if their visibility requirements agree.

Frequent alternation between headed/headless requests causes repeated launches. This is the
explicit cost of honoring each request with one browser, not a hidden browser pool.

### Multiple callers and fair admission

Core still applies the application's command concurrency (one in the RANDOM.ORG examples).
BrowserRuntime additionally coordinates its actual `withPage` operations:

1. Compatible operations may overlap; preparation/creation is serialized to prevent duplicate owners.
2. A conflicting request waits for all already-admitted browser operations to finish.
3. Later requests cannot bypass that request, even if they would fit the old mode.
4. After draining, replace the required resources and admit the waiting operation. Compatible
   followers can then overlap again.

For simplicity, any conflicting replacement waits for **all** operations in that runtime, even
when only one profile context needs replacement. There are no public scopes, priorities, profile
locks for users to configure, or per-client browser pools. Fairness is arrival order at BrowserRuntime,
not a promise about the order in which unrelated network connections reach the server.

An operation retains its admission slot through action completion, auth checkpoint, page/popup
closure, video finalization and artifact reporting. A mode switch cannot cut off a peer's recording.

The internal browser queue allows 128 pending operations; excess requests fail explicitly.
Compatible active operations have no additional numerical concurrency limit in this module.
The application's Core command limit and IPC invocation limit remain separate controls.

### Cancellation, timeouts and failure

The supplied AbortSignal covers queue waiting and browser work. Cancelling a queued conflicting
request removes only that request, unblocking compatible followers without restarting Chromium.
A request cancelled before admission never creates a page or performs its action.

Once preparation/replacement has begun, cancellation prevents the action but does not roll back an
already-started resource replacement. Cleanup is allowed to finish. Cancellation during an action
closes only that operation's page and owned popups, then attempts video finalization. It does not
interrupt another client's operation.

BrowserRuntime does not invent a CLI-wide timeout flag. Integrations supply a suitable deadline;
the RANDOM.ORG client uses a four-minute browser-operation deadline including browser admission.
Core waiting before the client starts is not included in that client-specific deadline. Video
finalization/reporting can extend completion beyond cancellation; custom callbacks must terminate.

If headed Chromium cannot start, return an actionable, sanitized launch error. Never silently fall
back to headless. A subsequent request may create new resources, but the failed action is not replayed.
Closing a browser window manually can invalidate an operation; it is not a supported pause/resume
protocol. Browser/host crashes also never cause automatic command replay.

Explicit `ipc-server stop` retains its existing cancellation/shutdown semantics; it is distinct from
automatic draining for a mode change. Graceful completion is not a power-loss or forced-kill guarantee.

Direct `BrowserRuntime.dispose()` is sufficient too: it rejects new work, cancels existing
operations and awaits their page/popup closure, requested videos and reporting before closing
contexts. The caller need not manually join every `withPage` first. Concurrent/repeated dispose
calls share the result. After five seconds without draining, cleanup closes browser resources
and disposal rejects with a partial-artifact warning. A hung custom callback is not forcibly
terminated; the deadline bounds operation draining, not arbitrary JavaScript or OS I/O.
Always observe both operation and disposal rejections. Successful disposal preserves saved
auth and videos; it does not claim that an interrupted domain action succeeded.

## Authentication and transient state

Visibility and recording settings are **not** part of the authentication identity. If an
integration already opted into `persistAuth: true`, a replacement context loads that profile's
last successfully checkpointed matching `storageState`: cookies, localStorage and IndexedDB.
Another profile or changed endpoint/user-agent identity cannot borrow that snapshot.

A mode change does not opt an anonymous application into credential persistence. With
`persistAuth: false`, in-memory cookies/origin state disappear when their context is replaced.
This is intentional; RANDOM.ORG does not persist a fabricated login.

Even with persistence enabled, open forms, page JavaScript, sessionStorage, network connections
and arbitrary browser/device state are not universally restored. A failed/cancelled operation
does not create a new successful auth checkpoint. Restoration uses the previous checkpoint.
This feature provides resource lifecycle management, not browser-session hibernation.

An application requiring uninterrupted transient state can choose:

```ts
const browser = new BrowserRuntime({ allowRestart: false });
```

Initial creation in any explicitly requested mode still works. Later visibility changes or
recording changes to an existing context fail with a sanitized explanation, leaving existing
resources untouched. Creating another profile in a compatible browser is allowed. This option
does not prohibit explicit profile invalidation, logout, disposal, or recovery after a crash;
it only prohibits automatic replacement caused by headed/video options.

## Video artifacts and security

Recording is opt-in for each operation. It captures page viewports, not the desktop, other apps,
browser chrome, or an audio session. Do not assume passwords or personal data are redacted.
A page can visibly display credentials, private account details or sensitive service responses.

Files belong to the selected profile:

```text
AppDataDirectory/
  browser/
    auth-state.json             # only when the app opted into auth persistence
    artifacts/
      .pending/<context-id>/    # Playwright's protected in-progress recordings
      <operation-id>/
        page-1.webm
        page-2.webm              # a popup, if the operation opened one
```

IDs are generated opaque UUIDs, not service URLs, titles, arguments or credentials. An operation ID
identifies one `withPage` call; it is not an IPC request ID. RANDOM.ORG uses one `withPage` per
generation. A command that deliberately performs several browser operations gets several groups.

Artifact directories are protected before recording starts: current-user DACL on Windows, 0700
directories on Unix. The module neither encrypts videos nor uploads/attaches them automatically.
They may be included in AppData backups. These controls do not isolate other code running as the
same user or a privileged administrator.

After closing each owned page, the runtime awaits `video.saveAs`, removes its original temporary
video, and reports the finalized path. Context and Chromium can remain warm. Successful operations,
application failures and cancellation all attempt to preserve requested recordings. Each main page
and its owned popups gets a separate file; concurrent operations get different directories.

The standard CLI helper writes one line per finalized file to **stderr**:

```text
Browser video: "<absolute JSON-escaped path to page-1.webm>"
```

stdout remains the ordinary domain result, including `{ "values": [...] }` with `--json`.
No artifact properties are added to DTOs. JSON-RPC uses the same flags inside `params.argv`;
artifact lines remain on that connection's stderr, never in JSON-RPC frames. If multiple RPC calls
need unambiguous artifact correlation beyond their execution order, the application can provide
its own `onVideo` callback; no new transport metadata is implied.

A command rejected before it creates a page has no video. Disk-full, encoder/browser failure,
shutdown or disconnected output can prevent saving/reporting. Such failures are sanitized, do
not replay service actions and may leave partial files in protected storage. An action may already
have succeeded remotely even if artifact finalization makes the CLI return an error.

There is **no automatic retention/size policy** in this slice. Recording is continuous for the
operation; long-running commands can consume substantial disk space. Saved videos survive normal
dispose, restart and `auth logout`. Logout removes auth state, not previously captured evidence.
Profile deletion removes the profile's entire AppData directory, including its videos, according
to the existing profile-deletion contract.

To reclaim space, first let operations finish (or explicitly stop the host), inspect the exact
profile's `browser/artifacts` directory, and remove recordings you no longer need, including
incomplete `.pending` files. Do not delete or move files while recording is active. No recordings,
raw HTML or real-service payloads belong in Git/test fixtures.

## Integration author API

The module exports ordinary option declarations plus a helper; there is no Core plugin API:

```ts
import { command } from "@eyeauras/cli-factory";
import {
  BrowserRuntime, browserCommandOptions, browserOperationOptions,
} from "@eyeauras/cli-factory-playwright";

const browser = new BrowserRuntime(); // headless default; allowRestart defaults to true
const inspect = command("inspect", "Inspect the service", async ({ options }, context) => {
  return browser.withPage(
    {
      appArguments: context.appArguments,
      baseURL: String(context.profile.values.url),
      // persistAuth: true only when the application deliberately owns browser auth.
    },
    context.signal,
    async page => {
      await page.goto("/");
      return { title: await page.title() };
    },
    browserOperationOptions(options, context),
  );
}, { permission: "ReadOnly", options: browserCommandOptions });
```

Use `inspect` in the normal command tree and `resources: [browser]` on the owning
`CliDefinition`; Core handles disposal and profile invalidation. Create a fresh browser owner
inside each definition factory, without launching it during construction.
Append `browserCommandOptions` to service-specific options where needed; do not
duplicate option parsing or mutate cached clients/process-global settings. Auth integrations may
also append them to `AuthDefinition.loginOptions` and use the same helper in their app-owned
login callback. The anonymous RANDOM.ORG app still has no auth commands.

For direct library use, the fourth argument is
`{ headless?: boolean, recordVideo?: boolean, onVideo?: (path) => void | Promise<void> }`.
Omitted headless uses the owner's constructor default; omitted recording is always false.
The CLI helper explicitly requests headless unless `--headed` is present. An omitted `onVideo`
still saves requested videos, without printing anything. Reporting callbacks must not write
protocol stdout, leak sensitive page data, or hang indefinitely.

One `withPage` is an atomic unit of browser ownership. Use the supplied page and its popups;
do not create unrelated pages through its shared context, retain pages after the callback,
close the shared context/browser, or nest another conflicting `withPage` inside the operation.
A nested incompatible call would wait for the outer call to finish. Group related navigation
and form steps in one callback. Direct callers coordinate explicit `invalidateProfile`/logout
with their own work; Core's profile/auth built-ins already do so for commands. Disposal owns
cancellation/draining, but must not be awaited from inside the operation it needs to drain.

## Windows: hidden service processes

Headless means no browser window **and no incidental console window**. In the pinned Playwright
1.62.1 launcher, console-subsystem helpers were spawned without `windowsHide`; a detached host
could therefore display a black `chrome-headless-shell.exe` console. FFmpeg has the same issue.

This module's version-guarded install/build script applies a narrow dependency correction:
`windowsHide: true` only for `chrome-headless-shell.exe` and `ffmpeg-win64.exe` on Windows.
It does not apply hidden-window flags to GUI Chromium, so explicit `--headed` still displays
the browser. It does not globally monkey-patch Node process creation, change the user's browser,
modify downloaded executables, or hide unrelated application windows.

The script is idempotent, runs on npm postinstall and module build, and requires the exact expected
Playwright version and launcher fragment. Unexpected contents or a version upgrade fail closed
and require review; do not silently retain an obsolete patch. No extra package dependency is added.
After an upstream fix lands, review and remove this correction when updating Playwright.
A fresh install with lifecycle scripts disabled must run the module build before use.

References: upstream [#41630](https://github.com/microsoft/playwright/issues/41630) and
[#40741](https://github.com/microsoft/playwright/issues/40741).

## Platforms and verification

Headed mode requires an interactive graphical session belonging to the host process. A server
launched in a noninteractive service/SSH session cannot put a window on another user's desktop.
Linux CI runs tests under `xvfb-run --auto-servernum npm test`; Xvfb is a virtual display, not a
remotely viewable desktop. Start the host with the intended display environment; later CLI clients
do not replace its process-wide DISPLAY/environment.

Headed is observation, not a pause: pages still close when their operation finishes. No automatic
slow motion, inspector, screenshot, trace, arbitrary profile attachment, or manual-login wait
is added here. Application-specific login completion remains the application's responsibility.

Default tests use real Chromium and routed synthetic pages, including actual headed launches,
WebM finalization, profile/auth isolation, queue fairness/cancellation/overload and packaged CLI
plus tunneled JSON-RPC output. Real-service proofs remain explicit, bounded and recording-free.
Local evidence is Windows; configuring the CI matrix is not a claim that Linux/macOS headed
execution was locally verified.

Implementation basis: [browser launch options](https://playwright.dev/docs/api/class-browsertype#browser-type-launch),
[context recording](https://playwright.dev/docs/videos),
[video finalization](https://playwright.dev/docs/api/class-video#video-save-as).
