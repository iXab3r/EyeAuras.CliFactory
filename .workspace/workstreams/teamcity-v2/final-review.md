# TeamCity v2 — final local implementation review (+432)

2026-08-30. **Local implementation complete; review passed.** All449 frozen TeamCity2026.1
method/path identities are exposed: **235/235 GET,214/214 mutations,100% route coverage**.
Baseline17 + S1–S9's400 + [S10's32](s10-coverage.csv) =449; zero missing/duplicate identities.
The workstream/Issue remain active pending code publication and CI/closing-reference evidence.
Nothing was staged, committed or pushed by this completion run.
Published progress: [final Issue report](https://github.com/iXab3r/EyeAuras.CliFactory/issues/5#issuecomment-5468967837).

## Reconciliation and executable evidence

- Re-read the actual frozen CSV, baseline CLI map and all10 slice CSVs. Matched **432/432** new
  rows one-to-one with independent compiled boundary cases (method, concrete path and CLI prefix),
  with no overlap with17 baseline identities. Path-valued placeholders use the native multi-segment
  semantics; the denominator and baseline audit were not changed.
- Each batch's exact Issue contract preceded production. S8/S9/S10 comments were read back and
  matched reviewed drafts; reviews at every+50 and final+432 are preserved here.
- S10's32 cases failed before implementation, then passed. Twelve file/secret safety tests and
  one additional test-first encoded credential-URL correction bring full **`npm test` to581 passed
  (20Core+561TeamCity), zero failures/skips**.
- Fixed packaged-CLI current-profile/keyring ReadOnly proof: **19/19 passed**, no new live routes,
  no real mutation, permission grant, credential import or profile change. No raw service response
  or discovered identifier became an artifact.
- Final code footprint is below. `git diff --check` passed and the staged diff is empty. The privacy
  final audit including this close-out scanned142 files and working/staged diffs:56 synthetic
  matches, zero unresolved findings. Repeat before any future commit/push.

New file tests read actual saved synthetic bytes and SHA256, not fake acknowledgements. Coverage
includes empty files, metadata without size, strict relative paths, Windows device names, symlink/
junction escapes, actual stream limits without Content-Length, media/signatures, no-clobber races,
cancellation cleanup, refused redirects and persistent two-profile JSON-RPC. Secret tests assert
exact whitespace, alias namespaces/collisions, unresolved expressions and non-atomic store failure.

## Final shorter-batch authoring review

Same width100/nonblank handwritten-TypeScript metric, including every DTO/helper/security function:

|Surface|+400|Final +432|Delta|
|---|---:|---:|---:|
|Core production|1742|1742|0|
|TeamCity production|8890|9629|+739|
|Combined production|10632|11371|+739|
|Core tests|832|832|0|
|TeamCity tests|8584|9389|+805|
|Local proof|344|344|0|

S10=23.09 production lines/route; cumulative8540/432=19.77 above the2831-line baseline.
This is total implementation cost, not a productivity percentage across unlike API mixes.
Equivalent detail/list/mutation direct-versus-bound examples remain6/15/13 versus6/12/7.
Core gained only the already-reviewed11 lines in the first checkpoint; later phases add no
TeamCity nouns or speculative cross-service abstractions to it.

Concrete reuse: one small native file-tree declaration serves four proven TeamCity tree families
while preserving different paths/parent queries. All ordinary JSON/help/RPC/gate handling is still
the existing framework. File models71 lines, command declarations208 and bounded file sink201 are
fully counted. The concrete client reuses one private authenticated response path for both ordinary
responses and streaming; it is not a generic user-visible HTTP client. Key preflight/persistence
moved to credential-inputs (70 total lines) for real pool-token and secure-reference consumers.
No second integration yet proves a Core extraction. No generator, dynamic method registry, legacy
fallback or arbitrary method/path/body command was introduced.

Review corrections: staging cleanup is permitted only after successful exclusive creation;
cancellation is checked again before atomic publication. Download destinations remain private
profile-owned documents, never a secret-store fallback. Encoded query keys, URL fragments and
username-only userinfo now trigger the existing credential-property guard; its regression test
first failed then passed. Exported FileTree/DownloadOptions let typed consumers name public inputs.

## Limits, known failures and deferred work

There are no failing offline tests or unimplemented frozen route rows.100% means at least one
useful typed safe contract per documented method/path, **not** all payload/locator variants,
all server/plugin versions, granted remote rights or live mutation proof.

Two native void actions deliberately do not claim verified postconditions:

1. Versioned config parameter DELETE: explicit confirmed vcsRootId reset request. Older official
   implementation can fail after writing; current successful clear semantics are unverified.
   Only actual2xx returns resetRequested. Errors remain errors, no retry/rollback claim.
2. Bulk unmute: current schema/docs specify Mutes body/void; the old posted model validates full
   scope/target/resolution. Selected-ID ReadOnly preflights reconstruct that full body before one
   DELETE. Current handler identity/atomicity is not proven. Actual2xx returns acknowledgement and
   postconditionVerified:false, not a deletion count. It is not race-free or an atomic bulk promise.

See [S8](s8-research.md), [S9](s9-research.md) and [S10](s10-research.md) primary-source notes.
Large repeated public-distribution research was denied for resource footprint and not bypassed;
smaller source/schema checks were used. A supplied small current REST artifact or separately
authorized sandbox mutation study could refine those two semantics; neither is fabricated here.

File safety assumes the current user's AppData ACL has not been intentionally made public; Windows
inherits that ACL and POSIX files/directories use private modes. Existing user ACLs are not silently
rewritten. Atomic no-clobber publication requires same-profile hard-link support and fails closed
otherwise. No archive/SVG is opened/extracted/executed. The local profile proof intentionally does
not enumerate sensitive files, credentials or unbounded administrative resources.

Main agent performed integration correctness and Reconciliation Lead review; the research agent
supplied primary-source evidence, not an independent implementation review. User-visible contracts
are now in the TeamCity README and shared authoring guide. Publication and Issue closure are separate
remaining workflow steps; do not change frozen history or claim remote code/CI state before evidence.
