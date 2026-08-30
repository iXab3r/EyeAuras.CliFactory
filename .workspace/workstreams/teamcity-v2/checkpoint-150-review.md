# TeamCity v2 — checkpoint +150 / S4 review

Date: 2026-08-30. Branch: feature/teamcity-v2. Verdict: **pass, local working tree**.
S4 adds 50 routes (28 ReadOnly, 22 Update), following the completed +100 review, for
**167/449 (37.19%)** total: 86/235 GET (36.60%), 81/214 Update (37.85%); 282 remain.
S3+S4 deliver exactly 100 new routes (54 reads, 46 updates) above the previous 67-route local state.
The v2 counter is +150 above its 17-route baseline, not 150 new routes in this delivery.
No code commit/push, real Update call, permission grant or profile reconfiguration occurred.

Authority: [100-route contract](https://github.com/iXab3r/EyeAuras.CliFactory/issues/5#issuecomment-5468205768),
[source corrections](https://github.com/iXab3r/EyeAuras.CliFactory/issues/5#issuecomment-5468269661),
and [s4-coverage.csv](s4-coverage.csv). Each row matches a distinct frozen census identity and one
compiled mock case by method/path and CLI prefix; no overlap with baseline or S1/S2/S3. Alias flags,
additional tests and the pre-existing global changes route do not advance the counter.

## Correctness evidence

- All 50 S4 exact contract cases failed before production implementation, then passed. The shared
  150-row harness checks CLI parsing, permission denial before HTTP, media type, query/body/result,
  no retries/hidden reads and safe remote errors. Expected field selectors live in independent fixtures.
- Ten additional S4 tests cover all denied gates, input/field/secret checks, false/empty replacements,
  projection of unknown nested data, empty/optional/malformed responses, successful ACK-body discard,
  numeric precision, two-profile JSON-RPC, a 15-command stateful mock workflow and unauthenticated help.
- Full `npm test`: **241 passed (20 Core, 221 TeamCity), zero failures/skips** after review corrections.
- Fixed packaged-CLI proof through the existing current-user profile/keyring: **19 passed, 0 skipped,
  0 failed**, both before the large slice and after S4. No new live routes or raw evidence artifacts.
  This proves shared authentication/ReadOnly execution still works; it does not live-verify new mutations.
- Built version, pool help, nested rule replacement help and agent-policy help verified; required
  options and Update hints remain generated. No profile/keyring is required just to display help.

Official JetBrains source established the concrete contracts, especially agent fields (never
authToken; only enabled/authorized writable), incompatible-job Compatibilities, nullable reads,
BooleanStatus bodies, queue position 1/first/last, and public tag defaults. The
[TagFinder](https://github.com/JetBrains/teamcity-rest/blob/master/rest-api/src/jetbrains/buildServer/server/rest/data/build/TagFinder.java)
default is private:false. The
[BuildRequest](https://github.com/JetBrains/teamcity-rest/blob/master/rest-api/src/jetbrains/buildServer/server/rest/request/BuildRequest.java)
implementation can return Tags after POST: the initial scope note's assumption of an empty response
is not a requirement on the server. Our declared add acknowledgement discards successful bodies;
both empty and nonempty replies are tested. There is no extra legacy/version-specific execution path.

## Authoring and simplicity review

Counting: nonblank handwritten TypeScript including comments, normal width-100 formatting, all
helper/validation/DTO files included; generated output excluded. Paths and baseline commit are in
[authoring-baseline.md](authoring-baseline.md). No dependency/formatter was added to package manifests.

| Surface | At +100 | At +150 | S4 delta |
|---|---:|---:|---:|
| Core production | 1742 | 1742 | 0 |
| TeamCity production | 2867 | 3730 | +863 |
| **Combined production** | **4609** | **5472** | **+863** |
| Core tests | 832 | 832 | 0 |
| TeamCity tests/fixtures | 3438 | 4242 | +804 |
| Local proof | 344 | 344 | 0 |

S4: **17.26 production lines/new route**. Combined S3+S4: +1559/100 = **15.59**.
Full v2 from 1d36395833101c920f74ecdf2749ef2f2f6a0575: +2641/150 = 17.61.
These mixes differ, so lower batch cost is not an equivalent-behavior productivity percentage.
At +150, TeamCity production file counts: client 1531, cli 456, authoring-commands 432,
advanced-authoring-commands 305, operator-commands 357, command-support 51, authoring-models 201,
advanced-authoring-models 59, operator-models 101, models 126, locator 62, index 46, bin 3.

The equivalent detail/list/mutation comparisons from [S1 review](s1-review.md) remain valid:
direct declarations 6/15/13 lines versus bound leaves 6/12/7, with setup separately included.
New S4 examples use the same transparent shape (illustrative diff, not minified measurement):

```diff
- async ({ args }, context) => (await client(context)).getPool(number(args, "pool-id"))
+ (c, { args }) => c.getPool(number(args, "pool-id"))
- async ({ options }, context) => (await client(context)).listPools(paging(options))
+ (c, { options }) => c.listPools(paging(options))
- async ({ options }, context) => (await client(context)).createPool(text(options, "name"))
+ (c, { options }) => c.createPool(text(options, "name"))
```

Permission, options and description stay explicit in each leaf; the single 51-line shared
command-support module acquires the active-profile client. Handlers still return values; no
renderers or alternate RPC/gate routing are introduced. Call path is declaration → bound client
→ named TeamCity method → existing request/fetch, unchanged from S3.

Actual reuse: the existing boundary harness accepts 50 more independent case records without 50
new test wrappers; repeatable tags/jobs share one parser; agent enabled/authorized share a concrete
two-leaf tree; build number/statusText share one scalar tree; build/queue tags share their actual
contracts but preserve the queue's lack of PUT. BooleanStatus/comment bodies and safe projections
are shared for real endpoint families. No schema/CRUD descriptor or dynamic method dispatch.

Review corrections: moved safe JSON decoding beside the client transport, removing an operator-model
dependency for unrelated requests; separated raw AgentPolicy buildTypes from the public `{policy,jobs}`
type so exported types match actual results. These improve API clarity, not the line metric: the
combined total changed 5469→5472 (+3). An additional test proves ACKs discard optional response data.
S3's rejected property-helper experiment remains rejected; no speculative shared layer was added.

Core production did not change in either half. Other CLIs continue to reuse the existing tree,
required options, profiles, keyring, gates, rendering and RPC. No second real integration justified
promoting TeamCity HTTP/DTO/locator rules into Core. Adding another framework concept to optimize
this one adapter would violate the promotion rule. The large client is a navigation cost, but its
methods are direct and operation-shaped; no generator, DI container or universal HTTP framework.

Main agent performed the technical and reconciliation review; no independent subagent is claimed.
No required correction remains before the next batch. Do not start +151 automatically: first agree
the next exact slice in Issue #5. Its next mandatory authoring checkpoint is +200 (217 total routes).
