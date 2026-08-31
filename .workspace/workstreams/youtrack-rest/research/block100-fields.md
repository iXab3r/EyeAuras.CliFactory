# Block 100: global fields, enum bundles and state bundles

Research refreshed 2026-08-30 against official JetBrains pages and the frozen Issue 6 classification. Exactly eleven ReadOnly operations released by root after the independent block-100 scope audit. Direct implementation and offline tests are ready for coordinated compilation and review.

## Method, command and query contract

All rows are GET and explicitly ReadOnly. P means `--fields`, `--top`, `--skip`; D means `--fields` only. Each P invocation performs one request: top defaults to 50 and is limited to 1..100; skip defaults to 0 and is a nonnegative safe integer. These are the existing CLI limits, not claims about the server's general maximum. The API documents fields/$top/$skip for every collection below. No query, archive filter, name resolution, cursor, all-pages flag or implicit follow-up is offered.

| Exact method/path | Issue CLI mapping | Flags | Default projection key |
|---|---|---|---|
| GET /api/admin/customFieldSettings/customFields | `field list` | P | F |
| GET /api/admin/customFieldSettings/customFields/{fieldID} | `field get <field>` | D | F |
| GET /api/admin/customFieldSettings/types | `field type list` | P | T |
| GET /api/admin/customFieldSettings/bundles/enum | `bundle enum list` | P | B |
| GET /api/admin/customFieldSettings/bundles/enum/{bundleID} | `bundle enum get <bundle>` | D | B |
| GET /api/admin/customFieldSettings/bundles/enum/{bundleID}/values | `bundle enum value list <bundle>` | P | E |
| GET /api/admin/customFieldSettings/bundles/enum/{bundleID}/values/{elementID} | `bundle enum value get <bundle> <value>` | D | E |
| GET /api/admin/customFieldSettings/bundles/state | `bundle state list` | P | B |
| GET /api/admin/customFieldSettings/bundles/state/{bundleID} | `bundle state get <bundle>` | D | B |
| GET /api/admin/customFieldSettings/bundles/state/{bundleID}/values | `bundle state value list <bundle>` | P | S |
| GET /api/admin/customFieldSettings/bundles/state/{bundleID}/values/{elementID} | `bundle state value get <bundle> <value>` | D | S |

- F: `id,name,fieldType(id,presentation,valueType,isMultiValue),aliases`
- T: `id,presentation,valueType,isMultiValue`
- B: `id,name,isUpdateable`
- E: `id,name,localizedName,description,archived,ordinal`
- S: `id,name,localizedName,description,archived,ordinal,isResolved`

All detail identifiers are database IDs, treated as encoded opaque path segments; these pages do not promise name/short-name lookup. Collection responses remain arrays, detail responses objects, and explicit fields remain sparse service-shaped projections. Existing response/credential scrubbing and invalid-shape errors apply. A rejected request remains an error even under a limited-rights token.

## Semantics and documentation limits

CustomField aliases/localizedName may be null. Enum/state values permit null localizedName, description and bundle references. `archived` is a value property, not a documented list-filter parameter; preserve archived entries rather than silently filtering them. State `isResolved` describes resolution classification and does not enumerate workflow transition events. Bundle contents are deliberately absent from defaults: callers use the paginated value-list endpoint. No field instances, defaults, nested values or linked project collections are expanded automatically.

The FieldType attribute table lists only id, but its own collection method's concrete request/response example documents presentation, valueType and isMultiValue. The current custom-field concept guide independently describes cardinality via fieldType.isMultiValue. Bundle/base entity tables omit name, but both enum and state GET examples explicitly request and return it; default name is grounded in those operation examples. None of these eleven GET methods or selected default attributes has a newer-version availability annotation in the refreshed pages. This is current-reference evidence, not a promise that every older installation exposes every field. Preserve explicit projections and safe server errors rather than adding version guesses or compatibility routes.

Detail access is permission-dependent: a global field requires access through a project or administrative permission; bundle access depends on a field using it, while an unused bundle can require Update Project rights even for GET. This remote authorization requirement does not change the CLI operation's ReadOnly effect category.

## Source and helper plan

Own only new `field-catalog.ts`, `field-catalog-commands.ts` and matching tests. Reuse existing readObject/readCollection, fields/page, encodedID and CLI support. No Core change or generic HTTP/schema/endpoint API is needed. Enum and state have four matching shapes with distinct value projections; a small private helper with a closed enum/state choice may be evaluated against a readable direct example. No arbitrary runtime path, dynamic family registration or user-supplied route is allowed. Lead mounts one global field root and combines enum/state children into the single bundle root shared with the separate user-bundle author.

## Official sources

- [Global field list](https://www.jetbrains.com/help/youtrack/devportal/resource-api-admin-customFieldSettings-customFields.html)
- [Global field detail](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-customFieldSettings-customFields.html)
- [Field type list and concrete projection example](https://www.jetbrains.com/help/youtrack/devportal/resource-api-admin-customFieldSettings-types.html)
- [Custom-field type and cardinality concepts](https://www.jetbrains.com/help/youtrack/devportal/api-concept-custom-fields.html)
- [Enum bundle list](https://www.jetbrains.com/help/youtrack/devportal/resource-api-admin-customFieldSettings-bundles-enum.html)
- [Enum bundle detail](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-customFieldSettings-bundles-enum.html)
- [Enum value list](https://www.jetbrains.com/help/youtrack/devportal/resource-api-admin-customFieldSettings-bundles-enum-bundleID-values.html)
- [Enum value detail](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-customFieldSettings-bundles-enum-bundleID-values.html)
- [State bundle list](https://www.jetbrains.com/help/youtrack/devportal/resource-api-admin-customFieldSettings-bundles-state.html)
- [State bundle detail](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-customFieldSettings-bundles-state.html)
- [State value list](https://www.jetbrains.com/help/youtrack/devportal/resource-api-admin-customFieldSettings-bundles-state-bundleID-values.html)
- [State value detail](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-customFieldSettings-bundles-state-bundleID-values.html)

The enum-detail page timed out on direct open but was refreshed successfully through the official-domain search result containing its full method text. No live instance or credentials were used.


## Direct implementation evidence

The released eleven operations are implemented in the two owned catalog source files (243 nonblank TypeScript lines, including declarations and projection constants). Existing shared helpers are unchanged. The owned tests/support total 325 nonblank lines across the case inventory and two test files; existing shared CLI fixture costs remain part of the full milestone accounting.

After the lead's serial build, both explicit compiled suites passed: 30/30 tests (15 native-fetch contract tests, 15 actual CLI tests). Evidence covers all eleven routes, exact context-aware encoded IDs and query/projections, human/JSON binding, ReadOnly denial before fetch even with Update enabled, nullable/archived/sparse/empty results, invalid response shapes, bounded pages, rejected unsupported flags, sanitized HTTP failures and persistent RPC isolation across profiles. No real instance, secret store, shared build or other source file was modified by this domain author. Technical acceptance and the operation counter remain owned by the independent reviewer/root.
