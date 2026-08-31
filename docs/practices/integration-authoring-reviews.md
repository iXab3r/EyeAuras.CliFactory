# Integration authoring reviews

The factory has two simultaneous goals: less handwritten work per integration operation and
simple, readable code. Neither endpoint count nor a smaller integration file proves success.

## Cadence

For a broad API expansion, declare the baseline and a review interval in the workstream before
implementation. The default interval is **50 newly accepted REST operations** unless the owner
chooses another interval. TeamCity v2 explicitly uses 50.

Count unique method/path identities newly exposed, tested and accepted since that workstream's
baseline. Existing routes, aliases, additional flags, commits, helper refactors and test cases do
not advance the counter. Publish current coverage separately.

At each +50, +100, +150, ... boundary, finish the review and its corrective simplification before
adding the first operation of the next batch. Review the final shorter batch too. Normal slice
reviews still apply; fifty is not a minimum slice size. Earlier simplification is encouraged.

## What the review measures

Record a small before/after evidence set:

| Evidence | Question |
|---|---|
| Same-capability detail read, collection read and mutation | How much must an author write for the same behavior now? |
| Handwritten declaration, adapter/client, DTO and validation code | Which repeated glue actually disappeared? |
| Core + integration source delta | Was work removed, or moved into a larger helper? |
| Test/fixture/support delta, reported separately | Are the contracts still independently proven? |
| Public concepts, dependencies and call-path layers | Is the result easier to understand and debug? |
| Service-neutral use of an existing Core improvement | Could another CLI use it without importing service concepts? |

Use a consistent counting method and preserve normal formatting. For physical line counts,
report nonblank handwritten TypeScript lines with comments included, exact paths and source
commit; exclude generated output. Track tests separately. An amortized batch metric may divide
the net Core-plus-integration source delta by newly accepted operations, but compare equivalent
behaviors too: a complex workflow naturally costs more than a field read.

Do not reward minification, giant expressions, hidden generated code/schema/DSL work, weak typing,
suppressed errors, omitted help, weakened gates, deleted tests, or dumping raw DTOs without safety
review. There is no arbitrary reduction percentage that justifies a harder API.

## How to simplify

1. Implement a few representative operations directly, through failing boundary tests.
2. Identify repetition in code that exists, not a hypothetical future integration.
3. Try the smallest direct function or improvement to an existing factory surface.
4. Rework equivalent examples and count all setup/helper cost.
5. Keep it only if authoring becomes easier and behavior remains transparent.

Potential existing Core improvements include command input typing, option declarations, handler
binding and shared contract-test setup. They are candidates, not a prescribed abstraction.
Reuse the command tree, profiles, secret store, permission gate and output/JSON-RPC machinery.

Service locators, paths, DTOs, property semantics and endpoint-specific safety remain local.
A repeated TeamCity property pattern does not by itself justify a universal CRUD or HTTP layer.
The repository's promotion rule still applies: a genuinely new extracted shared mechanism needs
evidence from another real integration. A synthetic service-neutral example can check an existing
Core API's coupling, but is not a substitute real product or permission to invent one.

When no abstraction is a net improvement, retain straightforward code and explain the decision.
The goal remains reducing future authoring effort; do not create complexity to make a metric fall.

## Review gate

The review record must include the baseline/count, sample diffs, total code and test changes,
scope of shared improvements, complexity tradeoffs, checks run and a pass/follow-up verdict.
Required corrective work lands before the next batch starts. A passing test suite alone is not
an authoring/simplicity review.

Integration/Core roles judge technical correctness. Reconciliation Lead keeps counters, evidence
and follow-ups consistent with the Issue and ledger. Do not mark planned work as implemented or
a checkpoint passed before its evidence exists.
