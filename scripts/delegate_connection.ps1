param(
  [ValidateSet("preview","production")]
  [string]$Environment = "preview",
  [ValidateSet("doctor","materialize","create-project","sync-secrets","deploy","all")]
  [string]$Action = "doctor",
  [string]$MasterEnvPath = "",
  [switch]$Apply,
  [switch]$AllowProduction
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$RegistryPath = Join-Path $RepoRoot "config\service-registry.json"

function Read-DotEnv([string]$Path) {
  if (-not (Test-Path $Path)) { throw "Master env not found: $Path" }
  $map = @{}
  foreach ($line in Get-Content -LiteralPath $Path -Encoding UTF8) {
    $trim = $line.Trim()
    if (-not $trim -or $trim.StartsWith("#")) { continue }
    $idx = $trim.IndexOf("=")
    if ($idx -lt 1) { continue }
    $key = $trim.Substring(0,$idx).Trim()
    $value = $trim.Substring($idx+1).Trim()
    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
      $value = $value.Substring(1,$value.Length-2)
    }
    $map[$key] = $value
  }
  return $map
}

function Require-Value($Map,[string]$Key) {
  if (-not $Map.ContainsKey($Key) -or [string]::IsNullOrWhiteSpace([string]$Map[$Key])) {
    throw "Required master.env key is missing: $Key"
  }
  return [string]$Map[$Key]
}

function Escape-DotEnv([string]$Value) {
  return '"' + ($Value -replace '\\','\\' -replace '"','\"') + '"'
}

function Invoke-CloudflareApi([string]$Method,[string]$Path,[string]$Token) {
  $headers = @{ Authorization = "Bearer $Token"; "Content-Type" = "application/json" }
  $uri = "https://api.cloudflare.com/client/v4$Path"
  try {
    return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers
  } catch {
    $status = $_.Exception.Response.StatusCode.value__
    if ($status -eq 404) { return $null }
    throw
  }
}

if (-not (Test-Path $RegistryPath)) { throw "Missing service registry: $RegistryPath" }
$Registry = Get-Content -LiteralPath $RegistryPath -Raw -Encoding UTF8 | ConvertFrom-Json

if (-not $MasterEnvPath) {
  if ($env:DECISION_OPS_MASTER_ENV) { $MasterEnvPath = $env:DECISION_OPS_MASTER_ENV }
  else { $MasterEnvPath = Join-Path $HOME ".decision-ops\master.env" }
}
$Master = Read-DotEnv $MasterEnvPath

$AccountId = Require-Value $Master $Registry.account_id_env
$ApiToken = Require-Value $Master $Registry.api_token_env
$Project = [string]$Registry.projects.$Environment
$Branch = [string]$Registry.branches.$Environment
$BillingMode = [string]$Registry.environments.$Environment.billing_mode
$AssetDir = Join-Path $RepoRoot ([string]$Registry.asset_dir)

if ($Environment -eq "production" -and -not $AllowProduction -and $Action -in @("create-project","sync-secrets","deploy","all")) {
  throw "Production write blocked. Re-run only after explicit approval with -AllowProduction."
}

$resolvedSecrets = @{}
$missingRequired = @()
foreach ($entry in $Registry.runtime_secret_map) {
  $sourceKey = if ($Environment -eq "preview") { [string]$entry.preview_source } else { [string]$entry.production_source }
  $value = if ($Master.ContainsKey($sourceKey)) { [string]$Master[$sourceKey] } else { "" }
  if ($entry.required -eq $true -and [string]::IsNullOrWhiteSpace($value)) {
    $missingRequired += $sourceKey
  }
  if (-not [string]::IsNullOrWhiteSpace($value)) { $resolvedSecrets[[string]$entry.target] = $value }
}
if ($missingRequired.Count -gt 0) { throw "Required runtime secrets missing: $($missingRequired -join ', ')" }

$envLocal = Join-Path $RepoRoot (".env.$Environment.local")
$devVars = Join-Path $RepoRoot (".dev.vars.$Environment")

function Materialize-LocalFiles {
  $envLines = @(
    "CLOUDFLARE_ACCOUNT_ID=$(Escape-DotEnv $AccountId)",
    "CLOUDFLARE_API_TOKEN=$(Escape-DotEnv $ApiToken)",
    "SERVICE_ID=$(Escape-DotEnv ([string]$Registry.service_id))",
    "CLOUDFLARE_ACCOUNT_ALIAS=$(Escape-DotEnv ([string]$Registry.cloudflare_profile))",
    "CLOUDFLARE_PROJECT_NAME=$(Escape-DotEnv $Project)",
    "TARGET_ENV=$(Escape-DotEnv $Environment)",
    "BILLING_MODE=$(Escape-DotEnv $BillingMode)"
  )
  Set-Content -LiteralPath $envLocal -Value ($envLines -join [Environment]::NewLine) -Encoding UTF8

  $devLines = @(
    "SERVICE_ID=$(Escape-DotEnv ([string]$Registry.service_id))",
    "TARGET_ENV=$(Escape-DotEnv $Environment)",
    "BILLING_MODE=$(Escape-DotEnv $BillingMode)"
  )
  foreach ($key in ($resolvedSecrets.Keys | Sort-Object)) {
    $devLines += "$key=$(Escape-DotEnv ([string]$resolvedSecrets[$key]))"
  }
  Set-Content -LiteralPath $devVars -Value ($devLines -join [Environment]::NewLine) -Encoding UTF8

  Write-Host "MATERIALIZED: $envLocal"
  Write-Host "MATERIALIZED: $devVars"
  Write-Host "No secret values were printed."
}

