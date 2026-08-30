# Reviewed Issue status introductions

Replace only each current introduction with the block below; preserve its existing tail beginning
at the named marker byte-for-byte. Root guards previous remote body hashes and verifies new readback.
Source evidence is exact to `005254d6`; later documentation-head CI is checked separately.

## Issue #6

Tail marker: `# Outcome and baseline`

<!-- BEGIN ISSUE 6 INTRO -->
# Functional v1 and PR review status — formal release pending

Accepted scope remains **118 REST operations** (98 ReadOnly / 20 Update) plus the separate
issue-attachment download, through 117 service leaves. The original inventory and decision history
below are unchanged; [Issue #7](https://github.com/iXab3r/EyeAuras.CliFactory/issues/7) owns v2.

The code is pushed in [PR #12](https://github.com/iXab3r/EyeAuras.CliFactory/pull/12). Independent PR
review corrections are in source commit `005254d6fc4981a1fafa0a6a715c9dbd92f946aa`: identity-output
rejection when shared scrubbing would alter a field, own-property profile handling and macOS
fixture-root canonicalization. Production download
safeguards remain unchanged. Independent re-review passed; root checks passed **423/423 offline tests**
(Core 47 / TeamCity 41 / YouTrack 335) and **24 fixed ReadOnly GETs**, zero failures/skips, with no live
writes/downloads or raw payload capture. [Source CI run 33314691369](https://github.com/iXab3r/EyeAuras.CliFactory/actions/runs/33314691369)
passed all six Ubuntu/Windows/macOS Node 22/24 jobs on that exact source commit.

[Issue #9](https://github.com/iXab3r/EyeAuras.CliFactory/issues/9) records profile isolation and
[Issue #10](https://github.com/iXab3r/EyeAuras.CliFactory/issues/10) the shared typing improvement.
The latter removed 129 redundant wrappers; its measured +51 Core lines at `869e7aa9` are a historical
trial comparison, not current totals after later fixes or a LOC saving. Original AR118 400-test /
99-file snapshot evidence likewise describes that earlier acceptance stage.

**Keep this Issue OPEN and the workstream active for formal close-out.** Source review and CI passed;
any later documentation-only head is checked separately. No merge, release or automatic closure is
claimed. Current receipts live under `.workspace/workstreams/youtrack-rest/research/`.

<!-- END ISSUE 6 INTRO -->

## Issue #9

Tail marker: `## Original finding and contract`

<!-- BEGIN ISSUE 9 INTRO -->
## Current functional and PR review status

The profile-isolation correction is pushed in [PR #12](https://github.com/iXab3r/EyeAuras.CliFactory/pull/12).
The original fix at `3df5066f` preserves exact existing names, rejects case collisions before mutation
and requires explicit manual recovery. PR review additionally corrected own-property permissions
handling for valid names such as `constructor` and `toString` in source commit
`005254d6fc4981a1fafa0a6a715c9dbd92f946aa`; no automatic migration or deletion is introduced.

Independent Core source/regression review passed. The corrected source passed **423/423 offline tests**
(Core 47 / TeamCity 41 / YouTrack 335), plus **24 fixed ReadOnly GETs** through the normal packaged
profile/keyring, with zero failures/skips and no live writes or raw payload fixtures.
[CI run 33314691369](https://github.com/iXab3r/EyeAuras.CliFactory/actions/runs/33314691369) passed all six
Ubuntu/Windows/macOS Node 22/24 jobs on that exact source commit. Earlier isolated profile tests
preserved configuration bytes, sentinel files and credentials on refused operations.

**This Issue remains OPEN for formal close-out.** The code is pushed; no merge/release is authorized.
A later documentation-only head needs its own CI verification. The original contract and checklist
below remain unchanged; these results supersede the old local-only publication status.

<!-- END ISSUE 9 INTRO -->

## Issue #10

Tail marker: `## Original outcome and contract`

<!-- BEGIN ISSUE 10 INTRO -->
## Current functional and PR review status

The accepted positional-inference change at `869e7aa9` and subsequent reviewed corrections are pushed
in [PR #12](https://github.com/iXab3r/EyeAuras.CliFactory/pull/12). Both actual integrations use the
existing literal declaration inference; **129 redundant positional string wrappers were removed**,
with domain validation and conservative fallback boundaries preserved.

The independent authoring comparison at `869e7aa9` measured +51 Core source lines and +205 test lines,
unchanged proof, and +1,108 production LF characters overall. These are historical trial costs,
not current totals after later PR fixes. The benefit is simpler, safer typing, not a LOC reduction.
Independent technical/authoring reviews passed; later PR review left the inferred-type contract intact.

Corrected source commit `005254d6fc4981a1fafa0a6a715c9dbd92f946aa` passed **423/423 offline tests**
(Core 47 / TeamCity 41 / YouTrack 335) and **24 bounded live ReadOnly GETs**, zero failures/skips,
without live writes/downloads or raw payload capture. [CI run 33314691369](https://github.com/iXab3r/EyeAuras.CliFactory/actions/runs/33314691369)
passed all six Ubuntu/Windows/macOS Node 22/24 jobs at that exact source head.

**This Issue remains OPEN for formal close-out.** No merge/release is claimed; a later documentation
head is checked separately. The original outcome, contract and acceptance history below are unchanged.

<!-- END ISSUE 10 INTRO -->
