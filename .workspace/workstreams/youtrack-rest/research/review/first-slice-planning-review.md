# First-slice and authoring-cadence planning review

Reviewer: `inventory_reviewer`, 2026-08-30.

**Verdict: PASS for the proposed Issue update and frozen baseline evidence.**
No implementation or authoring checkpoint is passed by this planning verdict.
Current accepted YouTrack operations remain **0**.

Reviewed Issue body SHA-256:
`b5d0b9c49366b7acd42e50ee805564b6316d97c4f3dfb5d93c1a367cb65a7d08`.
Read current repository AGENTS law 13 and `docs/practices/integration-authoring-reviews.md`.
The copied practice text matches the source policy; no production source was imported.

## First slice

The proposed eight operations match existing inventory identities: identity, project list,
issue list/detail, issue create/update, and comment list/add. They comprise five ReadOnly
and three Update operations. Reads precede writes, with an intervening review. Restricted
narrative bodies, exact projections, two-profile/auth/output evidence, denial before fetch,
MSW success/error contracts, and ordinary slice review form a bounded useful first slice.

Authentication validation and `user me` reuse one identity operation and count once.
Typed fields, commands, attachments, arbitrary request bodies, and hidden retries are
outside this first slice. This planning turn makes no live YouTrack calls; default tests
remain offline and no live mutations form implementation proof. A future explicit bounded
ReadOnly proof through the packaged CLI, normal profile, and keyring remains optional under
the canonical design. Server-required nondefault custom fields
produce a safe failure, not invented defaults or a false universal creation guarantee.
Future field expansion does not inflate the endpoint counter.

## Mandatory cadence and measurement

The reviewed contract retains cumulative checkpoints at 50, 100, and final 118 accepted
operations. The normal eight-operation review does not reset that counter. Operation 51
or 101 may not be implemented until the preceding authoring review passes and required
corrections close; a slice crossing a boundary must be split. Final review includes the
delivered derived-download code cost despite its separate capability count, and reopens
if that source is added afterward.

The metric counts total handwritten Core plus every integration source; tests, support,
fixtures, and local proof remain separate. Exact equivalent list/detail/update examples
and their helper/setup cost are preserved, alongside concepts, dependencies, and call
layers. Actual direct YouTrack samples at eight establish the later comparison benchmark;
the absent initial YouTrack code and nonidentical TeamCity domain behavior cannot prove
an authoring reduction. Uncommitted source hashes are allowed without forcing a commit.

New shared extraction requires real TeamCity and YouTrack consumer evidence. Existing
Core improvement may be checked for service coupling without inventing a third product.
No mandatory abstraction, percentage target, generator/DSL, hidden setup, minification,
weakened typing/gates/help/error handling, or test deletion is rewarded. Clear direct code
is acceptable when a proposed abstraction is not a net improvement. Parallel accepted
Core changes require explicit provenance/attribution; the original baseline and cumulative
counter survive a later approved integration, and this turn authorizes no merge.

## Independently verified baseline

Read `research/authoring-baseline/{README.md,baseline.json,recount.ps1}` and ran the
frozen recount. Its parsed JSON exactly equals the persisted baseline (deep canonical
comparison). The script now pins the source revision and cannot relabel a different
revision with frozen sample ranges or a false zero baseline.

- Source commit: `e0d4d1b8dc615a969a0160f69a5fb34968d9ab3d`.
- Exact measured files: 29.
- Production: Core 1,731 + TeamCity 1,100 + YouTrack 0 = 2,831 nonblank TS lines.
- Tests/support: Core 753 + TeamCity 1,155 + support 153 = 2,061 lines.
- Separate local proof: 330 lines.
- Independently recounted current unchanged source files with the same nonblank rule;
  the production and test/support/proof totals agree with immutable Git evidence.

Comments and normal formatting are counted; generated output is excluded. Fixed source
ranges are explicitly limited to the frozen commit and include warnings about shared
cost and cross-service behavior. The reference process-test isolation limitation is
recorded, not silently copied or claimed fixed.

Baseline SHA-256:
`18d1c72ee2a490ca83ebfc151584eb93a122354a85b9ce649e5fa9994249d999`.
Frozen recount SHA-256:
`13bb555281e531f57ef38441423faf989fbe47e83f3b2d8b7c7203a2121c7aec`.

## Remaining management work

No unresolved planning deficiency remains. The orchestrator owns Issue publication and
readback. Plan/ledger reconciliation follows that Issue scope update; this verdict does
not claim they were already synchronized, nor that any first-slice code, test run,
50/100/118 checkpoint, commit, push, or live-service proof exists.


## Final management consistency review

**PASS.** After the orchestrator reported exact Issue #6 amendment/readback, independently
read the reconciled `implementation-plan.md`, `implementation-ledger.md`, `scope.toml`,
and `authoring-review-template.md`.

- Issue body remains the approved `b5d0b9c49366b7acd42e50ee805564b6316d97c4f3dfb5d93c1a367cb65a7d08`.
- Plan references Issue-owned first-eight contracts rather than duplicating the REST inventory.
- V1.0A/B/C cumulative targets are 1/5/8, with reads reviewed before mutations.
- AR8, AR50, AR100, AR118 and delivery remain pending; accepted endpoint IDs are empty,
  accepted operation count is 0/118, and derived capability count is 0/1.
- The review template requires complete source/setup cost (including untracked additions),
  fixed same-capability evidence, separate tests/support, independent simplicity verdict,
  corrective closure, and final download cost. Frozen recount cannot hide new source files.
- Current ledger handover supersedes historical preparation narratives, records Issue-first
  reconciliation, preserves parallel TeamCity isolation, and makes no implementation/test
  or authoring-reduction claim. Optional future explicit ReadOnly local proof remains allowed.

No unresolved consistency deficiency remains. This is planning/readiness approval only;
the first slice and all quantitative authoring checkpoints still require real implementation,
independent evidence, tests, and their future reviews.
