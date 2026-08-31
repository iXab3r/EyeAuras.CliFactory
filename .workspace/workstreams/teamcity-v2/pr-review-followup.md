# TeamCity PR #13 — correction and integration review

Date: 2026-08-31. This supersedes the open R1/R2 verdict in [pr-review.md](pr-review.md).
Owner authorized P1/P2 fixes, re-review, conflict resolution and merge only after green checks.

## Corrections and evidence

- Fix commit `ee73fdd`: canonicalize only the freshly created test-owned temporary root before
  constructing AppArguments. A new cross-platform test deliberately uses a directory alias and
  proves a normal download succeeds through the canonical root. Existing profile-child symlink/
  junction rejection, no-clobber, cancellation and profile isolation remain unchanged.
- The shared TeamCity download sink rejects HTTP206 before staging/publication. The new MSW test
  exercises the real JSON CLI with and without Content-Range, verifies a nonzero exit, empty stdout,
  exactly one HTTP request with no Range, and empty destination/staging directories.
- Both regressions failed before the fixes and passed afterward. The complete file suite passed
  **46/46**; the pre-integration full suite passed **583/583**.
- No new dependency, CLI flag, permission change, raw HTTP passthrough, compatibility path or real
  service call was introduced. Valid whole-file200 responses retain existing coverage.

## YouTrack/main reconciliation

YouTrack PR #12 merged while the corrections were in progress. Integrated `main` at
`adfc2c37fe605a81eb3516f5929c36e98726c366` without rebasing or rewriting pushed history.
Actual conflicts were in Core command construction and DESIGN. Automatic merging also duplicated
`OptionDefinition.required` and AGENTS rule13; both duplicates were removed during review.

One required-option contract remains: mandatory parsing before onboarding, declared defaults,
custom parsers and the generated required help hint. Child commands copy inherited settings;
the inspected Commander implementation includes the root exit-override callback in that copy.
No parallel exit path is needed. YouTrack's new programmatic/RPC/process tests confirm errors and
help do not terminate the host. Its typed positional inference, fail-closed authentication and
profile-case isolation remain intact, including the updated TeamCity consumers/tests.

Fresh combined `npm test` passed **952/952**: Core48, TeamCity569, YouTrack335. Both integration
suites use the same Core; no production source changes were made in the YouTrack integration.
The full combined tracked/untracked tree and working/staged patches passed privacy review;
inherited formatting in unchanged main files is not rewritten. The PR diff against main is clean.

## Verdict and remaining gate

Focused source re-review: **pass**, no remaining actionable R1/R2 or merge-resolution finding.
Integrated head `a6abdbe608367ce841447d7f241b6a57b286de06` passed all six Linux/Windows/macOS
Node22/24 jobs in [CI run33365338367](https://github.com/iXab3r/EyeAuras.CliFactory/actions/runs/33365338367).
R1 is therefore closed by actual cross-platform evidence; R2 is closed by the failing-then-passing
command regression and source review. Final documentation-head checks must also pass before merge.
The prior100% count still means449 native route identities, not all payload/version variants or
live mutation proof; native config-reset and bulk-unmute acknowledgement limitations remain.

The broader Core/Common candidates in the original review are optional future authoring work,
not prerequisites for these bug fixes. The typed-argument Core API is now integrated from YouTrack;
no new shared download framework is introduced in this correction slice.
Unrelated browser/auth/IPC working changes are preserved separately and are not part of the PR.

## Final acceptance reconciliation

Fresh actual CSV reconciliation: baseline17 +432 new =449 distinct exposed method/path identities,
235 GET and214 mutations, zero missing/duplicate rows. The route client and independent case files
are unchanged from the original449-route review; the combined suite exercises them with the merged
Core. Slice contracts, existing-route launch options, flat gates, profile isolation and generated
UX evidence remain in the ten slice maps, checkpoint reviews and tested integration documentation.
The previous local-only packaged-CLI ReadOnly proof19/19 remains development evidence; no new real
endpoint, mutation, keyring access or unsanitized artifact was needed for these corrections.

Implementation/review workstream acceptance is complete. PR #13 is the closing change for Issue #5,
subject to the final exact-head CI/merge check. Known native reset/bulk-unmute limitations and future
Core/Common opportunities are documented, not silently relabeled as full payload/live coverage.
No unimplemented route is hidden or removed from the denominator.

The seven unrelated user documents were restored after integration. Six are byte-identical to
their saved originals; DESIGN also includes the legitimate main changes. All six tracked user-edit
patches match the saved patches exactly, and the previously untracked runtime design was restored.
