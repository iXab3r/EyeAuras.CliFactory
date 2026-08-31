# TeamCity v2 — checkpoint +350 / S8 review

Date: 2026-08-30. Verdict: **pass, local working tree**. S8 adds50 routes (24 GET,
26 mutations), reaching **367/449 (81.74%)**, GET175/235 (74.47%), mutations192/214
(89.72%);82 remain. The [published contract](https://github.com/iXab3r/EyeAuras.CliFactory/issues/5#issuecomment-5468677667)
was read back exactly. [s8-coverage.csv](s8-coverage.csv) reconciles all50 compiled cases
with the frozen census, without overlap. No commit/push or real mutation/profile change.

## Evidence and limits

All50 boundary cases failed before implementation. Full `npm test`: **479 passed
(20 Core +459 TeamCity)**, zero failures/skips. Ten focused tests exercise all gates,
composite cloud identity escaping, typed config/URL validation, HTTP202-only scheduling,
full-map empty/false semantics, reset failure after mutation, explicit keyring inputs,
preflight of every secret mapping, safe projections and persistent two-profile RPC.
Privacy gate:127 tracked/untracked files plus working/staged diffs,51 synthetic matches,
zero unresolved findings. The previous fixed19-route ReadOnly proof passed after S7;
S8 introduces no new live calls. Repeat proof at final reconciliation.

Versioned config parameter DELETE is a documented native void action, not a promise that
current servers can clear every parameter. The exposed subset is explicit `vcsRootId`
plus confirmation. Result `resetRequested` means actual2xx only; an HTTP error remains an
error and can occur after mutation in older official source. No retry, rollback claim,
or fabricated successful-clear postcondition. Current-server mutation semantics are not
live-verified. Other mutations likewise have offline contract evidence, not live proof.
See [S8 research](s8-research.md) and the current-distribution evidence limits in
[S9 research](s9-research.md). A large repeated public-archive scan was denied for resource
footprint and not bypassed; smaller source/schema alternatives informed this narrow contract.

## Authoring and simplicity

Nonblank handwritten TypeScript, formatted at width100; helpers/DTOs/security included:

| Surface | +300 | +350 | Delta |
|---|---:|---:|---:|
| Core production |1742|1742|0|
| TeamCity production |6440|7620|+1180|
| Combined production |8182|9362|+1180|
| Core tests |832|832|0|
| TeamCity tests |6595|7629|+1034|
| Local proof |344|344|0|

S8=23.60 production lines/route; cumulative6531/350=18.66. This is not a productivity
percentage: explicit secret handling and cloud composite IDs differ from ordinary CRUD.
Equivalent direct/bound detail-list-mutation declarations remain6/15/13 versus6/12/7:
the same `clientLeaf` binds profile context, so no repeated auth/output/help/RPC plumbing.
Actual shared cost: command-support79 lines unchanged; input-secret helpers42, models224,
infrastructure tree431, with all transport/concrete methods counted in client3094.

Review corrections: moved credential-input command declarations out of the module used by
the HTTP client; dependency now points to plain keyring helpers, not a CLI builder. Reused
the existing property validator to reject credential-bearing URL queries, closing a test-first
bypass across its TeamCity consumers. VCS roots now compose as ordinary child declarations,
avoiding construction/unpacking of a second parent tree. Cloud/provider, VCS and settings
semantics stay integration-owned; no generic REST registry or new Core API is justified by
a second real integration. Existing custom gates and ScopedSecrets are usable by other CLIs.

Main agent performed technical/reconciliation review; research agent supplied evidence only.
Gate closed. Continue S9 under the owner's autonomous-completion mandate.
