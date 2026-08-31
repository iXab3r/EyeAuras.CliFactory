# PV3 proposal: infer positional input from the existing command declaration

Status: discovery proposal only; no production changes or trial accepted. Source work must wait
for the reviewed PV2 fix commit and a new explicit scope decision. Issue number is not assigned.
Do not reuse issue #8, which belongs to another integration.

## Purpose and baseline

The user asked for common functionality that makes integration code smaller or simpler after
committing and reviewing YouTrack v1. The recommended bounded trial improves the existing
`command()` declaration rather than adding a builder, wrapper or schema.

The measured discovery baseline is commit `10d7fee2cbce13d90bf59a82f9946962ea69218b`:
118 accepted REST identities plus one derived download; no API inventory expansion is proposed.
Production nonblank TypeScript is Core 1760 + TeamCity 1100 + YouTrack 4016 = 6876 lines.
The pending four PV2 correctness fixes are not included in that count. Freeze their accepted
commit and recount immediately before PV3 so their cost is not attributed to this trial.

There are 129 `String(args.<name>)` expressions: 118 in YouTrack and 11 in TeamCity. These
expressions compensate for `CommandInput.args: Record<string, unknown>` even though Commander
already parsed the declared positional values. Their removal saves 1032 source characters,
without a claimed physical-line saving. They also hide misspelled argument names by converting
`undefined` into an ordinary string.

## Proposed contract

Keep the existing branch and leaf overloads of `command()`. Infer a leaf callback's positional
input from its existing literal command name, with no second argument declaration. Its `options`
remain `Record<string, unknown>`. Do not infer options, change parsing, or remove domain validation.

The ordinary declared forms have the following runtime values:

| Existing syntax | Callback property |
| --- | --- |
| `<id>` | `id: string` |
| `[id]` | `id: string | undefined`; the property is present |
| `<ids...>` | `ids: string[]` |
| `[ids...]` | `ids: string[]`; omission produces `[]` |

Evidence is the current Core `src/cli.ts` argument mapping, which creates a property for every
registered argument, and installed Commander `lib/command.js` `_processArguments`, which supplies
an empty array for an omitted variadic. Factory authors cannot currently attach a positional
argument parser or default through the public declaration.

Support only a small, readable literal grammar that can be proved equivalent to those paths.
Required positional arguments in both current products are the minimum useful consumer. Include
optional and variadic inference only if it stays small and correct; otherwise retain unknown
for those complete declarations and document that limit. A partially understood declaration must
not produce partially trusted argument types.

Broad/dynamic strings, unsupported syntax, duplicate argument names and ambiguous declarations
fall back to `Record<string, unknown>`. Whitespace must match Core's `trim().split(/\s+/)` meaning
for the supported cases; any whitespace or token form not handled confidently takes the same
conservative fallback. Do not replace Commander or build a general type-level Commander parser.

A likely implementation is a few private type helpers plus a generic leaf overload. Generic
`CommandInput` / `CommandHandler` parameters are optional implementation choices, not required new
public concepts. Keep their unparameterized annotation behavior broad. Existing callbacks annotated
with `CommandInput` or `CommandHandler` must remain usable, and returned commands must still compose
into `readonly CommandDefinition[]`. YouTrack uses that array annotation in three command modules;
no current integration explicitly annotates a callback as `CommandInput` or `CommandHandler`, so
focused compatibility checks must cover the exported annotation contract.

Avoid `any`, bivariant handler tricks and an assertion forest. If inference needs one localized
type erasure at the existing stored `CommandDefinition` boundary, explain why the unchanged parser
establishes the callback contract. Do not add a runtime wrapper merely to satisfy the type checker.

## Equivalent consumer examples

Line counts below include each complete command declaration or client function, including help,
permission and options, using the discovery baseline. Client implementation is unchanged in PV3.

| Capability | Declaration path and first line | Declaration lines | Client path and first line | Client lines |
| --- | --- | ---: | --- | ---: |
| YT collection | `integrations/youtrack/src/cli.ts:125` | 12 | `integrations/youtrack/src/client.ts:300` | 9 |
| YT detail | `integrations/youtrack/src/cli.ts:137` | 7 | `integrations/youtrack/src/client.ts:310` | 9 |
| YT create | `integrations/youtrack/src/cli.ts:111` | 7 | `integrations/youtrack/src/client.ts:387` | 12 |
| TC collection | `integrations/teamcity/src/cli.ts:193` | 20 | `integrations/teamcity/src/client.ts:168` | 18 |
| TC detail | `integrations/teamcity/src/cli.ts:213` | 6 | `integrations/teamcity/src/client.ts:187` | 7 |
| TC mutation | `integrations/teamcity/src/cli.ts:251` | 19 | `integrations/teamcity/src/client.ts:363` | 17 |

For example, a detail handler should pass `args.issueID` directly to `getIssue`; TeamCity should
pass `args.id` directly to `getProject`. A numeric TeamCity ID still passes through
`positiveInteger(args.id)`. YouTrack `issues update` also removes its redundant string conversion.
Collection and create commands without positional arguments retain their present authoring cost;
report those unchanged controls rather than implying that all operations become shorter.

## Evidence and acceptance

1. Freeze the reviewed PV2 commit. Record whole handwritten Core + both integrations production
   counts; separately record tests/support/proof and docs. Count nonblank `.ts` lines with comments,
   exclude generated files, and preserve normal formatting. Include every type helper, export,
   annotation or adapter required by the trial. Do not move declarations to hide their cost.
2. Update the canonical design before changing this public inference behavior. Keep all runtime
   command syntax, output, permission gates and service validation behavior unchanged.
3. Prove compile-time inference and typo rejection for both real products, plus no-argument,
   multiple-argument, annotated callback, command-array composition and dynamic fallback examples.
   Prove optional/variadic and unusual-whitespace behavior for whichever cases are claimed.
   Unsupported and duplicate forms must stay conservative rather than infer unsound properties.
4. Use compile-time negative assertions whose failure matters; do not suppress errors with broad
   casts. Existing real CLI, JSON and RPC tests exercise the same declarations. Add focused runtime
   checks for any newly claimed positional edge, including missing-required rejection before
   onboarding/HTTP and Update denial before the network boundary. Keep profile isolation unchanged.
5. Re-run both integrations' affected offline tests, Core tests and the full repository suite.
   No real-service call is necessary for a type-only change. Review the resulting diff independently.
6. Publish full before/after source cost, representative samples and the remaining coercion count.
   A rough discovery expectation was 25-40 added Core lines and no integration line reduction;
   this is neither a promise nor a line budget. Label the result a simplicity/type-safety gain if
   source grows. No new dependency, runtime call layer or consumer DSL should be introduced.

Reject the trial if matching the existing syntax requires a substantial type parser, many exported
concepts, repeated consumer annotations, unsafe assertions, or more difficult diagnostics than the
129 conversions it replaces. Keep the straightforward implementation and document the result if
no small, sound inference surface survives. Narrow, explicitly documented inference is preferable
to complex edge-case support.

## Alternatives considered

A context/connection binder would address 117 YouTrack and 17 TeamCity handler awaits, but the
existing handlers are generally one or two lines. A new wrapper adds setup and a call layer with
no demonstrated net line reduction. It is not part of PV3.

Shared body, pagination or HTTP abstractions are also excluded: YouTrack presence/null rules,
projections, array bounds and signed attachment URLs differ materially from TeamCity locators and
fixed DTOs. The proof runners contain reusable support mechanics, but safety differences require
separate correctness work; any later support saving must be reported separately from production.
