Behavioral decisions for the next bounded F05/F08 work, approved before implementation within
Issue #14's existing scope. These are planned contracts, not claims that the changes are shipped.

- **F08 response bound:** YouTrack JSON response consumption will have a finite **8 MiB limit on
  actual decoded body bytes**. TeamCity's existing **2 MiB** limit remains unchanged. Keep each
  service's status/error handling and successful empty/null-body semantics; never echo response
  content in failure diagnostics. Encoded Content-Length is not treated as the decoded byte count.
  Actual-byte accounting, cancellation and reader cleanup require deterministic boundary tests.
- **File staging:** YouTrack download staging moves under the selected profile's owned
  `AppDataDirectory/temp`. Attachment transfer limits remain unchanged. Existing profile isolation,
  exclusive/no-overwrite publication, path/link checks and cleanup protections remain required;
  this does not permit arbitrary temp paths, a storage fallback or live downloads.
- **F05 integer parsing:** shared mechanics preserve the integrations' existing syntax differences.
  TeamCity retains signed integers, including `-0` where its start/range policy already accepts it;
  YouTrack retains unsigned syntax and rejects `-0`. Defaults, ranges and numeric-ID/domain checks
  stay service-owned rather than being normalized to one policy.
- **Intentional YouTrack timing correction:** invalid integer option values will be rejected by the
  option parser **before onboarding**, without prompting or service I/O. Independently callable
  service methods retain their domain validation. CLI, execute and RPC regressions must prove the
  timing and non-echoing error behavior; parser extraction must not silently broaden accepted input.

No new endpoint or permission, automatic retry, attachment-limit increase or generic HTTP client
is introduced. Independent correctness/security and full-cost authoring reviews remain required;
added response safety and changed rejection timing are recorded as behavior/correctness costs,
not automatically counted as code savings. Current plan/evidence lives under
`.workspace/workstreams/integration-authoring-core/`.
