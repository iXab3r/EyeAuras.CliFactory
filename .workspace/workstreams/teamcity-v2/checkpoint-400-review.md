# TeamCity v2 — checkpoint +400 / S9 review

2026-08-30. **Pass, local working tree**: S9 adds50 (29 GET,21 mutations), total
**417/449 (92.87%)**, GET204/235 (86.81%), mutations213/214 (99.53%).32 remain.
[Contract](https://github.com/iXab3r/EyeAuras.CliFactory/issues/5#issuecomment-5468778016)
preceded production and was read back exactly. [Mapping](s9-coverage.csv) reconciles all50
independent compiled cases to the frozen census without duplicates. Not committed/pushed.

## Evidence and semantic corrections

All50 boundary tests initially failed; all now pass. Seven additional focused tests cover
every gate/help/error path, typed invalid input, XML/entity/media/stream bounds, partial
credential persistence, secret module input and sensitive URL errors, bulk-unmute preflight
identity/failure and persistent two-profile RPC. Full `npm test`: **536 passed (20+516)**.
After the source-confirmed root landing correction, affected57 tests passed again. Privacy
gate:133 files plus working/staged diffs,54 synthetic matches, zero unresolved findings.
No live mutation, profile/permission change, or new live-proof route.

Current public OpenAPI verified healthCategory (not category) as the collection key and
licensing/global-settings DTO names. Official RootApiRequest returns a relative /app/rest/server
link; parser and independent fixture now handle that concrete message, not an invented root list.
XML is the deliberately small attribute-only plugin projection, rejects DTD/entities/children,
and is not advertised as a general XML parser. Avatar multipart bytes are asserted, not a fake ACK.

Bulk DELETE uses full selected-ID preflight models, drops unknown fields, preserves original
scope/target/resolution and sends one native DELETE. Current schema/docs prove the Mutes input
and void response; old posted model proves full input validity, but current handler identity and
atomicity are **not live-verified**. Actual2xx returns acknowledgement plus false postcondition
verification, never an invented deletion count. Errors/retries/partial outcomes remain honest.

## Authoring review

Width100, nonblank handwritten TypeScript, all DTO/helper/security code included:

|Surface|+350|+400|Delta|
|---|---:|---:|---:|
|Core production|1742|1742|0|
|TeamCity production|7620|8890|+1270|
|Combined production|9362|10632|+1270|
|Core tests|832|832|0|
|TeamCity tests|7629|8584|+955|
|Local proof|344|344|0|

S9=25.40 production lines/route; cumulative7801/400=19.50. Different secret/file/XML semantics
explain cost; no invalid productivity percentage. The fixed same-capability detail/list/mutation
direct-versus-bound samples remain6/15/13 versus6/12/7. All new ordinary leaves still use
`clientLeaf`; exceptional context.secrets handlers remain explicit ordinary commands.

Actual reuse is concrete: role relation methods share typed included/permission handling;
dashboard and nested instances share validated IDs; safe collection projection includes the
local1000-item bound; alias preflight/persistence handles one-time pool tokens without duplicating
auth-store code. Wire transport supports real FormData, rejects redirects and bounds text/JSON
at2MiB; no universal HTTP registry or generic user method/path/body escape hatch. Existing trees
accept ordinary child declarations to compose new avatar/pool/mute leaves, with no merging DSL.
Core still has no TeamCity nouns or new APIs. No second real consumer justifies promoting these
service mechanisms into Core. JSON/help/RPC/profile/gate infrastructure remains reusable unchanged.

Main agent completed technical/reconciliation review; research agent supplied primary-source
evidence only. Gate closed; proceed to final32 and final shorter-batch review.
