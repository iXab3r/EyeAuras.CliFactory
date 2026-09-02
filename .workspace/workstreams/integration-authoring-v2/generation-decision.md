# P5 service-local generation decision

> **Reconciled after owner review:** the rejection of generated source and a service-neutral
> HTTP/CRUD schema still stands. Its claim that the existing corpus had no useful declarative
> family does not: P8 retained two small hand-written YouTrack-local vocabularies for 102 command
> leaves and 85 ordinary read resources. They execute directly and keep exceptional policy in
> normal code; there is no generated output or hidden schema.

**Decision: reject a production generator for the current TeamCity/YouTrack corpus.** Revisit at
the authoring checkpoint of a future operation batch, not as a migration of already complete APIs.

## Evidence counted

- TeamCity's frozen census contains method, path, operation ID, deprecation and broad accounting
  category for 449 identities. It does not encode the chosen CLI tree, typed inputs, safe request
  body, locator rules, response media/status policy, bounded projection, redaction or verified
  acknowledgement semantics.
- YouTrack's discovery records contain method, path, query template and public source. The accepted
  118-operation scope adds human priority/mapping decisions elsewhere, while production owns
  fields projections, sparse response handling, mutation schemas, uploads/downloads and
  sanitization in operation-shaped modules.
- The services disagree on transport and envelopes: TeamCity mixes JSON, text, XML/native files,
  void/discard and exact-status operations; YouTrack uses scrubbed JSON plus explicit multipart and
  derived binary download boundaries. Their command/profile auth shapes also differ.
- Independent contract tests cannot consume the production descriptor as their expected route,
  method, query, body or permission source. A generator therefore cannot claim the current
  tests/support corpus as deleted authoring cost.

## Full-cost result

A useful descriptor would need, per nontrivial operation, command placement/syntax, permission,
options/parsers, method/path/query, typed body builder, accepted response policy, projection,
sanitizer and overrides. It would duplicate or relocate the decisions now visible in production;
generator implementation, schema validation, emitted output and independent tests would be added
cost. The current inventories are research evidence, not that descriptor, and generated line
count is not a saving under the repository metric.

The expanded retained changes still avoid a generator: Core binds only an invocation-owned target,
while YouTrack's local helpers describe four proven command shapes and two proven read-resource
shapes. Paths, projections and ID encoding remain beside the service code and direct exceptions
remain ordinary functions. This achieves the current-corpus saving without emitted files or a
universal endpoint schema.

## Reopen trigger

Reconsider a **service-local** generator only when a new planned batch has at least 25 operations
whose normally formatted direct implementations share the same command/input, request and response
shape, and fewer than 20% require overrides. Before production use, compare one coherent direct
slice with a generated slice and count descriptor, generator, emitted code, overrides, exports and
independent tests. Accept only if total handwritten code and required concepts fall while typed
inputs, explicit gates, generated help, sanitization and independently-authored HTTP contracts stay
equivalent. A service-neutral generator or universal HTTP/CRUD schema remains out of scope.
