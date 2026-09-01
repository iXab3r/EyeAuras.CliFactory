# P4 residual-family review

Baseline: `c06efe9bcd27199776e6124122247e09685210d8`. Review target: the retained P1-P3
working tree. REST coverage remains TeamCity 449/449 and YouTrack 118/118 plus one derived
download; no operation identity was added or removed.

## Recount after the accepted trials

- TeamCity has 48 ordinary `#requestText` call sites. Four intentionally direct text media uses
  remain: batch JSON acceptance with a text request body, text-body/JSON-response decoding, a
  query-bearing commit-hook with exact 202 semantics, and a query-bearing backup start. The other
  `"text/plain"` occurrence is transport encoding. Extending the helper would make these policies
  less visible and would not remove a concept.
- TeamCity has 211 `#requestJson` call sites and 63 direct `#request` call sites, including the
  typed wrappers themselves. Fourteen calls opt into discard semantics. The direct calls are not
  one family: they include JSON/void mutations, explicit status checks, query-bearing actions,
  text/JSON crossings and response-discard safety.
- Twenty-six methods contain a direct `(value.<envelope> ?? []).map(...)` projection across 18
  envelope keys. Only `group` occurs three times; `build`, `role`, `property`, `investigation`,
  `project` and `mute` occur twice, and the other eleven keys occur once.

## Bounded candidate verdicts

| Candidate | Trial shape | Full-cost / simplicity result | Verdict |
|---|---|---|---|
| Dynamic JSON-list helper | `(path, query, envelopeKey, projector)` replacing three representative list methods | The pilot must add a helper plus four positional concepts before it saves a normally formatted caller. It converts typed response envelopes into string keys, while most projectors and envelopes are unique. Broader rollout would shorten methods but weaken local schema readability. | Reject; no prototype retained |
| Generic empty/acknowledgement helper | Move the 14 `discard` choices behind `requestEmpty` | These sites intentionally differ on accepted status, content type, query/body and whether a returned acknowledgement is verified. Hiding `discard` removes visible response policy and does not remove endpoint-specific decisions. | Reject; no prototype retained |
| Core option-bag inference | Generalize TeamCity `limit/start` and YouTrack `fields/top/skip/query` extraction | Names, defaults, numeric syntax, projection semantics and return types differ. A general picker would save local property checks while adding broad option inference, explicitly outside the workstream contract. | Reject; no prototype retained |
| Core connection/client binder | Lift TeamCity `clientLeaf` and YouTrack `connection(...)` into one API | TeamCity has guest/token modes and a class client; YouTrack has a token-only immutable connection. The common shape is only “run code after parsing”, which Core already supplies through command handlers. | Reject; no prototype retained |
| Split the TeamCity client by file size | Move methods without changing declarations or transport | This may improve navigation but does not reduce author code or concepts. It also creates cross-file private transport plumbing. | Defer as an independent maintainability task, not an authoring saving |

## P4 conclusion

P1-P3 exhausted the exact low-concept repetition in current scope. P4 retains no production or
Core change. That is the simplicity result: the next apparent savings require a dynamic schema,
hide endpoint policy, or merely redistribute lines. Those candidates may be reopened only with a
new concrete integration/operation slice and a direct-versus-candidate full-cost comparison.
