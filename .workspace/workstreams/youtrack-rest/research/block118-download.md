# B118 derived issue attachment download — design evidence

Status: implemented after root release and verified published Issue clarification; 22/22 focused tests PASS. Independent final security review PASS (22 download + 10 shared client tests); reviewer also reported the complete compiled suite 400/400 PASS, zero skips. Root owns acceptance and AR118 is separate. This is one derived CLI leaf, not REST operation 119.

## Official contract

- [Download an Issue Attachment](https://www.jetbrains.com/help/youtrack/devportal/api-usecase-download-issue-attachment.html) (18 August 2026): request attachment metadata including `url`, then GET that returned URL. The signature identifies the binary request; Authorization is unnecessary. Its example uses `/api/files/<fileID>?sign=...` beneath the configured context.
- [Specific IssueAttachment](https://www.jetbrains.com/help/youtrack/devportal/operations-api-issues-issueID-attachments.html): exact attachment metadata GET is available; attachment/file IDs need not match. The example also documents `/api/files/<fileID>/sign=...`.
- [IssueAttachment entity](https://www.jetbrains.com/help/youtrack/devportal/api-entity-IssueAttachment.html): `id`, `name`, `url`, and nullable `mimeType` support the fixed metadata projection; URL can be null, in which case no download is possible.
- [Node 24 filesystem](https://nodejs.org/docs/latest-v24.x/api/fs.html): exclusive creation, lstat, temporary directories, file handles, and hard links support bounded streaming with an exclusive final publication. Native filesystem errors must never enter output.

## Implemented contract

The existing client owns a narrow exact-metadata helper, internal to the integration and absent from its public barrel. Download source validates metadata identity, resolves the URL against the normalized profile URL, accepts only same-origin HTTPS (the profile localhost exception applies), and checks the context plus documented `api/files` shape. No arbitrary caller URL, userinfo, fragment, redirects, authorization, or cookies are permitted for binary fetching. URL/signatures remain transient.

The command takes a safe optional basename and byte limit. Default filename prefixes a sanitized attachment name with its sanitized ID. Reject traversal, rooted paths, separators, Windows device names, alternate data streams, controls, trailing dots/spaces, and existing destinations. The destination is profile `AppDataDirectory/downloads`.

The transfer checks Content-Length and counts actual streamed bytes, with default 25 MiB and allowed limit 1–104857600. Use a private temporary directory and exclusive file; abort and remove partial data on failure. Publish by hard link so a racing existing final filename is never overwritten. Unsupported filesystems fail closed; no rename/copy fallback.

Reject links/junctions in the directory chain and recheck directory/file identities before publication. Portable Node does not expose dirfd-relative no-follow operations across platforms: this does not claim protection against a malicious process running as the same OS account replacing ancestor directories between syscalls. The intended boundary is the current user's owned AppData; preexisting links and detectable replacement are rejected. POSIX modes are requested; Windows ACLs remain inherited from current-user AppData.

## Deterministic evidence

MSW at native fetch plus temporary real filesystem: exact two-step request/context/encoded IDs; both documented URL forms; binary absence of credentials; cross-origin, userinfo, traversal, redirect and malformed metadata rejection; empty/exact/over-limit/misleading Content-Length streaming; interrupted transfer cleanup; safe basename/device/ADS rules; existing regular/symlink targets; directory junction rejection; concurrent same-name publication; profile paths, permission denial, human/JSON/RPC rendering and signature-free failures. No live byte download or private fixture capture.

Focused command: `node --test integrations/youtrack/dist/tests/attachment-download.test.js`, following the lead-owned successful TypeScript build: 22 pass, 0 fail, 0 skip.

Two independent review findings were corrected before freeze: fully encoded bearer values in URL query keys are rejected, and path signatures preserve literal plus rather than receiving form-query decoding. Matching raw/decoded signature-name fixtures and a MIME reflection regression cover the actual secret values. Reader cancellation is asserted; concurrent publication uses a barrier so both transfers pass preflight; a bounded filesystem fault proves unsupported hard links fail closed and clean temporary bytes.

Result fields are `id`, sanitized local `name`, `path`, actual `bytes`, and media `contentType` without header parameters. Content-Disposition never selects a path. Partial HTTP 206 responses are rejected. Content-Length is checked before transfer, actual bytes are always bounded, and an unencoded transfer must match its declared length. Encoded response lengths are not confused with decoded byte counts. Explicit basenames are limited to 180 UTF-8 bytes; default ID/name components are ASCII-sanitized and bounded. No new dependencies or Core mechanisms were added.

If an ancestor directory is detectably replaced during transfer, cleanup refuses to traverse the changed path and reports a static instruction to inspect the profile downloads directory. This avoids deleting an unrelated replacement location; as documented above, a hostile same-account process is outside the portable directory-race guarantee.

