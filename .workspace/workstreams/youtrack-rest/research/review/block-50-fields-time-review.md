# Block 50 independent fields and work-time review

Reviewer: inventory_reviewer/fields_time_review. Date: 2026-08-30.
Scope authority: Issue #6 and block-50.json. Production authors are separate agents.
No production changes, builds, commits, service calls, profile reads or credential access by this reviewer.

## B50.5 technical verdict: PASS (seven operation identities)

| Method/path | CLI | Permission |
|---|---|---|
| GET /api/issues/{issueID}/timeTracking | issues time-tracking get | ReadOnly |
| GET /api/issues/{issueID}/timeTracking/workItems | issues work-items list | ReadOnly |
| POST /api/issues/{issueID}/timeTracking/workItems | issues work-items add | Update |
| GET /api/issues/{issueID}/timeTracking/workItems/{itemID} | issues work-items get | ReadOnly |
| POST /api/issues/{issueID}/timeTracking/workItems/{itemID} | issues work-items update | Update |
| GET /api/workItems | work-items list | ReadOnly |
| GET /api/workItems/{itemID} | work-items get | ReadOnly |

Independent source and actual mounted CLI review found no blocking defect. Verified one request, encoded opaque IDs under the profile context, finite projections, bounded offset pages, sparse/null result preservation, no implicit follow-up reads, and scrubbed output. Global work-items query is documented and exposed; issue-local query is rejected. The optional remaining global filters are explicitly deferred.

Create requires duration; update requires at least one writable field. Both duration representations are accepted and forwarded when supplied. Author/type selectors use explicit id objects; date/author are never fabricated. Nullable author/type/text/updated and absent fields remain distinct. Every Update leaf is denied before fetch by default. HTTP rejection never retries; successful empty response returns null. Direct and CLI/RPC tests exercise safe diagnostics, profile permission isolation, and continuation after errors.

Independent execution after the lead's coherent build: 29/29 tests passed, exit 0. This consists of 12 field-client tests plus 11 work-time client and 6 work-time CLI tests. Therefore B50.5 evidence is 17/17 focused tests. The initial command also named a not-yet-existing fields CLI test path; Node ignored that nonexistent argument. Its absence was checked explicitly, and no fields CLI evidence is claimed from this run.

Reproducible focused command (compiled files only):

```text
node --test integrations/youtrack/dist/tests/issue-time.test.js integrations/youtrack/dist/tests/issue-time-cli.test.js
```

Reviewed SHA256:

| File under integrations/youtrack | SHA256 |
|---|---|
| src/issue-time.ts | 7C4ED35301D49593826415F000E781371A47C0DD0F03B6DF8AF4D20C5210AC6D |
| src/issue-time-commands.ts | 37C3D3AD1A7EF18709D11D0EA628330637F93D6FBF4EF628E0DAB62EAFDC7C10 |
| tests/issue-time.test.ts | 521EE7F2C349C9760008EDC20C6CA0FA1A97C330494F134197C0DFBAB64D4E14 |
| tests/issue-time-cli.test.ts | 166BEA32F5F3720B923C5CEBCC27FD6831678EB655AB1AF1D9B516A96EF44A63 |
| src/client.ts | 14450CD5A9896935CFB352373AEE1F10C6946CC77DF5B773B320DA0F62E233F7 |
| src/cli.ts | DB99EF8A5350391B6657830E235FB3093A8F65C5297D35021FB45F56EBC8F54E |

