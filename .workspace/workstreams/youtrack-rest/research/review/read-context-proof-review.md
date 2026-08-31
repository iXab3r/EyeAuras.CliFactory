# Bounded read-context proof review

Date: 2026-08-30. Reviewer: inventory_reviewer.

PASS for the safety of the expanded local-only packaged-CLI proof. This is not acceptance
of the pending B implementation, proof of live availability, or authorization for mutation.
The reviewer ran no real profile/keyring/service operation.

The inventory is fixed to five ReadOnly rows: identity, projects, issues, one issue detail,
and its comments. Collections request top 3 / skip 0; projects use the default projection,
while issue/comment context requests only id. At most one collection page and one selected
issue are used. A valid empty issue list skips only its dependent detail/comment rows; failed
required rows stay FAIL and force a failed result, including authorization failures.

Every row invokes the compiled CLI with the required profile, captured output, a 30-second
child timeout and 64-KiB output bound. There is no shell execution, arbitrary argv forwarding,
endpoint/token override or mutation route. Token environment keys and CI guards are matched
case-insensitively. Discovered IDs stay in memory and cannot start with a CLI option prefix;
control characters, excessive length, invalid shapes and oversized collections are rejected.

Only fixed endpoint labels, PASS/FAIL/SKIP and counts are printed. Raw stdout/stderr/error
objects, URLs, profile names, IDs, user identities and response data never enter evidence.
The project default projection correction was reviewed and its exact argv/required shape
is tested. The normal test command does not execute the live inventory.

Independently executed the implementation agent's isolated compiled safety-test artifact:
7 tests passed, 0 failed. Tests cover exact invocation inventory, empty dependencies, failure
at every row, malformed/overlarge output, identity/project/detail shapes, refused arguments/
CI and mixed-case token environment removal. These synthetic tests prove the proof wrapper's
construction; actual CLI/native-fetch contracts remain the separate B implementation gate.

Frozen source SHA-256, independently verified:

- integrations/youtrack/integration-tests/profile-proof.ts: 75be8d0c2b521b365d999b184b79b7d2444fc4e41dc9a58f14033974754b03a0
- integrations/youtrack/tests/profile-proof.test.ts: 78a457dd6ac6a84249034d0fee13dd9ab41be44231be705d9718bf6b66cdb5d5
