# Block 100 independent field-catalog and time-settings review

Reviewer: inventory_reviewer/fields_time_review. Date: 2026-08-30.

**B100.1: PASS, eleven exact ReadOnly operations. B100.4: PASS, seven exact ReadOnly operations.** No blocking technical finding remains in the reviewed source and boundary evidence. These verdicts do not advance counters directly or satisfy the separate AR100 authoring checkpoint.

Source authority: Issue #6, block-100.json, classification.json and the two domain research notes. Independent manifest reconciliation found eighteen unique rows, every row P1/ReadOnly with the exact census CLI mapping, no accepted-baseline duplicate and zero mismatch. Source and actual mounted command tree expose these same identities:

| Group | Exact operation | CLI | Category |
|---|---|---|---|
| B100.1 | `GET /api/admin/customFieldSettings/bundles/enum` | `bundle enum list` | ReadOnly |
| B100.1 | `GET /api/admin/customFieldSettings/bundles/enum/{bundleID}` | `bundle enum get <bundle>` | ReadOnly |
| B100.1 | `GET /api/admin/customFieldSettings/bundles/enum/{bundleID}/values` | `bundle enum value list <bundle>` | ReadOnly |
| B100.1 | `GET /api/admin/customFieldSettings/bundles/enum/{bundleID}/values/{elementID}` | `bundle enum value get <bundle> <value>` | ReadOnly |
| B100.1 | `GET /api/admin/customFieldSettings/bundles/state` | `bundle state list` | ReadOnly |
| B100.1 | `GET /api/admin/customFieldSettings/bundles/state/{bundleID}` | `bundle state get <bundle>` | ReadOnly |
| B100.1 | `GET /api/admin/customFieldSettings/bundles/state/{bundleID}/values` | `bundle state value list <bundle>` | ReadOnly |
| B100.1 | `GET /api/admin/customFieldSettings/bundles/state/{bundleID}/values/{elementID}` | `bundle state value get <bundle> <value>` | ReadOnly |
| B100.1 | `GET /api/admin/customFieldSettings/customFields` | `field list` | ReadOnly |
| B100.1 | `GET /api/admin/customFieldSettings/customFields/{fieldID}` | `field get <field>` | ReadOnly |
| B100.1 | `GET /api/admin/customFieldSettings/types` | `field type list` | ReadOnly |
| B100.4 | `GET /api/admin/projects/{projectID}/timeTrackingSettings` | `project time-tracking get <project>` | ReadOnly |
| B100.4 | `GET /api/admin/projects/{projectID}/timeTrackingSettings/workItemTypes` | `project work-item-type list <project>` | ReadOnly |
| B100.4 | `GET /api/admin/projects/{projectID}/timeTrackingSettings/workItemTypes/{typeID}` | `project work-item-type get <project> <type>` | ReadOnly |
| B100.4 | `GET /api/admin/timeTrackingSettings` | `time-tracking settings get` | ReadOnly |
| B100.4 | `GET /api/admin/timeTrackingSettings/workItemTypes` | `work-item-type list` | ReadOnly |
| B100.4 | `GET /api/admin/timeTrackingSettings/workItemTypes/{typeID}` | `work-item-type get <type>` | ReadOnly |
| B100.4 | `GET /api/admin/timeTrackingSettings/workTimeSettings` | `time-tracking work-time get` | ReadOnly |
## Technical review

All eleven field-catalog endpoints use explicit functions and recursive command declarations. IDs are encoded once as opaque path segments under the profile's context; dot segments, controls and invalid Unicode fail locally. Six documented collections use one offset page, top50/skip0 defaults and top1..100. Five details expose only projection. No implicit name resolution, archived filtering, field-instance traversal, embedded bundle-value default expansion or cursor/full-scan option was added. The state isResolved flag is returned as data, not mistaken for a workflow transition inventory.

