param(
  [string]$GitPath = 'C:\Program Files\Git\cmd\git.exe'
)
$Revision = 'e0d4d1b8dc615a969a0160f69a5fb34968d9ab3d'
$ErrorActionPreference = 'Stop'
$repo = (& $GitPath -C $PSScriptRoot rev-parse --show-toplevel).Trim()
if ($LASTEXITCODE -ne 0) { throw 'Cannot resolve the worktree.' }
$commit = (& $GitPath -C $repo rev-parse "$Revision^{commit}").Trim()
if ($LASTEXITCODE -ne 0) { throw 'Cannot resolve the source revision.' }
function Get-SourceLines([string]$Path) {
  $lines = @(& $GitPath -C $repo show ($commit + ':' + $Path))
  if ($LASTEXITCODE -ne 0) { throw "Cannot read source: $Path" }
  return ,$lines
}
$paths = @(& $GitPath -C $repo ls-tree -r --name-only $commit -- packages/core integrations)
if ($LASTEXITCODE -ne 0) { throw 'Cannot enumerate tracked sources.' }
$rows = @(
  foreach ($path in $paths) {
    if ($path -notmatch '^(packages/core|integrations/[^/]+)/(src|tests|integration-tests)/.+\.ts$') { continue }
    $owner = $Matches[1]
    $surface = $Matches[2]
    $kind = if ($surface -eq 'src') { 'source' }
      elseif ($surface -eq 'integration-tests') { 'local-proof' }
      elseif ($path -match '(^|/)(support|fixtures)(/|\.ts$)') { 'test-support' }
      else { 'tests' }
    $lines = Get-SourceLines $path
    [pscustomobject][ordered]@{
      owner = $owner
      kind = $kind
      path = $path
      physical_lines = $lines.Count
      nonblank_lines = @($lines | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }).Count
    }
  }
)
$totals = @(
  $rows | Group-Object owner,kind | ForEach-Object {
    [pscustomobject][ordered]@{
      owner = $_.Group[0].owner
      kind = $_.Group[0].kind
      files = $_.Count
      nonblank_lines = ($_.Group | Measure-Object nonblank_lines -Sum).Sum
    }
  }
)
$samples = @(
  @{ id='detail-declaration'; path='integrations/teamcity/src/cli.ts'; start=213; end=218 }
  @{ id='detail-client'; path='integrations/teamcity/src/client.ts'; start=187; end=193 }
  @{ id='collection-declaration'; path='integrations/teamcity/src/cli.ts'; start=193; end=212 }
  @{ id='collection-client'; path='integrations/teamcity/src/client.ts'; start=168; end=185 }
  @{ id='mutation-declaration'; path='integrations/teamcity/src/cli.ts'; start=251; end=269 }
  @{ id='mutation-client'; path='integrations/teamcity/src/client.ts'; start=363; end=379 }
  @{ id='profile-client-setup'; path='integrations/teamcity/src/cli.ts'; start=35; end=51 }
  @{ id='cli-validation-adapters'; path='integrations/teamcity/src/cli.ts'; start=53; end=117 }
  @{ id='page-option-setup'; path='integrations/teamcity/src/cli.ts'; start=20; end=33 }
  @{ id='local-http-helper'; path='integrations/teamcity/src/client.ts'; start=412; end=462 }
  @{ id='client-constructor'; path='integrations/teamcity/src/client.ts'; start=130; end=154 }
  @{ id='client-error-type'; path='integrations/teamcity/src/client.ts'; start=120; end=128 }
)
$sampleRows = @(
  foreach ($sample in $samples) {
    $lines = Get-SourceLines $sample.path
    [pscustomobject][ordered]@{
      id = $sample.id
      path = $sample.path
      start = $sample.start
      end = $sample.end
      nonblank_lines = @($lines[($sample.start-1)..($sample.end-1)] |
        Where-Object { -not [string]::IsNullOrWhiteSpace($_) }).Count
    }
  }
)
$sourceRows = @($rows | Where-Object kind -eq 'source')
[pscustomobject][ordered]@{
  source_commit = $commit
  metric = 'Nonblank physical handwritten TypeScript lines; comments included; original formatting; tracked source read with git show at the exact commit'
  included = @('packages/core/src/**/*.ts','packages/core/tests/**/*.ts','integrations/*/src/**/*.ts','integrations/*/tests/**/*.ts','integrations/*/integration-tests/**/*.ts')
  excluded = @('generated output','node_modules','management/research scripts','non-TypeScript manifests/docs','untracked files')
  zero_baseline_note = 'No YouTrack source exists at this commit; this is a setup baseline, not evidence of a reduction or a per-operation authoring cost.'
  files = $rows
  totals = $totals
  source_totals = [ordered]@{
    core = (@($sourceRows | Where-Object owner -eq 'packages/core') | Measure-Object nonblank_lines -Sum).Sum
    all_integrations = (@($sourceRows | Where-Object owner -like 'integrations/*') | Measure-Object nonblank_lines -Sum).Sum
    youtrack = [int]((@($sourceRows | Where-Object owner -eq 'integrations/youtrack') | Measure-Object nonblank_lines -Sum).Sum)
    core_plus_all_integrations = ($sourceRows | Measure-Object nonblank_lines -Sum).Sum
  }
  samples = $sampleRows
  sample_ranges_valid_only_at = 'e0d4d1b8dc615a969a0160f69a5fb34968d9ab3d'
  sample_note = 'Declaration/client samples exclude shared setup, DTOs, validators and tests; reference components are not full per-operation costs. Re-identify ranges before comparing another revision.'
} | ConvertTo-Json -Depth 8

