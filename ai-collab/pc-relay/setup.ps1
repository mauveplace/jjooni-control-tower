#Requires -Version 5.1
<#
First-time Windows setup, current user only.
Run: powershell -NoProfile -ExecutionPolicy Bypass -File .\ai-collab\pc-relay\setup.ps1
#>
$ErrorActionPreference = "Stop"
$repo = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$runner = Join-Path $PSScriptRoot "run.ps1"
$startup = [Environment]::GetFolderPath("Startup")
$shortcutPath = Join-Path $startup "JJOONI PC Relay.lnk"
Write-Host "JJOONI PC Relay setup" -ForegroundColor Cyan
Write-Host "Repo: $repo"
if (-not (Test-Path (Join-Path $repo ".git"))) { throw "Clone repository first: gh repo clone mauveplace/jjooni-control-tower" }
$missing = @()
foreach ($tool in @("python", "git", "gh", "codex", "claude")) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { $missing += $tool }
}
if ($missing.Count -gt 0) {
    Write-Host "Missing: $($missing -join ', ')" -ForegroundColor Yellow
    Write-Host "Install prerequisites:"
    Write-Host "  winget install --id Git.Git -e"
    Write-Host "  winget install --id GitHub.cli -e"
    Write-Host "  winget install --id Python.Python.3.12 -e"
    Write-Host "  winget install --id OpenJS.NodeJS.LTS -e"
    Write-Host "  npm install -g @openai/codex"
    Write-Host "  irm https://claude.ai/install.ps1 | iex"
    Write-Host "Restart terminal; then: gh auth login ; codex login ; claude"
    exit 1
}
if ($env:OPENAI_API_KEY -or $env:CODEX_API_KEY -or $env:ANTHROPIC_API_KEY) {
    throw "API key environment variable detected. Use subscription CLI sign-in for no metered API calls."
}
Write-Host "Verifying subscriptions and CLI login states..." -ForegroundColor Cyan
& gh auth status *> $null
if ($LASTEXITCODE -ne 0) { throw "Please run gh auth login before installing startup relay." }
& codex login status *> $null
if ($LASTEXITCODE -ne 0) { throw "Please run codex login (ChatGPT account) before installing." }
& claude auth status *> $null
if ($LASTEXITCODE -ne 0) { throw "Please run claude auth login (Claude subscription) before installing." }
$confirmation = Read-Host "Install startup relay? It reads public PRs and posts GitHub agent handoffs (Y/N)"
if ($confirmation -notin @("Y", "y")) { Write-Host "Cancelled"; exit 0 }
$ws = New-Object -ComObject WScript.Shell
$lnk = $ws.CreateShortcut($shortcutPath)
$lnk.TargetPath = "$env:WINDIR\System32\WindowsPowerShell\v1.0\powershell.exe"
$lnk.Arguments = '-NoLogo -NoProfile -ExecutionPolicy Bypass -File "' + $runner + '"'
$lnk.WorkingDirectory = $repo
$lnk.Description = "JJOONI local Codex+Claude review handoff (logon only)"
$lnk.WindowStyle = 7
$lnk.Save()
Write-Host "Installed: $shortcutPath" -ForegroundColor Green
Write-Host "Works only when PC is on and current user is signed in."
Write-Host "Dry-run test command:"
Write-Host ('  powershell -NoProfile -File "' + (Join-Path $PSScriptRoot 'run.ps1') + '" -Once -DryRun')
Write-Host "Actual start command:"
Write-Host ('  powershell -NoProfile -File "' + (Join-Path $PSScriptRoot 'run.ps1') + '"')
Write-Host "Uninstall: delete Startup shortcut; stop the running relay."
