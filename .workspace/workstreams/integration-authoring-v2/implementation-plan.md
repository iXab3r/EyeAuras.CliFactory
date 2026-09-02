# Integration authoring v2 — implementation plan

**Lifecycle:** active. **Scope:** [Issue #16](https://github.com/iXab3r/EyeAuras.CliFactory/issues/16).
Branch `codex/integration-authoring-v2`; immutable baseline
`c06efe9bcd27199776e6124122247e09685210d8`.

The Issue owns the revised outcome and acceptance contract. The original P0-P5 trial remains
historical evidence, but its -141 product/test-line close-out was rejected by the owner as too
small. P6-P10 are the corrective slice; they do not add endpoints or change public CLI behavior.

## Phases

| Phase | Bounded work | Exit gate |
|---|---|---|
| P0-P5 | Original measurement, narrow TeamCity/test trials and generation decision | Historical evidence retained; old final verdict explicitly superseded |
| P6 | Reconcile owner correction across Issue, plan, ledger and review contract | Issue allows the shared target binder and large service-local migration; records agree |
| P7 | Add Core invocation-target binding and adopt it in TeamCity and YouTrack | Both integrations consume one service-neutral API; gate/profile/RPC/type evidence passes |
| P8a | Migrate the first 50 compatible YouTrack CLI operation declarations | Help/options/gates/routes/results unchanged; helper cost and exceptions reviewed |
| P8b | Complete compatible command migration and migrate 50+ ordinary read resources | Second checkpoint records total declarations, full cost and explicit exception boundary |
| P9 | Reuse configured shared fixtures where profile/auth behavior is not under test | Test intent and coverage stay independent; affected suites pass; no service-aware Core fixture |
| P10 | Full-cost review, complete test/privacy/CI gates and publish revised PR | Metrics, tests, privacy, commit, PR and exact-head CI evidence recorded |

## Review protocol

- Measure nonblank handwritten source with `scripts/measure-loc.mjs`; report production,
  tests/support, proof, Core investment, each integration and tooling separately.
- A checkpoint counts declarations as well as lines. Review normally formatted direct and helper
  samples, TypeScript signatures, runtime safety, exceptions and conceptual vocabulary.
- Core may bind an invocation-owned target only. Service paths, DTOs, projections, options,
  validation, sanitization and response policy remain integration-owned.
- YouTrack-local operation helpers may cover only exact positional + option families. Its resource
  helpers may cover only ordinary finite collection/detail GETs. Custom query/body/status,
  mutation, upload/download, nullable and acknowledgement semantics remain direct.
- Tests keep independently authored HTTP expectations. Fixture preparation can be shared only
  when profile/auth behavior itself is not the subject.
- Focused tests run at each checkpoint. P10 requires `npm test`, diff/privacy gates and exact-head
  remote CI. A sandbox `spawn EPERM` is environment evidence, never a product-test result.

## Fixed exclusions

No universal HTTP/CRUD layer, service-neutral route/projection schema, raw route command,
DI/plugin system, endpoint expansion, compatibility path, generated expectations or hidden
schema/DSL accounting. Rejected prototypes are removed completely.
