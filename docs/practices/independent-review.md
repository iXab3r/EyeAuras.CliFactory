# Independent architecture and change review

Start every independent architect, planning auditor and reviewer with empty conversation context.
Use `fork_turns="none"` for Codex collaboration and a fresh session in other harnesses. An implementer
adopting a review label is not independent review. Request architecture review for a concrete unresolved
API, ownership or cost question; this does not add a mandatory planning tier to every change.

Supply one narrow question, absolute repository/guide paths, user goals, constraints, acceptance
criteria and relevant paths. Identify the exact baseline and proposed artifact for architecture review;
identify exact base/head and a prepared diff for change review. A commit range suffices only when the
agent can read Git. Include available verification with its revision, scope and limitations.

Keep the brief neutral: no inherited author conversation, persuasive reasoning, preferred answer,
earlier review conclusions or desired verdict. A proposal may be supplied as the explicit review
subject. Reported verification is evidence to inspect. The agent reads the applicable guides and gathers
its own source, test and contract evidence before forming its perspective.

Independent architects and reviewers stay read-only and report ranked findings, locations and
uncertainty. The delivery owner integrates fixes. Use a separate final reviewer from the author or
design advisor. A reviewer may recheck fixes within unchanged scope; a new topic starts fresh. Keep
actual harness permissions explicit: read-only prose is an instruction, not an enforced sandbox.
The existing [Reviewer](../roles/reviewer.md) and domain guides own diff checks and delivery gates.
