# P0 baseline and candidate inventory

Source revision: `c06efe9bcd27199776e6124122247e09685210d8`. The reproducible command is:

```text
npm run measure:loc -- --ref c06efe9bcd27199776e6124122247e09685210d8 --json
```

## Fixed measurement

| Category | Files | Physical | Nonblank |
|---|---:|---:|---:|
| Production | 118 | 20,425 | 19,503 |
| Tests/support | 101 | 25,137 | 24,310 |
| Local proof | 6 | 475 | 443 |
| Tooling | 4 | 179 | 169 |
| Protocol source | 1 | 19 | 19 |
| Historical workstream code | 1 | 29 | 29 |
| Generated | 8 | 161 | 130 |

Functional roles inside production: ordinary runtime 18,964; authoring testing 220; authoring
proof 319. Moving a file between these roles is not a source saving.

| Workspace | Production | Tests/support | Proof |
|---|---:|---:|---:|
| packages/core | 3,294 | 4,230 | 0 |
| packages/ipc | 1,299 | 1,420 | 0 |
| packages/playwright | 574 | 1,211 | 0 |
| integrations/teamcity | 9,512 | 10,106 | 274 |
| integrations/youtrack | 3,920 | 6,151 | 161 |
| integrations/random-common | 511 | 0 | 0 |
| integrations/random-rest | 215 | 733 | 4 |
| integrations/random-pw | 178 | 459 | 4 |

## Bounded candidates

### P1 — existing mechanisms only

- TeamCity `cli.ts`: 471 nonblank lines and 17 direct `permission:` leaves. The rest of the v2
  command surface already uses the existing integration-local `clientLeaf`; P1 may migrate only
  compatible client-bound leaves and adds no new binding API.
- RANDOM common: `index.ts` 19, `proof.ts` 174 and `live-cases.ts` 42. `liveCases` is currently a
  default export used by two tests, while both real proof runners already enter through `./proof`.
  P1 moves that inventory to the existing proof subpath; this is surface isolation, not repository
  LOC deletion.

### P2 — TeamCity text response

- TeamCity `client.ts`: 3,824 nonblank lines, 334 public methods and 53 `"text/plain"` literals.
  One literal belongs to transport response handling; the other 52 are candidate call sites.
- The first trial is limited to ordinary scalar/field reads and writes. Special Accept headers,
  protected/secure values, XML/native/file responses and endpoint-specific empty semantics stay
  direct until independently proven identical.

### P3 — shared testing adoption

- Existing Core testing implementation is 220 source lines (`testing.ts` 130 and
  `testing-contracts.ts` 90). Current integration consumers are TeamCity authoring/operator and
  YouTrack field-catalog/work-time tests.
- Fixed pilot: TeamCity `infrastructure.test.ts` 455 + its independently authored 582-line case
  table, and YouTrack `issue-relations.test.ts` 277. Specialized safety checks remain direct.
- No production route may be the source of its own expected method/path/query/body.

## Baseline Git blobs

| Blob | Path |
|---|---|
| `6c5cf8255baf506cc441a595464536158c411c2a` | `integrations/teamcity/src/cli.ts` |
| `d2f4d0c3510e1f765de4cc59729e9c512f42af62` | `integrations/teamcity/src/command-support.ts` |
| `be2a8d7e3aed458737a7f72dbdf9bd18234d4710` | `integrations/teamcity/src/client.ts` |
| `17dc37ea81cc75b0f6282445b2c887f71bf10c9e` | `integrations/random-common/src/index.ts` |
| `981ee79195511d5864007ab520a6ca3591192bc3` | `integrations/random-common/src/proof.ts` |
| `52ea0a8e7a37f1c3dad2d11548cf95b703af02d3` | `integrations/random-common/src/live-cases.ts` |
| `81686c12b02595d7a7cdfdfea6a25f1a1d2df5d2` | `packages/core/src/testing.ts` |
| `6a6c59152a3534b92d4c5d4a27c7a4595bbecede` | `packages/core/src/testing-contracts.ts` |
| `15a66e64f1efa977bed422fa790c006fa0a7a21c` | `integrations/teamcity/tests/infrastructure.test.ts` |
| `edafd89f04be45a398af4ebdfe1d451b2b267baa` | `integrations/teamcity/tests/infrastructure-cases.ts` |
| `9b42d34a129a5851fac62c8cfc84dd9f09858cdb` | `integrations/youtrack/tests/issue-relations.test.ts` |

## P0 verdict

The metric exactly reproduces every frozen workspace/category total and separately reports
functional testing/proof roles. Candidate scope is bounded before production edits. P0 may close
after the ledger records the tool's own separately classified cost; it makes no product-saving
claim.
