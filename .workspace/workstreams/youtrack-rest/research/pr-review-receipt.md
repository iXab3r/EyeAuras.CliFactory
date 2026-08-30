# PR #12 independent review and correction receipt

Status: independent local correction review accepted; fixing commit/push and new-head CI pending.
[PR #12](https://github.com/iXab3r/EyeAuras.CliFactory/pull/12) initial reviewed range:
`e0d4d1b8dc615a969a0160f69a5fb34968d9ab3d..7a9811f56b9d836fadeacae65da872cfc55900dc`.
Findings restore the existing contracts in Issues #6/#9; no new feature Issue or inventory is needed.

| ID | Priority | Confirmed finding and bounded correction | Owner | State |
|---|---|---|---|---|
| R1 | P1 | YouTrack `currentUser` bypasses shared result scrubbing, permitting percent-encoded active bearer or signed URL content in identity output. Route identity through the shared safety contract and prove synthetic identity regressions. Source: `integrations/youtrack/src/client.ts`; tests: `integrations/youtrack/tests/client.test.ts`. | youtrack_auth | CLOSED locally: independent source review and 10 compiled assertions PASS |
| R2 | P2 | Valid names such as `constructor`/`toString` encounter inherited Object.prototype members in profile permissions; `getPermissions` throws on the inherited function. Use own-property checks without reserving otherwise-valid names or changing profile identity. Source: `packages/core/src/profile-store.ts`; add meaningful offline profile regressions. | repo_contract | CLOSED locally: independent source review and seven prototype-like profile names PASS |
| R3 | CI blocker | macOS `os.tmpdir()` may resolve through `/var` aliases; download fixtures then violate the deliberate production no-links policy. Canonicalize isolated test temp roots only; keep production link/junction rejection unchanged. Tests: `integrations/youtrack/tests/attachment-download.test.ts`. | youtrack_attachments | Static independent review PASS; corrected macOS CI execution pending |

Original-range review is complete: Core and safety each reported one finding above; operations
review reported none. Its independent tie-out confirmed 117 service leaves (97 ReadOnly / 20 Update),
118 REST routes (98 ReadOnly / 20 Update), and help execution for all 116 REST declaration leaves
with refusing profile/fetch dependencies and no I/O. Disputed official response shapes were checked.
Independent correction verdicts are recorded in the table; R1/R2 are closed locally and R3 awaits
its actual macOS CI witness after push. Synthetic regression fixtures
must contain no real token, private endpoint, identity or payload. No real mutation is authorized.

## Initial CI evidence

[Run 33314273329](https://github.com/iXab3r/EyeAuras.CliFactory/actions/runs/33314273329) completed on
initial head `7a9811f56b9d836fadeacae65da872cfc55900dc`: Linux Node 22/24 and Windows Node 22/24
passed; macOS Node 22/24 failed 17 YouTrack download tests. macOS Core 44 and TeamCity 41 passed.
The final matrix is therefore FAIL, not partial success. The failure diagnosis is fixture path
canonicalization; it does not justify weakening production download safeguards.

## Corrected local verification and next gate

Root's fresh `npm test` passed **423/423** (Core 47 / TeamCity 41 / YouTrack 335), zero failures or
skips. The fresh built normal-profile proof passed all **24 fixed GETs**, zero failures/skips;
only sanitized counts were returned, with no real writes, downloads or raw payload capture.
Independent Core review accepted source plus seven prototype-like names; independent safety review
accepted source plus 10 compiled assertions. Fixture canonicalization passed static review and
retains production no-links safeguards. Source corrections are frozen; local review is accepted.

Root now performs final staging/privacy, commits and pushes corrections plus these management
records and the unchanged original PR body. The fixing commit SHA is not known yet. PR3 remains
pending that commit/push; PR4 requires the exact new remote head's CI, including macOS. The old
run's four passing jobs do not prove the corrected matrix green. No merge/release/live-write
permission is inferred. A later PR-body update will record actual final-head results.
