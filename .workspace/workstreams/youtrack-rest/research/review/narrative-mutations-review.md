# V1.0C and first-eight technical review

Date: 2026-08-30. Reviewer: inventory_reviewer. Scope: Issue #6, C1-C3 and the
explicitly reconciled parser correction needed by the first-slice contract.

## Verdict and acceptance

PASS for C and the requested first-eight REST operation implementation, within the auth
limitations already recorded in auth-foundation-review.md. Accept these three new operations:

- POST /api/issues
- POST /api/issues/{issueID}
- POST /api/issues/{issueID}/comments

Together with accepted A/B this is 8/118 REST operations: five ReadOnly and three Update.
Derived attachment download remains 0/1. This is a technical/test verdict, not the separate
AR8 authoring/simplicity verdict, full-v1 completion, or permission to run live mutations.

## Mutation and response contracts

Reviewed the actual declarations, local validators, native-fetch adapter, exports, README
and MSW/CLI tests. Every write declares Update, stays disabled by default and requires a
profile-specific grant; tests prove each valid mutation is denied before HTTP. Explicit
remote authorization still governs server access.

Create requires project.id and summary and permits description; update permits a nonempty
subset of summary/description; comment add permits text only. Root and nested project keys
are restricted to the declared slice. Required text is checked for emptiness without losing
multiline narrative content. Omission stays omission; description null and empty string are
preserved. Missing custom-field/workflow requirements are not guessed or filled in.

Each write sends one POST with exact JSON, encoded issue path and fixed response projection.
The API accepts no arbitrary method/path or mutation passthrough. Tests cover all three
families across 400/401/403/409/429/500, with exactly one request and safe diagnostics.
No retry, implicit read-back, automatic permission grant or live mutation proof was added.

The small unified response.text plus JSON.parse path removes duplicated read/write parsing
without a new abstraction. GET empty or malformed data still fails, including the strict
auth identity error label. Only empty successful mutation text becomes null; literal JSON
null, arrays and malformed mutation responses are rejected. Object results retain source
fields while applying the reviewed recursive URL/token scrub.

## Required-body/parser correction closed

Independent synthetic reproduction against the preceding compiled code confirmed that
issues create without --body prompted for URL configuration. No real profile or network
was used. Root explicitly reconciled this with the Issue's no-prompt missing-parameter
contract and approved a small extension of the existing OptionDefinition surface.

Core now supports required: true through Commander's existing mandatory-option facility.
YouTrack's existing option parser rejects malformed body JSON before onboarding. A declared
default still satisfies required metadata and supplied-value parsing remains unchanged.
The canonical design documents this behavior. No callback framework, hook system, generator,
new dependency, new endpoint, or service terminology was introduced into Core.

Each recursively constructed service Command also gets exitOverride. Otherwise Commander
could terminate the process on a required-option/argument error, ending RPC or a test worker.
This preserves run() error returns and persistent RPC continuation. The actual TeamCity
jobs show missing-argument regression then executes help in the same RPC session, with an
injected runtime and zero network calls. TeamCity production source is unchanged.

Privacy checks cover all three YouTrack leaves with missing or malformed JSON in fresh TTY,
JSON CLI, programmatic and RPC modes: no onboarding prompt, keyring access or input echo.
The body parser throws a fixed plain Error; it does not use Commander's value-echoing
InvalidArgumentError path. RPC missing/malformed requests are followed by a successful
mocked mutation without restarting the session. Mutation result and permission behavior
remain the same across human/JSON/RPC execution and interleaved profiles/AppData roots.

## Independent checks and boundaries

Independently executed all compiled offline Core, TeamCity and YouTrack test suites:
114 passed, 0 failed (Core 25, TeamCity 36, YouTrack 53), including the new real TeamCity
RPC continuation regression. Test-count growth also includes previously existing cases
that can now complete after parser errors/help; it is not all newly authored coverage.

Root separately reported the bounded five-read B live proof passing. This reviewer made no
real-service calls, inspected no real profile/credential values, and performed no live write.
The proof stays fixed to the reviewed ReadOnly inventory. Any final packaged proof result
is separate from these offline mutation correctness tests.

The earlier Core auth-login TTY restriction and stored-candidate precedence discrepancies
remain explicitly documented; this change does not claim to fix them. No source edit or
commit was made by this reviewer. AR8 must count the required-option/exit correction as
correctness work and include all Core plus integration cost; parser simplification evidence
is separate, not a claim that added safety was free or that YouTrack's zero baseline shrank.

## Frozen reviewed SHA-256

- integrations/youtrack/src/client.ts: 3707be5d174caaaae5a90d828635bbab59e5e92ed86146ca855789a4b63249d6
- integrations/youtrack/src/cli.ts: c9efd73455eaf23da11796033ef7593003697c1bb381b6680f9d3c27e0f38aea
- integrations/youtrack/src/index.ts: 78a2b8d25a5fb2a62d6129c160de43b2c478404a33219e4f9c759e02fda59f95
- integrations/youtrack/tests/cli.test.ts: 275cc3b751adf3ad9342d66790f2b95cdfa104917c9c440f61d749854eb1fcb7
- integrations/youtrack/tests/mutations.test.ts: 239be5da6ccedf4242bb9c8df6cc7663c7faf1736e166f92cd7d9df851f0bfec
- packages/core/src/cli.ts: a7750f6af23a91b170ff6ba7ffeb1bc305cdaa6a5c3392780ef04d8ab0910ff4
- packages/core/src/types.ts: 796f9084b8815ecc58b699263446145d2c8abfc26d224e16c3c62725c27d8180
- packages/core/tests/profile-configure.test.ts: 807c28834c3f8b407271fa8b64b008a75877528b794ae6083fc05ad48a082160
- integrations/teamcity/tests/argument-errors.test.ts: a18d4c2d35809d2775939269e617e7927202ac068d1f1402f2e738462f3b1c40

Final packaged proof update: root reported the frozen-C five-row ReadOnly proof PASS with
exit 0. This confirms bounded live reads separately from the mocked write tests; no live
mutation was performed. No raw response, discovered ID or credential is included here.
