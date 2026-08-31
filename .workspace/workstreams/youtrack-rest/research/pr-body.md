## Why

Add YouTrack as a second real integration on the same CLI Factory as TeamCity, with one command
tree for human, JSON and persistent JSON-RPC use. The work includes the full official REST
inventory and a bounded v1 contract, then independent review fixes and an authoring improvement
proven in both integrations.

## Changes

- Add `@eyeauras/youtrack-cli` / `youtrack-cli`: 118 REST operations (98 ReadOnly, 20 Update) plus
  a separately counted issue-attachment download, exposed through 117 service leaves.
- Reuse Core profiles, OS credential storage, explicit permission gates and output/RPC behavior;
  add service-shaped YouTrack reads and controlled writes, pagination/projections and error handling.
- Keep signed attachment URLs and active credentials out of results/errors; constrain downloads
  to the profile's origin/context and AppData with bounded streaming and exclusive publication.
- Correct shared auth/prompt and built-in RPC continuation defects, and prevent case-colliding
  profile names from sharing AppData. Existing ambiguous documents fail before mutation; no
  automatic migration or deletion of user data.
- Infer positional callback arguments from existing literal command declarations. Remove 129
  redundant wrappers across YouTrack and TeamCity while retaining conservative type fallbacks
  and domain validation. Full source cost grows by 51 Core lines; this is simpler typing, not a LOC win.

## Verification

Root's fresh repository suite at head `7a9811f56b9d836fadeacae65da872cfc55900dc`, containing
accepted source `869e7aa9aa5b3c8f2c401f08b60f40c1cce87e47`, passed **418/418**
(Core 44, TeamCity 41, YouTrack 333), zero failures/skips. Independent technical
and authoring reviews passed; the preceding review/fix cycle closed four confirmed findings.
The equivalent type-only build before formatting passed **24 fixed live ReadOnly GET checks**
through the normal packaged CLI/profile/keyring. No live mutations, binary downloads or raw payload
fixtures were used. Full-tree and staged privacy checks passed before the source commits.
CI runs offline `npm ci` and `npm test` on Ubuntu, Windows and macOS with Node 22/24 (six jobs);
it does not run the live proof. PR-head CI and independent PR review are recorded as they complete;
this body does not claim CI success. Detailed evidence and final source manifests are in
`.workspace/workstreams/youtrack-rest/`.

## Scope and limitations

The inventory covers documented endpoint operations, not every optional field combination. The
remaining 163 P2/P3 operations and supplemental research belong to [v2 / Issue #7](https://github.com/iXab3r/EyeAuras.CliFactory/issues/7).
Default tests remain offline; the live profile has limited permissions and does not establish
access to every operation. Portable Node filesystem checks cannot eliminate malicious same-user
ancestor-directory swaps; downloader safeguards and that limit are documented.

Target base: `main`. PR creation/review/fixes are authorized; this PR does not authorize merge,
release or live writes. Keep related Issues open until their final review/CI/close-out conditions
are evidenced.

Refs #6, #9, #10.
