# Block 50 — query, context and shared-boundary review

Independent technical verdict: PASS for B50.1 (6 operations) and B50.4 (7 operations). This does not accept the authoring checkpoint or any unreviewed operation. IDs are exactly those in `block-50.json`.

## Accepted operation identities

- POST /api/commands/assist — ReadOnly
- POST /api/commands — Update
- POST /api/search/assist — ReadOnly
- POST /api/issuesGetter/count — ReadOnly
- GET /api/savedQueries — ReadOnly
- GET /api/savedQueries/{queryID} — ReadOnly
- GET /api/activitiesPage — ReadOnly
- GET /api/issues/{issueID}/activitiesPage — ReadOnly
- GET /api/issues/{issueID}/comments/{commentID} — ReadOnly
- POST /api/issues/{issueID}/comments/{commentID} — Update
- GET /api/issues/{issueID}/vcsChanges — ReadOnly
- GET /api/issues/{issueID}/vcsChanges/{changeID} — ReadOnly
- GET /api/issues/{issueID}/sprints — ReadOnly

## Evidence and corrections

Read the actual domain clients, recursive command declarations, mounted CLI, shared helper changes and native-fetch MSW tests. Official spot checks included Command Suggestions, Issue Count and ActivityCursorPage entity documentation; domain research notes retain the other exact official references.

Query selection is explicit and bounded to 1–20 distinct IDs; numeric database references and readable references are encoded as documented body fields. Unicode and punctuation in readable prefixes are not blocked by an invented ASCII rule. There is no target search expansion, silent/runAs option, arbitrary body/path escape hatch or retry. Safe parse errors cover required query/ID/caret syntax before onboarding. Cross-option caret bounds are checked before fetch. Pending -1 and nullable count remain source data; ReadOnly POSTs use strict object responses, not mutation empty-success semantics. Saved-query paging is one bounded request.

Activity input was corrected to the approved categories/cursor/reverse/fields-only surface. Required categories use a safe parser, including empty CSV validation. Defaults retain the complete cursor envelope; explicit fields allow sparse results while checking the types of any present envelope members. Tests now corrupt individual members of an otherwise complete envelope, so they exercise type checks independently of missing-member rejection. There is no invented top/skip/page-size or automatic traversal. Comment update is the explicitly scoped text-only write; multiline text is preserved and extra fields are rejected. VCS/pull-request and sprint projections remain finite and nullable source-shaped.

The shared transport remains YouTrack-local. It explicitly distinguishes GET, ReadOnly JSON POST, mutation POST, DELETE and native multipart. DELETE has no body/content-type; multipart leaves boundary generation to native fetch. Empty successful mutations return null, but literal JSON null and malformed/wrong-shaped success bodies fail. Errors never forward response bodies, redirects are refused, and recursive output scrubbing is reused. Existing first-eight behavior is preserved. CLI handlers use the same factory tree, profiles, permission gates and output/RPC mechanisms; no new Core mechanism was introduced for this block.

Independently ran the compiled offline query/context/shared regression subset: 49/49 PASS. After the last targeted test and ID-validation corrections, independently ran query 10 + context 14 + transport 3 = 27/27 PASS. Verified emitted query code and tests contain the final control-character validation and Unicode/punctuation selection cases. Actual CLI tests cover human/JSON bindings, exact method/path/query/body, ReadOnly POST with Update disabled, per-category denial, profile-scoped credentials and persistent RPC recovery with sanitized failures. No real-service call, real profile read, credential access or mutation was performed by this reviewer.

## Reviewed SHA-256 fingerprints

| File | SHA-256 |
|---|---|
| integrations/youtrack/src/client.ts | 14450CD5A9896935CFB352373AEE1F10C6946CC77DF5B773B320DA0F62E233F7 |
| integrations/youtrack/src/cli.ts | DB99EF8A5350391B6657830E235FB3093A8F65C5297D35021FB45F56EBC8F54E |
| integrations/youtrack/src/cli-support.ts | 14013884F0F830CE78C460CC4B5E0A792EBB2363AE7C07DADC6F9979D99B9C35 |
| integrations/youtrack/src/issue-query.ts | E963095D3C00A3E134838497D3B12DE82F7774D42A95EA63412805ABB8964880 |
| integrations/youtrack/src/issue-query-commands.ts | 556D42F8932649C97BCE6DB469465F460A7AF460F2A195F10099F63908A93C78 |
| integrations/youtrack/tests/issue-query.test.ts | D5E8DF7B6B6EC822127C5BD6D03DABD7D9B1B2268F8F2257857B60F4DCEBD962 |
| integrations/youtrack/src/issue-context.ts | F4FAA325E634BA0028F8AC22D391D5F31F586D8595A8E88A9369FFEC1F49D64A |
| integrations/youtrack/src/issue-context-commands.ts | E0F4D1594E7C3FD31954A24A9B8AAA5EAC0B8A24716EF4F44FB09D8126F3259B |
| integrations/youtrack/tests/issue-context.test.ts | 9B14F1F1BFE527874C228D662ECA203930E13A200E6C72BCA890A41878F05DEA |
| integrations/youtrack/tests/transport.test.ts | A335364709F4F4DA7DD1B788D6C4951F6791A49C1A873A419B26DBE24E3D649F |

Full aggregate tests, any later export/README edits, the optional expanded local proof and AR50 closure remain separately tracked. Operation 51 stays blocked until AR50 PASS and required corrections close. Pre-existing Core authentication limitations recorded by the first-eight review are not claimed fixed here.
