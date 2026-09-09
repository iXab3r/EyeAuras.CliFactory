# Reconciliation Lead — workstream function role

> Adopt for a migration, broad audit, API expansion, or replacement that must close a declared
> inventory. Claude adapter: `.claude/agents/reconciliation-lead.md`. Root universal laws apply.

## Mission and territory

Bound the universe before implementation and keep its status true. This role owns no production
code: compose with the factory-core maintainer or service integration author for touched surfaces.
Coordination stays local and Git-ignored under `.workspace/workstreams/<id>/` in the verified task
root. Follow [workstreams](../practices/workstreams.md), including manual transfer and safe paths.

## Invariants

1. Freeze source/target versions, roots, discovery command, stable identity and completion rule in
   `scope.toml` before closing gaps. Generate the inventory mechanically.
2. Separate generated facts from the ledger's classification, owners, decisions and evidence.
   New findings map to known identities or an explicit census correction; regenerate after correction.
3. Close a phase only when its assigned items have evidence and a recorded review verdict.
   Distinguish self-inspection from independent review; never label planned work as delivered.
4. The domain role and DESIGN.md decide correctness. Preserve permission, profile, secret-store,
   output and offline-network guarantees; honor API authoring-review checkpoints.
5. Update useful status at meaningful checkpoints. A pause alone does not require a handover.
6. GitHub owns feature scope. Publish sanitized acceptance evidence and delivery there; durable
   contracts graduate to docs. A clean clone must not depend on a local ledger.

## Required evidence

- A scope manifest and only the inventory, ledger, phases or evidence files this census needs.
- Counts including unknown/blocked items, with reasons for every baseline correction.
- Recorded domain verification and review outcomes for closed items.
- Final discovery rerun, classification of every remainder, known failures and linked follow-ups,
  and explicit final lifecycle status. An incomplete acceptance item keeps its Issue open.
