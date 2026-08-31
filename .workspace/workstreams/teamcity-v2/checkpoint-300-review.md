# TeamCity v2 — checkpoint +300 / S7 review

Date: 2026-08-30. Verdict: **pass, local working tree**. S7 adds 50 routes (23 GET,
27 mutations), for **317/449 (70.60%)**: GET151/235 (64.26%), mutations166/214 (77.57%).
132 remain. [S7 contract](https://github.com/iXab3r/EyeAuras.CliFactory/issues/5#issuecomment-5468584039)
preceded production; [mapping](s7-coverage.csv) reconciles one-to-one with compiled cases and
frozen census, without overlap. No commit/push, real mutation or local permission/profile change.

## Evidence

All 50 exact boundary cases failed first, then passed. Full `npm test`: **419 passed
(20 Core, 399 TeamCity)**, no failures/skips. Twelve additional tests cover all gates,
explicit token rights/expiry, alias conflict/ownership, secure-store failure before and after
remote creation/revocation, malformed one-time replies, nonsecret projections, direct replacement,
long IDs and persistent two-profile RPC. Packaged permission output now explicitly verifies that
Admin and Credentials default off. Ordinary Update grants neither category.

The fixed current-user profile/keyring ReadOnly proof passed **19/19** again after transport/gate
changes. No new live route was added; account/token/node mutations remain mock-only.
All three current execution comments were fetched and matched the reviewed drafts exactly.
Privacy scan over 118 files plus working/staged diffs had zero unresolved findings and 46
synthetic matches. A regex false positive on the nonsecret issued-token key prefix was corrected;
no production data was hidden or credential allowlist expanded. Re-run the gate before publication.

## Authoring and simplicity

Same nonblank handwritten TypeScript/width-100 counting, with all helper/DTO/security code included:

| Surface | At +250 | At +300 | Delta |
|---|---:|---:|---:|
| Core production | 1742 | 1742 | 0 |
| TeamCity production | 5556 | 6440 | +884 |
| Combined production | 7298 | 8182 | +884 |
| Core tests | 832 | 832 | 0 |
| TeamCity tests | 5800 | 6595 | +795 |
| Local proof | 344 | 344 | 0 |

S7 costs **17.68 production lines/route**, cumulative +5351/300 =17.84. Different endpoint mixes
are not a productivity percentage. The same measured direct/bound detail-list-mutation examples
remain 6/15/13 versus 6/12/7 lines; a new ordinary leaf has the same call path:

```diff
- async ({args}, context) => (await client(context)).getAccountGroup(text(args, "key"))
+ (c, {args}) => c.getAccountGroup(text(args, "key"))
- async (_, context) => (await client(context)).listAccountGroupsAll()
+ c => c.listAccountGroupsAll()
- async ({args}, context) => (await client(context)).deleteAccountGroup(text(args, "key"))
+ (c, {args}) => c.deleteAccountGroup(text(args, "key"))
```

Actual reuse: user/group role, property and membership trees share concrete contract families;
role-at-scope still explicitly uses user PUT versus group POST. Scope validation now serves both
role assignments and token restrictions without pretending a permission restriction is a role.
Group locators are explicit, not recovered by slicing a constructed resource path. Shared typed
JSON parsing and the independent boundary harness support this batch unchanged except custom gate
expectations. No generic HTTP registry, generator, dynamic service method dispatch or Core concept.

Token issuance deliberately uses the ordinary command handler with context.secrets: adding a new
Core binding abstraction for two handlers would cost more than the explicit code. The existing
custom permission mechanism and injected store are reusable by every integration. TeamCity paths,
scope strings, token lifecycle and projections remain local. No second real integration justifies
promoting them into Core.

Review corrections: sanitize both fetch and response-stream failures (including discard streams),
separate optional expiry metadata from explicit null, validate future parsed timestamps, and make
group-parent help distinct from All Users membership semantics. Tests first caught the network
error leak and now cover it. Token aliases fail closed before HTTP; this is not a cross-process
atomic reservation. Remote issuance/storage and revocation/cleanup remain explicitly non-atomic.
Local forget does not revoke remotely or remove the auth token; cleanup is documented, not inferred.

Main agent performed technical and reconciliation review. Research agent provided official-source
evidence, not an independent implementation review. Gate closed; proceed to S8 under owner mandate.
