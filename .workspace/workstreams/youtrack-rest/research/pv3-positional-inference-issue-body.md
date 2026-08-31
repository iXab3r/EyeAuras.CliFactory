Existing `command()` declarations already name their positional arguments, but callbacks receive
`args: Record<string, unknown>`. Both current products repeat string coercions to recover information
that the existing parser knows. Infer those callback types from the same declaration so authors can
pass required IDs directly and the compiler catches misspelled positional names.

**Reviewed baseline:** commit `3df5066f8d3cc1038570bf6005db32aa4ff47655`, tree
`0493db1b9b75be8ace7d6b76d9a3cf76494bbd40`. All four PV2 correctness findings are independently
closed; the final offline suite passed 414/414. Full costs are 6,904 production lines
(Core 1,779 / TeamCity 1,100 / YouTrack 4,025), 8,867 test/support lines and 513 proof lines.
These correctness costs belong to the baseline, not this trial. Discovery identified 129
`String(args.<name>)` expressions (118 YouTrack / 11 TeamCity); confirm the candidate sites against
this reviewed commit before conversion. The motivation is simpler authoring and stronger types,
not a promise of fewer physical source lines. Independent proposal review approved the bounded
trial and conservative fallbacks; implementation and acceptance remain pending.

## Bounded behavior

- Extend inference at the existing literal leaf `command()` declaration. Do not require a second
  argument schema, builder or runtime wrapper. A declared required `<id>` gives the inline callback
  `args.id: string`; multiple declared required arguments work, and undeclared names are type errors.
- Keep branch/leaf composition, existing command names, parsing, help, output, permissions and
  service validation unchanged. Options remain `Record<string, unknown>`; options inference is
  out of scope. A numeric ID still goes through its existing domain validator.
- Required positional IDs used by both products are the minimum useful supported grammar.
  Optional/variadic forms may be included only if the implementation stays small and proves the
  existing runtime contract: `[id]` is a present property with `string | undefined`, `<ids...>` is
  `string[]`, and `[ids...]` is `string[]` with omission producing `[]`. Otherwise the entire such
  declaration falls back to `Record<string, unknown>` and the limit is documented.
- Broad/dynamic strings, unsupported syntax, duplicate argument names and ambiguous declarations
  retain the broad unknown-record type. Never partially trust a declaration the type grammar cannot
  fully understand. Dynamic template types such as `get <${number}>` and `get <${string}>` must not
  infer a trusted numeric-key map or `Record<string, string>`; checking only `string extends Name`
  is insufficient. Literal-name unions also fall back rather than introducing a complex union parser.
  Duplicate names invalidate inference for the whole declaration because runtime mapping uses the
  last value, which may be optional. Support whitespace only where equivalent to the current
  `trim().split(/\s+/)` behavior is proven; otherwise use the same conservative fallback.
- Existing unparameterized `CommandInput` and `CommandHandler` annotations remain usable with their
  broad behavior, and inferred declarations compose in `readonly CommandDefinition[]`. Preserve
  these contracts in the same existing API; do not add a parallel legacy path or compatibility shim.
- Convert the actual eligible YouTrack and TeamCity consumers, including the 129 discovery coercion
  sites after recount. Remove only redundant positional string conversions; preserve numeric/domain
  validation. Account explicitly for any site that remains broad rather than adding assertions to
  reach a target number. No-positional collection/create examples are unchanged controls.

No runtime API, dependency, DSL, generic HTTP/CRUD layer, context binder or service schema is added.
Do not use `any`, bivariant callback tricks or repeated consumer assertions. If a localized erasure
at the existing stored command-definition boundary is necessary, justify it against the unchanged
parser and test it. Inference applies to the literal declaration callback and factory-parsed
invocation; the stored mutable `CommandDefinition` stays broad. Manually changing its `name`/`run`
or directly invoking an erased `run` is not an end-to-end static type guarantee. Document this
existing low-level boundary without adding a runtime wrapper or promising stronger guarantees.
Reject the trial if it needs a substantial type parser, many exported concepts, repeated annotations
or diagnostics harder to understand than the original direct code.

## Evidence and acceptance

- [ ] Freeze the independently accepted PV2 commit and exact file manifest before the trial; preserve
      direct YouTrack and TeamCity collection/detail/mutation examples. Record nonblank handwritten
      TypeScript with comments, normal formatting and generated output excluded.
- [ ] Reconcile the canonical design before public inference changes. Implement the smallest sound
      literal grammar and document its fallback boundary. Runtime command/profile/auth/output/error
      behavior and the 118 REST plus one derived-capability inventory remain unchanged.
- [ ] Compile-time positive and meaningful negative tests cover required/multiple/no-positional
      arguments, typo rejection, broad annotated callbacks, arrays/branches, dynamic templates and
      literal-name union fallback. Test every claimed optional, variadic or whitespace form and
      conservative unsupported/duplicate fallback. No broad cast may hide a failed contract assertion.
- [ ] Convert both real integrations and run their affected offline tests plus Core tests. Existing
      CLI/JSON/RPC behavior remains intact. Focused runtime checks prove each newly claimed positional
      edge and retain missing-required rejection before onboarding/HTTP and Update denial before fetch.
      Preserve profile isolation; tests use synthetic data, no live service or real keyring required.
- [ ] Run repository `npm test` and independent correctness review. Resolve required findings before
      accepting the trial; green tests alone are not an authoring/simplicity verdict.
- [ ] Independently review full before/after Core + all integration source/helper/setup cost,
      tests/support/proof separately, representative same-capability diffs, remaining coercions and
      concepts/dependencies/call layers. Report a simplicity/type-safety gain honestly if source grows;
      do not claim LOC reduction from removed characters or moved helper work.
- [ ] Retain only a small, sound and clearer result, or revert the trial and document rejection.
      Record the accepted review verdict, privacy-checked commit and required closure evidence.
      No push, merge, live mutation or release is implied by this issue.

## Context and ownership

This follows the committed [YouTrack v1 / Issue #6](https://github.com/iXab3r/EyeAuras.CliFactory/issues/6)
and the separately scoped [profile isolation correction / Issue #9](https://github.com/iXab3r/EyeAuras.CliFactory/issues/9).

Execution remains in `.workspace/workstreams/youtrack-rest/implementation-plan.md` and
`implementation-ledger.md`, PV3, on `feature/youtrack-v1`. The local proposal is
`research/pv3-positional-inference-proposal.md`; these paths do not imply unpublished work is already
available as a remote GitHub blob. Follow `docs/DESIGN.md` and
`docs/practices/integration-authoring-reviews.md`. Core/integration agents own implementation;
independent agents review correctness and authorship; root owns publication and commits.
