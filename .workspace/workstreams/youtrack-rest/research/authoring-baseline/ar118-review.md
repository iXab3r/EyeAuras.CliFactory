# AR118 final independent authoring review

**PASS.** Reviewer: repo_contract. Root accepted **118 REST operations: 98 ReadOnly, 20 Update**,
plus **derived issue-attachment download1/1**, separately counted. The final shorter-batch gate
is complete; required authoring corrections: none. Exact scope belongs to block-118.json/Issue6.

## Immutable evidence and full cost

Before changes, all84 current source/test/proof hashes matched AR100 snapshot2e84c557...
The original source reference remains e0d4d1b8dc615a969a0160f69a5fb34968d9ab3d plus captured
worktree contents. Rule: nonblank handwritten TypeScript physical lines, comments included,
normal formatting; exclude generated output. Tests/support/proof remain separate. Exact paths,
contents, hashes, manifests and counting rules are in capture-working-tree.ps1 snapshots.

| Scope | AR100 | Correctness-fixed direct | Final | Delta from AR100 |
|---|---:|---:|---:|---:|
| Core production | 1741 | 1760 | 1760 | +19 |
| TeamCity production | 1100 | 1100 | 1100 | 0 |
| YouTrack production | 3217 | 4024 | 4016 | +799 |
| All production | 6058 | 6884 | 6876 | +818 |
| Tests/support | 6687 | 8264 | 8264 | +1577 |
| Local proof | 507 | 513 | 513 | +6 |

Final tests/support: Core1156, TeamCity1421 (1268 tests+153 support), YouTrack5687
(5652 tests+35 fixture). Proof: TeamCity330 +YouTrack183. No non-TS test artifacts.
From original2831/2061/330: +4045 production, +6203 tests/support, +183 proof.
All download code, shared metadata/CLI/barrel wiring, validators, helpers, tests and proof count;
download is never treated as REST119 or excluded from the cost denominator's source inventory.

- Baseline: snapshots/ar100-final.json, SHA-256
  2e84c55765941e663f5bc2b0f0e4e7d3ff5aee0e0d092f2d67b9348f32339033.
- Correctness-fixed direct: snapshots/ar118-direct.json, SHA-256
  9a671dd6714aa3faaf34aaf3e318d65c5ba778ccd724feb7e509c0911c127c36.
- Final: snapshots/ar118-final.json, SHA-256
  594bc11c7802b24f287fabac0da278e3feef6bb3c753f888836ee379e89f1e32.
- Exact sample/upload comparisons and99-file verification: ar118-equivalence.json, SHA-256
  6937cb43b1b762c491b7559c7e259004e80bea24d05a8fbfa60fc6eee88bfe5d.

## Equivalent authoring comparison

Issues list/get/update declarations and service functions are identical to AR100; local
combined costs remain **21/16/21 lines**. Shared setup is counted in the full totals above.
Core auth behavior changed for correctness; unchanged local samples do not imply the old and
new complete authentication behavior is identical.

The retained multipart trial changes only two callers and one new local helper:

| File under integrations/youtrack/src | Direct | Final | Net |
|---|---:|---:|---:|
| issue-attachments.ts | 60 | 47 | -13 |
| article-extras.ts | 101 | 88 | -13 |
| attachment-form.ts | 0 | 18 | +18 |
| Whole repository source | 6884 | 6876 | **-8** |

Issue/article upload service functions shrink20→9 and22→11 lines, but this is not a22-line
whole-cost saving: the helper and all imports yield exactly **eight fewer production lines**.
The12-line preparation block is byte-identical in both direct callers and the final helper.
It preserves requiredText, stat/regular-file validation, openAsBlob, the exact safe error,
FormData/upload1/basename behavior. Caller path and article projection validation still precede
filesystem access; Update gates and response handling are unchanged. Tests and binary-download
code are unchanged by the trial. The extra local function/file boundary is justified by two
actual consumers and one place to maintain identical preparation, with no new dispatch layer.
Earlier AR100 nullableText savings are prior history, not a new AR118 saving.

## Correctness costs, concepts and shared benefit

Core auth costs **+19 production/+425 tests** (Core276, TeamCity66, YouTrack83). This is correctness
work, not endpoint growth or authoring savings: explicit candidate precedence, automation without
prompts, validate-before-persist, fail-closed config/secret ordering and static storage errors.
It reuses existing private interaction/candidate/name checks; no public Core API or dependency
was added. Actual TeamCity and YouTrack regressions demonstrate the shared behavioral benefit.
Earlier provisional auth counts were superseded before the direct comparison was captured.

Download is a new capability with no equivalent old implementation: its own source/command
files cost304 lines, the internal metadata function23, with remaining wiring/shared tests also
included in the whole-cost table. Profile-owned paths, bounded binary transfer, signed-URL/bearer
rules, redirect refusal, temporary publication and cleanup account for real safety complexity.
Metadata uses the existing JSON request boundary; binary transfer and file publication remain
explicit integration code. They were not forced into a generic JSON/binary transport abstraction.
The direct baseline already contains the final auth and download security corrections.

YouTrack source modules grow29→36. Its barrel grows100→119 runtime names and11→13 types;
the new types describe download options/results. attachmentForm is internal, not a barrel API.
Core stays11 runtime/24 type exports. All four package manifests match AR100; no dependency
change. Existing command/profile/keyring/permission/output/RPC mechanisms continue to be shared.
Bundle commands remain explicit: shorter path literals alone did not justify another CRUD/factory
surface. The earlier TeamCity test-harness candidate stays a support-only follow-up, not required.

Original checkout HEAD was1d36395833101c920f74ecdf2749ef2f2f6a0575; native Git log
 e0d4d1b..HEAD -- packages/core found no newer accepted commit. Dirty original work was excluded
and never imported. The new Core fix belongs to this worktree, with separate reviewed evidence.

## Verification and closure

This reviewer verified all99 final saved-content/current-file hashes and nonblank counts,
unchanged manifests, the three old samples and exact moved multipart blocks. Only the expected
three source files differ from the correctness-fixed direct snapshot. Root and author independently
agree on6876/8264/513. Independent technical review reconstructed both caller edits exactly and
passed29 multipart-focused tests; the independent whole suite and root's fresh npm build/test
passed **400/400** (Core33/TeamCity39/YouTrack328), zero skips. Required auth/download security
reviews are closed. Root retained the measured multipart simplification.

Root's normal-profile/keyring packaged proof passed **24 fixed ReadOnly GET checks**, zero skips,
zero failures, exit0. It did not perform live binary downloads or mutations. Snapshot security
fixtures contain clearly synthetic rejection cases; no credential strings are reproduced here.
This reviewer inspected no credentials/private service responses and makes no commit or full
pre-commit privacy-gate claim.

**Independent authoring/simplicity verdict: PASS. Required corrections remaining: none.**
Root may close AR118 and the v1 functional gate with118 REST operations and download1/1.
Deferred v2 scope, commits, publication or GitHub issue closure are not implied by this review.
