# F07 typed-options experiment

Status: **REJECTED; F07 complete**. Independent authoring review confirmed the measured rejection,
and the root accepted that verdict. Prototype cleanup was verified on 2026-08-31. No production
files were changed by this experiment. Scope:
[Issue #14, F07](https://github.com/iXab3r/EyeAuras.CliFactory/issues/14).

## Frozen scope and historical commands

Baseline: `b5762f242ff1ea074e33a1c1739190ac4d0ee523`. The task copied its 81 Core,
TeamCity and YouTrack source files into separate `before`/`after` directories under
`%TEMP%/clifactory-f07-20260831`. Only the after copy was edited; dependencies are a junction
to the existing installation. No shared build, real network, service account or keyring was used.
All runtime storage is explicitly injected below that task-owned temporary directory.

The following temporary artifacts were independently reviewed and then removed. Their hashes
identify that evidence; these paths and commands are historical, not currently runnable artifacts:

- `prototype.diff`: complete eight-file production prototype diff.
- `measurement.json`: complete file counts/hashes, six declaration spans, 74 unchanged source controls.
- `after/checks.ts`: 32 exact-type assertions and eight expected-error checks.
- `diagnostics.txt`: ordinary TS7 errors after removing the expected-error directives.
- `diagnostics-before.txt` / `diagnostics-after.txt`: identical comparison source against both APIs.
- `compile-before.txt` / `compile-after.txt`: successful complete source compiler runs.
- `runtime.mjs`, `runtime-before.json`, `runtime-after.json`: independently written request/result
  expectations and parser controls through the real copied CLI/client implementations.

SHA-256: measurement `6eb9d535d1f954d4a946256e5fa1253516ac28bbc542ddcd9feac6a9f8635338`;
diff `5653cc584d632eebb339b6d401cfc32c54993ed01100ec19e5c040f3b30eec81`;
option mapper `9d1a86d512bd638dce49c67edf3083771acd80b1b651c1eb9af3046775ae588c`.

The compiler invocation used the existing Node executable, the repository's
`node_modules/typescript/lib/tsc.js`, and
`--project <temporary-root>/after/tsconfig.json --pretty false --noEmit`, repeated for `before`.
Runtime verification invoked Node with `<temporary-root>/runtime.mjs before` and then `after`.
Neither built the shared checkout. Compiler: TypeScript **7.0.2**; parser: Commander **14.0.3**.

## What the prototype actually supports

The existing command callback receives inferred options from a preserved readonly tuple.
The small grammar accepts lowercase long names and kebab-to-camel keys, boolean flags,
required-value placeholders, literal required/optional declarations, defaults, and typed
parser results. Supplied unparsed values remain strings: a numeric default without a parser
produces `string | number`, not `number`. Required parsed JSON still has type `unknown`.
Repeated ordinary options use Commander last-value behavior; guarded accumulation uses the
parser's declared return type. The parser's previous-value input remains `unknown`.

The complete options object falls back to `Record<string, unknown>` for widened arrays/flags,
union declarations, dynamic required/default metadata, duplicate keys, negation, aliases,
optional-value/variadic syntax, boolean parsers, optional parser properties, and untyped JSON
parser returns. Mixing a supported option into any unsupported tuple does not preserve a
partially trusted member. A union-subtype detection hole was exposed by a compiler assertion
and corrected before this evidence freeze.

There is a measured authoring limitation: the natural inline parser `(value) => Number(value)`
causes the callback's entire options object to remain broad. A named parser or an explicitly
typed parameter restores inference. An explicit return annotation alone and a `NoInfer` variant
did not fix it; the unsuccessful `NoInfer` change was removed.

No new value cast, `any`, or bivariant callback was introduced to force a claim. `as const`
preserves declaration literals. The pre-existing Core erased-handler assertion and TeamCity
property parser assertion were retained and are not counted as newly proved validation.

## Same-capability and complete cost

Counts are nonblank handwritten physical TypeScript lines, including comments. Normalized
character counts are also recorded because generic declarations can grow without adding lines.
Frozen source snapshots and emitted output are excluded from authored cost.

| Complete changed file | Before lines | After lines | Delta | Character delta |
|---|---:|---:|---:|---:|
| Core `command-options.ts` | 0 | 51 | +51 | +3,475 |
| Core `command-input.ts` | 48 | 51 | +3 | +206 |
| Core `command.ts` | 36 | 39 | +3 | +156 |
| Core `index.ts` | 49 | 51 | +2 | +127 |
| TC `command-support.ts` | 79 | 81 | +2 | +534 |
| TC `authoring-commands.ts` | 440 | 441 | +1 | +19 |
| YT `cli-support.ts` | 48 | 48 | 0 | +54 |
| YT `cli.ts` | 164 | 164 | 0 | -26 |
| **Full Core + TC + YT source** | **16,187** | **16,249** | **+62** | **+4,545** |

The baseline delta includes the one-line public handler export already accepted separately
in F06. Excluding that shared prerequisite, F07 adds 61 lines. No F06 positional-read reduction
is attributed to F07. Core accounts for +59 baseline lines and integration sources for +3.

| Same command declaration | Before / after lines | Actual change |
|---|---:|---|
| TC jobs steps list | 3 / 3 | Unchanged control |
| TC jobs steps show | 6 / 6 | Unchanged control |
| TC jobs steps create | 7 / 7 | Declaration unchanged; shared input helper simplified |
| YT project list | 6 / 6 | One `readOptions` call removed; 13 characters saved |
| YT issues get | 7 / 7 | One `readOptions` call removed; 13 characters saved |
| YT issues create | 7 / 7 | Unchanged; JSON still needs service validation |

The TC `stepInput` helper remains: two `text(options, ...)` reads and one property-array
assertion become direct typed reads. It needs an inferred-options import and type query.
Other consumers still need `text` and `readOptions`, so neither shared helper can be deleted.
Full cost includes generic wrapper forwarding, two option-helper overloads, literal-preserving
property and step declarations, and three literal-preserving YouTrack option arrays.
The new mapping alone introduces **19 type aliases** and a supported-grammar/fallback contract.

Separate temporary proof cost: 103 TypeScript lines of checks, 117 JavaScript lines of runtime
proof, 108 JavaScript lines of snapshot/adaptation/measurement tooling, and 15 lines of identical
diagnostic comparison input. These are not production savings or proposed shipped dependencies.

## Compiler and runtime evidence

Both complete copied production trees compile successfully. The after tree also passes all
32 exact-type assertions and eight expected-error checks. Removing suppression comments yields
the expected ordinary diagnostics: string versus number, optional string versus required string,
`string | number` versus number, unknown JSON/previous value, and broad fallback access.
The wrong hyphenated key produces TS2551 with a `fileLimit` suggestion, although its diagnostic
also exposes a long intersection of `Record` and optional-property types.

The identical before/after diagnostic example has four errors in each version: the before API
rejects valid required-string access as unknown and permits the misspelled key; the prototype
accepts the valid access, reports accurate optional/default types, and rejects the typo.
Thus the experiment demonstrates real type-safety benefit, not a claim that inference is impossible.

Each of the six actual selected commands passes both `execute` and JSON CLI output checks in
both versions. The first execute request has independently authored method/path/query/body
assertions, and its result is checked. The second JSON request is recorded and counted, with
JSON result checked; its wire contract is compared between versions, not separately asserted
against the expected route a second time. Twenty-five parser controls also pass in both versions: absence/presence,
required/default values, missing-required rejection before the handler, parsed/unparsed numeric
values, boolean flags, repeated flags and guarded accumulation, camel keys, unknown JSON objects
and primitives, and unchanged negation/alias behavior. Normalized before/after evidence is identical
(SHA-256 `5f8281c03691b4b7e06c654f6d610544d882831b071a733c7016f48a7f2d1782`).

Unchanged source controls include Core option/runtime parsing, permissions, profile/auth/storage,
both service clients and all other copied source files. No CLI flag, service route, permission,
authentication or output contract was intentionally changed. One prototype detail remains an
acceptance caveat: forwarding an absent generic options tuple omits the stored `options` property
instead of storing `[]`. CLI behavior is equivalent in the measured paths, but acceptance would
need an explicit normalization decision/test. This experiment does not claim a full regression run
or complete production acceptance. Single compiler timing samples are not a performance benchmark.

## Reviewed verdict and cleanup

The author, independent reviewer and root agreed to reject this bounded design, retaining the
existing broad option API.
It works for the supported declarations and improves diagnostics, but the six real samples show
no line reduction while requiring 19 mapping aliases, literal-preservation setup, additional
wrapper/export machinery, and an inline-parser annotation rule. JSON validation and broad shared
helpers remain necessary. Shipping it would therefore add authoring concepts and maintenance for
a smaller demonstrated benefit than the simpler F06 positional improvement.

This is an experiment-specific cost/fit judgement, not a blanket rejection of typed options.
A broader design or a different concrete consumer should have separately scoped evidence;
this verdict does not automatically open a follow-up scope.

The independent reviewer reproduced all 81 baseline blob identities, all changed-file metrics,
74 unchanged controls, the after compiler run, and before/after runtime-evidence equality.
The complete prototype was then removed only from the resolved task-owned temporary root.
Cleanup verified the root was not a link, identified exactly two dependency junctions, checked
their expected shared dependency target, and detached those junctions without recursive traversal.
A second bounded scan found no remaining reparse points before recursive removal of the owned
tree. Its absence and unchanged shared TypeScript/Commander dependency sentinel hashes were
verified afterward. No prototype code or fixtures remain in the checkout or temporary root.
