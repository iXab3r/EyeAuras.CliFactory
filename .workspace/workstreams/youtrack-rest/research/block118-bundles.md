# Final 118: build, owned and version bundle reads

Official JetBrains references refreshed 2026-08-30 and reconciled with Issue 6's frozen classification. Root released exactly these twelve ReadOnly GET operations after independent scope acceptance. The approved defaults include version startDate with its explicit 2023.1 availability note.

P flags: `--fields <projection>`, `--top <count>`, `--skip <offset>`. D flags: `--fields <projection>` only. Every P method below explicitly documents fields/$top/$skip. Preserve the current CLI one-page limits (top defaults to 50, range 1..100; skip defaults to 0, nonnegative safe integer). No archive/released/owner/date/query filters, automatic pagination, name lookup, sorting or nested-values expansion.

| Exact method/path | Exact CLI mapping | Flags | Default |
|---|---|---|---|
| GET /api/admin/customFieldSettings/bundles/build | `bundle build list` | P | B |
| GET /api/admin/customFieldSettings/bundles/build/{bundleID} | `bundle build get <bundle>` | D | B |
| GET /api/admin/customFieldSettings/bundles/build/{bundleID}/values | `bundle build value list <bundle>` | P | Build |
| GET /api/admin/customFieldSettings/bundles/build/{bundleID}/values/{elementID} | `bundle build value get <bundle> <value>` | D | Build |
| GET /api/admin/customFieldSettings/bundles/ownedField | `bundle owned list` | P | B |
| GET /api/admin/customFieldSettings/bundles/ownedField/{bundleID} | `bundle owned get <bundle>` | D | B |
| GET /api/admin/customFieldSettings/bundles/ownedField/{bundleID}/values | `bundle owned value list <bundle>` | P | Owned |
| GET /api/admin/customFieldSettings/bundles/ownedField/{bundleID}/values/{elementID} | `bundle owned value get <bundle> <value>` | D | Owned |
| GET /api/admin/customFieldSettings/bundles/version | `bundle version list` | P | B |
| GET /api/admin/customFieldSettings/bundles/version/{bundleID} | `bundle version get <bundle>` | D | B |
| GET /api/admin/customFieldSettings/bundles/version/{bundleID}/values | `bundle version value list <bundle>` | P | Version |
| GET /api/admin/customFieldSettings/bundles/version/{bundleID}/values/{elementID} | `bundle version value get <bundle> <value>` | D | Version |

Approved finite defaults:

- B: `id,name,isUpdateable` (same as accepted enum/state/user bundle reads).
- Build: `id,name,description,archived,ordinal,assembleDate`.
- Owned: `id,name,description,archived,ordinal,owner(id,login)`.
- Version: `id,name,description,archived,ordinal,released,releaseDate,startDate`.

Both identifiers are database IDs, encoded independently as opaque segments beneath the profile context path. The CLI name `owned` deliberately maps to the documented `ownedField` URL segment. Bundle and value details return objects; lists return arrays. Explicit projections preserve sparse/null service data and $type values through existing response scrubbing.

## Semantic details

All three value types can have null descriptions and bundle references. Build assembleDate can be null and is documented as a UTC Unix timestamp in milliseconds. Owned owner is a nullable User reference, not a string or proof of current issue assignment; default id/login avoids expanding user groups/profiles. Version released and archived are independent flags; neither should be inferred from the dates or used as an automatic filter. Version releaseDate and startDate can be null. Retain raw numeric date values without timezone conversion, formatting or synthesis. The official tables label version dates Long; build assembleDate explicitly defines milliseconds. Official version request examples use millisecond epoch values, so tests retain these numbers without claiming a stricter date format than the source establishes.

Version startDate is documented as available since YouTrack 2023.1. Including it in the proposed current-reference default means older deployments may need an explicit narrower --fields projection; do not add silent version probing or fallback routes. Other selected attributes have no newer-version availability annotation on these pages. A caller can explicitly select nested metadata, but defaults never include values collections and no follow-up request occurs.

Like accepted enum/state bundle reads, name appears in each official GET example despite sparse bundle entity tables. The build/version bundle-list samples also contain fieldType selections without returned fieldType data; do not copy that unsupported selection into defaults. Remote bundle read rights can depend on a project using the bundle or Update Project permission for unused bundles. This does not change the ReadOnly CLI category or justify weakening errors under a restricted token.

## Implementation boundary

Only new bundle-values.ts, bundle-values-commands.ts and matching tests belong to this author. Lead appends three children to the existing single bundle root. Reuse existing native-fetch read, fields/page and encoded-ID helpers and shared CLI fixture. First implementation stays direct/readable; no enum/state edits, generated command table or helper trial before the coherent AR118 direct snapshot and separate approval.

## Official sources

- [Build bundles](https://www.jetbrains.com/help/youtrack/devportal/resource-api-admin-customFieldSettings-bundles-build.html)
- [Build bundle detail](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-customFieldSettings-bundles-build.html)
- [Build values](https://www.jetbrains.com/help/youtrack/devportal/resource-api-admin-customFieldSettings-bundles-build-bundleID-values.html)
- [Build value detail](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-customFieldSettings-bundles-build-bundleID-values.html)
- [Owned bundles](https://www.jetbrains.com/help/youtrack/devportal/resource-api-admin-customFieldSettings-bundles-ownedField.html)
- [Owned bundle detail](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-customFieldSettings-bundles-ownedField.html)
- [Owned values](https://www.jetbrains.com/help/youtrack/devportal/resource-api-admin-customFieldSettings-bundles-ownedField-bundleID-values.html)
- [Owned value detail](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-customFieldSettings-bundles-ownedField-bundleID-values.html)
- [Version bundles](https://www.jetbrains.com/help/youtrack/devportal/resource-api-admin-customFieldSettings-bundles-version.html)
- [Version bundle detail](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-customFieldSettings-bundles-version.html)
- [Version values](https://www.jetbrains.com/help/youtrack/devportal/resource-api-admin-customFieldSettings-bundles-version-bundleID-values.html)
- [Version value detail](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-customFieldSettings-bundles-version-bundleID-values.html)

