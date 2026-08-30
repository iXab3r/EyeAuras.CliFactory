# Final118 scope and download design review

Independent reviewer: inventory_reviewer. Date: 2026-08-30.

## Scope PASS (not implementation acceptance)

Reviewed block-118.json SHA256 9456925EBB763DE1FEEE556722A806E1F6183DF53D627D5C16557C0755363451 against classification.json and the current scope.toml accepted-operation IDs. All 18 rows match the frozen inventory identity, category, priority, CLI mapping and source. They are 17 ReadOnly and one Update, all P1. The 100 baseline IDs exactly equal the accepted ledger; their union with these rows is exactly the 118 v1 operations with no duplicate, missing row, overlap or v2 promotion.

B118.1 contains build/ownedField/version bundle collection, detail, value collection and value detail (12 ReadOnly). B118.2 contains article attachment collection/detail/upload and child collection/detail/parent (five ReadOnly, one Update). Repeated articleID source placeholders remain unchanged in inventory while CLI arguments distinguish parent and child.

Derived issue attachment download remains one separate ReadOnly/P1 capability with endpoint-counter increment zero. Its implementation, tests, setup and proof costs must be included in final AR118. Endpoint acceptance and derived acceptance do not alone establish full auth/release/issue closure readiness.

## Download security design review

Official sources read directly:

- https://www.jetbrains.com/help/youtrack/devportal/api-usecase-download-issue-attachment.html (page dated 18 August 2026): obtain a returned attachment URL and perform a separate binary GET; query-signature URL form; binary Authorization is unnecessary.
- https://www.jetbrains.com/help/youtrack/devportal/operations-api-issues-issueID-attachments.html (page dated 23 May 2025): exact attachment metadata GET and a path-signature example. The example file ID differs from the attachment ID; equality of those two IDs must not be invented.
- https://www.jetbrains.com/help/youtrack/devportal/api-entity-IssueAttachment.html: URL and MIME type may be null. Null URL must fail actionably without a binary request.

Design direction is consistent with Issue6: fixed authenticated metadata route/projection and matching requested attachment ID; only the returned same-origin HTTPS URL under the configured YouTrack context and documented api/files path; both documented query-signature and path-signature forms. Validate path escapes before URL normalization, reject arbitrary same-origin API paths, userinfo, fragments, foreign origins and redirects. Do not decode or rewrite the opaque signature; official query examples contain percent-encoded line breaks. Binary fetch must carry neither bearer Authorization nor cookies, use no retries and never return or persist the URL.

Output remains sanitized ID/name/local path/byte count/content type. The narrow internal raw-metadata exception must not leak into public metadata output or package exports; reject active bearer reflection and scrub signature reflection in returned metadata. Names are basenames, with safe default ID prefix, Windows reserved/traversal/root/ADS protections and exclusive no-clobber publication beneath profile AppArguments.AppDataDirectory/downloads. Enforce the stated byte cap on the stream, not only Content-Length; cleanup profile-owned partial files after all failures/aborts.

Root-approved planned filesystem strategy uses a private temporary directory/file, checks existing ancestors for symlink/junction substitutions and rechecks directory identity, then publishes through an exclusive hard link. Filesystems without this capability fail closed. Portable Node path APIs cannot fully defeat a malicious concurrent process running as the same OS user; document this limitation rather than claiming race-proof ancestor confinement. No fallback that overwrites an existing destination is acceptable.

Actual implementation, offline request/filesystem tests, review of sanitization/abort/cleanup behavior and coherent repository test execution remain pending. No reviewer real-service calls, credential-store access or production edits were performed.

## V2 follow-up draft review PASS

Independently parsed the actual Markdown inventory in v2-issue-body.md, SHA256 7910D9371A9631B6247E32FAF6E02B29742A90818085218624106662DD46310E. Its 163 unique IDs exactly equal classification.json v2: 140 P2 / 23 P3 and 41 ReadOnly / 122 Update. Every priority, category and official source matches; no missing, duplicate, promoted or foreign row. Read the public policy, supplemental candidates, excluded boundaries, source discrepancies and closure contract. It does not claim v1 delivery or transfer unresolved v1 auth defects. Four supplemental candidates remain outside the census, historical Reports routes require current support verification, and the five dynamic app scopes remain excluded. Root owns privacy review, publication and exact remote readback; this reviewer did not publish.

## Final ReadOnly proof scope

Approved the proof author's proposed fixed 24-row inventory: the already accepted 21 rows plus build, owned (ownedField route) and version bundle collections, each top3/skip0/fields=id. No nested discovery, arbitrary arguments, article descendants or binary download. Existing CI refusals, token-environment stripping, fixed argv, timeout/output bounds and count-only failure behavior must remain unchanged. Actual frozen proof source/tests review is pending; root alone may run the real proof afterward.

## Final public amendment wording PASS

Read the final frozen candidate issue-body-final118-candidate.md SHA256 A3E0AB6DB72680EC45B8744C5470B35BADFDBB90B1853753FFA08C7DE9309030 and embedded research/final118-contract-amendment.md SHA256 979194E0A353C748B1F1C52AC09C5302DD10BEA5CD9557F20CED11DA072320A5. Removing the exact amendment and its two separator newlines restores the prior body content (SHA256 4433757A320C1D6C30664A60ED493BDD403F89EE0A8357748C5F0A5454399C5E). Article parent-null handling, existing upload/fields exception, documented signed forms, opaque encoded signatures and exclusive publication/threat-model wording are sound. Real signatures/private data are forbidden in fixtures while synthetic test values remain explicitly allowed. Independent core_auth_review also returned Core-section wording PASS; implementation review remains separate. Root owns publication and remote readback.
