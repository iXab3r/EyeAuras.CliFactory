# Story-driven delivery

> **Status: practice** (binding when a repository adopts the
> [Story Delivery Lead](../roles/story-delivery-lead.md) role).

This practice takes a service CLI from an empty repository to delivered user stories. It names no
service: any product built on CLI Factory can adopt it. The work moves through layers. Each layer has
an exit gate, and production code starts only after the planning layers are complete.

| Layer | Output | Exit gate |
|---|---|---|
| 1. API inventory | One root issue per API group, one sub-issue per operation | Generated from a pinned official source; counts recorded |
| 2. User stories | 20–25 story issues, simplest and most common first | Owner approved the list and order |
| 3. Dependencies | Each story is *blocked by* the operations it needs | Every story has links; unknown needs are stated |
| 4. Milestones | Milestones delivering one or more stories each | Owner approved the plan |
| 5. Execution | Red story tests, then implementation, per milestone | Story tests green at the milestone head |
| 6. Review loop | Review rounds, bug issues, fixes | Fresh reviewers report PASS or PASS-WITH-NITS with no accepted findings; every milestone issue closed |

Layers 5 and 6 repeat for each milestone. Layers 1–4 may be extended later (new stories, a newer
service version); an extension passes the same gates before its code starts.

## Tracker shape

Use GitHub Issues with sub-issues, *blocked by* relationships and milestones. A GitHub Project may
add board views and a status field; it does not replace issue state. The lead creates these labels once,
at planning setup and with owner approval, so ordinary issue work never creates labels:

| Label | Meaning |
|---|---|
| `type:api` | One service operation in the inventory |
| `type:api-group` | Root tracker issue of one API group |
| `type:story` | A user story |
| `type:review` | A milestone review round record |
| `api:<group>` | The API group of an operation |

Defects found during a milestone use the default `bug` label plus the milestone. Add service-specific
labels (for example, version availability) only when they help filtering.

## 1. API inventory

Bound the API before planning against it. In this practice the inventory lives in GitHub as a progress
tracker. [Reconciliation Lead](../roles/reconciliation-lead.md) remains the role for census-style
closure or audits of an inventory, with its local ledger. API expansion here still honors the
authoring-review checkpoint of root law 13 (normally every 50 new operations) across milestones. The inventory answers "how much of the service does the
product cover", not "what do we build next".

- **Source.** Prefer the service's official machine-readable specification (OpenAPI or equivalent) at
  a pinned revision; otherwise its official reference documentation at a pinned version. Record the
  source URL, revision and supported service versions in the generator and in every root issue.
- **Generation.** A script in the product repository reads the source and produces the inventory.
  Do not copy operations by hand. Re-running it on the same revision must produce the same set.
  Corrections happen by changing the generator or the pinned revision and regenerating.
- **Identity.** One inventory item is one logical operation as the source defines it (for example,
  an operation group covering several paths and methods), not one URL.
- **Root issues.** One per API group: source and revision, operation count, and the sub-issue list.
  Root issues stay open while any of their operations is open.
- **Operation issues.** Verbatim facts only: operation identity, methods and paths, version
  availability and deprecation, link to the official documentation. No design, no priority.
- **Closure.** An operation closes when a delivered story uses it with tested behavior, or when the
  owner records an explicit *won't do* decision with a reason. Unlinked operations simply stay open:
  the open count is the remaining coverage.

## 2. User stories

A story is the unit of delivery. Write 20–25 to start; full API coverage is not the goal of the
first list, and the list grows later.

- **Order.** Start with the most common and simplest (configuring a profile and signing in), then
  move to rarer and more complex ones. Later stories may be multi-step workflows.
- **Content.** Actor and goal; the CLI scenario as concrete command lines; acceptance scenarios in
  *Given / When / Then* form, including empty results, errors, partial results and permission
  denial where relevant; permission category of each command; explicit out-of-scope items.
- **Independence from implementation.** A story states observable behavior: commands, output fields,
  exit codes, error codes. It does not prescribe internal structure.
- **Approval.** The owner approves the list and its order before layer 3 starts.

## 3. Story-to-API dependencies

For every story, find the operations its scenarios need and link each as *blocked by*. When a needed
operation is not in the inventory, record that in the story and fix the inventory source or generator.
A story with unresolved needs is not ready for a milestone.

## 4. Milestones

Group stories into milestones. Each milestone is a shippable product increment:

- one or more stories, delivered together, with their linked operations;
- earlier milestones carry simpler, more common stories, so foundations (profiles, authentication,
  error handling) are proven first;
- a milestone description stating the outcome, the stories, and the exit gate below.

The owner approves the milestone plan. Until then the repository contains no production code for
the stories. Infrastructure (build, packaging, CI, test harness) may precede it.

## 5. Execution: test first

Each milestone follows test-driven development against mocks of the network boundary, as described
in [testing](../testing.md) (MSW at the native `fetch` boundary):

1. **Fixtures.** Prepare minimal, sanitized response fixtures for every operation the milestone
   needs. Follow the repository's fixture practice and [testing](../testing.md).
2. **Red.** Encode every acceptance scenario of every milestone story as an end-to-end test that
   runs the real command tree (for example through the shared CLI fixture) against the mocks.
   Commit these tests first, on the story's own branch. Record the failing run, test count and head
   in the story issue. Red tests never reach the default branch: a story's PR merges only when its
   tests are green, and tests are never merged skipped or marked as expected failures. Each PR
   therefore passes the normal required checks and `npm test`.
3. **Green.** Implement until the story tests pass. Add focused tests at the client boundary where
   an operation has behavior the story tests do not pin down (pagination, error mapping).
4. **Story closure.** A story closes when all its scenarios pass at the milestone's final head and
   its delivered command text follows [CLI writer](../roles/cli-writer.md). Linked operations close
   with it when the delivered behavior covers them.

Each implementation PR follows [GH issue dev](../roles/gh-issue-dev.md) and the
[issue lifecycle](github-issues.md). Partial PRs do not close stories.

## 6. Milestone review loop

When all stories of a milestone are green:

1. Open a `type:review` issue for the round with base (milestone start) and head.
2. Run one or more independent [Reviewers](../roles/reviewer.md) in fresh contexts under
   [independent review](independent-review.md), with the milestone's stories and acceptance as the
   contract and the full milestone diff as the subject.
3. File every BLOCKER, MAJOR and accepted MINOR finding as a `bug` issue in the same milestone,
   linked to the review round. Fix each with a regression test first.
   The lead decides which MINOR findings are accepted and records the decision on the review issue;
   the owner can overrule. This deliberately replaces the usual follow-up suggestions: an accepted
   finding is fixed in the milestone instead of being deferred.
4. Start a new round on the new head with fresh reviewers. Repeat until every reviewer reports PASS
   or PASS-WITH-NITS with no accepted findings.
5. Close the milestone only when every issue in it is closed. Nothing moves to the next milestone
   without explicit owner agreement recorded in the affected issue.

## What the owner decides

- The story list and its order, and the milestone plan.
- Any story scope reduction and any *won't do* decision on an operation.
- Releases, publication and any use of a real service. Approval of a plan does not include them.

## Adopting the practice

A consuming repository references this practice and the role from its `AGENTS.md` at the CLI Factory
version it depends on, and adds only its service specifics: the inventory source and generator, the
fixture rules and the supported service versions.
