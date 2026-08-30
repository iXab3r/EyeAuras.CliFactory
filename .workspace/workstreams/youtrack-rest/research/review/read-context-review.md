# V1.0B read-context technical review

Date: 2026-08-30. Reviewer: inventory_reviewer. Scope: Issue #6, B1-B4 plus the
already-counted identity operation's explicit fields option.

## Verdict and counter

PASS. Four new operations are exposed through the real declaration/client, boundary-tested,
and accepted once each:

- GET /api/admin/projects
- GET /api/issues
- GET /api/issues/{issueID}
- GET /api/issues/{issueID}/comments

Cumulative accepted REST operations: 5, including A1. user me --fields does not increment
that count. C may begin after orchestration reconciles this gate. No C implementation,
live availability or AR8 authoring/simplicity verdict is implied by this review.

## Contract evidence

Read the frozen Issue first-slice/default-projection/common contracts and the refreshed
B/C official-reference notes. Reviewed the integration source, export/CLI wiring, tests and
shipped README. Every read uses its declared ReadOnly gate and the shared factory's existing
profiles, keyring, output and RPC mechanisms. Authentication remains a separate strict
id,login validation; explicit user/read fields remain source-shaped and may be sparse/null.

The three collections issue exactly one page, default top 50 / skip 0, validate integer
bounds locally, and reject an oversized server response. There is no scan, retry or nested
follow-up. IDs are encoded once as opaque path segments with raw dot-segment rejection;
configured context paths remain intact. Query and fields are separate encoded query values.
Default projections match the Issue. Empty arrays succeed; malformed object/collection/JSON
responses fail safely. HTTP errors are status-only with safely parsed numeric/date Retry-After.

The actual CLI/MSW tests exercise all five read leaves in human/JSON mode and persistent
RPC, including exact forwarded fields/paging/query, URL/token/AppData profile isolation,
ReadOnly denial before HTTP and the existing RPC -32000 failure envelope. Assertions cover
the network boundary and expected protocol values, not merely helper return shapes.

## Review corrections closed

- Promise-returning client validation behavior is consistent with its asynchronous contract.
- Explicit projected data scrubs known bearer values and nested signed/credential URLs,
  including documented sign query and signed path forms, API-key variants, relative URLs
  and token fragments. Whole URL values become [redacted]. A finite normalized key set
  avoids false-positive changes to unsigned assigned/design links.
- Confirmed the relative/fragment/API-key gaps using the actual compiled getIssue with an
  injected synthetic fetch before correction; regression tests now cover those cases.
- Server pages exceeding the requested bound are rejected rather than silently expanded.
- CLI option binding assertions and a real RPC failure/redaction regression were added.

## Checks and limitations

Independently ran node --test integrations/youtrack/dist/tests/*.test.js: 42 passed,
0 failed. The implementation agent reports the final repository npm test: 88 passed
(18 Core, 28 TeamCity, 42 YouTrack). Separately reviewed the fixed five-row local proof
and independently ran its seven synthetic safety tests; see read-context-proof-review.md.

No real profile, credential, service response or live endpoint was accessed by this reviewer.
Root owns any later explicit bounded read-only proof. No source edit or commit was made by
the reviewer. The earlier minimal Core prompt fix remains separately reviewed; B adds no
new Core mechanism or dependency. AR8 will review complete setup/helper/source cost and the
saved direct list/detail/mutation comparison set; no authoring reduction is claimed here.

Frozen reviewed SHA-256:

- src/client.ts: b2a4772c7fd3cb40f0977c6211afb6d1b7c85bb6e4da3b322b8342d01cd98a7d
- src/cli.ts: fa62e32dec8c996adb3d8537bff7434ea8285323222e1c88a4169fcfd83ccc60
- src/index.ts: 0f9a4266f2b96eb46781b6db423d4026b3d7cc051f5a402df6d47e9fbd0a55bd
- tests/cli.test.ts: 4f168e932dfb255e3cf999e388a5baefa423535109c30529ee935859fa86f071
- tests/reads.test.ts: 5aa02da75b3d4cddbec392c16e98a92b22336a15a3537211a8815dd3cb2ad5f9

Paths in the hash list are relative to integrations/youtrack.
