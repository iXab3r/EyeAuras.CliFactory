# Final bundle reads independent technical review

Reviewer: inventory_reviewer/fields_time_review. Date: 2026-08-30.

**B118.1 PASS: twelve exact ReadOnly operation identities.** No blocking technical finding remains in this domain. Scope was checked against block-118.json and classification.json: twelve unique P1 rows with exact CLI mappings and zero mismatch.

| Exact operation | CLI | Category |
|---|---|---|
| `GET /api/admin/customFieldSettings/bundles/build` | `bundle build list` | ReadOnly |
| `GET /api/admin/customFieldSettings/bundles/build/{bundleID}` | `bundle build get <bundle>` | ReadOnly |
| `GET /api/admin/customFieldSettings/bundles/build/{bundleID}/values` | `bundle build value list <bundle>` | ReadOnly |
| `GET /api/admin/customFieldSettings/bundles/build/{bundleID}/values/{elementID}` | `bundle build value get <bundle> <value>` | ReadOnly |
| `GET /api/admin/customFieldSettings/bundles/ownedField` | `bundle owned list` | ReadOnly |
| `GET /api/admin/customFieldSettings/bundles/ownedField/{bundleID}` | `bundle owned get <bundle>` | ReadOnly |
| `GET /api/admin/customFieldSettings/bundles/ownedField/{bundleID}/values` | `bundle owned value list <bundle>` | ReadOnly |
| `GET /api/admin/customFieldSettings/bundles/ownedField/{bundleID}/values/{elementID}` | `bundle owned value get <bundle> <value>` | ReadOnly |
| `GET /api/admin/customFieldSettings/bundles/version` | `bundle version list` | ReadOnly |
| `GET /api/admin/customFieldSettings/bundles/version/{bundleID}` | `bundle version get <bundle>` | ReadOnly |
| `GET /api/admin/customFieldSettings/bundles/version/{bundleID}/values` | `bundle version value list <bundle>` | ReadOnly |
| `GET /api/admin/customFieldSettings/bundles/version/{bundleID}/values/{elementID}` | `bundle version value get <bundle> <value>` | ReadOnly |
## Source and contract checks

The author implements twelve direct, typed client functions and twelve leaves under the existing recursive bundle root. Build, owned and version families each have bundle list/detail and value list/detail. The CLI owned name maps to the official ownedField path. Identifiers remain opaque encoded path segments under the configured context; no name lookup or automatic traversal occurs.

All six collection methods document fields/top/skip. Each command requests one page using existing top50/skip0 defaults, top1..100 and nonnegative safe-integer skip. Six detail methods expose fields only. Unsupported search/archive/release/owner/full-scan flags and detail pagination fail locally. Defaults omit bundle values collections and other unbounded nested resources.

Finite value projections match the official [build values](https://www.jetbrains.com/help/youtrack/devportal/resource-api-admin-customFieldSettings-bundles-build-bundleID-values.html), [owned values](https://www.jetbrains.com/help/youtrack/devportal/resource-api-admin-customFieldSettings-bundles-ownedField-bundleID-values.html) and [version values](https://www.jetbrains.com/help/youtrack/devportal/resource-api-admin-customFieldSettings-bundles-version-bundleID-values.html). Nullable assembly/date/description/owner values remain source-shaped. Owned owner is a User reference rather than an issue assignment. Version released and archived are independent flags and do not trigger filtering. Numeric dates are neither synthesized nor converted. Version startDate is documented since2023.1; command help exposes that boundary, and an unsupported default projection fails once without fallback. An explicitly narrower fields selection is a separate caller action.

The bundle default id/name/isUpdateable follows official collection examples in [build](https://www.jetbrains.com/help/youtrack/devportal/resource-api-admin-customFieldSettings-bundles-build.html), [owned](https://www.jetbrains.com/help/youtrack/devportal/resource-api-admin-customFieldSettings-bundles-ownedField.html), and [version](https://www.jetbrains.com/help/youtrack/devportal/resource-api-admin-customFieldSettings-bundles-version.html). The abbreviated entity tables omit name, while examples request and return it. Unsupported sample-only fieldType selections are excluded. Remote permissions may require access to a field/project using a bundle, but this does not change the local ReadOnly effect category or turn denial into success.

All twelve actual CLI routes execute against native-fetch MSW in human and JSON modes with exact path/query expectations. ReadOnly denial happens before fetch even if Update is enabled. Three-profile RPC verifies isolated URLs, tokens, permissions and AppData; a remote403 and local denial do not prevent the next request. Ordinary JSON failures use stderr/exit1 and never return private server bodies. Sparse/empty/malformed envelopes, oversized collection responses, encoded/dot/invalid-Unicode IDs and nested signed URL/bearer scrubbing are covered. No mutation or implicit network follow-up is present.

One test-fixture finding was corrected by the author before acceptance: the version RPC sample copied localizedName from enum/state metadata. Both returned and expected values now use the documented nullable startDate. No production correction was required.

## Independent execution and frozen evidence

After the lead's coherent Core/TeamCity/YouTrack build, this reviewer checked that both normal compiled files exist and ran:

```text
node --test integrations/youtrack/dist/tests/bundle-values.test.js integrations/youtrack/dist/tests/bundle-values-cli.test.js
```

**35/35 PASS, exit0:** eighteen direct boundary tests and seventeen actual CLI tests. Every operation's row, source function, declaration and test binding was inspected; operation acceptance is not inferred from the test count alone.

Reviewed hashes after this execution:

| File | SHA256 |
|---|---|
| `integrations/youtrack/src/bundle-values.ts` | 3ED123C16B71E43EFB8BCE2A7942978E9E0CA2402DFF1FE3797753D4CD85A0AC |
| `integrations/youtrack/src/bundle-values-commands.ts` | 1167AA294E84F5D442D34729A68C99C92F0291B3E0D04C85E6CE2BBA493AAC15 |
| `integrations/youtrack/tests/bundle-values-cases.ts` | 08E6EA7AE5D63FDA7C3058FCE9A0AE7BC1C02ABBFD50D7902B544B66CB2C1D5F |
| `integrations/youtrack/tests/bundle-values.test.ts` | AC3238A72FFB16668CCE8FF3AEB1FBC259FE522DAAAE5D42ADFEE9488B10E6D3 |
| `integrations/youtrack/tests/bundle-values-cli.test.ts` | F382B7BEA0C38878F61D6F58E8DD9ABD7FF26CD03DE12404CB38CBF75F350957 |
| `integrations/youtrack/src/client.ts` | 5B4A2D04479F2D9E4B7634279FD6C5E9607635E70336BFC2CBACB78F1C3392A2 |
| `integrations/youtrack/src/cli.ts` | DAA584511549950E0C3D2F05DEF4FDAB93B4A8199E5518BE00B50C3A774B0133 |
| `integrations/youtrack/src/cli-support.ts` | 14013884F0F830CE78C460CC4B5E0A792EBB2363AE7C07DADC6F9979D99B9C35 |
Shared client and command-tree hashes identify the tested assembly. Separate final security review owns the shared download-related client changes; this record does not claim an independent review of that derived capability. AR118, repository-wide verification, other final operations, live proof and counter/Issue updates remain separate responsibilities. This reviewer edited only management evidence and performed no source build, production edit, real-service call, profile/keyring access, commit or remote publication.
