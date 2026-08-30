# TeamCity API coverage audit — implementation ledger

Lifecycle: complete. Owner/reviewer: main agent acting as integration auditor + Reconciliation Lead.

| Phase | Scope | Status | Agent | Review |
|---|---|---|---|---|
| 1 | Existing CLI/auth route census | done | Main agent | Pass: declaration/client review + mocked execution agree |
| 2 | Current Swagger census | done | Main agent | Pass: 449 unique method/path keys, 30 groups, zero normalized collisions |
| 3 | Coverage and gap analysis | done | Main agent | Pass: 17 exposed / 432 absent, all subtotal identities reconcile |
| 4 | Verification and handoff | done | Main agent | Pass: build/probe/42 tests, CSV joins/counts, artifact privacy and final source-state checks |

## 2026-08-30 evidence

Baseline: `e0d4d1b8dc615a969a0160f69a5fb34968d9ab3d`; working tree was clean.
No production-code or profile/permission changes were needed.

1. Inspected `integrations/teamcity/src/cli.ts` and `client.ts`: 17 service leaves
   (14 ReadOnly, 3 Update), 16 unique service REST operations, plus one current-user auth route.
2. Retrieved the configured server's current Swagger metadata and confirmed API/server 2026.1.
   Kept only portable method/path/operationId/tag/deprecation metadata; source address and
   credentials stayed in memory. No live mutation was requested.
3. Reconciled all 449 rows: GET 235, POST 62, PUT 92, DELETE 60. Zero deprecated flags and
   zero identity collisions. Exposed: GET 14, POST 3, PUT 0, DELETE 0.
4. `npm run build` passed.
5. A one-off Node probe used `createTeamCityCli` plus the existing synthetic
   `createTestRuntime`, injected a recording fetch, and disabled the real fetch. It invoked
   all 17 service leaves and `auth status`: 18 successful requests, 17 unique Swagger matches,
   no unverified supported row. A default ReadOnly runtime rejected all three Update commands
   without reaching fetch. No persistent user state or service data was involved.
6. `npm test` initially hit sandbox `spawn EPERM` before tests ran. Retried with process-spawn
   permission: all 42 tests passed (14 Core + 28 TeamCity).

## Deviations and interpretation

- This is a census/report request, not a new feature contract: no Issue/workstream feature scope
  was expanded. Existing feature records were left unchanged.
- Schema metadata required a direct authenticated GET because our product does not expose a
  Swagger command. This was discovery, not a substitute for the packaged-CLI integration proof.
- Route exposure is intentionally not called complete parameter or workflow support.
  Non-Swagger helpers and token-specific permissions are excluded.
- No percentage of hypothetical future custom permissions is asserted: GET/non-GET buckets
  are accounting only.

## Close-out

Final review: pass. Parsed the saved CSV files independently: 449 unique operations, 17 mapped
operations, 432 absent operations, 30 groups; method/category subtotals and every exposure flag
agree with the mapping. All mapped rows exist in the inventory.

Reviewed all six artifacts for credentials, credential-bearing URLs, private server references,
personal email addresses, private keys, and unexpected network addresses. No findings; all
concrete web links use the public JetBrains documentation domain. No raw live responses saved.
`git diff --check` passed; the only working-tree addition is this audit directory.

Delivered: frozen census, exact CLI mapping, qualified percentages, full missing-operation list,
and prioritized follow-up candidates. Known audit failures: none. Evidence boundary: no live
Update execution, no per-token authorization audit, and no exhaustive parameter/workflow census.
Future implementation candidates remain recommendations, not accepted work or created Issues.
No commit or push was performed.
