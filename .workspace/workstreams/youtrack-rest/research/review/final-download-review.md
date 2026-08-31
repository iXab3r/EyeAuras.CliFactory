# Derived issue attachment download security review

Independent reviewer: inventory_reviewer; 2026-08-30. Status: corrected direct implementation SECURITY PASS; see final evidence below.

## Initial actual-source review

Read attachment-download.ts, attachment-download-commands.ts, the fixed raw-metadata helper in client.ts and the complete offline download test file. The route/context/header/redirect, profile AppData, name/size/streaming and exclusive-publication design is implemented directly. The binary request uses credentials=omit with no Authorization or Cookie header and redirect=error. File writes use FileHandle.writeFile for complete chunks; actual bytes are checked, temporary data is removed after errors, and exclusive hard-link publication never overwrites an existing final target. Detected ancestor substitutions fail rather than deleting through a changed path; same-OS-user TOCTOU limitations remain explicit.

Independently ran the first coherent compiled offline download test file: 17/17 passed. This did not establish complete security coverage: additional synthetic reproductions using an injected fetch and temporary directories confirmed two defects outside those tests.

1. A path signature containing both percent-encoded slash and literal plus was decoded using query-string plus-to-space rules. Its correctly decoded path signature could therefore pass through the returned content type. Fix must distinguish path percent-decoding from query form decoding and test the actual matching raw/decoded values.
2. A fully percent-encoded active bearer placed in a query parameter name was not checked; metadata literal comparison and URL-value checks missed it, and the binary request occurred. Check decoded query keys as well as values/path before binary I/O, with a regression proving only metadata was fetched.

The existing test claiming raw/decoded reflection coverage used names that did not match its URL's signature; requested correction to meaningful matching fixtures. Also requested the amendment's explicit unsupported-hard-link failure/cleanup test. No production edits, profile/keyring reads or live service calls were performed by this reviewer. All reproductions used clearly synthetic data and removed only their checked temporary directories.

Final fixed-source review, focused rerun and coherent whole-suite evidence remain pending. Root owns derived acceptance and any separate bounded real proof; download never increments the 118 REST counter.

## Corrected direct implementation SECURITY PASS

Both confirmed findings are closed. Path signatures retain literal plus while query values use form decoding. Active bearer reflection is rejected in the decoded URL and decoded query keys/values. Tests now use matching raw/decoded signature fixtures; the specific path-plus MIME disclosure case is a regression. Unsupported hard-link publication is fault-injected through the existing Node builtin with restoration, proving static errors and cleanup without a production abstraction. The concurrent-publication test forces both binary requests to reach a barrier before completion; reader cancellation on byte-limit failure is also asserted.

Independently ran the corrected downloader 22 tests plus shared client 10 tests: 32/32 PASS, zero skips. Re-ran both original independent injected-fetch reproductions: the path-plus result uses safe application/octet-stream instead of the signature; a percent-encoded bearer query key rejects after the metadata request with no binary I/O. Independently ran all compiled Core, TeamCity and YouTrack tests: 400/400 PASS, zero failures/skips, exit0. No live bytes, real profile or credential-store access was used.

Frozen hashes reviewed:

- attachment-download.ts: E4A1FBF59088F3B8E87AB064CC11C026329B5EC94734E8A328A62B7193C9382A
- attachment-download-commands.ts: 07A3B7D498A5B8947979D3566DBD1F15D83D9ED3791CD0ADDA78D9D8C7035C03
- tests/attachment-download.test.ts: 465E1BE2169F25473ABD70D27FD8A9FD40DB3ED7B40E697611DFA01F44F5E7EC
- shared client.ts: 0D61DD9CEEEA78243AA826E8C63DBEFD71BBF65D6DB332A315911EA3CD5DEF79

No remaining independent security finding. Root may accept this as derived capability1/1, separate from the118 route counter. Final authoring review includes all downloader complexity, and any later source trial needs its own semantic/rerun gate. Filesystems without exclusive hard-link support fail closed; hostile same-OS-user ancestor replacement is not claimed to be fully prevented by portable Node path APIs.
