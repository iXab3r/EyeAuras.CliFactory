# Pre-commit privacy and generated-file review

Scope: full tracked tree plus all intended untracked v1 files in the YouTrack worktree; no real profile, auth store, or service access. Staged-diff audit is required after staging and before commit.

Initial candidate census: 242 files, approximately 8.97 MB. Reviewed credential/key patterns, literal assignments, userinfo and signed URLs, all URL hosts, personal-path/email candidates, private-address patterns (including escaped literals), binary/generated-file names, and decoded JSON source snapshots. Fourteen immutable snapshots contain 168 distinct source contents; their credential examples are synthetic test inputs. No binary files were present. Public JetBrains/GitHub references, reserved example domains, localhost test servers, synthetic fixtures, package integrity hashes, and source-content hashes are intentional.

One finding in the pre-existing tracked tree was corrected: the historical onboarding ledger contained an organization-specific private-host literal inside a scan command. Replaced that command with a generic truthful statement of the completed scan, preserving historical meaning without retaining the private value. No credentials, service data, source code, or Git history were changed by this audit.

Generated-file classification: dependency/build/coverage outputs remain ignored. The frozen official-reference census, classifications, publication records, and immutable authoring source snapshots are deliberate reproducible evidence, not build noise. Historical issue-body candidates are contract-publication records; preserve referenced hashes.

Current verdict: full candidate tree PASS after the management-only sanitization; staged audit pending. This record is not permission to skip the staged gate for this or later commits.