Independent official checks confirmed that [field types](https://www.jetbrains.com/help/youtrack/devportal/resource-api-admin-customFieldSettings-types.html) explicitly support top/skip, despite their small finite catalog. The method's request/response sample supports presentation/valueType/isMultiValue even though its attribute table is abbreviated. [Global field documentation](https://www.jetbrains.com/help/youtrack/devportal/resource-api-admin-customFieldSettings-customFields.html) supports the selected fields and nullable aliases. [Enum bundles](https://www.jetbrains.com/help/youtrack/devportal/resource-api-admin-customFieldSettings-bundles-enum.html) and [state bundle detail](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-customFieldSettings-bundles-state.html) explicitly request and return name in examples; that discrepancy with abbreviated entity tables is recorded rather than hidden. [State value documentation](https://www.jetbrains.com/help/youtrack/devportal/resource-api-admin-customFieldSettings-bundles-state-bundleID-values.html) supports the finite value projection, nullable metadata, archive property and resolution flag.

The seven time-settings reads use the exact settings/type routes. Only the two work-item-type collections paginate; five details/settings leaves expose projection without paging or search. Finite project estimate/timeSpent identities and workTimeSettings objects are returned without requesting nested type or attribute collections. Server schedule values and null project settings remain unchanged; no local schedule or default type is synthesized. Work-item type metadata uses id/name/autoAttached and excludes sample-only url. WorkTimeSettings uses firstDayOfWeek from its attribute table, not the misspelled sample field. These decisions were independently checked against [project settings](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-projects-projectID-timeTrackingSettings.html), [project type collection](https://www.jetbrains.com/help/youtrack/devportal/resource-api-admin-projects-projectID-timeTrackingSettings-workItemTypes.html), [global type collection](https://www.jetbrains.com/help/youtrack/devportal/resource-api-admin-timeTrackingSettings-workItemTypes.html), [global settings](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-timeTrackingSettings.html), and [work schedule](https://www.jetbrains.com/help/youtrack/devportal/operations-api-admin-timeTrackingSettings-workTimeSettings.html).

All eighteen leaves explicitly require ReadOnly before fetch; enabling Update does not grant ReadOnly. A remote administrative permission requirement does not reclassify their effects or make denial a success. HTTP failures remain sanitized errors and do not retry. Response envelopes, empty pages, oversized pages, sparse projections, nullable values and nested credential-URL/bearer scrubbing are covered at native fetch. Actual CLI tests execute every exact command in human and JSON modes. Persistent RPC exercises profile URL/token/AppData separation, denied operations, safe remote failure and later successful requests. Unsupported filters/detail paging fail locally. No Core or shared-client change was introduced for these domains.

## Independently executed evidence

After the lead's fresh serial integration build, the reviewer explicitly checked that all three normal compiled test files exist, then ran:

```text
node --test integrations/youtrack/dist/tests/field-catalog.test.js integrations/youtrack/dist/tests/field-catalog-cli.test.js integrations/youtrack/dist/tests/time-settings.test.js
```

**38/38 PASS, exit 0:** field catalog fifteen direct tests plus fifteen actual CLI tests; time settings eight tests covering all seven routes at both client and actual CLI boundaries. Test counts alone were not used for acceptance: source paths, method/query projections, all leaf declarations and test row inventories were read and reconciled.

Reviewed SHA256 values after this run:

| File | SHA256 |
|---|---|
| `integrations/youtrack/src/field-catalog.ts` | AA963519E2D3C32A1B3A05A7EC19F157416B8067207210A074218C188F7C890D |
| `integrations/youtrack/src/field-catalog-commands.ts` | 75DEE1F2593A8E666CEDDF0903DD6DFAFCE146D0B2C86207E74F2D7CB0933CE1 |
| `integrations/youtrack/tests/field-catalog-cases.ts` | 2C9652309FCC598225706DC191473BF56FCFEF53DE4E9D532A918913D8D4D02E |
| `integrations/youtrack/tests/field-catalog.test.ts` | F1EEC9E9DDBC4D7912CFEDD82DA965BF4E2E7925B4D3AEF7E9CB9EEB139789C0 |
| `integrations/youtrack/tests/field-catalog-cli.test.ts` | DC272737A06EFEDA17D68CB47A06EDC55982EEC3B6FE829750E3B68C13ABC360 |
| `integrations/youtrack/src/time-settings.ts` | 1CAF11290C8F322AD924535E7A1A3C643D1174E59DF1DD0E695423A5BA7736A9 |
| `integrations/youtrack/src/time-settings-commands.ts` | 1C9E7A282DD45F4B359413062E38484D9536225A19EFF9A2B0CE8C4354C98DCF |
| `integrations/youtrack/tests/time-settings.test.ts` | 7E5F9E9AA4FE3017E032815552D6F0553B9CB5AEEDE7F3B4586D8171B8C3824C |
| `integrations/youtrack/src/client.ts` | 14450CD5A9896935CFB352373AEE1F10C6946CC77DF5B773B320DA0F62E233F7 |
| `integrations/youtrack/src/cli.ts` | 2334577846144086C6E4AA23738772DC2FDB2DA1D88B9C96688FFC1F59F104E3 |
| `integrations/youtrack/src/cli-support.ts` | 14013884F0F830CE78C460CC4B5E0A792EBB2363AE7C07DADC6F9979D99B9C35 |
The reviewer changed only this management record. No production edits, source builds, profile/credential reads, live service calls, commits or remote publication were performed. Root owns any bounded ReadOnly live proof. Repository-wide verification, remaining B100 groups, counters and AR100 are separate gates; operation 101 is not authorized by this review.
