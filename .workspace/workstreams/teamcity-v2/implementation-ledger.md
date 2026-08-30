# TeamCity v2 — implementation ledger

Lifecycle: active. Implementation has not started.
Feature contract: [Issue #5](https://github.com/iXab3r/EyeAuras.CliFactory/issues/5).
Working branch: `feature/teamcity-v2`.

| Phase | Scope | Status | Agent | Review |
|---|---|---|---|---|
| 0 | Census, Issue and branch setup | awaiting review | Main agent / Reconciliation Lead | Issue and linked branch created; publication/privacy verification pending |
| 1 | Project/job authoring | pending | Unassigned | Exact slice contract required in Issue before code |
| 2 | Advanced launch and queue | pending | Unassigned | Not started |
| 3 | Build evidence, annotations and triage | pending | Unassigned | Not started |
| 4 | Infrastructure and configuration | pending | Unassigned | Not started |
| 5 | Administration and final reconciliation | pending | Unassigned | Not started |

## 2026-08-30 — phase 0

Owner request: create a separate GitHub Issue containing the complete API inventory and current
state; implement follow-ups on `feature/teamcity-v2`. This turn sets up tracking and branch only.

- Confirmed there was no open TeamCity v2 Issue or existing `feature/teamcity-v2` branch.
- Baseline local and remote `main`: `e0d4d1b8dc615a969a0160f69a5fb34968d9ab3d`.
- Reused the completed [449-operation audit](../teamcity-api-coverage-20260830/report.md):
  17 exposed, 432 missing; read-like 14/235, update-like 3/214.
- Created Issue #5 with all 449 method/path checklist rows (17 checked, 432 unchecked),
  existing CLI mapping, metric limitations, future slices, permission review and closure contract.
- Created the branch through `gh issue develop 5 --base main --name feature/teamcity-v2 --checkout`.
  GitHub reports it linked to the Issue; the local checkout is on that branch.
- Before Issue publication, scanned all tracked and pending files (71 at that point): no unresolved
  privacy findings; credential-shaped literals were synthetic fixtures. Published no private URL,
  real ID, credential or raw service payload.
- No API implementation, user-profile change, permission grant or real service mutation occurred.
- Retrieved the published Issue and compared its complete body with the reviewed draft: exact
  match, all 449 rows present, Issue open and labeled enhancement. Verified the linked branch.
- Re-ran `npm test` on the feature branch: 42 passed (14 Core + 28 TeamCity).
- Tracker files and the frozen audit are prepared for publication; phase 0 remains awaiting review
  until the committed branch artifacts and links are verified remotely.

## Next executable step

After phase 0 publication, phase 1 is the first implementation candidate. Read the Issue's P1
contract and current integration/core design; propose the exact smallest project/job authoring
leaf set in the Issue before broad code. Start with auth/profile-backed ReadOnly discovery and
synthetic network-boundary tests. Do not treat the REST checklist alone as a complete payload design.

Full implementation remains pending; publishing the tracker is not completion of TeamCity v2.
