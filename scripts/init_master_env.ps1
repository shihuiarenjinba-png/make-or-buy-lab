param(
  [string]$MasterEnvPath = ""
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$Template = Join-Path $RepoRoot ".env.master.example"

if (-not $MasterEnvPath) {
  if ($env:DECISION_OPS_MASTER_ENV) { $MasterEnvPath = $env:DECISION_OPS_MASTER_ENV }
  else { $MasterEnvPath = Join-Path $HOME ".decision-ops\master.env" }
}

if (-not (Test-Path $Template)) { throw "Missing template: $Template" }
$dir = Split-Path -Parent $MasterEnvPath
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }

if (Test-Path $MasterEnvPath) {
  Write-Host "Master env already exists; not overwriting: $MasterEnvPath"
} else {
  Copy-Item -LiteralPath $Template -Destination $MasterEnvPath
  Write-Host "Created: $MasterEnvPath"
}

Write-Host ""
Write-Host "Fill the values once, then keep this file outside Git."
Write-Host "Recommended editor command:"
Write-Host "  notepad `"$MasterEnvPath`""
Write-Host ""
Write-Host "After filling it, run:"
Write-Host "  PowerShell -ExecutionPolicy Bypass -File .\scripts\delegate_connection.ps1 -Environment preview -Action doctor"
