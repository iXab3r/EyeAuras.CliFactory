# Content and resource policy

CLI Factory does not impose fixed local ceilings on user content, page sizes, selected items,
request/response bytes, downloads, browser state or pending work. Large operations may fail in
the operating system, runtime, filesystem or service; the CLI does not replace those real limits
with smaller arbitrary ones. Cancellation, Writable backpressure, explicit targeting, permissions,
profile isolation, path validation and transfer integrity remain part of the contract.

## Arguments and transports

Core's `validateArgv` checks an array of strings; there are no argument count, per-argument byte
or aggregate byte caps. The former `inputLimits` export is removed. JSON-RPC buffers one complete
request line without a byte ceiling and remains cancellable while waiting for EOF/newline.
Requests are executed sequentially and output backpressure delays reading the next request.

IPC has no configured protobuf message-size or queued-output ceiling. It splits stream bytes into
16 KiB frames; this is transfer chunking, not a total-size limit. Large synchronous writes are
accepted. Producers should respect Writable backpressure to avoid accumulating queued data.
Core/Playwright pending queues have no fixed item ceiling. IPC `maxInvocations` is an optional
caller-selected admission limit; omission means unlimited. Declared command concurrency still
expresses application synchronization requirements.

Native command-line launches remain subject to the OS argv limit. JSON-RPC stdin avoids that
particular limit; neither path can promise unlimited physical memory or successful remote execution.

## HTTP, files and browser state

`readResponseBody(response, { signal, maxBytes? })` replaces `readBoundedResponseBody`. Omission
of `maxBytes` means no local byte ceiling. An explicitly selected budget must be a positive safe
integer. Core continues to own response chunks, validate Content-Length syntax and identity-body
completeness, cancel/release readers, and avoid exposing raw failure causes.

`publishProfileFile` likewise accepts an optional byte budget. YouTrack and TeamCity downloads
have no default budget; `--max-bytes` opts into a caller-selected budget without a fixed upper cap.
Identity Content-Length must match completed bytes. Encoded wire length is not decoded size.
No-clobber publication, private staging, hashes, path/device checks and cleanup ownership remain.
Local basename length caps/truncation have been removed; filesystem name/path limits apply.

TeamCity avatar uploads and text/XML projections, ordinary YouTrack/TeamCity responses and
RANDOM results have no fixed local byte ceiling. Playwright auth snapshots have no local size cap.
Browser action/navigation and RANDOM operation deadlines are not imposed by default. Explicit
caller timeouts/cancellation and startup/shutdown recovery deadlines remain supported.

## Selection, paging and validation

YouTrack no longer limits explicit issue selection to 20 IDs or page size to 100. TeamCity no longer
caps typed/bulk items, roles, restrictions, tags, keys, mutes, backup modules, decoded collections
or page sizes. Default page sizes remain convenient defaults and do not limit an explicit request.
No automatic pagination, recursive discovery, command replay or extra remote requests are added.

TeamCity's extra text/path/XML/cron/identifier lengths, avatar pixel maximum and debug-token TTL
maximum have been removed. Profile, category and AppData-name length checks are removed while
allowed characters, reserved names, exact profile lookup and case-collision rules remain intact.
RANDOM no longer imposes 100 results or a 254-character contact maximum. Its documented remote
numeric range of ±1 billion remains a service-domain check. The service can still reject requests;
its published result-count limit is not copied as a new local ceiling.

## Constraints that are not content ceilings

- Finite/safe-integer representation, documented service numeric types and calendar values.
- Required values, supported request shapes, explicit-ID/duplicate checks and returned-page
  consistency against the caller's requested page size.
- Authentication, permission gates, origin restrictions, signed-URL handling and secret scrubbing.
- Safe path syntax, no traversal, reserved devices, private file permissions and ownership checks.
- Startup, shutdown and stale-owner recovery deadlines, and caller-selected timeouts/budgets.
- Fixed-size hashes/protocol markers and stream chunk sizes used for transfer efficiency.
- The local-only proof harness's deliberately fixed ReadOnly inventory, capture budgets and timeout.
  Proof limits do not constrain ordinary CLI operations. TeamCity's short discard loop only disposes
  unwanted response content; it does not reject an operation or truncate returned data.

## Upgrading

Use Core, YouTrack CLI and TeamCity CLI 0.2.0 together. Integration packages depend on Core 0.2.0.
Library consumers replace the removed `readBoundedResponseBody` import with `readResponseBody`;
pass `maxBytes` only when an explicit caller budget is intended. No credentials or profile data
are migrated or deleted. A running IPC host must be stopped after the workspace build changes.
