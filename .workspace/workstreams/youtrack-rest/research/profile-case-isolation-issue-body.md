Profile names that differ only by ASCII letter case can identify separate entries in
`profiles.json` while addressing the same profile-owned directory on Windows. A synthetic
review reproduction at commit `10d7fee2cbce13d90bf59a82f9946962ea69218b` created `Fixture` and
`fixture`, observed shared AppData, then showed that deleting one could remove data belonging
to the other. This inherited Core defect affects both TeamCity and YouTrack and violates profile
isolation. No real profile, credential or service data was used in this evidence.

## Outcome and bounded contract

Make ASCII profile names unique ignoring letter case on every supported platform, so a profile
set has one portable identity rule. Preserve the exact spelling of each existing, unambiguous
profile name; do not lowercase stored names, directory names or credential identities.

- Reject creating or configuring a new name whose ASCII case-folded form matches an existing
  name. `Fixture` followed by `fixture` must fail without altering either profile's configuration,
  active selection, permissions, files or secrets. Existing exact-name behavior is unchanged.
- Validate an existing profile document for case collisions when loading it. If it contains two
  names that differ only by ASCII case, fail closed before any profile file or credential mutation,
  including `profile delete`. Do not pick a winner or fall back to a different profile.
- Report an actionable error explaining the collision and the need for explicit manual backup
  and reconfiguration. The CLI must not migrate, normalize, rename, merge or delete existing user
  data or credentials. Do not print configuration values or secrets in this guidance.
- Existing correctly named profiles retain their spelling, values, active selection, permissions,
  profile-owned AppData and secret identity. Exact-name lookup remains exact; this does not add
  case-insensitive aliases or silently resolve a differently cased selector.

The shared Core profile store and normal profile lifecycle enforce this rule for both real
integrations. Keep storage under the existing injected `AppArguments` and secret-store contracts.
No new profile storage format, portable storage mode, credential fallback or migration framework.
Trailing dots, Windows device names and other filename policy changes are out of scope without
separate confirmed evidence. No REST endpoint, permission category, pagination or service-output
contract changes; existing CLI/JSON/RPC error behavior remains in force.

## Deterministic acceptance

- [ ] Offline profile-store create tests reject differently cased duplicate ASCII names on every
      platform and leave the original document, active profile and permissions unchanged.
- [ ] Offline load tests reject pre-existing colliding documents before save/delete/secret mutation;
      a single mixed-case profile still loads and round-trips without normalization.
- [ ] Actual CLI `profile create`, `profile configure` and `profile delete` paths exercise the shared
      rule using isolated temporary AppData and an injected synthetic secret store. Deleting from a
      colliding document fails and preserves both sentinel files and credentials; no real keyring
      or user files are touched.
- [ ] TeamCity and YouTrack consumer regressions prove the shared lifecycle, including a valid
      non-colliding profile. Cases that do not require authentication perform no service request;
      any necessary authentication boundary is mocked.
- [ ] Error output is actionable and contains no profile values, credentials or private service
      data. Durable profile documentation states the portable uniqueness rule and explicit manual
      recovery requirement without promising an automatic migration.
- [ ] Focused affected tests, repository `npm test`, and independent review pass. Before each commit,
      full tracked-tree and staged-diff privacy checks pass. Link the correcting commit and required
      CI evidence before formal closure; this draft does not claim implementation or a fix.

## Context

Discovered during independent post-commit review of
[YouTrack v1 / Issue #6](https://github.com/iXab3r/EyeAuras.CliFactory/issues/6).
Execution and evidence remain in `.workspace/workstreams/youtrack-rest/implementation-plan.md`
and `implementation-ledger.md`, PV2, on branch `feature/youtrack-v1`; these local workstream paths
are not represented as already-published GitHub blobs. Canonical constraints are in
`docs/DESIGN.md`, `docs/practices/github-issues.md`, and the root profile-isolation/AppData laws.
The fix is a correctness prerequisite before the later shared-authoring trials, not a claimed
code-size improvement. All examples here are synthetic. No live writes, push or merge is required.
