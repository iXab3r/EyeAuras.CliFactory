# GitHub Issues in the development loop

> **Status: binding practice.** GitHub Issues are the discussion and scope boundary for planned
> and unplanned product work. They complement durable documentation and tracked workstreams; they
> do not replace either.

## Authority by artifact

| Artifact | Owns | Does not own |
|---|---|---|
| `docs/` | Current architecture, shared practices, and shipped public behavior | Per-task status or implementation history |
| GitHub Issue | One feature or bug: problem, outcome, bounded scope, behavioral contract, acceptance criteria, decisions, and discussion | Phase status or a second copy of shipped documentation |
| `.workspace/workstreams/<id>/` | Execution phases, owners, evidence, deviations, handover, and close-out | An independent feature specification |
| Code and tests | Implemented behavior and executable evidence | Undocumented architectural policy |

An open Issue is authoritative for the scope of that feature. When implementation closes it, any
contract that remains useful after the task must be reflected in `docs/`; the closed Issue remains
decision history, not the current product manual.

## What gets an Issue

Open an Issue for a user-visible feature, integration slice, bug, or a design question expected to
produce implementation. Small repository-only maintenance may skip one when its commit or pull
request is already a complete and reviewable record.

A feature is ready for implementation only when its Issue states:

- the user or agent outcome and the existing baseline;
- exact in-scope and out-of-scope behavior;
- public command/API/permission mappings when an integration is involved;
- profile, authentication, pagination, output, and error contracts that affect callers;
- deterministic test scenarios and observable acceptance criteria;
- dependencies, linked workstream, and official references.

Do not put credentials, authorization headers, private logs, unsanitized payloads, customer data,
or internal identifiers into an Issue or attachment. Treat every Issue as public fixture content.

## Relationship to workstreams

Use Reconciliation Lead when an Issue spans multiple useful phases, declares an inventory, or must
be resumable. Link the Issue and workstream in both directions:

- the Issue owns the feature contract and acceptance checklist;
- the implementation plan orders slices and points to Issue sections instead of copying them;
- the ledger records status and evidence, not another REST or CLI inventory;
- scope changes happen in the Issue first, with their reason recorded; the ledger links the
  resulting deviation.

Partial pull requests and commits reference the Issue without closing it. Use `Closes #N` only for
the change that satisfies the complete acceptance checklist.

## Closure contract

Close an Issue only when:

1. every acceptance item is satisfied or explicitly moved to a linked follow-up Issue;
2. focused tests and the repository-wide verification are green;
3. the shipped command tree and durable documentation agree;
4. the closing commit or pull request and CI evidence are linked;
5. any workstream is marked `complete` with a close-out verdict.

Labels help filtering but are not a source of truth. The default `enhancement`, `bug`, and
`documentation` labels are sufficient until repeated triage proves another category useful.
