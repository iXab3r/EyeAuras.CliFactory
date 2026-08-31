param(
 [Parameter(Mandatory=$true)][ValidatePattern('^[a-z0-9-]+$')][string]$Snapshot,
 [Parameter(Mandatory=$true)][string]$Stage,
 [int]$AcceptedOperations=0,
 [string]$GitPath='C:\Program Files\Git\cmd\git.exe'
)
$ErrorActionPreference='Stop'
$repo=(& $GitPath -C $PSScriptRoot rev-parse --show-toplevel).Trim()
if($LASTEXITCODE -ne 0){throw 'Cannot resolve worktree'}
$head=(& $GitPath -C $repo rev-parse HEAD).Trim()
$branch=(& $GitPath -C $repo branch --show-current).Trim()
$paths=@(& $GitPath -C $repo ls-files --cached --others --exclude-standard -- packages/core integrations)
if($LASTEXITCODE -ne 0){throw 'Cannot enumerate source'}
$rows=@(foreach($path in ($paths|Sort-Object -Unique)){
 if($path -notmatch '^(packages/core|integrations/[^/]+)/(src|tests|integration-tests)/.+\.ts$'){continue}
 $owner=$Matches[1];$surface=$Matches[2]
 $kind=if($surface -eq 'src'){'source'}elseif($surface -eq 'integration-tests'){'local-proof'}elseif($path -match '(^|/)(support|fixtures)(/|\.ts$)' -or $path -like '*/tests/cli-fixture.ts'){'test-support'}else{'tests'}
 $fullPath=Join-Path $repo $path
 if(-not(Test-Path -LiteralPath $fullPath)){continue}
 $bytes=[System.IO.File]::ReadAllBytes($fullPath)
 $content=[System.Text.Encoding]::UTF8.GetString($bytes)
 $lines=@($content -split '\r\n|\r|\n')
 $physical=$lines.Count
 if(-not $content.Length){$physical=0}elseif($content.EndsWith([char]10)-or $content.EndsWith([char]13)){$physical--}
 [pscustomobject][ordered]@{
  owner=$owner;kind=$kind;path=$path
  nonblank_lines=@($lines|Where-Object {-not[string]::IsNullOrWhiteSpace($_)}).Count
  physical_lines=$physical
  sha256=[Convert]::ToHexString([System.Security.Cryptography.SHA256]::HashData($bytes)).ToLowerInvariant()
  content=$content
 }
})
$manifests=@(foreach($path in @('package.json','packages/core/package.json')+@($paths|Where-Object{$_ -match '^integrations/[^/]+/package\.json$'})){
 $fullPath=Join-Path $repo $path
 if(-not(Test-Path -LiteralPath $fullPath)){continue}
 [pscustomobject][ordered]@{path=$path;sha256=(Get-FileHash -LiteralPath $fullPath -Algorithm SHA256).Hash.ToLowerInvariant();manifest=(Get-Content -LiteralPath $fullPath -Raw|ConvertFrom-Json)}
})
$totals=@($rows|Group-Object owner,kind|ForEach-Object{
 [pscustomobject][ordered]@{owner=$_.Group[0].owner;kind=$_.Group[0].kind;files=$_.Count;nonblank_lines=[int](($_.Group|Measure-Object nonblank_lines -Sum).Sum)}
})
$nonTsTests=@(foreach($path in ($paths|Sort-Object -Unique)){
 if($path -notmatch '^(packages/core|integrations/[^/]+)/(tests|integration-tests)/' -or $path -like '*.ts'){continue}
 $fullPath=Join-Path $repo $path
 if(-not(Test-Path -LiteralPath $fullPath -PathType Leaf)){continue}
 [pscustomobject][ordered]@{path=$path;bytes=(Get-Item -LiteralPath $fullPath).Length;sha256=(Get-FileHash -LiteralPath $fullPath -Algorithm SHA256).Hash.ToLowerInvariant()}
})
$output=[pscustomobject][ordered]@{
 snapshot=$Snapshot;stage=$Stage;captured_utc=[DateTime]::UtcNow.ToString('o')
 head_commit=$head;branch=$branch;frozen_reference_commit='e0d4d1b8dc615a969a0160f69a5fb34968d9ab3d'
 accepted_operations=$AcceptedOperations
 metric='Actual working-tree nonblank handwritten TypeScript lines; comments included; exact UTF-8 source content and byte hashes preserved; generated output excluded'
 note='Working-tree evidence, not a committed revision or acceptance verdict. Snapshot content is management evidence excluded from product-source metrics.'
 files=$rows;totals=$totals;manifests=$manifests;non_ts_test_artifacts=$nonTsTests
 source_total=[int](($rows|Where-Object kind -eq source|Measure-Object nonblank_lines -Sum).Sum)
 test_support_total=[int](($rows|Where-Object{$_.kind -in 'tests','test-support'}|Measure-Object nonblank_lines -Sum).Sum)
 local_proof_total=[int](($rows|Where-Object kind -eq 'local-proof'|Measure-Object nonblank_lines -Sum).Sum)
}
$directory=Join-Path $PSScriptRoot 'snapshots'
New-Item -ItemType Directory -Force -Path $directory|Out-Null
$destination=Join-Path $directory ($Snapshot+'.json')
if(Test-Path -LiteralPath $destination){throw 'Snapshot already exists; immutable evidence must not be overwritten'}
$output|ConvertTo-Json -Depth 20|Set-Content -LiteralPath $destination -Encoding utf8
[pscustomobject]@{path=$destination;sha256=(Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash;totals=$totals;source_total=$output.source_total;test_support_total=$output.test_support_total;local_proof_total=$output.local_proof_total}|ConvertTo-Json -Depth 6


