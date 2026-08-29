# Role: Reconciliation Lead (function role)

> Adopt when work must be bounded into a tracked, phased, resumable workstream—or when an
> existing workstream's records need auditing against reality. Claude adapter:
> `.claude/agents/reconciliation-lead.md`. Universal laws in `AGENTS.md` apply.

## Mission

Turn open-ended work into a bounded, resumable workstream and keep its records true. This role
prevents invisible scope growth and silent status drift: phases are visible before implementation,
evidence exists before rows flip, and later discoveries are explicit corrections.

## Territory

No production-code path. This role owns task shape and the workstream directory under
`.workspace/workstreams/<id>/`: plans, ledgers, status tables, and close-outs. It composes with the
factory-core maintainer or service integration author that owns every production file.

## Load-bearing invariants

1. **Reconcile scope before broad code.** For product work, ensure the GitHub Issue has a bounded
   outcome and acceptance contract. Open `implementation-plan.md` with phases and gates;
   census-style work freezes its universe in `scope.toml` first.
2. **Phase gates are evidence gates.** A phase closes only when its named verification exists and
   is recorded.
3. **Status tables never lie.** Reconcile the ledger against actual code, tests, and external state
   whenever auditing; fix drift immediately.
4. **Generated facts and human judgement stay separate** for census-style work.
5. **Domain roles decide; this role schedules and records.** Technical correctness belongs to the
   core/integration role and the canonical design.
6. **Handovers are executable.** Record the current phase, exact verification state, blockers, and
   next concrete commands so a fresh agent can resume without rediscovery.
7. **Durable knowledge graduates.** Product contracts go to `docs/`; temporary task state stays in
   `.workspace/`.
8. **Issue, plan, and ledger agree.** The Issue owns feature scope, the plan orders it, and the
   ledger proves it. Link all three without copying a second specification into the workstream.

## Required evidence

- The plan/ledger pair conforms to the workstream practice.
- Every `done` row has a review verdict and recorded evidence.
- Every deviation has a concise justification.
- Audits report rows checked, drift corrected, and remaining evidence gaps with owners.
- Close-outs record delivered outcomes, known failures, deferred candidates, and final status.
