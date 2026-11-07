# Changelog

## Unreleased

## 0.7.0

### Breaking changes

- YouTrack offset lists use `--page-size`/`--start` instead of `--top`/`--skip`.
  Library options likewise use `pageSize`/`start`. Lists now return
  `{ count, items, hasMore, nextStart }`; read rows from `items` rather than the result itself.
  `hasMore: null` means completeness is unknown. Native activity cursor commands retain their
  existing flags and result objects. See the [migration guide](integrations/youtrack/README.md).

### Fixed

- Complete YouTrack issue selections validate every generated page window before dispatch,
  advance by actual returned rows and reject incomplete or over-budget selections.
- TeamCity pagination preserves sparse continuation and partial-failure causes, rejects malformed
  page responses and checks offset arithmetic. Both integrations honor cancellation between pages.

### Added

- Core exports `advanceOffset` for checked pagination arithmetic without imposing content ceilings.

## 0.6.1

### Fixed

- Diagnostics redact known values across mixed-case percent escapes and later copies, and visibly
  escape terminal controls while retaining useful native codes, causes and stack locations.
- TeamCity improves help, build summaries and artifact browsing, including safer artifact follow-ups.
- Installed-package verification reduces filesystem scheduling overhead; external IPC fixtures honor
  the configured temporary directory.

### Breaking changes

- YouTrack `issues batch apply` now fails with `batch.incomplete` when any row is `failed`,
  `uncertain` or `unattempted` ([#33](https://github.com/iXab3r/EyeAuras.CliFactory/issues/33)).
  CLI callers must handle exit code 1 instead of relying on exit 0 plus `status: incomplete`.
  The full summary remains on stdout in human/JSON mode, with the reason on stderr (`--json`
  uses one machine-error line). JSON-RPC returns `error.data.code` and `error.data.result`;
  programmatic `execute` rejects with a `CliError` carrying `.result`. Counts, every row and
  `failedRows` save metadata remain in that summary. Fully completed batches still succeed.
  Check uncertain rows in YouTrack before resubmitting; they remain excluded from `--failed-rows`.
