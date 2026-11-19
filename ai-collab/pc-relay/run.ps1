#Requires -Version 5.1
param([switch]$Once, [switch]$DryRun, [switch]$NoLocalClaudeFallback)
$ErrorActionPreference = "Stop"
$repo = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$entry = Join-Path $PSScriptRoot "pc_relay.py"
$argsList = @("-u", $entry, "--repo-dir", $repo)
if ($Once) { $argsList += "--once" }
if ($DryRun) { $argsList += "--dry-run" }
if (-not $NoLocalClaudeFallback) { $argsList += "--enable-local-claude-fallback" }
& python @argsList
if ($LASTEXITCODE -ne 0) { throw "JJOONI PC relay exited with code $LASTEXITCODE" }
