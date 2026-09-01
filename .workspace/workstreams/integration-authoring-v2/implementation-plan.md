# Integration authoring v2 — implementation plan

**Lifecycle:** active. **Scope:** [Issue #16](https://github.com/iXab3r/EyeAuras.CliFactory/issues/16).
Branch `codex/integration-authoring-v2`; immutable baseline
`c06efe9bcd27199776e6124122247e09685210d8`.

The Issue owns the outcome, in/out scope, behavioral contract and acceptance criteria. This plan
orders execution and evidence. The endpoint inventory does not change. No live mutation, profile,
credential, npm publication or compatibility work is authorized.

## Phases

| Phase | Bounded work | Exit gate |
|---|---|---|
| P0 | Reproducible LoC command, frozen all-workspace baseline, exact candidate inventory | Tool output reconciles the baseline; scope/ledger reviewed before product edits |
| P1 | Existing `clientLeaf` adoption in compatible TeamCity root leaves; RANDOM proof-only export | Public command/proof behavior unchanged; full-cost source measurement and focused tests pass |
| P2 | Small TeamCity-local text-response helper trial, then only behaviorally identical consumers | Direct/helper samples and all affected route cases pass; net source/concept verdict recorded |
| P3 | Existing testing-helper adoption in one TeamCity and one YouTrack family | Independent expectations and scenario coverage remain; test/support full cost and verdict recorded |
| P4 | Recount residual TeamCity families; bounded accept/reject trials only where exact repetition remains | Every prototype retained with evidence or removed; no speculative Core/service abstraction remains |
| P5 | Full-cost service-local generation decision and workstream close-out | Explicit accept/reject verdict; final metrics, tests, privacy, CI and known deferrals recorded |

## Review protocol

- Use `scripts/measure-loc.mjs` with the frozen revision and working tree; report production,
  tests/support, proof, functional roles and tooling separately.
- Preserve normally formatted same-capability command, request and contract-test samples. Count
  helper, descriptor, generator, override, import/export and test cost; generated output is not a
  saving by itself.
- A phase implementation moves to `awaiting review`; only the orchestrator/reviewer records `done`.
- Existing Core surfaces are preferred. A new Core public concept requires TeamCity and YouTrack
  consumption of the same service-neutral shape in the same retained change.
- Keep service paths, DTOs, locators, projections, validation, permissions and response policy local.
- Focused tests run per phase. Final acceptance requires `npm test`, exact-head CI and the privacy
  gate. Local real-service proof is not a merge gate and no live operation is inferred.

## Fixed exclusions

No universal HTTP/CRUD layer, connection binder, broad option inference, raw route command,
DI/plugin system, file-size-only client split, endpoint expansion, compatibility path or hidden
schema/DSL accounting. Rejected prototypes are removed completely.
