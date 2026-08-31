# Final v1 contract clarification — article results, downloads and authentication

This later amendment clarifies the existing final-v1 behavior and supersedes broader earlier wording
where stated below. Earlier preparation/implementation decisions and all 281 inventory rows remain
unchanged. No endpoint priority, permission, release count, public API or derived-operation count is
added by these clarifications. Implementation acceptance still requires independent tests/review.

## Article parent and upload results

`article parent get <article>` may return JSON `null` only when the successful response explicitly
contains JSON null. This is an explicit CLI handling policy, not a guarantee that every YouTrack
version returns null for a root article. Never turn 403, 404, an empty body, malformed JSON or another
failure into absence. Other documented successful objects retain normal validation and redaction.

`article attachment upload <article> --file <path>` supports documented write-result `--fields`
with finite defaults, the same explicit-file/Update gate and signed-URL output scrubbing as existing
attachment commands. This already-inventoried attachment upload remains in scope and supersedes the earlier block100 shorthand deferring nested-resource writes; it adds no endpoint. Article binary download and broader optional write payloads remain deferred.

## Signed download URL and file publication

The existing issue-download command accepts either documented signature form under the configured
context-relative `/api/files/` path: `/context/api/files/<fileID>?sign=...` or
`/context/api/files/<fileID>/sign=...`, where `/context` represents the actual configured context and
may be empty. The returned fileID can differ from the attachment entity ID. Require the metadata
object's `id` to match the requested attachmentID exactly; do not substitute the fileID for it.

Treat the signature as opaque secret material. Its encoded content may include CR/LF or slash
characters; this does not authorize an origin/context/path escape or signature disclosure. Validate
the actual URL structure without treating an encoded signature as an identifier. The same-origin,
configured-context, HTTPS/loopback, no-Authorization-on-binary-request and no-redirect policies remain
binding. Fetch only the exact metadata-returned URL; no arbitrary URL option or external/CDN fallback.

Reject existing symlinks/junctions along the managed download path. Create a private profile-owned
temporary file and publish the completed file using an exclusive hard link, never an overwrite or
an overwrite-capable rename fallback. Fail closed if the required hard-link operation is unsupported;
clean temporary/partial data on failure. Existing name/path/byte-limit/projection-redaction rules and
profile AppData ownership remain binding. Portable Node filesystem APIs cannot guarantee protection
against a malicious process running as the same OS user that swaps ancestor directories between
checks and operations. This explicit threat-model limit is not a promise of race-free isolation from
that same-user attacker; no stronger filesystem guarantee is claimed.

## Core configure/login candidate and persistence policy

For token-authenticated `profile configure`, first validate the profile name and candidate config.
Choose a new token candidate in this order: explicit `--token-stdin`, integration token environment
variable, then a masked prompt only in an ordinary fully interactive rendered invocation. Never use
a stored token as a configure/login candidate. Missing candidates and candidate/config validation
failures change neither the existing config nor its credential. Validate the new candidate against
the candidate config before any persistent change.

Prompting requires ordinary rendered execution without `--json` and TTY stdin, stdout and stderr.
JSON, JSON-RPC, programmatic/render-false execution and redirected input or output never prompt.
Explicit `--token-stdin` is unavailable inside JSON-RPC/programmatic execution because that transport
owns stdin; an explicit rendered CLI stdin flow remains available. Existing secret redaction and
profile-specific credential identity remain mandatory.

After successful configure authentication validation, remove that profile's previous credential,
then persist the candidate config, then persist the validated credential. If credential removal
fails, do not change config. A later persistence failure may leave an unauthenticated profile and
must provide actionable login/reconfigure guidance. Do not roll back in a way that pairs the old
credential with a new endpoint. This is a fail-closed ordering across config and keyring stores,
not a claim that those stores form an atomic transaction.

`auth login` validates a new candidate against the current config before replacing its credential;
it does not change the endpoint. Preserve no-auth integrations and TeamCity guest configuration:
they require neither token nor keyring access, while guest auth login remains rejected. Ordinary
`profile set` remains a non-auth lifecycle operation and is not covered by this configure transaction
policy. Reusing internal profile-name validation does not introduce a new public Core API.

## Required deterministic evidence

Test explicit article-parent null separately from empty/malformed/error responses; upload default
and explicit projections; both signed-URL forms including opaque encoded signature characters,
metadata-ID binding, origin/context/redirect/header checks, existing link/junction rejection,
exclusive publication and unsupported-link failure/cleanup. Keep real signatures and private service data
out of normal outputs, failures, logs and fixtures; tests use clearly synthetic values.

Auth tests must prove candidate precedence, no stored fallback, every noninteractive prompt guard,
config/candidate validation before persistence, credential-removal failure preserving config, later
persistence failure leaving no old-token/new-endpoint combination, profile isolation and unchanged
no-auth/TeamCity guest behavior. Existing CLI/RPC/output and full-suite gates remain required. These
are implementation contracts; the amendment alone accepts no operation or auth lifecycle path.
