# TeamCity v2 — PR review

Date: 2026-08-30. Reviewed implementation: `717b3465cc0a01d4048e331b6bedb7964b26f34d`.
[PR #13](https://github.com/iXab3r/EyeAuras.CliFactory/pull/13), references
[Issue #5](https://github.com/iXab3r/EyeAuras.CliFactory/issues/5).

## Verdict

**Not ready to merge.** Two actionable findings remain. The 449-route census is complete,
but route exposure is not a substitute for cross-platform correctness or complete downloads.
No fixes, Core extraction, merge, remote service mutations or permission changes were made
during this review. This is an author-side focused review, not an independent approval.

## Findings

### R1 / P1 — canonicalize the owned test root before constructing AppArguments

Location: `integrations/teamcity/tests/files.test.ts:20-31`;
related guard: `integrations/teamcity/src/downloads.ts:24-46`.

`fileRuntime` feeds the lexical `mkdtemp(tmpdir())` result directly into AppArguments. The download
guard walks every ancestor and compares the path text with `realpath`. Valid platform aliases
therefore stop the file tests before the network/file assertions they are supposed to exercise.
macOS CI fails with `Download directory must not contain symlinks or junctions`; Windows CI fails
with `Download directory resolves outside its declared path`. The macOS system temporary-root
alias and Windows canonical path spelling must not be confused with an injected link below the
profile. The exact Windows alias spelling was not captured; the realpath comparison failure is
directly recorded in CI.

Evidence: both Node versions fail on each platform in
[CI run 33314767522](https://github.com/iXab3r/EyeAuras.CliFactory/actions/runs/33314767522).
Node24 records 20 failing TeamCity tests on macOS and 19 on Windows; all20 Core tests pass.
Both Linux jobs pass. Local Windows `npm test` passed581, so local success missed this distinction.

Smallest correction: canonicalize the newly created, test-owned root with `realpath` before
constructing AppArguments. Keep the intentional symlink/junction rejection tests inside that root
and the production containment/no-clobber checks. Do not simply remove the security guard or
blindly canonicalize an untrusted profile child. Verify the complete six-job matrix again.

### R2 / P2 — reject partial-content responses for whole-file downloads

Location: `integrations/teamcity/src/downloads.ts:139-143`.

The sink accepts every `response.ok` status, including206. The client sends no Range request
and has no resume/reassembly contract. A valid partial response is nevertheless published under
the final requested filename, with the ordinary successful download result. PNG/ZIP prefix checks
do not establish completeness, and untyped artifact/source bytes have no format check at all.

Offline reproduction through the compiled real command, with an injected fetch and temporary
AppArguments (no real network/keyring):

```text
builds artifacts download 7 example.bin --output partial.bin
response: 206, Content-Range: bytes 0-2/100, Content-Length: 3
observed: one request, no Range header, success, final file contains3 bytes
```

Reject206 before staging/publication and add an MSW command-level regression asserting no final
file and no retained staging bytes. If checking Content-Length completeness too, account for
transparent Content-Encoding decompression; do not compare compressed length with decoded bytes.
YouTrack's existing download implementation already rejects206, providing a concrete second
consumer for a shared complete-download contract.

## Core/Common reuse review

Peer evidence is read-only from existing work, not a hypothetical example:

- [YouTrack PR #12](https://github.com/iXab3r/EyeAuras.CliFactory/pull/12), snapshot
  `005254d6fc4981a1fafa0a6a715c9dbd92f946aa`. The inspected command/input, CLI support and download
  files are unchanged from the initial `7a9811f` snapshot.
- RANDOM.ORG HTTP example, local snapshot `40c265b89f3975257b5254819610a90d5aa51ba9`.
  This is an existing local consumer, not code shipped by this TeamCity PR.

| Priority | Candidate | Concrete benefit and boundary |
|---|---|---|
| First | Reuse typed command arguments plus a small context binder | YouTrack already adds literal argument inference to Core `command`. TeamCity has304 `text(args, ...)` call sites in command modules and8 uses of `clientLeaf`. Preserve syntax inference through any binder so eligible literal handlers use `args.id`, without repeating extraction checks. This is an opportunity set, not a claim all304 calls disappear: dynamic syntax still needs validation. Keep client construction, guest mode and domain validation local. RANDOM.ORG also demonstrates client binding, but has no token requirement. |
| First, after R1/R2 | One profile-owned bounded file sink | TeamCity `downloads.ts` is201 nonblank lines; YouTrack independently implements private staging, byte bounds, cancellation, hard-link no-clobber publication and cleanup. Extract the proven filesystem/stream mechanism with both callers migrated together. Keep TeamCity media/signature checks and YouTrack signed attachment URL validation in their adapters. Moving201 lines alone is not a saving; measure the combined implementation and tests. |
| Small follow-up | JSON/repeated options and test runtime setup | TeamCity has8 `jsonOption`,16 `repeatOption` and95 `option` calls; YouTrack has its own non-echoing JSON parser and option declarations. Share only meaningful parsing/error behavior, not a new options DSL or one-line object wrapper for its own sake. Both integrations duplicate profile/output capture and gate-test setup; a test-only helper may remove more authoring cost than another production abstraction. Native MSW assertions and DTO expectations must stay service-specific. |
| Defer public API | Multi-secret lifecycle | TeamCity's70-line `credential-inputs.ts` and separate issued-token handling show pressure beyond Core's single auth secret. A future owned-alias cleanup contract could prevent manual cleanup before profile deletion. A second implemented multi-secret consumer is not established by the peers reviewed here. Do not add a generic secret registry/transaction framework from this evidence alone. |

Counts are nonblank handwritten lines including comments, or literal call-site counts in
`integrations/teamcity/src/*-commands.ts`, at the reviewed commit. They are not projected percentage
savings. Representative before/after detail, collection and mutation declarations must include the
new helper, public API, test cost and number of concepts, as required by the authoring practice.

### What must remain TeamCity-specific

REST paths, locators, DTO/fields projections, secure-property classification, parameter replacement
semantics, permission choice, server action acknowledgements, pagination and endpoint limits.
Do not promote the3833-nonblank-line client wholesale into a universal HTTP/CRUD framework.
Bounded stream consumption may be a small reusable primitive once both concrete callers agree;
their entire transports do not need to become identical.

### Reconcile parallel Core work before extraction

A read-only three-tree merge against the YouTrack snapshot reports conflicts in
`packages/core/src/cli.ts` and `docs/DESIGN.md`. Both PRs change the required-option contract.
Neither worktree/index was merged or modified by this check. Coordinate merge order and reconcile
one Core API, then test both integrations; do not introduce a second typed command helper in
TeamCity that competes with the existing YouTrack work.

Suggested order: R1/R2 regression fixes -> green CI -> reconcile the overlapping Core contract ->
measure typed binding on both consumers -> extract the bounded sink with both adapters -> consider
small option/test utilities. No generator, plugin registry or new dependency is justified here.

## Verification and publication

- Implementation committed/pushed as717b346; PR #13 targets `main`. No force push/history rewrite.
- Full local suite581/581 before commit. Prior bounded packaged-CLI ReadOnly proof19/19 is preserved
  as local development evidence; this review did not rerun private endpoints.
- Full142-file tracked/untracked tree plus working/staged diffs: no unresolved privacy findings
  before the implementation commit; staged whitespace check passed.
- Published implementation CI: Linux22/24 pass; Windows22/24 and macOS22/24 fail. The feature Issue
  remains open and the workstream remains active. No `Closes #5` or merge approval.
- Unrelated local browser/auth/IPC design edits were preserved and excluded from both publication
  and this implementation review.
- Review covered changed Core parsing, representative command composition and mock contracts,
  transport error/bounds, file persistence and credential helpers, plus peer reuse candidates.
  It is not independent manual validation of every native endpoint/payload/server-version variant.
