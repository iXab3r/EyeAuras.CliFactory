# Integration authoring v2 — final review

**Result: PASS pending publication/remote CI.** Baseline
`c06efe9bcd27199776e6124122247e09685210d8`; endpoint coverage and public CLI behavior are
unchanged. P1-P3 retain three small simplifications; P4 rejects speculative residual abstractions;
P5 rejects generation for the completed corpus with an explicit reopen trigger.

## Full cost

Nonblank handwritten code, comments included, normal formatting. Generated output, protocol source
and historical workstream code are separate.

| Surface | Baseline | Final | Delta |
|---|---:|---:|---:|
| Production | 19,503 | 19,376 | **-127** |
| Ordinary runtime role | 18,964 | 18,836 | **-128** |
| Authoring-proof role | 319 | 320 | +1 |
| Core production | 3,294 | 3,294 | 0 |
| TeamCity production | 9,512 | 9,385 | **-127** |
| YouTrack production | 3,920 | 3,920 | 0 |
| Tests/support | 24,310 | 24,296 | **-14** |
| Local proof | 443 | 443 | 0 |
| Repository tooling | 169 | 318 | +149 |

Product + tests/support + proof is **141 nonblank lines smaller**. Including the new reusable
149-line measurement command, the measured repository investment is +8 lines. That tooling cost is
reported rather than hidden as infrastructure; it enables exact baseline/working-tree comparisons
for later authoring reviews. Generated code stays 130 and protocol source stays 19.

## Retained result

- TeamCity's root service leaves now reuse its existing typed `clientLeaf`; one recursive command
  declaration still owns help, human/JSON output and JSON-RPC execution.
- TeamCity's repeated ordinary text requests use one private transport specialization. Four
  exceptional text operations remain direct so their query, Accept or status semantics stay
  visible.
- RANDOM live proof inventory is reachable only through the proof entry point, not the runtime
  barrel.
- TeamCity/YouTrack tests reuse existing Core request/gate contracts. No Core production or test
  API was added.
- No generator, dynamic envelope registry, universal HTTP/CRUD layer, connection binder, option
  inference or compatibility path was introduced.

## Verification

- `npm test`: PASS, **1,149/1,149** tests, zero failures/skips (Core 133, IPC 31,
  Playwright 23, RANDOM Playwright 6, RANDOM REST 25, TeamCity 586, YouTrack 345).
- Focused phase evidence: P1 617 tests; P2 586 tests; P3 30 tests, all PASS.
- `npm run measure:loc -- --ref <baseline> --json` reproduced every frozen row; final working-tree
  measurement produced the table above.
- `git diff --cached --check`: PASS. Pre-commit privacy gate: PASS across 492 tracked files and all
  17 staged files. No private build host/IP, private key, access token, JWT, personal path/email,
  credential-bearing staged URL or literal staged secret was found. Existing credential-shaped URL
  and email fixtures resolve only to reserved example/test domains; three remaining broad literal
  matches were a policy sentence, a field-name list and a synthetic test contract.
- Remote CI evidence is recorded after publication; no live service proof is required because
  behavior/coverage did not change.

## Reviewer verdict

The retained changes lower integration authoring code without weakening typing, gates, profile
isolation, response bounds, redaction or independent HTTP expectations. The new concepts are one
TeamCity-private specialization and one repository metric; all other savings reuse existing APIs.
P4/P5 explicitly stop where shorter code would mean more hidden schema or policy. Local technical
review passes.
