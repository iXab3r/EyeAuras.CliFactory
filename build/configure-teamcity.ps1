# One-time setup through @eyeauras/teamcity-cli. Does not create or read secrets.
$ErrorActionPreference = 'Stop'

function Invoke-TeamCity {
    & teamcity-cli @args
    if ($LASTEXITCODE -ne 0) { throw 'TeamCity configuration stopped; inspect the command error before resuming.' }
}

$permissions = & teamcity-cli permissions list --json | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'Could not read TeamCity profile permissions.' }
if (-not ($permissions | Where-Object { $_.name -eq 'Update' -and $_.enabled })) {
    throw 'TeamCity Update permission is disabled. Next: teamcity-cli permissions grant Update'
}

# Create-only: an existing identity stops setup instead of replacing its settings.
Invoke-TeamCity projects create EyeAuras_CliFactory --name CLI.Factory --parent EyeAuras `
    --description 'CLI Factory verification and manual dependency-ordered npm releases.'
Invoke-TeamCity vcs roots create EyeAuras_CliFactory_Repo --name EyeAuras.CliFactory `
    --project EyeAuras_CliFactory --url https://github.com/iXab3r/EyeAuras.CliFactory.git --branch refs/heads/main
Invoke-TeamCity vcs roots properties set EyeAuras_CliFactory_Repo teamcity:branchSpec '+:refs/heads/(*)'
Invoke-TeamCity projects features create EyeAuras_CliFactory --type JetBrains.SharedResources `
    --property name=cli-factory-release --property type=quoted --property quota=1 --property enabled=true

foreach ($job in @(
    @{ Id = 'EyeAuras_CliFactory_Verify'; Name = 'Verify'; Mode = '--verify-only' },
    @{ Id = 'EyeAuras_CliFactory_Release'; Name = 'npm release'; Mode = '--dry-run' }
)) {
    Invoke-TeamCity jobs create $job.Id --project EyeAuras_CliFactory --name $job.Name
    Invoke-TeamCity jobs vcs attach $job.Id --root EyeAuras_CliFactory_Repo
    Invoke-TeamCity jobs parameters create $job.Id env.CI --value true
    Invoke-TeamCity jobs parameters create $job.Id env.RELEASE_MODE --value $job.Mode
    Invoke-TeamCity jobs agent-requirements create $job.Id --type equals `
        --parameter teamcity.agent.jvm.os.name --value Linux
    Invoke-TeamCity jobs steps create $job.Id --name 'Verify, pack and release' --type simpleRunner `
        --property use.custom.script=true --property 'script.content=bash build/teamcity.sh' `
        --property plugin.docker.imageId=node:24-bookworm --property plugin.docker.imagePlatform=linux `
        --property plugin.docker.pull.enabled=true --property 'plugin.docker.run.parameters=--user 0 --init --ipc=host'
}

Invoke-TeamCity jobs features create EyeAuras_CliFactory_Release --type JetBrains.SharedResources --enabled `
    --property 'locks-param=cli-factory-release writeLock'
# Enable main verification after merging the entry point and checking the branch on TeamCity.
Invoke-TeamCity jobs triggers create EyeAuras_CliFactory_Verify --type vcsTrigger `
    --property 'branchFilter=+:<default>'

Write-Host 'TeamCity configurations created; the Verify trigger is disabled for cutover.'
Write-Host 'Configure the release job password parameters before publishing.'
