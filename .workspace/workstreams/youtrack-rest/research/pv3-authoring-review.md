# PV3 independent authoring and simplicity review

Verdict: **PASS — retain as simpler, safer authoring, not as a net source-size reduction.** Reviewer: inventory_reviewer. Baseline is the accepted PV2 commit `3df5066f8d3cc1038570bf6005db32aa4ff47655`; PV2 correctness costs are excluded from this trial's delta. Existing 118 REST operations and separate download are unchanged.

## Reproducible evidence

- pv3-authoring-baseline.json SHA256 `3CE3705D1387DB6ADEB928A219607CF5E6822BD31AE252453202570C5CADF8D7`: 104 committed TypeScript files, raw Git blob hashes and IDs, whole costs and seven exact sample spans. A second independent git-show pass confirmed all 104 saved hashes and metrics.
- pv3-authoring-final.json SHA256 `99B84464FEEAF8D6CBFF47C9C41796464BC6968E0671BC99E39C6B1549170FB7`: 106 frozen working-tree files, raw hashes, LF-normalized metrics, per-file comparisons, samples, manifest and design evidence. No source text is duplicated in either artifact.
- All 17 changed integration source files are exactly their committed contents with `String(args.<name>)` replaced by `args.<name>`. No other source behavior, line layout, validator, permission, option, request, body or result changed. No baseline path disappeared. The two new paths are Core command-input.ts and its test file.

## Whole cost, including every type helper

| Surface | Before production | After production | Delta | Before tests/support | After tests/support |
|---|---:|---:|---:|---:|---:|
| Core |1779|1830|+51|1435|1640|
| TeamCity |1100|1100|0|1556|1556|
| YouTrack |4025|4025|0|5876|5876|
| Total |6904|6955|+51|8867|9072|

Both local proofs are unchanged: 330 TeamCity + 183 YouTrack = 513 nonblank lines. Tests/support grow 205 Core lines; existing test/proof files remain exactly unchanged after LF normalization. DESIGN adds 12 nonblank lines, reported outside production. Dependencies and package manifests are unchanged.

Primary measurement is nonblank handwritten TypeScript, comments included, with generated output excluded. Normal formatting is preserved. The new type helper has 48 nonblank lines; the existing overload/storage file adds 3. The initially compact conditional branches were expanded for readability, and their quote/template-aware token sequence was independently confirmed unchanged. Final counts include that formatting; the smaller preliminary 34-line delta is not the final result.

The 129 conversion wrappers disappear: 118 YouTrack and 11 TeamCity. Their syntax accounts for 1032 removed ASCII characters, but whole production LF-normalized characters grow from 241021 to 242129: **net +1108**, comprising Core +2140 and consumers -1032. LF-normalized UTF-8 production bytes grow 241033 to 242141. Character units are UTF-16 code units; raw byte hashes remain separate, so CRLF checkout differences do not create savings. Do not describe the 1032 wrapper characters as a net source reduction.

## Fixed same-capability comparison

| Sample | Before declaration + client lines | After | Declaration character delta | Client change |
|---|---:|---:|---:|---|
| YT issues list, unchanged control |12+9=21|21|0|None|
| YT issue detail |7+9=16|16|-8|None|
| YT issue update |7+14=21|21|-8|None|
| YT issue create, unchanged control |7+12=19|19|0|None|
| TC project list, unchanged control |20+18=38|38|0|None|
| TC project detail |6+7=13|13|-8|None|
| TC job run |19+17=36|36|-8|None|

Exact committed/current spans, hashes and character counts are in the JSON artifacts. Full shared setup, validators, client methods and Core machinery remain counted in whole costs. Collections and creates without positional inputs are honest unchanged controls. Numeric TeamCity validation and service-specific YouTrack ID validation remain intact; type inference does not replace those rules.

## Why the tradeoff is worthwhile

Both real products now use the existing declaration once: a supported required positional name is available as a string directly in its callback. Authors no longer add coercions to 129 sites or accidentally turn a misspelled property into the string undefined. Independent compiler evidence shows ordinary actionable errors (TS2339 for an undeclared property and TS2322 for a wrong value type), rather than requiring a new authoring schema or annotations.

The implementation adds eight private lexical/argument/command type aliases and one internal inferred-handler alias. It handles only finite ASCII names and required tokens separated by single spaces; all unsupported declarations fall back as a whole. Optional/variadic runtime syntax, dynamic/templates/unions, duplicate names and other whitespace are deliberately not expanded into a general type-level Commander parser. That narrow boundary is documented and tested.

The existing command() leaf overload gains inference. Existing unparameterized CommandInput and CommandHandler annotations, branch composition and readonly command arrays remain usable; options stay unknown. The package barrel and public runtime surfaces add no new exported concept. One localized stored-handler assertion documents erasure at the existing broad CommandDefinition boundary. There is no any-based or bivariant workaround, assertion scaffolding in consumers, new runtime callback wrapper, extra service call layer, dependency or service schema. Mutation/manual invocation of the broad stored definition is explicitly outside the literal callback guarantee.

This is a better fit than the rejected connection binder or shared HTTP/body proposals: it removes repeated work in both current integrations without adding setup or concealing service behavior. A binder would add another call layer to already short handlers; service HTTP/body contracts differ and remain local. No hypothetical second consumer is used as justification here.

The Core type grammar does cost maintenance and more total source. Its bounded, private implementation and explicit fallback keep that cost proportionate to 129 real consumer sites and clearer compile-time feedback. Retain this improvement; do not broaden inference, add a DSL or claim production-line savings merely to improve a metric.

## Verification and scope of this verdict

Independent technical reviewer review_common_types returned PASS after four new compiled runtime tests and temporary compiler probes covering 24 conservative fallback cases, required/multiple/no-argument forms, existing annotations and command-array composition. Negative diagnostics were inspected directly. That reviewer retained PASS after the formatting-only change. Root separately ran the final post-format npm test build-and-test suite: 418/418 PASS (Core 44, TeamCity 41, YouTrack 333). The baseline had 414 tests; four are new. Root also reports the existing bounded 24 ReadOnly proof passed; no real-service run was needed to establish this type-only authoring benefit.

This reviewer independently read source/design/tests, verified exact consumer transformations, all final metrics and sample comparisons, and checked type-format token equivalence. This reviewer did not run builds, access profiles/keyring, make live calls, edit production, publish GitHub content or commit. Technical correctness, release/commit/privacy gates and any issue closure remain separately owned; this authoring PASS has no remaining required correction.
