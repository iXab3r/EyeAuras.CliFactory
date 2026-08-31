# Block 51–100 — independent scope review

Verdict: PASS for scheduling the fifty operations in `block-100.json`, SHA-256 `1FAEEA1796BCC7EAC05D50372E9465E813859328CE7C5D8C54A2C2B8944EAB46`. This is scope acceptance, not implementation acceptance. Current accepted coverage remains 50/118, derived download 0/1.

An independent comparison against the frozen `classification.json` and the accepted IDs in `scope.toml` confirms:

- Exactly fifty distinct new METHOD PATH IDs: 44 ReadOnly, 6 Update, all existing v1 operations. Category, priority, CLI mapping and official source URL match the inventory exactly.
- No overlap with the fifty accepted operations. The manifest baseline ID set matches the ledger exactly.
- Six groups contain 11/8/9/7/6/9 operations, reaching cumulative planning targets 61/69/78/85/91/100.
- The accepted fifty, proposed fifty and eighteen deferred operations form exactly the 118-operation v1 inventory, with no gap or duplicate. Deferred rows also match the inventory metadata exactly: build/owned/version bundles twelve, article attachments three and article hierarchy three.
- The authoring baseline matches the actual final AR50 snapshot SHA-256 `1387DD12CEF9C7F6A8F94E395D9B4696D798223E53FF346C02558DE0F7334984`.

The direct-membership switches are significant routing choices: group-member and project-team-user commands select distinct ownUsers versus aggregate-users REST operations. Their two underlying resource IDs are counted separately; a flag, alias or helper alone never adds an operation. Each route variant needs exact mocked binding and permission evidence.

The existing Issue 6 remains the public contract. Domain owners must refresh official method, body, parameter and projection rules before affected implementation. Collections expose offset controls only where documented; catalog/type resources must not inherit pagination by guess. User bundles, group aggregation and project teams remain distinct and never imply computed effective access, recursive traversal or a Hub fallback. Sprint transfer, if considered at all, must be explicit and reviewed. Article creation uses summary and project; copied reference prose must not invent a required existing article ID. Optional entity/body limitations and any new public behavior require Issue reconciliation before source.

All writes remain offline boundary tests with Update denied by default and no retries. Reads retain finite default projections, explicit source-shaped fields, encoded opaque IDs and credential-safe output/error behavior across CLI/JSON/RPC. Article attachments, hierarchy and derived download remain outside this block. The orchestrator alone may execute an explicitly reviewed bounded local ReadOnly proof.

Each internal group requires independent technical acceptance before its IDs increment the counter. AR100 remains a separate authoring/simplicity checkpoint; operation 101 is blocked until its PASS and all required corrections close. This review changes no production source and makes no real-service call.

## Article/sprint contract amendment review

PASS for the six existing Update command contracts in `research/block100-contract-amendment.md`, SHA-256 `AEC2A1B375126BA695C6D2595091E37FD9B1B163F6D5F9CF845C193E18E7D122`. The reviewed Issue body SHA-256 is `4433757A320C1D6C30664A60ED493BDD403F89EE0A8357748C5F0A5454399C5E`; the exact amendment text is embedded in it.

The bounded article/project/summary/content and article-comment text schemas are explicit CLI restrictions. Sprint date/null/boolean/goal rules and the single-line name policy are explicit. Create-only previousSprint transfer and isDefault automatic inclusion of newly matching issues are explained as side effects. Sprint issue membership, muting, article visibility/parent edits, drafts and other unsupported fields remain deferred and rejected rather than silently omitted. No endpoint, category, priority, release or counter changes are introduced.

Two review corrections were incorporated before publication: missing required arguments and malformed JSON are checked before onboarding, while semantic body validation is required before fetch; the amendment no longer promises all semantic errors precede onboarding. The isDefault effect and single-line sprint-name limitation are now stated clearly. Official agile/sprint and article-comment methods were independently inspected; domain research retains article and other exact source references.

This PASS clears the independent contract review gate. The orchestrator still owns GitHub publication/exact readback and affected implementation release; this reviewer did not publish or edit source.
