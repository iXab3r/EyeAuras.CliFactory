# Integration authoring v2 — expanded final review

**Result: local technical and privacy PASS; publication/remote CI pending.** Baseline
`c06efe9bcd27199776e6124122247e09685210d8`. The original -141-line close-out was rejected by
the owner and is superseded by this review. Endpoint coverage and public CLI behavior are unchanged.

## Full cost

Nonblank handwritten code, comments included, normal formatting. Helper, descriptor and test cost
is included; generated output, protocol source and historical workstream code stay separate.

| Surface | Baseline | Expanded result | Delta |
|---|---:|---:|---:|
| Production | 19,503 | 18,517 | **-986** |
| Ordinary runtime role | 18,964 | 17,977 | **-987** |
| Core production | 3,294 | 3,364 | +70 |
| TeamCity production | 9,512 | 9,374 | **-138** |
| YouTrack production | 3,920 | 3,002 | **-918** |
| Tests/support | 24,310 | 24,346 | +36 |
| Core tests/support | 4,230 | 4,307 | +77 |
| TeamCity tests/support | 10,106 | 10,095 | **-11** |
| YouTrack tests/support | 6,151 | 6,121 | **-30** |
| Local proof | 443 | 443 | 0 |
| Repository tooling | 169 | 318 | +149 |

Product + tests/support + proof is **950 nonblank lines smaller**. Including the previously retained
149-line reusable metric, all measured code is **801 lines smaller**. The 70-line Core runtime and
77-line Core test investments are explicit; the result does not claim only shorter call sites.

## Retained authoring model

- Core's `targetCommands(resolve)` binds an invocation-owned target after profile/readiness/gate
  admission. `read`, `update` and custom `gated` declarations preserve positional inference and
  fresh profile state across RPC. TeamCity and YouTrack both consume it.
- YouTrack has four local operation declarations covering **102 leaves**: paged/projected reads
  and body/projected-body updates. They reuse the one command tree, so help, human/JSON output and
  JSON-RPC remain derived from the same leaf.
- YouTrack has two local resource declarations covering **85 ordinary reads**: finite collections
  and projected objects. Static resources expose zero positional arguments; dynamic paths retain
  their exact required string tuple.
- Custom query/body/status behavior, mutations, acknowledgements, nullable reads, upload/download,
  sanitization, path/ID policy and bounded transport remain direct integration code.
- Repeated configured-profile tests prepare Core's existing offline fixture. Tests whose subject is
  auth, profile lifecycle, gates or isolation still exercise those transitions explicitly.
- The TeamCity text helper, RANDOM proof export isolation, narrow shared contract assertions and
  repository metric from the original trial remain retained.

## Simplicity review

The expanded solution adds one service-neutral Core concept and six YouTrack-local shapes. It does
not add a route schema, CRUD client, generator, DI layer or runtime dependency. A new integration
can reuse target binding and the offline fixture; it defines its own small local vocabulary only
after a repeated service dialect exists. Exceptional policy is more visible because it is exactly
the code that does not fit the ordinary declarations.

The first prototype briefly weakened static-resource TypeScript signatures. Review caught this
before publication; conditional path arguments and compile-only tests now preserve zero/fixed
arity. No known type, runtime, gate, profile, response or privacy behavior is intentionally relaxed.

## Verification

- `npm test`: PASS, **1,150/1,150** tests, zero failures/skips (Core 134, IPC 31,
  Playwright 23, RANDOM Playwright 6, RANDOM REST 25, TeamCity 586, YouTrack 345).
- Focused evidence includes the Core target lifecycle test and affected YouTrack command/resource,
  profile, RPC, upload/download, response and type contracts; the complete suite is authoritative.
- `npm run measure:loc -- --ref <baseline> --json` reproduces the frozen baseline; the working-tree
  run produces the table above.
- `git diff --check`: PASS. A sandbox-only `spawn EPERM` run was discarded; the same full test
  command passed outside that process restriction.
- Privacy gate: PASS across 494 tracked files, both new Core files and all 58 staged files; no
  private key/token/JWT, private host/IP, personal path, non-reserved email, staged credential URL
  or literal secret assignment was found. Commit, push and exact-head CI still block publication.

## Reviewer verdict

P7, P8a, P8b and P9 pass local technical review. The result is now material rather than cosmetic:
it removes 918 YouTrack production lines after paying the full common/local implementation cost,
while preserving independent contracts and explicit exceptions. P10 remains active until
publication and exact-head CI close.
