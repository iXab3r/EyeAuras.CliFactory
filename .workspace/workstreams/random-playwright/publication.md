# Publication and main reconciliation

Owner authorized commit, push, merge into the default branch, and merge-back to the working branch.
Role: Reconciliation Lead + Core/integration maintainer. No history rewriting or force push.

| Phase | State | Evidence |
|---|---|---|
| Feature privacy gate and commit | Ready to commit | Full feature suite 171/171; full tracked-tree and staged-diff privacy review passed |
| Push codex/random-rest-cli | Pending | Verify remote commit identity |
| Reconcile with main | Pending | Main includes TeamCity v2 and YouTrack; preserve their contracts and tests |
| Publish main and merge it back | Pending | Full merged suite, privacy gate, branch ancestry and remote identity |

Initial main: adbc566. Feature base: 40c265b. Other worktrees are explicitly out of scope;
the primary checkout has unrelated uncommitted documentation. All integration work takes place
in EyeAuras.CliFactory-2. Earlier local-only evidence remains a dated baseline, not publication status.

Pre-commit inventory: 175 tracked paths, 119 staged changes. Credential/key, email, URL/userinfo,
private-address and personal-path checks covered the tree and staged diff; candidate locations
were reviewed as synthetic test URL interpolation, an explicit unsafe-URL fixture, documentation
protocol text and a Node engine version. No real credentials, personal captures or internal service
data were found. Staged generated protobuf declarations had upstream whitespace noise; the normal
build now strips only trailing whitespace/extra EOF blank lines reproducibly. Staged diff check passes.
