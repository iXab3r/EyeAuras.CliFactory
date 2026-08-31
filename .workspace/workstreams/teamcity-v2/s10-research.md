# S10 file, image, server-path, and secure-value API research

Research date: 2026-08-30. Final proposed 32-route slice for
[Issue #5](https://github.com/iXab3r/EyeAuras.CliFactory/issues/5), after S9's exact 50.
These are contract notes, not accepted coverage. No real credentials/profiles, server content,
live mutations, Git, or GitHub state were touched.

## Census and primary sources

Exactly **32 frozen routes: 31 GET / ReadOnly and 1 POST / Update**.
Together S9+S10 exhaust the 82 routes left after baseline, S1-S7, and planned S8.
All binary routes require a useful file-transfer result; none is satisfied by an ACK or omitted
response bytes. Secret routes require a useful persisted credential reference, never printed bytes.

- [Current official public OpenAPI](https://teamcity.jetbrains.com/guestAuth/app/rest/swagger.json),
  retrieved anonymously with Accept: application/json; info.version = 2026.1 (current).
- [Files](https://www.jetbrains.com/help/teamcity/rest/files.html) and linked File model,
  [secure tokens documentation](https://www.jetbrains.com/help/teamcity/storing-project-settings-in-version-control.html#Managing+Tokens).
- Official source pinned at
  [fc730e618ccd4b57dbbaf03425bb79a9580d19d2](https://github.com/JetBrains/teamcity-rest/tree/fc730e618ccd4b57dbbaf03425bb79a9580d19d2):
  [FilesSubResource](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/request/FilesSubResource.java),
  [BuildArtifactsFinder](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/data/finder/impl/BuildArtifactsFinder.java),
  [BuildRequest](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/request/BuildRequest.java),
  [BuildTypeRequest](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/request/BuildTypeRequest.java),
  [ProjectRequest](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/request/ProjectRequest.java),
  [ServerRequest](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/request/ServerRequest.java),
  [VcsRootRequest](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/request/VcsRootRequest.java),
  [AvatarRequest](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/request/AvatarRequest.java).

Current schema wins for route/query names; older source clarifies semantics and is not a license
to assume missing newer features. Native transport/media remain integration-owned; a small bounded
file sink can be shared only if it genuinely stays service-neutral. Do not add a universal REST
passthrough, remote-path interpreter, or generic arbitrary server-export command.

## Exact native routes

The complete advertised query surface is listed even if the first typed command intentionally
exposes a safer subset. No method in this slice supports a request JSON DTO.

| # | Method | Frozen path | Native query | Request / response | Gate and implementation note |
|---|---|---|---|---|---|
| 1 | GET | `/app/rest/avatars/{userLocator}/{size}/avatar.png` | none |  none → image/png bytes/void (see note) | ReadOnly; PNG download; size 2..300; hash variant requires matching hash (C). |
| 2 | GET | `/app/rest/avatars/{userLocator}/{size}/avatar.{hash}.png` | none |  none → image/png bytes/void (see note) | ReadOnly; PNG download; size 2..300; hash variant requires matching hash (C). |
| 3 | GET | `/app/rest/buildTypes/{btLocator}/settingsFile` | none |  none → text/plain string | ReadOnly; Text absolute SERVER path, not settings contents; return typed serverPath (D). |
| 4 | GET | `/app/rest/buildTypes/{btLocator}/vcs/files/latest` | basePath, locator, fields, resolveParameters:boolean |  none → JSON files | ReadOnly; Files collection, bounded typed locator; never auto-recurse/follow hrefs (A). |
| 5 | GET | `/app/rest/buildTypes/{btLocator}/vcs/files/latest/archived{path}` | basePath, locator, name, resolveParameters:boolean |  none → */* bytes/void (see note) | ReadOnly; ZIP bytes; native default is recursive, override/bound deliberately (A,B). |
| 6 | GET | `/app/rest/buildTypes/{btLocator}/vcs/files/latest/files{path}` | resolveParameters:boolean |  none → */* bytes/void (see note) | ReadOnly; Opaque file bytes, no Files collection; bounded profile-owned save (B). |
| 7 | GET | `/app/rest/buildTypes/{btLocator}/vcs/files/latest/metadata{path}` | fields, resolveParameters:boolean |  none → JSON file | ReadOnly; File metadata, no body or pagination query (A). |
| 8 | GET | `/app/rest/buildTypes/{btLocator}/vcs/files/latest/{path}` | basePath, locator, fields, resolveParameters:boolean |  none → JSON files | ReadOnly; Files collection, bounded typed locator; never auto-recurse/follow hrefs (A). |
| 9 | GET | `/app/rest/builds/aggregated/{buildLocator}/statusIcon{suffix}` | none |  none → native bytes/void (see note) | ReadOnly; Native image download; safe fixed suffix .svg; not semantic build success (C). |
| 10 | GET | `/app/rest/builds/{buildLocator}/artifacts` | basePath, locator, fields, resolveParameters:boolean, logBuildUsage:boolean |  none → JSON files | ReadOnly; Files collection, bounded typed locator; never auto-recurse/follow hrefs (A). |
| 11 | GET | `/app/rest/builds/{buildLocator}/artifacts/archived{path}` | basePath, locator, name, resolveParameters:boolean, logBuildUsage:boolean |  none → */* bytes/void (see note) | ReadOnly; ZIP bytes; native default is recursive, override/bound deliberately (A,B). |
| 12 | GET | `/app/rest/builds/{buildLocator}/artifacts/files{path}` | resolveParameters:boolean, logBuildUsage:boolean |  none → */* bytes/void (see note) | ReadOnly; Opaque file bytes, no Files collection; bounded profile-owned save (B). |
| 13 | GET | `/app/rest/builds/{buildLocator}/artifacts/metadata{path}` | fields, resolveParameters:boolean, logBuildUsage:boolean |  none → JSON file | ReadOnly; File metadata, no body or pagination query (A). |
| 14 | GET | `/app/rest/builds/{buildLocator}/artifacts/{path}` | basePath, locator, fields, resolveParameters:boolean, logBuildUsage:boolean |  none → JSON files | ReadOnly; Files collection, bounded typed locator; never auto-recurse/follow hrefs (A). |
| 15 | GET | `/app/rest/builds/{buildLocator}/artifactsDirectory` | none |  none → text/plain string | ReadOnly; Text absolute SERVER artifact directory path, not file contents (D). |
| 16 | GET | `/app/rest/builds/{buildLocator}/resolved/{value}` | none |  none → text/plain string | ReadOnly; Resolve one typed parameter reference and persist result to secret alias (E). |
| 17 | GET | `/app/rest/builds/{buildLocator}/sources/files/{fileName}` | none |  none → application/octet-stream bytes/void (see note) | ReadOnly; Opaque source bytes; explicit relative file path and bounded save (B). |
| 18 | GET | `/app/rest/builds/{buildLocator}/statusIcon{suffix}` | none |  none → native bytes/void (see note) | ReadOnly; Native image download; safe fixed suffix .svg; not semantic build success (C). |
| 19 | POST | `/app/rest/projects/{projectLocator}/secure/tokens` | none | text string → text/plain string | Update; Text secret from alias → new secure token reference, stored to alias (E). |
| 20 | GET | `/app/rest/projects/{projectLocator}/secure/values/{token}` | none | text none → text/plain string | ReadOnly; Text secret resolved from secure-token alias → destination secret alias (E). |
| 21 | GET | `/app/rest/projects/{projectLocator}/settingsFile` | none |  none → text/plain string | ReadOnly; Text absolute SERVER path, not settings contents; return typed serverPath (D). |
| 22 | GET | `/app/rest/server/files/{areaId}` | basePath, locator, fields |  none → JSON files | ReadOnly; Files collection, bounded typed locator; never auto-recurse/follow hrefs (A). |
| 23 | GET | `/app/rest/server/files/{areaId}/archived{path}` | basePath, locator, name |  none → */* bytes/void (see note) | ReadOnly; ZIP bytes; native default is recursive, override/bound deliberately (A,B). |
| 24 | GET | `/app/rest/server/files/{areaId}/files{path}` | none |  none → */* bytes/void (see note) | ReadOnly; Opaque file bytes, no Files collection; bounded profile-owned save (B). |
| 25 | GET | `/app/rest/server/files/{areaId}/metadata{path}` | fields |  none → JSON file | ReadOnly; File metadata, no body or pagination query (A). |
| 26 | GET | `/app/rest/server/files/{areaId}/{path}` | basePath, locator, fields |  none → JSON files | ReadOnly; Files collection, bounded typed locator; never auto-recurse/follow hrefs (A). |
| 27 | GET | `/app/rest/vcs-root-instances/{vcsRootInstanceLocator}/files/latest` | basePath, locator, fields |  none → JSON files | ReadOnly; Files collection, bounded typed locator; never auto-recurse/follow hrefs (A). |
| 28 | GET | `/app/rest/vcs-root-instances/{vcsRootInstanceLocator}/files/latest/archived{path}` | basePath, locator, name |  none → */* bytes/void (see note) | ReadOnly; ZIP bytes; native default is recursive, override/bound deliberately (A,B). |
| 29 | GET | `/app/rest/vcs-root-instances/{vcsRootInstanceLocator}/files/latest/files{path}` | none |  none → */* bytes/void (see note) | ReadOnly; Opaque file bytes, no Files collection; bounded profile-owned save (B). |
| 30 | GET | `/app/rest/vcs-root-instances/{vcsRootInstanceLocator}/files/latest/metadata{path}` | fields |  none → JSON file | ReadOnly; File metadata, no body or pagination query (A). |
| 31 | GET | `/app/rest/vcs-root-instances/{vcsRootInstanceLocator}/files/latest/{path}` | basePath, locator, fields |  none → JSON files | ReadOnly; Files collection, bounded typed locator; never auto-recurse/follow hrefs (A). |
| 32 | GET | `/app/rest/vcs-roots/{vcsRootLocator}/settingsFile` | none |  none → text/plain string | ReadOnly; Text absolute SERVER path, not settings contents; return typed serverPath (D). |

## A. Four typed file trees

Use the same small integration-owned mechanics with distinct public nouns:

| Owner | Native base | Required parent selector | Parent query |
|---|---|---|---|
| Build artifacts | /builds/{buildLocator}/artifacts | Build ID, or a documented bounded selector for a chosen build | resolveParameters:boolean, logBuildUsage:boolean |
| Build configuration VCS tree | /buildTypes/{btLocator}/vcs/files/latest | Build configuration ID | resolveParameters:boolean |
| VCS root instance tree | /vcs-root-instances/{vcsRootInstanceLocator}/files/latest | VCS instance ID | none |
| Server file area | /server/files/{areaId} | area enum logs/backups/dataDirectory | none |

The current native functions are: base → list root, /{path} → list children at a path,
/metadata{path} → one File, /files{path} → actual bytes, /archived{path} → ZIP bytes.
There is deliberately no counted /content or /children alias in the frozen inventory.

For /metadata, /files, /archived, path pattern is (/.*)? and may be empty; do not join a nonempty
path without its separating slash. For plain child listing /{path}, pattern is (.*)?.
Accept a relative slash-separated path, reject dot segments, backslashes, control characters,
drive/UNC/absolute forms, and encoded traversal. Encode individual segments once, preserving
the intended separators. IDs are encoded as whole locator values separately; file paths are
not locators. This protects URI construction and does not convert server paths into local paths.

BasePath is a remote relative traversal base used by the server finder; never use it as local
destination. Name on archived is an archive output name chosen by the server, not a local output
path. A first slice can omit both options and use explicit subpath + safe local output basename.

### Native metadata DTOs and bounded selection

Files is `{count?:number,href?:string,file?:File[]}`, **no nextHref** in current schema.
File fields include name,fullName,size:int64,modificationTime,href,parent,content:{href},children:Files.
Safe initial fields:
`count,file(name,size,modificationTime)` for lists and `name,size,modificationTime` for detail.
Optionally include a locally derived requested relative path, not untrusted server fullName or href.
size can be absent for a directory/unavailable metadata; do not invent zero-size files.
Do not recursively request children through fields; no automatic follow-up requests.

Source finder supports recursive, hidden, browseArchives, directory, pattern, modified, size and
common paging dimensions. Default listing is recursive:false,hidden:false,browseArchives:false.
recursive additionally accepts a nesting-level number; CLI can expose boolean only initially.
size is an upper bound with bytes/kb/mb syntax in source. A clear typed first slice uses
count:<boundedCount>,recursive:false,hidden:false,browseArchives:false and optional directory filter.
Source getCountIfDefaultLocator explicitly recognizes count. Files response does not advertise
continuation, so report returned count and optional truncation suspicion honestly; do not claim all
files were enumerated or synthesize nextHref.

No parent except build artifacts supports archive browsing in the older FilesSubResource
configuration; archive extraction/browsing and generating ZIP are different capabilities.
Do not expose browseArchives:true generally. Artifact hidden .teamcity contents may carry logs,
settings, and secrets; keep hidden false by default, with any explicit access documented as sensitive.

Build artifacts query **logBuildUsage** can record usage on downloads. Set false explicitly for
ReadOnly commands/proof rather than permitting a user-supplied true on the same gate. Routine server
request logging can still happen; ReadOnly is no intentional domain mutation, not no access log.
Set resolveParameters:false when literal paths are intended. Turning it on can resolve sensitive
build parameters into paths and needs a clearly documented separate typed option, not implicit behavior.

### Archive route behavior

The source overrides absent locator recursive to true and browseArchives to false when zipping.
To keep operations bounded, send an explicit count and recursive choice; no automatic ZIP of a whole
server area or VCS tree. Default to an explicit non-empty selected subpath or require explicit root
selection with a clear size bound. Never auto-extract a returned archive. The native server supports
streaming but does not promise a bounded amount of work from client cancellation; client byte limits
bound local resource use, not total remote ZIP preparation cost.

Server file areas are logs, backups, dataDirectory in official source. custom.* areas exist only
behind an unsafe server startup setting; **do not expose custom areas** in the first typed CLI.
Logs require MANAGE_SERVER_INSTALLATION; other built-in areas require VIEW_SERVER_SETTINGS in older
source. These reads can reveal extremely sensitive data; require explicit area and path and do not
include them in live proof. Never dump returned logs/config/backups into stdout or commit them.

## B. Useful bounded file transfer contract

All bytes stay bytes. Do not use response.text(), fake JSON parsing, base64 in JSON/RPC, or return
only a download URL that the caller cannot safely use. Use explicit profile-owned destination:
`join(context.appArguments.AppDataDirectory,"downloads",safeOutputName)`, never cwd/executable.
A destination name is a basename chosen by the user, not Content-Disposition, remote path, or href.
The smallest useful user result after successful file completion is
`{path,bytes,sha256,mediaType}`, where path points at the real saved current-profile file.
This is a real deliverable; `{downloaded:true}` without retained bytes is not coverage.

- Gate and validate inputs before network/file work. Reject existing destination without overwriting.
- Preflight resolved destination remains in the selected profile download directory; reject symlink/
  junction/reparse-point escape. Create current-user private directories/files with platform-appropriate
  protection, as other profile data does. Never silently fall back to cwd or plaintext secret storage.
- Use bounded streaming into a uniquely owned temporary file under profile TempDirectory. Check
  Content-Length if present but enforce an actual received-byte limit too; compressed-transfer length
  alone is not a decoded-byte bound. Propagate cancellation and network errors. Finish/close/hash before
  atomic no-clobber publication. Remove only the exact owned temporary file on failure.
- Never use untrusted remote headers as local filenames or print them raw. Do not follow arbitrary
  redirects or content.href. Default to refusing redirects; if cross-origin artifact delivery is
  later added, it needs a deliberate allowlist and must strip TeamCity Authorization/Cookie headers.
- Validate response status before reading; cap retained error text, suppress raw bodies/URLs that can
  contain signed links or content. Binary success metadata must not contain credentials.
- Ordinary artifacts/source/logs can contain sensitive user data. The user explicitly requests that
  file; stored output is a private downloaded document, not a general credential-store fallback.
  Standalone token/key-value APIs below **must still use the keyring**, not this file sink.
- The file stays under the active profile and follows profile deletion semantics. Document that the
  file may contain secrets and must not become a fixture, be auto-opened/executed, or auto-uploaded.
  Never auto-extract ZIP, render SVG, execute downloaded scripts, or traverse nested archive entries.

Source file endpoint is application/octet-stream, no fields/query/body. fileName is a nonempty
relative source path for the selected build. It resolves source at that build, not arbitrary local
server filesystem. VCS exceptions must become safe CLI errors, not source content.

For wildcard file responses use Accept:*/* or a precise suitable media only when known. Archive MIME
is supplied by native response builder (commonly ZIP); validate a plausible archive type/signature
if naming .zip, do not falsely label arbitrary successful HTML as archive. Bytes may legitimately
be zero for an empty ordinary file; don't globally reject all empty content.

## C. Images

Avatar PNG: required UserLocator and size:int32 **2..300 inclusive**. Hashless route gets current
avatar; hashed route checks hash against current avatar and otherwise 404. Hash is a non-secret
cache identity but still encode as one segment and reject invalid path characters.
Send Accept:image/png, verify PNG signature/media, stream to the same private bounded file sink.

Build status icons use suffix as a regex path fragment. Official source default suffix is **.svg**;
format is chosen by actual static resource file and content MIME comes from the servlet.
A safe first CLI supports only explicit enum svg (PNG only if current distribution/source proves
resource availability). Do not expose arbitrary suffix; it becomes part of a resource filename.
For svg use image/svg+xml and store bytes without rendering/executing. Validate bounded XML root and
reject DTD/entities if parsing for signature, but do not serialize/render untrusted SVG into UI.

A returned icon can represent permission denied, not found, or internal error using status-image
semantics and an HTTP-success response. It proves the icon resource was downloaded, **not** that
the selected build succeeded or that the caller can inspect it.
Aggregated icons use a typed bounded build locator (e.g. configuration ID + count) as in the shipped
aggregate-status operation. Do not allow an unbounded arbitrary build locator merely because the
output image is tiny. No query body or fields parameter exists for either icon route.

## D. Server-side path lookups, not downloads

The three settingsFile handlers all call getConfigurationFile().getAbsolutePath().
artifactsDirectory calls build.getArtifactsDirectory().getAbsolutePath().
Every response is text/plain and may be an absolute Windows or Unix path **on the remote server**.
These routes do not transfer XML configuration content, artifact bytes, or a local file.

A useful typed result is `{serverPath:string}` after bounded text validation. Preserve necessary
server-path information so an authorized operator can diagnose storage; do not reduce it to
configured:true. Reject NUL/control characters that would corrupt output. Never feed the returned
path into local filesystem calls, infer a UNC connection, or automatically call server/files.
No existing-path assertion can be made locally. Permission in source is VIEW_SERVER_SETTINGS.

This output is private operational metadata, not a credential, and is an explicit requested result;
it must never be added to diagnostics/fixtures/workstream records from a real private server.
Tests use clearly synthetic paths, e.g. /srv/teamcity-example/config/projects/Example/project-config.xml.
If product policy chooses metadata-only UI, it must retain a usable server-path result behind an
explicit option rather than count a discarded text response as supported API.

## E. Secure values and parameter resolution

Native text/plain transport is mandatory. Do not convert text values into JSON DTOs, trim significant
secret whitespace, print results, log raw request/error text, or write values into profile JSON/files.
Use the existing profile-scoped injected secret store and explicit aliases. Returned metadata must
identify usable aliases rather than discarded response bytes.

### Project secure token creation

POST /projects/{projectLocator}/secure/tokens, body is the secret value string.
Current schema description: requires EDIT_PROJECT; returns new secure token name/scrambled reference.
Source getOrCreateToken may reuse an existing reference for the same value and schedules persistence.
It is not creation of a TeamCity REST access token and not auth login for the CLI.

Suggested typed operation:
`projects secure create-token <project> --value-secret <sourceAlias> --store-as <referenceAlias>`.
Resolve source alias after Update gate; ensure explicit new output alias and available keyring first.
POST only the secret bytes; persist returned non-empty token/reference string to referenceAlias.
Return `{projectId,referenceAlias,stored:true}` only after actual persistence. This enables later
secure resolution or DSL wiring through another alias-aware command. If local persistence fails after
POST, state remote creation/reuse may have occurred; don't auto-retry or invent remote rollback.

The returned reference is normally suitable for versioned settings, but treating it as sensitive in
CLI outputs avoids accidentally publishing credential identifiers. It is not interchangeable with
the underlying secret; types/alias namespace should distinguish secure-reference from value.

### Project secure value retrieval

GET /projects/{projectLocator}/secure/values/{token} returns actual secret text.
Current 2026.1 description requires **CHANGE_SERVER_SETTINGS**, whereas the older public source
checks VIEW_SERVER_SETTINGS. Record the current requirement; don't weaken permission based on old code.
Older source deliberately delays lookup by default five seconds; use reasonable timeout, no retry storm.

Suggested operation:
`projects secure resolve <project> --reference-secret <tokenAlias> --store-as <valueAlias>`.
The token is read from a profile secret alias and encoded into the internal request path;
sensitive path must be suppressed from errors/tracing. Persist returned value to valueAlias, return
only alias metadata after success. The remote action is ReadOnly, while the explicit local result
storage is acknowledged. This is not a live proof command because it intentionally retrieves secrets.

### Build parameter resolution

GET /builds/{buildLocator}/resolved/{value} is incorrectly summarized as a status in generated docs;
source actually calls the build value resolver and returns **resolved text**. Use a typed parameter
name option to construct one expression `%<name>%` rather than accepting an arbitrary value literal
that could contain credentials in a URL. Require a concrete build ID and an explicit destination alias.

Remote permission is VIEW_BUILD_RUNTIME_DATA in source, with narrow exceptions for literals/build
number. If there is no associated build, the source can return the original expression unchanged.
A result equal to the input expression is not proof of successful resolution; report unresolved
without claiming stored actual value (or fail before persistence). Otherwise treat output as secret,
store it, and return only alias metadata. More complex expressions belong to an explicit later typed
feature; this subset already makes the native route useful safely.

### Secret-operation tests

Cover text/plain body/Accept, absent Content-Type on GET, exact percent/colon/path encoding,
deny Update before source-secret read, source/output alias collisions, cross-profile isolation,
unavailable store, keyring failure after response, unchanged unresolved expression, HTTP errors
echoing input secret, and hostile non-JSON success text. No secret bytes appear in exception cause,
stdout/stderr, JSON-RPC payloads, snapshots, or saved files. Do not return synthetic stored:true unless
the mocked/real secret store actually received the intended value.

## Acceptance and authoring checkpoint

For file routes MSW must supply actual byte bodies and tests read the saved synthetic output.
Verify hash/bytes/media, JSON/RPC metadata-only presentation, profile-separated paths, no clobber,
traversal/symlink defenses, cancellation, incorrect media, streaming size cap without Content-Length,
error cleanup, and no cross-origin Authorization forwarding. ZIP tests prove bytes, not extraction.
SettingsFile tests assert native text path result and zero local attempts to read that server path.
Route tests must distinguish list/metadata/file/archive aliases and all inherited parent queries.

Authoring review compares total Core + TeamCity code and concepts with the earlier slices. A small
binary sink shared with a current second consumer can help; service-specific path and DTO semantics
must remain TeamCity code. No generic method/path/body passthrough, ACK-only coverage, or claim that
a response-byte discard fulfills downloads. All default tests remain offline; these sensitive and
potentially expensive routes do not expand the fixed real-service ReadOnly proof inventory by default.
