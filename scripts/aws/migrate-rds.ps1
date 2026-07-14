#Requires -Version 5.1
<#
.SYNOPSIS
  Apply Prisma migrations + seed against RDS using deploy/aws/out/rds-connection.txt
#>
param(
  [string]$ConnectionFile = ""
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $root

if (-not $ConnectionFile) {
  $ConnectionFile = Join-Path $root "deploy\aws\out\rds-connection.txt"
}
if (-not (Test-Path $ConnectionFile)) {
  throw "Missing $ConnectionFile — run create-rds.ps1 first (or set DATABASE_URL manually)."
}

$dbUrl = $null
Get-Content $ConnectionFile | ForEach-Object {
  if ($_ -match '^DATABASE_URL=(.+)$') { $dbUrl = $Matches[1].Trim() }
}
if (-not $dbUrl) { throw "DATABASE_URL not found in $ConnectionFile" }

$env:DATABASE_URL = $dbUrl
$env:DIRECT_URL = $dbUrl
$env:NODE_ENV = "development"

Write-Host "Running prisma migrate deploy..."
npx prisma migrate deploy
if ($LASTEXITCODE -ne 0) { throw "migrate deploy failed" }

Write-Host "Seeding..."
npx tsx prisma/seed.ts
if ($LASTEXITCODE -ne 0) { Write-Warning "Seed returned non-zero — check output." }

Write-Host "Resetting admin (uses .env PASSWORD_PEPPER if present)..."
if (Test-Path ".env") {
  node --env-file=.env --import tsx scripts/reset-admin.ts
} else {
  Write-Warning "No local .env — skip db:reset-admin or run with peppered env."
}

Write-Host "RDS schema ready."
