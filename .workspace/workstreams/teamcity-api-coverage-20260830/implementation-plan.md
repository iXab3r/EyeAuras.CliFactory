# TeamCity API coverage audit — implementation plan

Status: complete. Request: audit what our TeamCity integration does not expose, including mutations,
and calculate supported versus available API coverage. This is a read-only audit, not feature
implementation; no GitHub Issue is created or modified.

## Frozen scope

[scope.toml](scope.toml) records the current TeamCity 2026.1 Swagger universe and source baseline.
[report.md](report.md) holds findings; generated operation facts and the reviewed CLI mapping
remain separate. No private endpoint, credentials, or live entity payloads may enter artifacts.

## Phases and gates

| Phase | Scope | Gate |
|---|---|---|
| 1 | Inventory command declarations, auth and client routes | Every existing service leaf and auth maps to method/path; duplicate routes count once |
| 2 | Enumerate the advertised REST API | Method/path identities unique; 449 operations reconciled by method and 30 groups |
| 3 | Compare, quantify and review gaps | 17 exposed + 432 unexposed = 449; qualified read/update totals; scoped limitations documented |
| 4 | Verify and hand off | Offline command/gate probe, repository tests, artifact consistency and privacy review |

## Review protocol

The main agent acts as integration auditor and orchestrator/reviewer. This audit needs no
delegated production-code work. Only mark phases done after recorded evidence and a review
verdict. Recheck arithmetic and CLI mappings independently of prose; keep future priorities
explicitly non-binding. Do not commit, push, mutate TeamCity, or edit GitHub Issues.