function Test-ExactCloudflareTarget {
  $account = Invoke-CloudflareApi "GET" "/accounts/$AccountId" $ApiToken
  if (-not $account -or $account.success -ne $true) { throw "Cloudflare account validation failed." }
  $actualId = [string]$account.result.id
  if ($actualId -ne $AccountId) { throw "CLOUDFLARE_TARGET_HOLD: account mismatch." }

  $projectResult = Invoke-CloudflareApi "GET" "/accounts/$AccountId/pages/projects/$Project" $ApiToken
  $projectExists = $null -ne $projectResult -and $projectResult.success -eq $true

  Write-Host "SERVICE_ID=$($Registry.service_id)"
  Write-Host "TARGET_ENV=$Environment"
  Write-Host "BILLING_MODE=$BillingMode"
  Write-Host "ACCOUNT_ALIAS=$($Registry.cloudflare_profile)"
  Write-Host "ACCOUNT_ID=$AccountId"
  Write-Host "PROJECT=$Project"
  Write-Host "PROJECT_EXISTS=$projectExists"
  return $projectExists
}

function Assert-Npx {
  if (-not (Get-Command npx -ErrorAction SilentlyContinue)) { throw "npx is required." }
}

function Create-ProjectIfMissing {
  Assert-Npx
  $exists = Test-ExactCloudflareTarget
  if ($exists) { Write-Host "Project already exists; no create needed."; return }
  if (-not $Apply) { throw "PLAN_ONLY: project missing. Re-run with -Apply to create it." }

  $env:CLOUDFLARE_ACCOUNT_ID = $AccountId
  $env:CLOUDFLARE_API_TOKEN = $ApiToken
  & npx wrangler pages project create $Project --production-branch $Branch
  if ($LASTEXITCODE -ne 0) { throw "Cloudflare Pages project creation failed." }
  $null = Test-ExactCloudflareTarget
}

function Sync-Secrets {
  Assert-Npx
  $exists = Test-ExactCloudflareTarget
  if (-not $exists) { throw "CLOUDFLARE_TARGET_HOLD: project does not exist." }
  if (-not $Apply) { throw "PLAN_ONLY: secret sync requires -Apply." }

  if ($resolvedSecrets.Count -eq 0) {
    Write-Host "No runtime secrets configured for this service/environment; nothing to sync."
    return
  }

  $temp = Join-Path ([System.IO.Path]::GetTempPath()) ("cf-secrets-" + [guid]::NewGuid().ToString("N") + ".json")
  try {
    $resolvedSecrets | ConvertTo-Json -Compress | Set-Content -LiteralPath $temp -Encoding UTF8
    $env:CLOUDFLARE_ACCOUNT_ID = $AccountId
    $env:CLOUDFLARE_API_TOKEN = $ApiToken
    & npx wrangler pages secret bulk $temp --project-name $Project
    if ($LASTEXITCODE -ne 0) { throw "Cloudflare Pages secret bulk sync failed." }
    Write-Host "SYNCED_SECRET_NAMES=$((($resolvedSecrets.Keys | Sort-Object) -join ','))"
  } finally {
    if (Test-Path $temp) { Remove-Item -LiteralPath $temp -Force }
  }
}

function Deploy-Pages {
  Assert-Npx
  $exists = Test-ExactCloudflareTarget
  if (-not $exists) { throw "CLOUDFLARE_TARGET_HOLD: project does not exist." }
  if (-not $Apply) { throw "PLAN_ONLY: deploy requires -Apply." }
  if (-not (Test-Path $AssetDir)) { throw "Asset directory missing: $AssetDir" }

  $commit = "UNKNOWN"
  if (Get-Command git -ErrorAction SilentlyContinue) {
    try { $commit = (& git -C $RepoRoot rev-parse HEAD).Trim() } catch {}
  }

  $env:CLOUDFLARE_ACCOUNT_ID = $AccountId
  $env:CLOUDFLARE_API_TOKEN = $ApiToken
  & npx wrangler pages deploy $AssetDir --project-name $Project --branch $Branch --commit-hash $commit
  if ($LASTEXITCODE -ne 0) { throw "Cloudflare Pages deploy failed." }
}

Write-Host "=== Delegated connection plan ==="
Write-Host "Service: $($Registry.service_id)"
Write-Host "Environment: $Environment"
Write-Host "Billing mode: $BillingMode"
Write-Host "Cloudflare alias: $($Registry.cloudflare_profile)"
Write-Host "Project: $Project"
Write-Host "Runtime secret names resolved: $((($resolvedSecrets.Keys | Sort-Object) -join ', '))"
Write-Host "Master env: $MasterEnvPath"

switch ($Action) {
  "doctor" { $null = Test-ExactCloudflareTarget }
  "materialize" { Materialize-LocalFiles; $null = Test-ExactCloudflareTarget }
  "create-project" { Materialize-LocalFiles; Create-ProjectIfMissing }
  "sync-secrets" { Materialize-LocalFiles; Sync-Secrets }
  "deploy" { Materialize-LocalFiles; Deploy-Pages }
  "all" {
    Materialize-LocalFiles
    Create-ProjectIfMissing
    Sync-Secrets
    Deploy-Pages
  }
}
