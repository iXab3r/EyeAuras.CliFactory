# Workstreams

> **Status: practice** (binding).

Use a workstream only when a task must close a declared universe: a migration, parity/reconstruction
campaign, public-contract replacement, broad audit, security review, performance campaign, or systematic
deprecation removal. A localized fix or ordinary handoff does not need one.

## Location and authority

All coordination artifacts (scratch plans, ledgers, handovers, and lightweight evidence) stay local and
Git-ignored under `.workspace/workstreams/<id>/`. Do not commit/push them, put them beside this directory,
or treat them as authority over code, specs, practices, or role guides.

Before the first note write, fix the **absolute project/worktree root of the current task** and verify
it with `git -C <project-root> rev-parse --show-toplevel`. Derive every note path from this root, even
when commands run from `src/` or a submodule. Do not choose the Git common directory, the first worktree
in a listing, a similar sibling folder, or a path copied from an old handover. Resolve junction/symlink
ancestors before writing; if the destination escapes this root or resolves into another checkout, stop
the write and report the mismatch. An explicitly declared worktree handoff establishes a new task root.

## Manual transfer

The user copies selected files or the current workstream directory into
`.workspace/workstreams/<id>/` of the receiving worktree. Use this same directory for transfer; do not
create a separate handover directory, automatically copy to a neighbor, or publish notes through Git.
A receiving agent binds future notes to its own verified task root. Source checkout paths are context,
never a destination instruction, and transferring notes does not transfer uncommitted source changes.

An optional `handover.md` contains only what resumption needs: issue/goal, source branch and commit,
changed files/current state, completed checks and limitations, blockers, and next actions. No handover
or ledger is mandatory for every small task or pause. Record durable decisions and final verification
results in the appropriate docs, issue, or PR so a clean clone does not depend on local notes.

Runtime credentials, browser auth state, and explicitly requested sensitive videos belong only in
current-user profile AppData under DESIGN.md, never in notes or fixtures. Large generated evidence
stays outside tracked source; record only sanitized conclusions and artifact identity in local notes.

## Relationship to GitHub Issues

GitHub Issues own the bounded outcome, behavior and acceptance criteria. Local notes order the work
and record census details; they are not a second feature specification. Record the workstream ID in
the Issue when useful, never a link that assumes access to ignored files. Publish sanitized acceptance
evidence, review verdicts and final delivery in the Issue/PR so a clean clone can understand delivery.
Scope changes go into the Issue first. Follow [GitHub Issues](github-issues.md).

## Minimum contract

A new reconciliation workstream starts with `scope.toml` containing:

- stable ID and title;
- explicit status;
- source/reference and target roots/versions;
- discovery/census command and stable identity rule;
- artifact names and completion rule.

Add only the artifacts the work needs:

| Artifact | Purpose |
|---|---|
| `inventory.tsv` | mechanically reproducible source universe |
| `ledger.md` / `ledger.tsv` | human classification, owner, state, decision, evidence |
| `phases.md` | ordered gates for a multi-phase implementation |
| `evidence.md` | commands, measurements, captures, review outcomes |
| `handover.md` | optional current resume point when another agent actually needs one |

`handover.md` is not mandatory for every task. Chat history is also not a substitute for a ledger entry
when a finding belongs to a declared census.

Use a clear lifecycle. `active`, `blocked`, `complete`, and `archived` are the preferred top-level
categories; a workstream may use a more specific status if its `scope.toml` defines the meaning. A record
without an explicit active scope is historical by default.

## Workflow

1. Freeze scope and stable identity before edits.
2. Generate the raw census and record its count.
3. Classify with the owning domain roles; do not make unknown items look closed.
4. Implement coherent phases and record evidence at meaningful checkpoints.
5. On pause, update the current status/ledger and add a handover only if resumption requires it.
6. On completion, rerun the census, classify every remainder, and set the final status.
7. Graduate only durable contracts, specs, practices, and decisions into `docs/`.

A new finding is either an existing inventory item newly understood or a documented census defect that
requires regenerating the inventory. It must not exist only in chat.

## Retention and cleanup

Delete obsolete local records when they no longer help the task. Do not retain or republish the old
workstream archive, move temporary plans into `docs/`, or rely on Git history for new notes. Before
cleanup, preserve only necessary durable guidance in its owning document and remove consumers of the
notes. Delete exact verified note paths only: `.workspace/` can also contain real Git worktrees and
must never be recursively removed as a notes directory.

## Integration phases and authoring reviews

Order phases by user/agent value: profile/auth proof, bounded ReadOnly operations, then explicitly
gated mutations. Freeze method/path identities for API inventories; route coverage does not prove
every payload variant or live mutation. Apply the [authoring-review cadence](integration-authoring-reviews.md)
before the next batch. Keep reproducible counts separate from human acceptance and publish the
checkpoint verdict and necessary evidence in the Issue/PR, not only in ignored notes.
