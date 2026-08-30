# Auth foundation independent review

Date: 2026-08-30. Reviewer: inventory_reviewer. Scope owner: GitHub Issue #6.

## Verdict

PASS for the explicitly authorized V1.0A foundation: a fresh named current-user profile,
normal factory token authentication, and one ReadOnly GET /api/users/me command with fixed
id,login projection. No blocking finding remains in that constrained implementation.
A1 may be recorded as one implemented endpoint operation; this does not approve B/C,
the full first-eight contract, optional user me --fields, or a successful live connection.
The local profile-backed proof is ready but has not been run by this reviewer.

## Inspected implementation and evidence

Reviewed integrations/youtrack source, package/TypeScript wiring, README, all three test
files, and integration-tests/profile-proof.ts against the factory design and integration/
testing rules. The existing shared factory is consumed directly; no service-specific Core
abstraction, generator, DSL, extra HTTP layer, or production TeamCity/Core modification was
introduced. git diff --name-only for packages/core and integrations/teamcity was empty.

The URL validator rejects credentials, query/fragment, backslashes, unsafe protocols and
an appended /api, retains context paths, and allows HTTP only for explicit local addresses.
The client refuses redirects, uses a minimal fields projection, rejects malformed identity
or credential reflection, and returns static network/status/shape errors without upstream
payloads. Authentication validates the candidate before keyring persistence. The single
command tree owns human/JSON/RPC behavior and declares ReadOnly explicitly.

Independently executed node --test integrations/youtrack/dist/tests/*.test.js: 19 passed,
0 failed. The tests exercise native fetch through MSW and the actual CLI declaration,
including candidate validation before persistence, rejected replacement, unavailable
keyring read/write, no plaintext config fallback, context path and projection, URL and
HTTP/redirect failure handling, credential reflection rejection, profile credential/URL/
permission/logout isolation, persistent RPC profile/AppData separation, and human/JSON
identity output. Fixtures are synthetic and no real account or credential store was read.
The parent and implementation agent additionally reported repository npm test: 61 passed
(Core 14, TeamCity 28, YouTrack 19); this reviewer independently reran the affected 19.

## Proof and login boundary

The proof invokes exactly one compiled user me --profile NAME --json child, accepts only
an explicit validated profile argument, removes YOUTRACK_TOKEN from the child environment,
refuses six common CI indicators before invocation, and bounds the child to 30 seconds /
64 KiB captured output. It does not forward arbitrary commands or endpoint/token overrides.
Response and child diagnostics remain in memory; output is static method/pass/count only.
Default npm test does not execute the live proof. The offline proof tests verify its fixed
argv, pre-invocation refusals and payload/error suppression.

Interactive login is user-owned: use a fresh profile in a visible ordinary terminal, enter
the endpoint at its prompt, and paste the token only at the factory hidden token prompt.
No token belongs in chat, command history, terminal capture, fixtures or workstream records.
This reviewer did not open a real profile, inspect credentials, capture an interactive
terminal, or make a real-service call. Live proof remains a separate explicit local action;
no live mutations are authorized.

## Explicit remaining limits

Existing Core profile configure can reuse a stored credential ahead of a new environment
candidate when changing an endpoint; this review permits the fresh-profile path only.
Existing Core auth login does not fully enforce the canonical noninteractive restriction
for TTY streams. Neither discrepancy was patched or certified fixed in this integration.
The README and workstream must retain those limits until separately reconciled.

The first-eight user me --fields option and B/C operations remain pending. AR8 and mandatory
AR50/AR100/final118 authoring gates remain pending; this bounded foundation review does not
replace those reviews or claim a reduction from the zero-YouTrack authoring baseline.

## Reviewed source hashes (SHA-256)

- src/client.ts: 771e10ec2aeee910f83f10ec16b8d86669ffe0c7c5829a473f14cf45d3c4e8e6
- src/cli.ts: ef602e5815a39f8f99af3a89d8a5d0f75914ffdfa37d1b4c83e890d7461a2a72
- integration-tests/profile-proof.ts: 005be57fd05e131339c61138fd1d186d906a37b37dd8bc18e0a4f7130c51defd

## Interactive handoff follow-up

After the above offline review, the user reported that URL entry and the token prompt were followed by an
empty-token configuration failure. Interactive readiness is pending investigation; no successful
live login or proof is established. An independent in-memory TTY-stream reproduction against the
then-current compiled Core demonstrated the mechanism: promptText receives a URL ending in CR,
closes, promptSecret starts, and a delayed LF immediately resolves an empty candidate. This is a
confirmed synthetic regression and a plausible explanation of the report, not a capture of the
user's terminal. Root authorized only a minimal reproduced shared-prompt correction, with new
Core/integration verification and review required. The existing A1 offline evidence stands; the
original empty Core diff statement describes the reviewed state before this follow-up.

## Prompt correction and proof hardening review

Follow-up verdict: PASS for the minimal reproduced shared-prompt correction and explicit
local proof readiness. A user-owned interactive retry may use the existing profile with its
endpoint unchanged. Successful real login and live proof still require separate evidence.

The Core patch only keeps the hidden token prompt active on empty CR/LF and installs its
data listener before explicitly resuming input. It does not flush input, echo secrets, alter
profile storage or credential precedence, or fix the unrelated auth-login TTY guard. This is
an evidence-backed shared defect correction used by the existing integrations, not a new
abstraction. The original checkout and concurrent TeamCity work are outside this patch.

Four synthetic Core tests cover the full text-prompt to secret-prompt split-CRLF handoff,
leading empty lines plus pasted text/backspace, Ctrl-C and raw-mode/listener cleanup, and
listener-before-resume ordering. Independently reran the compiled Core + YouTrack suites:
38 passed, 0 failed (18 Core + 20 YouTrack). The initial restricted attempt failed to spawn
Node test children with EPERM; the approved identical offline rerun passed.

A second review finding was corrected in the local proof: Windows environment variable
lookup is case-insensitive, so removing only an exact YOUTRACK_TOKEN object key could leave
a differently cased credential candidate. The proof now filters that key case-insensitively;
a synthetic uppercase/lowercase/mixed-case regression passes. No real environment values
were inspected. All previous fixed inventory, timeout/output bound, CI refusal and static
summary guarantees remain. The earlier proof hash is superseded by the hash below.

Reviewed follow-up SHA-256:

- packages/core/src/auth.ts: 3dbfefed87caabbdb0bcd5dee530cd4e161bfb5af5c49799810881e61c932636
- packages/core/tests/auth.test.ts: ab2ed97bfe77df3334ca9cb5f9c3b3cbcf6ce10b5f87bd71044dfdb139e256b9
- integrations/youtrack/integration-tests/profile-proof.ts: 7857bc7c8ee2acc5fd36840b6d2e8ad9927476c9290a494929e70b088094ecb1
- integrations/youtrack/tests/profile-proof.test.ts: 8ef5ecf06d4fc3a2f1af0dae475eb8c18fbcefe6293052545756f84e77b4af72

Final source freeze removed trailing blank lines only; the listed follow-up hashes were independently rechecked. The implementation agent reported the final repository npm test passing all 66 tests (18 Core, 28 TeamCity, 20 YouTrack).


