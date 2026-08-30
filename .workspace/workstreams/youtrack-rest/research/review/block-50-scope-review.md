# Block to 50 — independent scope review

Verdict: PASS for scheduling the next 42 existing operations; not implementation acceptance. Current accepted count remains 8/118 and derived download 0/1.

Reviewed manifest: `block-50.json`, SHA-256 `C2DA09A097C69284D6540CFC54B89C4002D2E5A2B546A56CDB1A58F18C8D7B24`.

Independent comparison against `classification.json` and the accepted IDs in `scope.toml` confirms:

- Exactly 42 distinct census METHOD PATH IDs: 32 ReadOnly and 10 Update; all P0/P1 and v1.
- Every category, priority, CLI mapping and official source URL matches the frozen inventory; no missing census ID, duplicate, P2/P3 addition or overlap with the eight accepted operations.
- Six groups contain 6/7/12/7/7/3 operations and reach cumulative targets 14/21/33/40/47/50.
- The baseline accepted ID set exactly matches the current ledger contract. The authoring baseline artifact matches SHA-256 `9E38686726651B97964A689E130CFE2D90F5FBBAE9E29D1A5D38C5A9D32269CE`.
- Signed attachment download remains a separately tracked, deferred capability and does not inflate endpoint acceptance.

The manifest retains the Issue 6 scope boundary. Each family must pin its official request, response projection and supported parameters before implementation. Material body/type restrictions or public contract changes require Issue reconciliation before the affected source. Scheduling PASS does not waive these gates.

Specific review obligations remain: ReadOnly POST assist/count versus gated command application; polymorphic custom-field and state-machine semantics; directional links and distinct source/target issue arguments; relationship removal rather than resource deletion; cursor pages without invented offset/page-size parameters; documented work-time filters and nullable/omitted values; multipart upload with explicit local-file preflight and credential-safe metadata. All remote mutations remain offline tests, with bounded real ReadOnly proof owned by the orchestrator.

Technical acceptance increments only after exposed command bindings and meaningful boundary tests are independently reviewed. AR50 is a separate same-capability authoring/simplicity review, including total Core/integration cost and separate test/proof cost. No operation 51 is released until AR50 PASS and required corrections close.

## Orchestrator release clarification

The later manifest SHA-256 `2F9231B20113ECD26BCB78E04088B69D4EFCDF774116FDB2CFF3691F3B84920C` assigns six source owners and releases implementation after each official contract check. The operation IDs are unchanged. For attachment input, only required argument presence and pure syntax checks precede onboarding: actual stat/open/read must occur inside the Update-gated handler. This ordering overrides any earlier ambiguous local-file-preflight wording. Cursor input remains categories/cursor/reverse/fields only; optional global work-item query is documented; accepted typed references and duration forms must not gain an invented exclusive-one restriction.
