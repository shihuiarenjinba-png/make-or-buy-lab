param(
  [switch]$Serve
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "=== Make or Buy Lab local verification ==="
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "Node.js 22+ is required." }
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw "npm is required." }

$nodeMajor = [int]((node --version).TrimStart("v").Split(".")[0])
if ($nodeMajor -lt 22) { throw "Node.js 22+ is required. Current: $(node --version)" }

npm test
if ($LASTEXITCODE -ne 0) { throw "npm test failed." }

npm run check
if ($LASTEXITCODE -ne 0) { throw "npm run check failed." }

Write-Host "PASS: local deterministic checks"
Write-Host "No Stripe/Cloudflare/API credentials are required for v1 calculations."

if ($Serve) {
  if (-not (Get-Command python -ErrorAction SilentlyContinue)) { throw "Python is required for the local static server." }
  Write-Host "Open http://localhost:8766/public/"
  python -m http.server 8766
} else {
  Write-Host "To open the UI: PowerShell -ExecutionPolicy Bypass -File .\scripts\local_verify.ps1 -Serve"
}
