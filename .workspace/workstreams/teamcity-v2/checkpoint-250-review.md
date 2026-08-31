# TeamCity v2 — checkpoint +250 / S6 review

Date: 2026-08-30. Verdict: **pass, local working tree**. S6 adds 50 routes (28 GET,
22 Update) for **267/449 (59.47%)**, GET 128/235, Update 139/214; 182 remain.
Authority: [S6 contract and previous checkpoint](https://github.com/iXab3r/EyeAuras.CliFactory/issues/5#issuecomment-5468511277).
All [50 mappings](s6-coverage.csv) reconcile one-to-one with compiled exact cases and the frozen
census; no overlaps. Main agent performed technical/reconciliation review; research agent supplied
primary-source evidence only. No commit/push, real Update, permission grant or profile change.

## Evidence and corrections

All 50 boundary cases failed before implementation; the shared 250-case harness now passes.
Full `npm test`: **357 passed (20 Core, 337 TeamCity)**, no skips/failures. Eight additional
tests cover all gates, bounded/duplicate identities, strict typed input, long IDs, stateful mutes,
investigation replacement identity, partial failures, secret-body disposal and two-profile RPC.
Safety tests first caught duplicate investigation targets, empty status-result success and unsafe
numeric identity projections; all corrected and verified. The fixed ReadOnly proof last passed
19/19 after S5; S6 administrative/unpaged/mutation routes are mock-only.

Mixed text-body/JSON-response endpoints now set Accept independently from Content-Type inside the
existing transport. The initial await-cancel implementation deadlocked on a mock tee stream;
scalar existence probes now drain at most 64 KiB before canceling the rest without awaiting another
consumer. An unending-stream test verifies bounded pulls/cancellation. No private bytes are decoded,
hashed, saved or returned. Error bodies are canceled, never echoed. Partial build failures retain
counts and IDs; malformed counts or absent status outcomes are not called success.

Investigation replacement uses one typed target for locator and payload and documents non-atomic
server delete/create. Bulk mutations take explicit bounded IDs. Label creation requires one VCS
root instance and returns individual statuses. No hidden reads/retries, raw REST passthrough,
parameter-value output or unverified bulk-unmute payload was added.

## Authoring/simplicity review

Same counting rule: nonblank handwritten TypeScript with comments, width-100 formatting, all
helpers/DTOs included, generated files excluded.

| Surface | At +200 | At +250 | Delta |
|---|---:|---:|---:|
| Core production | 1742 | 1742 | 0 |
| TeamCity production | 4497 | 5556 | +1059 |
| Combined production | 6239 | 7298 | +1059 |
| Core tests | 832 | 832 | 0 |
| TeamCity tests | 4977 | 5800 | +823 |
| Local proof | 344 | 344 | 0 |

S6 costs **21.18 production lines/route**, cumulative +4467/250 = 17.87. Higher batch cost includes
typed triage validation and partial-failure/security semantics; different mixes are not a
productivity percentage. New triage commands/models cost 350/258 lines; support is 79 total.

Equivalent declaration shapes still use the existing bound client, without rendering boilerplate:

```diff
- async ({ args }, context) => (await client(context)).getMute(num(args, "id"))
+ (c, { args }) => c.getMute(num(args, "id"))
- async ({ options }, context) => (await client(context)).listMutes(page(options))
+ (c, { options }) => c.listMutes(page(options))
- async ({ options }, context) => (await client(context)).createMute(options.item)
+ (c, { options }) => c.createMute(options.item)
```

The earlier measured equivalent detail/list/mutation shapes (6/15/13 versus 6/12/7 lines) remain
the baseline; no new reduction is claimed from this illustrative diff. Ordinary named client
methods still own each service contract. Existing one-tree help/output/RPC/gates remain unchanged.

Actual simplification: typed JSON option parsing is shared by S5 collections and S6 triage, while
family validation stays explicit. One mixed-media helper removes repeated decode/request glue.
Minimal scalar projection validates fields and long numeric IDs, with nested triage projection
still explicit; it is not an arbitrary output schema or transport registry. The shared boundary
harness grew by data cases, not 50 new wrappers. Core gains no service-specific concept or new
dependency; no real second integration justifies promotion. Retain direct methods despite their
navigation cost rather than add a generated endpoint engine. Review gate is closed; S7 may proceed.
