## Why

Add YouTrack as a second real integration on the same CLI Factory as TeamCity, with one command
tree for human, JSON and persistent JSON-RPC use. The change includes official API scope research,
bounded v1 implementation, independent reviews and a shared authoring improvement used by both CLIs.

## Changes

- Add `@eyeauras/youtrack-cli` / `youtrack-cli`: 118 REST operations (98 ReadOnly / 20 Update) plus
  a separate issue-attachment download, exposed through 117 service leaves. Reuse Core profiles,
  OS credential storage, permission gates and output/RPC behavior.
- Add service-shaped YouTrack reads and controlled writes with bounded pagination, projections,
  sanitized errors and profile-scoped downloads. Signed URL/credential scrubbing and filesystem
  safeguards remain enforced; no generic HTTP/CRUD layer is introduced.
- Correct shared authentication/prompt and built-in RPC continuation defects; reject case-colliding
  profile identities before mutation without silently migrating or deleting user data.
- Infer positional arguments from existing literal command declarations, removing 129 redundant
  wrappers in both integrations. The reviewed trial adds 51 Core source lines: simpler, safer typing,
  not a source-size reduction. Domain validation and conservative type fallbacks are retained.

## Independent PR review and corrections

The initial base `e0d4d1b8dc615a969a0160f69a5fb34968d9ab3d` / head
`7a9811f56b9d836fadeacae65da872cfc55900dc` received separate Core, safety and operations reviews.
Operations review found no issue; two code findings and the macOS CI fixture failure were corrected
and independently reviewed in pushed commit `005254d6fc4981a1fafa0a6a715c9dbd92f946aa`:

1. Reject `currentUser` identity fields that the shared scrubber would alter, including encoded
   active-bearer and signed-URL content, with meaningful synthetic regressions.
2. Use own-property handling for valid profile names such as `constructor` and `toString`, avoiding
   inherited Object.prototype values in permissions without reserving those names.
3. Canonicalize isolated download-test temp roots for macOS `/var` aliases. Production rejection of
   symlinks/junctions remains unchanged; the fixture fix does not weaken download safety.

## Verification

- Corrected source passed **423/423 offline tests** (Core 47 / TeamCity 41 / YouTrack 335), zero
  failures/skips, plus independent focused source/regression checks.
- Its freshly built normal-profile/keyring proof passed **24 fixed ReadOnly GETs**, zero failures
  or skips. Only sanitized counts were returned; no real writes, binary downloads or raw payload files.
- Initial CI passed Linux/Windows Node 22/24 and failed macOS Node 22/24 on the fixture-root problem.
  Corrected source head `005254d6fc4981a1fafa0a6a715c9dbd92f946aa` passed **all six CI jobs** in
  [run 33314691369](https://github.com/iXab3r/EyeAuras.CliFactory/actions/runs/33314691369): Ubuntu,
  Windows and macOS, Node 22/24, offline npm ci/test. This closes the actual macOS fixture witness.
  Any later documentation-only head is checked separately; its result is not claimed in advance.
- Full-tree/staged privacy passed before source commits, including the review-fix push. Exact review,
  test, scope and source-manifest evidence lives in `.workspace/workstreams/youtrack-rest/`.

## Scope and limitations

Endpoint coverage is not every optional field combination. [Issue #7](https://github.com/iXab3r/EyeAuras.CliFactory/issues/7)
owns the 163 deferred P2/P3 operations and supplemental research. The live profile has limited
permissions; its checks do not establish access to every operation. Portable Node filesystem checks
cannot eliminate malicious same-user ancestor-directory swaps; the limit is documented.

Base is `main`. Review/fix publication does not authorize merge, release or live writes. Related
Issues remain open pending their formal linked/CI/close-out conditions.

Refs #6, #9, #10.
