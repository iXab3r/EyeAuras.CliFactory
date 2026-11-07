# Changelog

## Unreleased

### Breaking changes

- YouTrack `issues batch apply` now fails with `batch.incomplete` when any row is `failed`,
  `uncertain` or `unattempted` ([#33](https://github.com/iXab3r/EyeAuras.CliFactory/issues/33)).
  CLI callers must handle exit code 1 instead of relying on exit 0 plus `status: incomplete`.
  The full summary remains on stdout in human/JSON mode, with the reason on stderr (`--json`
  uses one machine-error line). JSON-RPC returns `error.data.code` and `error.data.result`;
  programmatic `execute` rejects with a `CliError` carrying `.result`. Counts, every row and
  `failedRows` save metadata remain in that summary. Fully completed batches still succeed.
  Check uncertain rows in YouTrack before resubmitting; they remain excluded from `--failed-rows`.
