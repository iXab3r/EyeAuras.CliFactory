# Agent roles

Roles are small sets of applicable instructions, not personas or additional checklists. The root
[router](../../AGENTS.md) selects them. Reading and adopting a domain role does not require spawning
an agent; independent review does require a separate context.

## Domain and function roles

Domain roles define correct behavior for their files. Function roles define how a task is delivered;
they compose with the domains they touch and never replace those domains' invariants.

| Role | Trigger / canonical guide |
|---|---|
| Factory-core maintainer | Shared CLI mechanisms: [Core guide](../../packages/core/AGENTS.md) |
| Service integration author | Service-shaped commands and clients: [integration guide](../../integrations/AGENTS.md) plus any deeper router |
| Repository tooling/docs owner | Tooling, CI and documentation: [root router](../../AGENTS.md), the relevant design/practice and [testing](../testing.md) when applicable |
| GH issue dev | Issue intake through verified delivery: [role](gh-issue-dev.md), [lifecycle](../practices/github-issues.md) |
| Reviewer | Independent read-only audit of a completed diff: [role](reviewer.md) |
| Reconciliation Lead | Migration, expansion or audit of a declared inventory: [role](reconciliation-lead.md), [workstreams](../practices/workstreams.md) |

Select checks for the actual risk under the [verification policy](../practices/github-issues.md#verification-and-setup-limits)
and preserve mandatory repository/domain gates. Several roles do not imply several copies of a test run.
One delivery owner controls branch changes and publication. Delegated writers need disjoint agreed
scopes; reviewers remain read-only. A small fix needs no workstream.

## Canonical guides and adapters

Keep a guide focused: trigger, mission/territory, load-bearing invariants, evidence by risk and hand-off.
Domain guidance may stay in its existing subtree `AGENTS.md`; do not create a duplicate role document.
Shared lifecycle rules belong in the practice, not in every role.

The existing `.claude/agents/` adapters point to canonical guides and carry only discovery metadata,
role/guide selection and harness controls (such as read-only tools). Adapters do not duplicate policy
or install tool prerequisites. Other harnesses follow the same router and guides; personal configuration
changes are outside ordinary repository work.
