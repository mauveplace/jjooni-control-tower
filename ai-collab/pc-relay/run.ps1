#Requires -Version 5.1
param([switch]$Once, [switch]$DryRun, [switch]$EnableLocalClaudeFallback)
$ErrorActionPreference = "Stop"
$repo = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$entry = Join-Path $PSScriptRoot "pc_relay.py"
$argsList = @("-u", $entry, "--repo-dir", $repo)
if ($Once) { $argsList += "--once" }
if ($DryRun) { $argsList += "--dry-run" }
if ($EnableLocalClaudeFallback) { $argsList += "--enable-local-claude-fallback" }
while ($true) {
    & python @argsList
    if ($Once) { break }
    Write-Host "PC relay exited ($LASTEXITCODE). Restarting after 60 seconds..."
    Start-Sleep -Seconds 60
}
if ($LASTEXITCODE -ne 0) { throw "JJOONI PC relay exited with code $LASTEXITCODE" }
