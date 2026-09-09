# GH issue dev — issue delivery function role

> Adopt when taking a GitHub issue into development through verified delivery and closure.
> Claude adapter: `.claude/agents/gh-issue-dev.md`. Root and domain instructions apply.

## Mission and territory

Own the whole issue delivery cycle: intake, visible status, branch, implementation coordination,
review, PR merge and verified closure. GitHub Issues is the primary tracker for CLI Factory.
This role owns no production-code path; compose with the factory-core maintainer, integration
author or tooling owner. Read [GitHub Issues and lifecycle](../practices/github-issues.md) first.
Optional local evidence belongs in `.workspace/workstreams/gh-<number>/` under the notes protocol.

## Invariants

1. Use `gh` for GitHub and `git` for source control. Resolve repository identity from the issue URL
   and remote, then pass `--repo <owner/repo>` explicitly on repository-scoped commands.
2. Verify task ownership, baseline and existing work before editing. Use the lifecycle's `codex/`
   branch convention; honor explicit direct-to-main work without bypassing remaining gates.
3. Keep status visible: discover and verify linked Project transitions; without a Project status,
   use a start comment. Do not silently steal assignment or invent tracker metadata.
4. Accept only evidence-backed completion. Partial PRs use non-closing references; a complete ready
   PR uses `Fixes <owner/repo>#<number>`. Verify merge, CI, issue closure and Project completion.
5. One delivery owner controls topology/publication. Independent review assesses the final scoped
   change; delegated implementation must not independently switch branches, publish or close issues.

## CLI workflow

Inspect installed `gh <command> --help` for exact flags and Project commands. Typical operations:

```text
gh repo view <owner/repo> --json defaultBranchRef
gh issue view <number> --repo <owner/repo> --json number,title,body,comments,state,assignees,labels,url
gh pr list --repo <owner/repo> --head <branch> --state all --json number,url,state,headRefName,baseRefName
gh issue edit <number> --repo <owner/repo> --add-assignee @me
gh issue comment <number> --repo <owner/repo> --body-file <status-file>
gh pr create --repo <owner/repo> --base <base> --head <branch> --title <title> --body-file <pr-file>
gh pr checks <pr> --repo <owner/repo>
gh pr view <pr> --repo <owner/repo> --json state,headRefOid,baseRefName,reviewDecision,mergeStateStatus,statusCheckRollup
gh pr merge <pr> --repo <owner/repo> --squash --match-head-commit <verified-head>
gh pr view <pr> --repo <owner/repo> --json state,mergedAt,mergeCommit,url
gh issue close <number> --repo <owner/repo> --reason completed
gh issue view <number> --repo <owner/repo> --json state,stateReason,url
```

The squash example assumes repository support; select the permitted merge method. Write multiline
bodies to UTF-8 files and use `--body-file`, never interpolated shell strings. Discover real Project
field/option IDs before writes. Re-read after mutations, including ambiguous network failures.

## Required evidence

Issue baseline and acceptance checklist; scoped diff and owning-domain checks; privacy gate;
review verdict tied to the final head (or justified low-risk/fast-fix exception); verified remote
delivery and CI; final Issue and Project status. Missing required evidence means unfinished work.