Independent official-reference checks: [issue collection/create](https://www.jetbrains.com/help/youtrack/devportal/resource-api-issues-issueID-timeTracking-workItems.html), [issue detail/update](https://www.jetbrains.com/help/youtrack/devportal/operations-api-issues-issueID-timeTracking-workItems.html), and [global list filters](https://www.jetbrains.com/help/youtrack/devportal/resource-api-workItems.html). The method-specific writable duration contract takes precedence over the entity's read-only labels, as recorded in the author's research note.

## B50.2 technical verdict: PASS (seven operation identities)

| Method/path | CLI | Permission |
|---|---|---|
| GET /api/admin/projects/{projectID} | project get | ReadOnly |
| GET /api/admin/projects/{projectID}/customFields | project field list | ReadOnly |
| GET /api/admin/projects/{projectID}/customFields/{fieldID} | project field get | ReadOnly |
| GET /api/users | user list | ReadOnly |
| GET /api/issues/{issueID}/customFields | issues fields list | ReadOnly |
| GET /api/issues/{issueID}/customFields/{fieldID} | issues fields get | ReadOnly |
| POST /api/issues/{issueID}/customFields/{fieldID} | issues fields set | Update |

All seven source operations and all eighteen concrete issue-field classes were independently reviewed. No blocking source or boundary defect remains. State-machine writes use event.id and reject value; normal fields reject event. Single-value null clearing, multi-value empty arrays, primitive values, safe date timestamps and text objects preserve their documented distinction. Multiple documented reference selectors and both period representations are accepted and forwarded. An earlier exclusive-selector proposal was corrected before source acceptance. Unknown types/root/nested keys fail with fixed safe diagnostics.

Default project-field projection uses field.fieldType.isMultiValue, never an invented direct multi property. Reads keep sparse explicit projections and nullable/polymorphic source values. No automatic bundle or transition discovery is introduced; possibleEvents is an explicit projection. Six read commands and the set command were exercised through the actual mounted CLI in human and JSON modes. Every leaf has denial-before-fetch evidence. Persistent RPC verifies two-profile URL/token/AppData separation, default Update denial, empty success and continuation after a sanitized HTTP failure. Missing or malformed required body fails before keyring access.

After the author froze source and tests and built the integration, this reviewer independently ran all four compiled test files: **39/39 PASS, exit 0**, comprising B50.2 direct12 + CLI10 = 22, and B50.5 direct11 + CLI6 = 17. The previously missing fields CLI file was read in full and its tests actually executed in this final run.

```text
node --test integrations/youtrack/dist/tests/issue-fields.test.js integrations/youtrack/dist/tests/issue-fields-cli.test.js integrations/youtrack/dist/tests/issue-time.test.js integrations/youtrack/dist/tests/issue-time-cli.test.js
```

Final field SHA256:

| File under integrations/youtrack | SHA256 |
|---|---|
| src/issue-fields.ts | B62B06C9361D80FCE942928254136B42C4AE65B33086F08CFA580E45F382B59E |
| src/issue-fields-commands.ts | 821CF3D0AACF11514285529B3850E84FED076E580310006B93A3E4659DB49687 |
| tests/issue-fields.test.ts | 3DC2A03441382A3F0071AF0A405F92639A2C0697F18F3F9F2CE0208FE9AC3521 |
| tests/issue-fields-cli.test.ts | 5C0F68C263E51AF92B36A80B0352948F706435589122BE63ACD2BD51088A7147 |

Shared client and mounted CLI hashes are unchanged from the B50.5 table above. Independent official checks include [concrete field types and values](https://www.jetbrains.com/help/youtrack/devportal/api-concept-custom-fields.html), [declared customFields route](https://www.jetbrains.com/help/youtrack/devportal/operations-api-issues-issueID-customFields.html), [date representation](https://www.jetbrains.com/help/youtrack/devportal/api-entity-DateIssueCustomField.html), and [state-machine event semantics](https://www.jetbrains.com/help/youtrack/devportal/api-entity-StateMachineIssueCustomField.html). Per-family author notes record additional source links and the root-approved compatible contract pinning.

These two verdicts cover fourteen exact operation identities (eleven ReadOnly, three Update). They do not advance counters directly. AR50 authoring review, repository-wide verification, final shared-boundary review and counters remain with the separate reviewers and orchestrator; this domain verdict does not authorize operation 51. No real-service result or write is claimed.

## AR50 follow-up: period/work duration equivalence check

The two payloads belong to distinct REST entities: [PeriodValue](https://www.jetbrains.com/help/youtrack/devportal/api-entity-PeriodValue.html) for a period custom field and [DurationValue](https://www.jetbrains.com/help/youtrack/devportal/api-entity-DurationValue.html) for a work item. Both entity tables declare minutes as Int and presentation as String. Their writable shapes were independently confirmed in the custom-field concept guide and the work-item POST method; the entity read-only labels alone are not the write contract.

Current source differs only in local validation here: period minutes allow a nonnegative JavaScript safe integer, work-item minutes additionally cap at 2147483647; period presentation uses narrative text validation while work duration rejects control characters. No documented numeric distinction was found. Harmonizing the minute maximum to the existing Int32 policy is a reasonable small validation correction, with accepted/rejected boundary tests and an updated research note. The retrieved REST pages name Int but do not explicitly state its bit width or numerical bounds, so Int32 is a conventional type interpretation and local policy, not an independently quoted server maximum.

The REST presentation fields do not state a single-line restriction. Narrowing period presentation merely to reuse a helper is therefore not automatically equivalent; JSON body encoding already prevents header/URL injection. Preserve the existing behavior during a pure refactor, or obtain an explicit orchestrator decision before a contract change. No shared helper was designed or source changed by this reviewer. Root authorization and a fresh technical review remain required for any trial. This follow-up does not itself retract accepted endpoint coverage or claim a proven server failure.
