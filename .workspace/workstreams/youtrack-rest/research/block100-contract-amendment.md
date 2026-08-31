# Block 51–100 — article and sprint CLI body restrictions

This later contract amendment defines the supported writable fields for the article and sprint
commands already in the v1 inventory. Earlier preparation and first-eight planning sections are
retained as decision history; current implementation status belongs to the linked workstream.
These are explicit CLI restrictions, not a claim to cover the complete REST entity schema. They
change no endpoint identity, priority, permission category, release count or published inventory row.

All six commands retain their published positional IDs and required inline `--body <json>`:

| Command | Supported body contract |
|---|---|
| `article create` | Required `project: {id: <nonempty string>}` and nonblank `summary`; optional `content` string or explicit `null`. |
| `article update <article>` | Nonempty subset of nonblank `summary` and `content` string or explicit `null`; unspecified fields stay omitted. |
| `article comment add <article>` | Required nonblank `text` string; preserve multiline text. |
| `article comment update <article> <comment>` | Required nonblank `text` string; preserve multiline text. |
| `sprint create <agile>` | Required nonblank single-line `name` without control characters; optional `goal` string or `null`, `start`/`finish` safe-integer UTC milliseconds or `null`, `archived`/`isDefault` booleans, and explicit `previousSprint: {id: <nonempty string>}`. |
| `sprint update <agile> <sprint>` | Nonempty subset of nonblank single-line `name` without control characters, `goal`, `start`, `finish`, `archived`, and `isDefault`, with the same value types as creation. `previousSprint` is not accepted on update. |

Preserve empty and multiline sprint goals; do not replace an omitted goal with an empty value.
`previousSprint` is a create-only explicit choice: it moves unresolved issues from that sprint.
Never infer it from the board or current sprint. Setting `isDefault: true` automatically adds new issues that match the board column to this sprint; it is an explicit side effect, not a cosmetic flag. The CLI does not expose sprint issue membership
writes in this block, and must not assume replacement semantics for an `issues` collection.

For articles, defer parent/visibility/reporter/stars/tags and nested-resource writes, draft helpers
(`draftId`) and mute options; the separately declared article-comment commands above remain in scope.
For sprints, defer issue-membership and mute options. Reject unsupported body fields locally rather
than silently dropping them. Article creation does not require an existing article ID from copied
subarticle prose in the reference; it uses the explicit project and summary above.

Reads and write-result projections support the documented `--fields` option. Existing contracts
remain binding: finite source-shaped defaults, credential-safe human/JSON/RPC output, empty successful
2xx bodies as `null`, pre-fetch Update gates, missing required `--body` or malformed JSON syntax rejected before onboarding, semantic body fields/types validated before fetch, profile
isolation, and no automatic mutation retry. No real-service mutation proof is authorized.

Deterministic acceptance includes each allowed/unsupported field, missing and empty required bodies,
multiline content/text/goal, omission versus explicit null, safe-integer date validation, boolean
validation and create-only previous-sprint behavior. Missing required `--body` and malformed JSON syntax must not reach onboarding or fetch; unsupported body fields/types/null values must fail before fetch. All six Update leaves must be denied before fetch when disabled; prior output/error/response
sanitization and no-retry tests remain mandatory. This amendment does not add service calls or aliases
to the accepted-operation counter.

Official references: [Article resource](https://www.jetbrains.com/help/youtrack/devportal/resource-api-articles.html),
[Article operations](https://www.jetbrains.com/help/youtrack/devportal/operations-api-articles.html),
[Sprint resource](https://www.jetbrains.com/help/youtrack/devportal/resource-api-agiles-agileID-sprints.html),
[Sprint operations](https://www.jetbrains.com/help/youtrack/devportal/operations-api-agiles-agileID-sprints.html).
